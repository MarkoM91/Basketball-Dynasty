import type { Franchise, GameResult, League, LeagueMatchup, LeagueTeam } from '../types/game';
import { getTeamById, normalizeLeagueTeam } from '../data/league';
import { ensureLeagueSchedule, getWeekMatchups } from './leagueSchedule';
import { buildSeasonSchedule, SEASON_GAME_COUNT } from './schedule';
import { initialTeamScoring, mergeLeagueTeamScoring, simulateTeamGameScores, NBA_HOME_EDGE } from './stats';
import { franchiseRegularSeasonRecord, teamRegularSeasonRecord } from './regularSeasonRecord';
import { effectiveGameStrength } from './leagueWorld';

export { SEASON_GAME_COUNT, SCHEDULE_WEEKS, TRADE_DEADLINE_WEEK } from './leagueSchedule';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** NBA-style win percentage: .720 for 59–23. */
export function formatWinPct(wins: number, losses: number): string {
  const games = wins + losses;
  if (games <= 0) return '.000';
  const thousandths = Math.round((wins / games) * 1000);
  return `.${thousandths.toString().padStart(3, '0')}`;
}

export function winPctDecimal(wins: number, losses: number): number {
  const games = wins + losses;
  return games > 0 ? wins / games : 0;
}

function teamAfterGame(
  team: LeagueTeam,
  won: boolean,
  teamScore: number,
  oppScore: number,
): LeagueTeam {
  const reg = {
    wins: team.regularWins ?? team.wins,
    losses: team.regularLosses ?? team.losses,
  };
  if (reg.wins + reg.losses >= SEASON_GAME_COUNT) {
    return normalizeLeagueTeam(team);
  }

  const scoring = mergeLeagueTeamScoring(
    {
      ppgFor: team.ppgFor,
      ppgAgainst: team.ppgAgainst,
      scoreGames: team.scoreGames ?? reg.wins + reg.losses,
    },
    teamScore,
    oppScore,
  );
  const nextReg = {
    wins: reg.wins + (won ? 1 : 0),
    losses: reg.losses + (won ? 0 : 1),
  };
  return normalizeLeagueTeam({
    ...team,
    ...scoring,
    wins: nextReg.wins,
    losses: nextReg.losses,
    regularWins: nextReg.wins,
    regularLosses: nextReg.losses,
  });
}

export interface UserWeekGame {
  opponentId: string;
  won: boolean;
  teamScore: number;
  oppScore: number;
}

export function resolveOpponentId(league: League, opponentName: string): string | undefined {
  return league.teams.find((t) => t.fullName === opponentName)?.id;
}

export function scheduledUserOpponents(
  franchise: Franchise,
  league: League,
  week: number,
): string[] {
  return buildSeasonSchedule(franchise, league)
    .filter((g) => g.week === week)
    .map((g) => g.opponentId);
}

export function applyUserGameToLeague(
  league: League,
  result: GameResult,
  opponentId?: string,
): League {
  const oppId = opponentId ?? resolveOpponentId(league, result.opponent);
  if (!oppId) return league;

  return {
    ...league,
    teams: league.teams.map((t) => {
      if (t.id === oppId) {
        return teamAfterGame(t, !result.won, result.oppScore, result.teamScore);
      }
      return normalizeLeagueTeam(t);
    }),
  };
}

/** Seed AI records to match games played while keeping league wins == league losses. */
export function seedLeagueRecords(
  teams: LeagueTeam[],
  gamesPlayed: number,
  userTeamId?: string,
  userRecord?: { wins: number; losses: number },
): LeagueTeam[] {
  if (gamesPlayed <= 0) {
    return teams.map((t) =>
      normalizeLeagueTeam({
        ...t,
        wins: t.id === userTeamId && userRecord ? userRecord.wins : 0,
        losses: t.id === userTeamId && userRecord ? userRecord.losses : 0,
        scoreGames: 0,
      }),
    );
  }

  const targetTotalWins = (teams.length * gamesPlayed) / 2;
  let seeded = teams.map((t) => {
    if (t.id === userTeamId && userRecord) {
      return normalizeLeagueTeam({
        ...t,
        wins: userRecord.wins,
        losses: userRecord.losses,
        scoreGames: gamesPlayed,
      });
    }
    const winRate = clamp(1 / (1 + Math.exp(-(t.strength - 75) / 5.5)), 0.22, 0.78);
    const wins = clamp(Math.round(gamesPlayed * winRate), 0, gamesPlayed);
    return normalizeLeagueTeam({
      ...t,
      wins,
      losses: gamesPlayed - wins,
      scoreGames: gamesPlayed,
    });
  });

  let totalWins = seeded.reduce((sum, t) => sum + t.wins, 0);
  const adjustable = () =>
    [...seeded]
      .filter((t) => t.id !== userTeamId)
      .sort((a, b) => a.strength - b.strength);

  while (totalWins < targetTotalWins) {
    const team = adjustable().find((t) => t.losses > 0);
    if (!team) break;
    seeded = seeded.map((t) =>
      t.id === team.id ? { ...t, wins: t.wins + 1, losses: t.losses - 1 } : t,
    );
    totalWins += 1;
  }

  while (totalWins > targetTotalWins) {
    const team = [...adjustable()].reverse().find((t) => t.wins > 0);
    if (!team) break;
    seeded = seeded.map((t) =>
      t.id === team.id ? { ...t, wins: t.wins - 1, losses: t.losses + 1 } : t,
    );
    totalWins -= 1;
  }

  return seeded.map(normalizeLeagueTeam);
}

function applyMatchupResult(
  teams: LeagueTeam[],
  homeId: string,
  awayId: string,
  homeWon: boolean,
  homeScore: number,
  awayScore: number,
): LeagueTeam[] {
  return teams.map((t) => {
    if (t.id === homeId) return teamAfterGame(t, homeWon, homeScore, awayScore);
    if (t.id === awayId) return teamAfterGame(t, !homeWon, awayScore, homeScore);
    return t;
  });
}

function findUserGameLogEntry(
  franchise: Franchise,
  league: League,
  matchup: LeagueMatchup,
  userTeamId: string,
) {
  const userHome = matchup.homeTeamId === userTeamId;
  const opponentId = userHome ? matchup.awayTeamId : matchup.homeTeamId;
  const opponent = getTeamById(league, opponentId);
  const opponentName = opponent?.fullName;

  return (
    franchise.gameLog.find(
      (entry) =>
        entry.season === franchise.season &&
        entry.week === matchup.week &&
        entry.gameInWeek === matchup.gameInWeek,
    ) ??
    (opponentName
      ? franchise.gameLog.find(
          (entry) =>
            entry.season === franchise.season &&
            entry.week === matchup.week &&
            entry.opponent === opponentName,
        )
      : undefined)
  );
}

function markWeekPlayed(schedule: LeagueMatchup[], week: number, matchups: LeagueMatchup[]): LeagueMatchup[] {
  const playedIds = new Set(matchups.map((m) => m.id));
  return schedule.map((m) => (m.week === week && playedIds.has(m.id) ? { ...m, played: true } : m));
}

/** Replay the full 82-game schedule so every team has identical games played. Uses user game log where available. */
export function reconcileLeagueRegularSeason(
  league: League,
  franchise: Franchise,
  userTeamId: string,
): { league: League; franchise: Franchise } {
  const scheduled = ensureLeagueSchedule(league);
  let teams = scheduled.teams.map((t) => {
    const scoring = initialTeamScoring(t.strength);
    return normalizeLeagueTeam({
      ...t,
      wins: 0,
      losses: 0,
      regularWins: 0,
      regularLosses: 0,
      ...scoring,
      scoreGames: 0,
    });
  });

  const ordered = [...(scheduled.schedule ?? [])].sort(
    (a, b) => a.week - b.week || a.gameInWeek - b.gameInWeek || a.id.localeCompare(b.id),
  );

  for (const m of ordered) {
    const home = teams.find((t) => t.id === m.homeTeamId);
    const away = teams.find((t) => t.id === m.awayTeamId);
    if (!home || !away) continue;

    const involvesUser = m.homeTeamId === userTeamId || m.awayTeamId === userTeamId;
    const logEntry = involvesUser ? findUserGameLogEntry(franchise, scheduled, m, userTeamId) : undefined;

    if (logEntry) {
      const userHome = m.homeTeamId === userTeamId;
      const homeWon = userHome ? logEntry.won : !logEntry.won;
      const homeScore = userHome ? logEntry.teamScore : logEntry.oppScore;
      const awayScore = userHome ? logEntry.oppScore : logEntry.teamScore;
      teams = applyMatchupResult(teams, m.homeTeamId, m.awayTeamId, homeWon, homeScore, awayScore);
    } else {
      const homeStr = effectiveGameStrength(scheduled, m.homeTeamId, franchise, m.week);
      const awayStr = effectiveGameStrength(scheduled, m.awayTeamId, franchise, m.week);
      const result = simulateTeamGameScores(homeStr, awayStr, NBA_HOME_EDGE);
      teams = applyMatchupResult(
        teams,
        m.homeTeamId,
        m.awayTeamId,
        result.won,
        result.teamScore,
        result.oppScore,
      );
    }
  }

  const userTeam = teams.find((t) => t.id === userTeamId);
  const userReg = userTeam
    ? teamRegularSeasonRecord(userTeam)
    : franchiseRegularSeasonRecord(franchise, scheduled);

  const syncedTeams = teams.map((t) => normalizeLeagueTeam(t));
  const nextLeague = {
    ...scheduled,
    teams: syncedTeams,
    schedule: ordered.map((m) => ({ ...m, played: true })),
  };

  const nextFranchise: Franchise = {
    ...franchise,
    record: userReg,
    regularSeasonRecord: userReg,
  };

  return { league: nextLeague, franchise: nextFranchise };
}

export function teamGamesPlayed(team: LeagueTeam): number {
  const reg = { wins: team.regularWins ?? team.wins, losses: team.regularLosses ?? team.losses };
  return reg.wins + reg.losses;
}

/** Sim any unplayed matchups through the given week (handles schedule rebuilds mid-season). */
export function catchUpLeagueThroughWeek(
  league: League,
  userTeamId: string,
  franchise: Franchise | null,
  throughWeek: number,
): League {
  const scheduled = ensureLeagueSchedule(league);
  let teams = scheduled.teams.map(normalizeLeagueTeam);
  let schedule = scheduled.schedule ?? [];

  const pending = schedule
    .filter((m) => m.week <= throughWeek && !m.played)
    .sort((a, b) => a.week - b.week || a.gameInWeek - b.gameInWeek || a.id.localeCompare(b.id));

  for (const m of pending) {
    const home = teams.find((t) => t.id === m.homeTeamId);
    const away = teams.find((t) => t.id === m.awayTeamId);
    if (!home || !away) continue;

    const involvesUser = m.homeTeamId === userTeamId || m.awayTeamId === userTeamId;
    const logEntry =
      involvesUser && franchise ? findUserGameLogEntry(franchise, scheduled, m, userTeamId) : undefined;

    if (logEntry) {
      const userHome = m.homeTeamId === userTeamId;
      const homeWon = userHome ? logEntry.won : !logEntry.won;
      const homeScore = userHome ? logEntry.teamScore : logEntry.oppScore;
      const awayScore = userHome ? logEntry.oppScore : logEntry.teamScore;
      teams = applyMatchupResult(teams, m.homeTeamId, m.awayTeamId, homeWon, homeScore, awayScore);
    } else if (!involvesUser) {
      const homeStr = effectiveGameStrength(scheduled, m.homeTeamId, franchise, m.week);
      const awayStr = effectiveGameStrength(scheduled, m.awayTeamId, franchise, m.week);
      const result = simulateTeamGameScores(homeStr, awayStr, NBA_HOME_EDGE);
      teams = applyMatchupResult(
        teams,
        m.homeTeamId,
        m.awayTeamId,
        result.won,
        result.teamScore,
        result.oppScore,
      );
    } else {
      continue;
    }

    schedule = schedule.map((entry) => (entry.id === m.id ? { ...entry, played: true } : entry));
  }

  return { ...scheduled, teams: teams.map(normalizeLeagueTeam), schedule };
}

export function simulateLeagueWeek(
  league: League,
  userTeamId: string,
  week: number,
  userGames: UserWeekGame[] = [],
  userFranchise?: Franchise | null,
): League {
  const scheduled = ensureLeagueSchedule(league);
  let teams = scheduled.teams.map(normalizeLeagueTeam);
  const matchups = getWeekMatchups(scheduled, week);
  const userByOpp = new Map(userGames.map((g) => [g.opponentId, g]));

  for (const m of matchups) {
    const involvesUser = m.homeTeamId === userTeamId || m.awayTeamId === userTeamId;

    if (involvesUser) {
      const oppId = m.homeTeamId === userTeamId ? m.awayTeamId : m.homeTeamId;
      const ug = userByOpp.get(oppId);
      if (ug) {
        teams = teams.map((t) =>
          t.id === oppId ? teamAfterGame(t, !ug.won, ug.oppScore, ug.teamScore) : t,
        );
      } else {
        const home = teams.find((t) => t.id === m.homeTeamId);
        const away = teams.find((t) => t.id === m.awayTeamId);
        if (home && away) {
          const homeStr = effectiveGameStrength(scheduled, m.homeTeamId, userFranchise, week);
          const awayStr = effectiveGameStrength(scheduled, m.awayTeamId, userFranchise, week);
          const result = simulateTeamGameScores(homeStr, awayStr, NBA_HOME_EDGE);
          const oppIsHome = oppId === m.homeTeamId;
          const oppWon = oppIsHome ? result.won : !result.won;
          const oppScore = oppIsHome ? result.teamScore : result.oppScore;
          const oppAgainst = oppIsHome ? result.oppScore : result.teamScore;
          teams = teams.map((t) =>
            t.id === oppId ? teamAfterGame(t, oppWon, oppScore, oppAgainst) : t,
          );
        }
      }
      continue;
    }

    const home = teams.find((t) => t.id === m.homeTeamId);
    const away = teams.find((t) => t.id === m.awayTeamId);
    if (!home || !away) continue;

    const homeStr = effectiveGameStrength(scheduled, m.homeTeamId, userFranchise, week);
    const awayStr = effectiveGameStrength(scheduled, m.awayTeamId, userFranchise, week);
    const result = simulateTeamGameScores(homeStr, awayStr, NBA_HOME_EDGE);
    teams = teams.map((t) => {
      if (t.id === home.id) return teamAfterGame(t, result.won, result.teamScore, result.oppScore);
      if (t.id === away.id) return teamAfterGame(t, !result.won, result.oppScore, result.teamScore);
      return t;
    });
  }

  const updatedSchedule = markWeekPlayed(scheduled.schedule ?? [], week, matchups);

  return { ...scheduled, teams: teams.map(normalizeLeagueTeam), schedule: updatedSchedule };
}

export function userWeekResultsFromGames(
  results: GameResult[],
  opponentIds: string[],
): UserWeekGame[] {
  return results.map((result, index) => ({
    opponentId: opponentIds[index] ?? result.opponent,
    won: result.won,
    teamScore: result.teamScore,
    oppScore: result.oppScore,
  }));
}
