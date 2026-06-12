import { buildLeagueSchedule } from '../leagueSchedule';
import { processStaticPublishing } from './staticContentLoop';
import type { LeagueState, NewsEvent } from './models';
import { syncCoreTeamsFromRosters } from './teamSync';

export function processOffseason(state: LeagueState): LeagueState {
  if (state.calendar.seasonDay !== 1 || state.calendar.day === 1) return state;

  const season = state.league.season + 1;
  const resetTeams = state.league.teams.map((t) => {
    const net = (t.strength - 75) * 0.35;
    return {
      ...t,
      wins: 0,
      losses: 0,
      regularWins: 0,
      regularLosses: 0,
      ppgFor: Math.round((105 + net) * 10) / 10,
      ppgAgainst: Math.round((105 - net) * 10) / 10,
      scoreGames: 0,
    };
  });
  const league = syncCoreTeamsFromRosters(
    {
      ...state.league,
      season,
      draftOrder: [],
      draftLotteryLog: [],
      teams: resetTeams,
      schedule: buildLeagueSchedule(resetTeams, season),
    },
    state.franchise,
  );

  const franchise = state.franchise
    ? {
        ...state.franchise,
        season,
        week: 1,
        phase: 'regular_season' as const,
        record: { wins: 0, losses: 0 },
        regularSeasonRecord: undefined,
        gameLog: [],
      }
    : undefined;

  const news: NewsEvent = {
    id: `news-${state.calendar.day}-season-rollover`,
    dateISO: state.calendar.dateISO,
    season,
    type: 'season',
    headline: `${season} season calendar opened.`,
    severity: 'normal',
  };

  return processStaticPublishing({
    ...state,
    league,
    franchise,
    news: [news, ...state.news],
    history: [
      {
        id: `hist-${season}-opened`,
        dateISO: state.calendar.dateISO,
        season,
        summary: `League rolled into the ${season} season.`,
      },
      ...state.history,
    ],
  });
}
