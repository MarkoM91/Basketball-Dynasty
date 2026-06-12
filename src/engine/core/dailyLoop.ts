import type { League, LeagueTeam } from '../../types/game';
import { ensureLeagueSchedule } from '../leagueSchedule';
import { applyGameResultToLeague, simulateGame } from './gameLoop';
import { processContractFreeAgencyAi } from './contractFreeAgencyAiLoop';
import { processInjuryFatigueMorale } from './injuryFatigueMoraleLoop';
import { processOffseason } from './offseasonLoop';
import { processOffseasonPhases } from './offseasonPhaseLoop';
import { processPlayerDevelopment } from './playerDevelopmentLoop';
import { processCorePlayoffs } from './playoffLoop';
import { advanceCalendar, gamesForDate, initialCalendar, processSeasonBoundaries } from './seasonLoop';
import { ensureStaticContentLoop, processStaticPublishing } from './staticContentLoop';
import type { AdvanceDayOptions, LeagueState, SaveCheckpoint, TeamLoopState } from './models';
import { createRng } from './rng';

function checksum(input: unknown): string {
  const raw = JSON.stringify(input);
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function defaultTeamLoopState(team: LeagueTeam): TeamLoopState {
  return {
    teamId: team.id,
    fatigue: 0,
    morale: team.wins >= team.losses ? 55 : 45,
    transactionPressure: 0,
  };
}

export function createLeagueState(
  league: League,
  options: Partial<Pick<LeagueState, 'franchise' | 'calendar' | 'staticContent'>> & { seed?: string } = {},
): LeagueState {
  const scheduled = ensureLeagueSchedule(league);
  const state: LeagueState = {
    league: scheduled,
    franchise: options.franchise,
    calendar: options.calendar ?? initialCalendar(),
    rng: { seed: options.seed ?? `${scheduled.season}-core-loop`, cursor: 0 },
    teams: Object.fromEntries(scheduled.teams.map((team) => [team.id, defaultTeamLoopState(team)])),
    news: [],
    history: [],
    saves: [],
    staticContent: options.staticContent ?? [],
    freeAgencyMarket: [],
    lastResults: [],
  };
  return ensureStaticContentLoop(state);
}

function addCheckpoint(state: LeagueState): LeagueState {
  const checkpoint: SaveCheckpoint = {
    id: `save-${state.calendar.day}`,
    dateISO: state.calendar.dateISO,
    season: state.league.season,
    checksum: checksum({
      season: state.league.season,
      day: state.calendar.day,
      standings: state.league.teams.map((t) => [t.id, t.wins, t.losses]),
      news: state.news.slice(0, 6).map((n) => n.id),
    }),
  };
  return { ...state, saves: [checkpoint, ...state.saves].slice(0, 24) };
}

function trimOutputs(state: LeagueState, maxNewsItems: number): LeagueState {
  return {
    ...state,
    news: state.news.slice(0, maxNewsItems),
    history: state.history.slice(0, 80),
  };
}

export function advanceDay(input: LeagueState, options: AdvanceDayOptions = {}): LeagueState {
  const rng = createRng(options.seed ? { seed: options.seed, cursor: input.rng.cursor } : input.rng);
  let state: LeagueState = {
    ...input,
    league: ensureLeagueSchedule(input.league),
    rng: rng.state,
  };

  const games = gamesForDate(state.league, state.calendar);
  for (const matchup of games) {
    const involvesUser =
      state.franchise &&
      (matchup.homeTeamId === state.franchise.leagueTeamId || matchup.awayTeamId === state.franchise.leagueTeamId);
    if (involvesUser && options.simUserGames === false) continue;
    const result = simulateGame({ matchup, league: state.league, franchise: state.franchise, day: state.calendar.day }, state, rng);
    if (result) state = applyGameResultToLeague(state, result);
  }

  state = processCorePlayoffs(state, rng);
  state = processOffseasonPhases(state, rng);

  state = processInjuryFatigueMorale(state, rng);
  state = processPlayerDevelopment(state, rng);
  state = processContractFreeAgencyAi(state, rng);
  state = processSeasonBoundaries(state);

  if (state.franchise) {
    const userTeam = state.league.teams.find((t) => t.id === state.franchise?.leagueTeamId);
    if (userTeam) {
      state = {
        ...state,
        franchise: {
          ...state.franchise,
          week: Math.max(1, Math.floor((state.calendar.seasonDay - 1) / 7) + 1),
          record: {
            wins: userTeam.wins,
            losses: userTeam.losses,
          },
        },
      };
    }
  }

  if (options.publishStaticContent) state = processStaticPublishing(state);
  if (options.autosave !== false) state = addCheckpoint(state);

  state = {
    ...state,
    calendar: advanceCalendar(state.calendar),
    rng: rng.state,
  };
  state = processOffseason(state);

  return trimOutputs(state, options.maxNewsItems ?? 120);
}

export function advanceDays(state: LeagueState, days: number, options: AdvanceDayOptions = {}): LeagueState {
  let next = state;
  for (let i = 0; i < days; i += 1) {
    next = advanceDay(next, options);
  }
  return next;
}
