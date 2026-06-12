import type { League, PlayoffRound, PlayoffSeries, PlayoffState } from '../../types/game';
import { getStandings, getTeamById } from '../../data/league';
import { PLAYOFF_TEAM_COUNT } from '../playoffs';
import { NBA_HOME_EDGE, NBA_WIN_PROB_SCALE } from '../stats';
import type { LeagueState, NewsEvent } from './models';
import type { Rng } from './rng';
import { syncCoreTeamsFromRosters } from './teamSync';

const ROUND_ORDER: PlayoffRound[] = ['First Round', 'Quarterfinals', 'Semifinals', 'Finals', 'Complete'];

function makeSeries(
  round: PlayoffRound,
  higher: { teamId: string; seed: number },
  lower: { teamId: string; seed: number },
  userTeamId: string,
): PlayoffSeries {
  return {
    id: `core-series-${round}-${higher.seed}-${lower.seed}-${higher.teamId}-${lower.teamId}`,
    round,
    higherSeed: higher,
    lowerSeed: lower,
    higherWins: 0,
    lowerWins: 0,
    games: [],
    complete: false,
    userInvolved: higher.teamId === userTeamId || lower.teamId === userTeamId,
  };
}

function pairWinners(
  winners: { teamId: string; seed: number }[],
  round: PlayoffRound,
  userTeamId: string,
): PlayoffSeries[] {
  const sorted = [...winners].sort((a, b) => a.seed - b.seed);
  const series: PlayoffSeries[] = [];
  for (let i = 0; i < sorted.length / 2; i += 1) {
    series.push(makeSeries(round, sorted[i], sorted[sorted.length - 1 - i], userTeamId));
  }
  return series;
}

function initCorePlayoffs(league: League, userTeamId: string): PlayoffState {
  const standings = getStandings(league).slice(0, PLAYOFF_TEAM_COUNT);
  const seeded = standings.map((team, index) => ({ teamId: team.id, seed: index + 1 }));
  const userQualified = seeded.some((team) => team.teamId === userTeamId);
  return {
    active: true,
    round: 'First Round',
    series: pairWinners(seeded, 'First Round', userTeamId),
    bracketHistory: [],
    userEliminated: !userQualified,
    userResult: userQualified ? undefined : 'Missed playoffs',
  };
}

function nextRound(round: PlayoffRound): PlayoffRound {
  return ROUND_ORDER[Math.min(ROUND_ORDER.length - 1, ROUND_ORDER.indexOf(round) + 1)];
}

function teamStrength(league: League, teamId: string): number {
  return getTeamById(league, teamId)?.strength ?? 75;
}

function simSeriesGame(series: PlayoffSeries, league: League, rng: Rng): PlayoffSeries {
  if (series.complete) return series;
  const homeTeamId = series.games.length % 2 === 0 ? series.higherSeed.teamId : series.lowerSeed.teamId;
  const awayTeamId = homeTeamId === series.higherSeed.teamId ? series.lowerSeed.teamId : series.higherSeed.teamId;
  const home = getTeamById(league, homeTeamId);
  const away = getTeamById(league, awayTeamId);
  const adjusted = teamStrength(league, homeTeamId) + NBA_HOME_EDGE + 0.5 - teamStrength(league, awayTeamId) + (rng.next() - 0.5) * 12;
  const homeWon = rng.chance(1 / (1 + Math.exp(-adjusted / NBA_WIN_PROB_SCALE)));
  const base = 104 + Math.round((rng.next() - 0.5) * 10);
  const margin = Math.max(1, Math.round(Math.abs(adjusted) * 0.3 + rng.next() * 8));
  const homeScore = homeWon ? base + margin : base - margin;
  const awayScore = homeWon ? base - margin : base + margin;
  const winnerId = homeWon ? homeTeamId : awayTeamId;
  const higherWins = series.higherWins + (winnerId === series.higherSeed.teamId ? 1 : 0);
  const lowerWins = series.lowerWins + (winnerId === series.lowerSeed.teamId ? 1 : 0);
  const complete = higherWins >= 4 || lowerWins >= 4;
  return {
    ...series,
    higherWins,
    lowerWins,
    complete,
    winnerId: complete ? winnerId : series.winnerId,
    games: [
      ...series.games,
      {
        homeTeamId,
        awayTeamId,
        homeScore,
        awayScore,
        winnerId,
        note: Math.abs(homeScore - awayScore) >= 15 ? 'Rotation mismatch decided it.' : 'Playoff possessions were tight late.',
        playByPlay: [
          `${home?.fullName ?? 'Home'} hosted ${away?.fullName ?? 'Away'} in ${series.round}.`,
          `Final: ${homeScore}-${awayScore}.`,
        ],
      },
    ],
  };
}

function advanceRound(state: PlayoffState, league: League, userTeamId: string): PlayoffState {
  const history = [...(state.bracketHistory ?? []), ...state.series.filter((series) => series.complete)];
  if (state.round === 'Finals') {
    const championTeamId = state.series[0]?.winnerId;
    const champion = championTeamId ? getTeamById(league, championTeamId) : undefined;
    const userWon = championTeamId === userTeamId;
    return {
      ...state,
      active: false,
      round: 'Complete',
      bracketHistory: history,
      championTeamId,
      championName: champion?.fullName,
      userEliminated: !userWon,
      userResult: userWon ? 'Champions' : state.userEliminated ? state.userResult : 'Finals loss',
    };
  }
  const round = nextRound(state.round);
  const winners = state.series.map((series) => {
    const teamId = series.winnerId!;
    return {
      teamId,
      seed: teamId === series.higherSeed.teamId ? series.higherSeed.seed : series.lowerSeed.seed,
    };
  });
  return {
    ...state,
    round,
    bracketHistory: history,
    series: pairWinners(winners, round, userTeamId),
  };
}

export function processCorePlayoffs(state: LeagueState, rng: Rng): LeagueState {
  if (state.calendar.phase !== 'playoffs') return state;
  const userTeamId = state.franchise?.leagueTeamId ?? state.league.teams.find((team) => team.isUser)?.id ?? '';
  let playoffs = state.franchise?.playoffs;
  if (!playoffs?.active && playoffs?.round !== 'Complete') {
    playoffs = initCorePlayoffs(state.league, userTeamId);
  }
  if (!playoffs?.active || playoffs.round === 'Complete') return state;

  const targetIndex = playoffs.series.findIndex((series) => !series.complete);
  if (targetIndex < 0) {
    playoffs = advanceRound(playoffs, state.league, userTeamId);
  } else {
    const series = simSeriesGame(playoffs.series[targetIndex], state.league, rng);
    const last = series.games[series.games.length - 1];
    const home = getTeamById(state.league, last.homeTeamId);
    const away = getTeamById(state.league, last.awayTeamId);
    const nextSeries = playoffs.series.map((item, index) => (index === targetIndex ? series : item));
    let userEliminated = playoffs.userEliminated;
    let userResult = playoffs.userResult;
    if (series.complete && series.userInvolved && series.winnerId !== userTeamId) {
      userEliminated = true;
      userResult = `${series.round} exit`;
    }
    playoffs = { ...playoffs, series: nextSeries, userEliminated, userResult };
    if (nextSeries.every((item) => item.complete)) {
      playoffs = advanceRound(playoffs, state.league, userTeamId);
    }
    const news: NewsEvent = {
      id: `news-${state.calendar.day}-${series.id}-g${series.games.length}`,
      dateISO: state.calendar.dateISO,
      season: state.league.season,
      type: 'game',
      headline: `Playoffs: ${home?.fullName ?? 'Home'} ${last.homeScore}-${last.awayScore} ${away?.fullName ?? 'Away'}.`,
      teamId: last.winnerId,
      severity: series.complete ? 'major' : 'normal',
    };
    return {
      ...state,
      league: syncCoreTeamsFromRosters(state.league, state.franchise),
      franchise: state.franchise ? { ...state.franchise, playoffs, phase: playoffs.round === 'Complete' ? 'season_review' : 'playoffs' } : state.franchise,
      news: [news, ...state.news],
    };
  }

  return {
    ...state,
    franchise: state.franchise ? { ...state.franchise, playoffs, phase: playoffs.round === 'Complete' ? 'season_review' : 'playoffs' } : state.franchise,
  };
}

