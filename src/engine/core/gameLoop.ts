import type { GameLogEntry, League, LeagueTeam, Player, PlayerSeasonStats } from '../../types/game';
import { getTeamById, normalizeLeagueTeam } from '../../data/league';
import { playerName } from '../../data/scenarios';
import { NBA_HOME_EDGE, NBA_WIN_PROB_SCALE, mergeLeagueTeamScoring } from '../stats';
import { getTeamRoster, setTeamRoster, strengthFromRoster } from '../leagueWorld';
import type { GameSimulationInput, HeadlessGameResult, LeagueState, NewsEvent } from './models';
import type { Rng } from './rng';
import { syncCoreTeamsFromRosters } from './teamSync';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function mergeStats(
  current: PlayerSeasonStats | undefined,
  box: { pts: number; reb: number; ast: number; min: number },
): PlayerSeasonStats {
  const prev = current ?? { games: 0, ppg: 0, rpg: 0, apg: 0, mpg: 0 };
  const games = prev.games + 1;
  return {
    games,
    ppg: Math.round(((prev.ppg * prev.games + box.pts) / games) * 10) / 10,
    rpg: Math.round(((prev.rpg * prev.games + box.reb) / games) * 10) / 10,
    apg: Math.round(((prev.apg * prev.games + box.ast) / games) * 10) / 10,
    mpg: Math.round(((prev.mpg * prev.games + box.min) / games) * 10) / 10,
  };
}

function playerBox(player: Player, rng: Rng): { pts: number; reb: number; ast: number; min: number } {
  const usage = clamp(player.minutesPerGame / 36, 0.1, 1.1);
  const variance = 0.75 + rng.next() * 0.55;
  const pos = player.position;
  const pts = (7 + player.overall * 0.28 + (pos === 'SG' || pos === 'SF' ? 3 : 0)) * usage * variance;
  const reb = (2 + player.overall * 0.06 + (pos === 'C' || pos === 'PF' ? 4 : 0)) * usage * variance;
  const ast = (1.5 + player.overall * 0.05 + (pos === 'PG' ? 4 : pos === 'SG' ? 1.5 : 0)) * usage * variance;
  const min = clamp(player.minutesPerGame * variance, 5, 39);
  return {
    pts: Math.max(0, Math.round(pts)),
    reb: Math.max(0, Math.round(reb)),
    ast: Math.max(0, Math.round(ast)),
    min: Math.round(min),
  };
}

function updateRecord(team: LeagueTeam, won: boolean, forScore: number, againstScore: number): LeagueTeam {
  const wins = (team.regularWins ?? team.wins) + (won ? 1 : 0);
  const losses = (team.regularLosses ?? team.losses) + (won ? 0 : 1);
  const scoring = mergeLeagueTeamScoring(
    {
      ppgFor: team.ppgFor,
      ppgAgainst: team.ppgAgainst,
      scoreGames: team.scoreGames ?? team.wins + team.losses,
    },
    forScore,
    againstScore,
  );
  return normalizeLeagueTeam({
    ...team,
    ...scoring,
    wins,
    losses,
    regularWins: wins,
    regularLosses: losses,
  });
}

function topLine(roster: Player[]): { scorer?: { name: string; pts: number }; rebounder?: { name: string; reb: number }; assister?: { name: string; ast: number } } {
  const played = roster.filter((p) => p.seasonStats && p.seasonStats.games > 0);
  const scorer = [...played].sort((a, b) => (b.seasonStats?.ppg ?? 0) - (a.seasonStats?.ppg ?? 0))[0];
  const rebounder = [...played].sort((a, b) => (b.seasonStats?.rpg ?? 0) - (a.seasonStats?.rpg ?? 0))[0];
  const assister = [...played].sort((a, b) => (b.seasonStats?.apg ?? 0) - (a.seasonStats?.apg ?? 0))[0];
  return {
    scorer: scorer ? { name: playerName(scorer), pts: Math.round(scorer.seasonStats?.ppg ?? 0) } : undefined,
    rebounder: rebounder ? { name: playerName(rebounder), reb: Math.round(rebounder.seasonStats?.rpg ?? 0) } : undefined,
    assister: assister ? { name: playerName(assister), ast: Math.round(assister.seasonStats?.apg ?? 0) } : undefined,
  };
}

export function simulateGame(input: GameSimulationInput, state: LeagueState, rng: Rng): HeadlessGameResult | null {
  const home = getTeamById(input.league, input.matchup.homeTeamId);
  const away = getTeamById(input.league, input.matchup.awayTeamId);
  if (!home || !away) return null;

  const homeRoster = getTeamRoster(input.league, home, input.franchise);
  const awayRoster = getTeamRoster(input.league, away, input.franchise);
  const homeFatigue = state.teams[home.id]?.fatigue ?? 0;
  const awayFatigue = state.teams[away.id]?.fatigue ?? 0;
  const homeMorale = state.teams[home.id]?.morale ?? 0;
  const awayMorale = state.teams[away.id]?.morale ?? 0;
  const homeStrength = strengthFromRoster(homeRoster) - homeFatigue * 0.12 + homeMorale * 0.04 + NBA_HOME_EDGE;
  const awayStrength = strengthFromRoster(awayRoster) - awayFatigue * 0.12 + awayMorale * 0.04;
  const adjusted = homeStrength - awayStrength + (rng.next() - 0.5) * 13;
  const homeWinProbability = 1 / (1 + Math.exp(-adjusted / NBA_WIN_PROB_SCALE));
  const homeWon = rng.chance(homeWinProbability);
  const base = 108 + Math.round((rng.next() - 0.5) * 12);
  const margin = Math.round(Math.abs(adjusted) * 0.32 + rng.next() * 9 + 1);
  const homeScore = clamp(homeWon ? base + margin : base - margin, 82, 145);
  const awayScore = clamp(homeWon ? base - margin : base + margin, 82, 145);

  const updateRoster = (roster: Player[]) => {
    const rotation = roster
      .filter((p) => !p.injured)
      .sort((a, b) => b.minutesPerGame - a.minutesPerGame || b.overall - a.overall)
      .slice(0, 9);
    return roster.map((p) => {
      if (!rotation.some((r) => r.id === p.id)) return p;
      return { ...p, seasonStats: mergeStats(p.seasonStats, playerBox(p, rng)) };
    });
  };

  const nextHomeRoster = updateRoster(homeRoster);
  const nextAwayRoster = updateRoster(awayRoster);
  const updatedHome = updateRecord(home, homeWon, homeScore, awayScore);
  const updatedAway = updateRecord(away, !homeWon, awayScore, homeScore);
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;
  const news: NewsEvent[] = [
    {
      id: `news-${state.calendar.day}-${input.matchup.id}-game`,
      dateISO: state.calendar.dateISO,
      season: state.league.season,
      type: 'game',
      headline: `${winner.fullName} beat ${loser.fullName}, ${homeScore}-${awayScore}.`,
      teamId: winner.id,
      severity: Math.abs(homeScore - awayScore) >= 18 ? 'major' : 'normal',
    },
  ];

  const logEntries: GameLogEntry[] = [];
  for (const team of [home, away]) {
    if (!team.isUser) continue;
    const isHome = team.id === home.id;
    const opponent = isHome ? away : home;
    const userRoster = isHome ? nextHomeRoster : nextAwayRoster;
    const line = topLine(userRoster);
    logEntries.push({
      id: `gm-${state.calendar.day}-${input.matchup.id}-${team.id}`,
      season: state.league.season,
      week: input.matchup.week,
      gameInWeek: input.matchup.gameInWeek,
      opponent: opponent.fullName,
      home: isHome,
      teamScore: isHome ? homeScore : awayScore,
      oppScore: isHome ? awayScore : homeScore,
      won: isHome ? homeWon : !homeWon,
      note: isHome === homeWon ? 'Rotation executed the plan in a clean sim.' : 'Thin margins and fatigue showed up late.',
      topScorer: line.scorer,
      topRebounder: line.rebounder,
      topAssister: line.assister,
    });
  }

  return {
    matchup: input.matchup,
    homeScore,
    awayScore,
    winnerId: homeWon ? home.id : away.id,
    logEntries,
    news,
    playerUpdates: {
      [home.id]: nextHomeRoster,
      [away.id]: nextAwayRoster,
    },
    teamUpdates: [updatedHome, updatedAway],
  };
}

export function applyGameResultToLeague(state: LeagueState, result: HeadlessGameResult): LeagueState {
  let league: League = {
    ...state.league,
    teams: state.league.teams.map((team) => result.teamUpdates.find((t) => t.id === team.id) ?? team),
    schedule: (state.league.schedule ?? []).map((m) =>
      m.id === result.matchup.id ? { ...m, played: true } : m,
    ),
  };

  for (const team of result.teamUpdates) {
    const roster = result.playerUpdates[team.id];
    if (roster) league = setTeamRoster(league, team, roster);
  }

  league = syncCoreTeamsFromRosters(league, state.franchise);
  const userLog = result.logEntries[0];
  const franchise =
    state.franchise && userLog
      ? {
          ...state.franchise,
          record: {
            wins: state.franchise.record.wins + (userLog.won ? 1 : 0),
            losses: state.franchise.record.losses + (userLog.won ? 0 : 1),
          },
          gameLog: [userLog, ...(state.franchise.gameLog ?? [])].slice(0, 96),
          roster: result.playerUpdates[state.franchise.leagueTeamId] ?? state.franchise.roster,
        }
      : state.franchise;

  return {
    ...state,
    league,
    franchise,
    lastResults: [...result.logEntries, ...state.lastResults].slice(0, 12),
    news: [...result.news, ...state.news],
    teams: {
      ...state.teams,
      [result.matchup.homeTeamId]: {
        ...state.teams[result.matchup.homeTeamId],
        teamId: result.matchup.homeTeamId,
        fatigue: clamp((state.teams[result.matchup.homeTeamId]?.fatigue ?? 0) + 9, 0, 100),
        lastGameDay: state.calendar.day,
      },
      [result.matchup.awayTeamId]: {
        ...state.teams[result.matchup.awayTeamId],
        teamId: result.matchup.awayTeamId,
        fatigue: clamp((state.teams[result.matchup.awayTeamId]?.fatigue ?? 0) + 11, 0, 100),
        lastGameDay: state.calendar.day,
      },
    },
  };
}
