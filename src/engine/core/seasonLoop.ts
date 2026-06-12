import type { League } from '../../types/game';
import { ensureLeagueSchedule, SCHEDULE_WEEKS } from '../leagueSchedule';
import type { LeagueCalendar, LeagueState } from './models';

const REGULAR_SEASON_DAYS = SCHEDULE_WEEKS * 7;
const PLAYOFF_DAYS = 56;
const OFFSEASON_DAYS = 74;
const SEASON_LENGTH_DAYS = REGULAR_SEASON_DAYS + PLAYOFF_DAYS + OFFSEASON_DAYS;

function addDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function initialCalendar(dateISO = '2026-10-01'): LeagueCalendar {
  return {
    dateISO,
    day: 1,
    seasonDay: 1,
    seasonLengthDays: SEASON_LENGTH_DAYS,
    phase: 'regular_season',
  };
}

export function advanceCalendar(calendar: LeagueCalendar): LeagueCalendar {
  const day = calendar.day + 1;
  const seasonDay = calendar.seasonDay >= calendar.seasonLengthDays ? 1 : calendar.seasonDay + 1;
  let phase: LeagueCalendar['phase'] = 'regular_season';
  if (seasonDay > REGULAR_SEASON_DAYS && seasonDay <= REGULAR_SEASON_DAYS + PLAYOFF_DAYS) phase = 'playoffs';
  if (seasonDay > REGULAR_SEASON_DAYS + PLAYOFF_DAYS) {
    const offseasonDay = seasonDay - REGULAR_SEASON_DAYS - PLAYOFF_DAYS;
    if (offseasonDay <= 18) phase = 'draft';
    else if (offseasonDay <= 30) phase = 'contract_renewals';
    else if (offseasonDay <= 58) phase = 'free_agency';
    else phase = 'training_camp';
  }
  return {
    ...calendar,
    dateISO: addDays(calendar.dateISO, 1),
    day,
    seasonDay,
    phase,
  };
}

export function gamesForDate(league: League, calendar: LeagueCalendar) {
  const scheduled = ensureLeagueSchedule(league);
  if (calendar.phase !== 'regular_season' && calendar.phase !== 'trade_deadline') return [];
  const week = Math.floor((calendar.seasonDay - 1) / 7) + 1;
  const dayInWeek = ((calendar.seasonDay - 1) % 7) + 1;
  const gameSlot = dayInWeek <= 3 ? 1 : dayInWeek <= 6 ? 2 : 0;
  if (!gameSlot) return [];
  return (scheduled.schedule ?? []).filter((m) => m.week === week && m.gameInWeek === gameSlot && !m.played);
}

export function processSeasonBoundaries(state: LeagueState): LeagueState {
  const regularSeasonComplete =
    state.calendar.phase === 'regular_season' &&
    state.calendar.seasonDay >= SCHEDULE_WEEKS * 7 &&
    (state.league.schedule ?? []).every((m) => m.played);

  if (!regularSeasonComplete) return state;

  return {
    ...state,
    history: [
      {
        id: `hist-${state.league.season}-regular-season`,
        dateISO: state.calendar.dateISO,
        season: state.league.season,
        summary: `Regular season complete for ${state.league.season}.`,
      },
      ...state.history,
    ],
  };
}

