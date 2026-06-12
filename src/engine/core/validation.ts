import type { League, Franchise } from '../../types/game';
import { advanceDay, advanceDays, createLeagueState } from './dailyLoop';
import { initialCalendar } from './seasonLoop';
import type { LeagueState } from './models';

function stableSnapshot(state: LeagueState) {
  return {
    calendar: state.calendar,
    rng: state.rng,
    standings: state.league.teams.map((t) => [t.id, t.wins, t.losses, t.ppgFor, t.ppgAgainst]),
    injuries: state.league.rosters,
    news: state.news.map((n) => [n.id, n.headline]),
    saves: state.saves,
    freeAgencyMarket: state.freeAgencyMarket,
  };
}

export function validateDeterministicAdvanceDay(league: League, franchise?: Franchise): {
  ok: boolean;
  first: unknown;
  second: unknown;
} {
  const base = createLeagueState(league, { franchise, seed: 'validation-seed' });
  const first = stableSnapshot(advanceDay(base, { simUserGames: true, autosave: true }));
  const second = stableSnapshot(advanceDay(base, { simUserGames: true, autosave: true }));
  return {
    ok: JSON.stringify(first) === JSON.stringify(second),
    first,
    second,
  };
}

export function validateHeadlessSeasonSlice(league: League, franchise?: Franchise, days = 30): {
  ok: boolean;
  gamesPlayed: number;
  newsCount: number;
  saveCount: number;
} {
  const end = advanceDays(createLeagueState(league, { franchise, seed: 'season-slice' }), days, {
    simUserGames: true,
    autosave: true,
  });
  const gamesPlayed = end.league.teams.reduce((sum, t) => sum + t.wins + t.losses, 0) / 2;
  return {
    ok: gamesPlayed > 0 && end.saves.length > 0,
    gamesPlayed,
    newsCount: end.news.length,
    saveCount: end.saves.length,
  };
}

export function validateStaticPublishingLoop(league: League, franchise?: Franchise): {
  ok: boolean;
  pendingBefore: number;
  generatedAfter: number;
  publishingNews: number;
} {
  const base = createLeagueState(league, { franchise, seed: 'static-publishing' });
  const pendingBefore = base.staticContent.filter((item) => item.dirty).length;
  const end = advanceDay(base, {
    simUserGames: true,
    autosave: false,
    publishStaticContent: true,
  });
  const generatedAfter = end.staticContent.filter((item) => item.lastGeneratedISO).length;
  const publishingNews = end.news.filter((item) => item.type === 'publishing').length;
  return {
    ok: pendingBefore > 0 && generatedAfter === base.staticContent.length && publishingNews >= pendingBefore,
    pendingBefore,
    generatedAfter,
    publishingNews,
  };
}

export function validateSeasonBoundaryLoop(league: League, franchise?: Franchise): {
  ok: boolean;
  seasonBefore: number;
  seasonAfter: number;
  phaseAfter: LeagueState['calendar']['phase'];
  gamesReset: number;
} {
  const base = createLeagueState(league, {
    franchise,
    seed: 'season-boundary',
    calendar: {
      ...initialCalendar(),
      day: 350,
      seasonDay: initialCalendar().seasonLengthDays,
      phase: 'training_camp',
    },
  });
  const end = advanceDay(base, { simUserGames: true, autosave: false });
  const gamesReset = end.league.teams.reduce((sum, team) => sum + team.wins + team.losses, 0);
  return {
    ok: end.league.season === league.season + 1 && end.calendar.seasonDay === 1 && gamesReset === 0,
    seasonBefore: league.season,
    seasonAfter: end.league.season,
    phaseAfter: end.calendar.phase,
    gamesReset,
  };
}

export function validateCoreStatisticalSanity(league: League, franchise?: Franchise): {
  ok: boolean;
  gamesPlayed: number;
  averagePpg: number;
  winLossBalanced: boolean;
  injuryEvents: number;
  developmentEvents: number;
  failures: string[];
} {
  const end = advanceDays(createLeagueState(league, { franchise, seed: 'statistical-sanity' }), 90, {
    simUserGames: true,
    autosave: false,
    maxNewsItems: 500,
  });
  const startWins = league.teams.reduce((sum, team) => sum + team.wins, 0);
  const startLosses = league.teams.reduce((sum, team) => sum + team.losses, 0);
  const teamGames = end.league.teams.reduce((sum, team) => sum + team.wins + team.losses, 0);
  const totalWins = end.league.teams.reduce((sum, team) => sum + team.wins, 0);
  const totalLosses = end.league.teams.reduce((sum, team) => sum + team.losses, 0);
  const winLossBalanced = totalWins - totalLosses === startWins - startLosses;
  const scoredTeams = end.league.teams.filter((team) => team.scoreGames > 0);
  const averagePpg =
    scoredTeams.reduce((sum, team) => sum + team.ppgFor, 0) / Math.max(1, scoredTeams.length);
  const injuryEvents = end.news.filter((item) => item.type === 'injury').length;
  const developmentEvents = end.news.filter((item) => item.type === 'development').length;
  const failures: string[] = [];

  if (teamGames <= 0) failures.push('No games were played.');
  if (!winLossBalanced) failures.push(`League wins/losses drifted from initial balance: ${totalWins}-${totalLosses}.`);
  if (averagePpg < 96 || averagePpg > 121) failures.push(`Average PPG out of range: ${averagePpg.toFixed(1)}.`);
  if (injuryEvents > 80) failures.push(`Injury event rate too high: ${injuryEvents}.`);
  if (developmentEvents > 80) failures.push(`Development event rate too high: ${developmentEvents}.`);

  return {
    ok: failures.length === 0,
    gamesPlayed: teamGames / 2,
    averagePpg: Math.round(averagePpg * 10) / 10,
    winLossBalanced,
    injuryEvents,
    developmentEvents,
    failures,
  };
}
