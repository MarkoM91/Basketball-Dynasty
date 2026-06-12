import type { LeagueTeam } from '../../types/game';
import type { LeagueState, NewsEvent, TeamLoopState } from './models';

export interface CoreTeamSummary {
  teamId: string;
  name: string;
  wins: number;
  losses: number;
  winPct: number;
  gamesPlayed: number;
  fatigue: number;
  morale: number;
  transactionPressure: number;
  streakLabel: string;
  isUser: boolean;
}

export interface CoreLoopSummary {
  dateISO: string;
  season: number;
  day: number;
  seasonDay: number;
  phase: LeagueState['calendar']['phase'];
  gamesToday: number;
  standings: CoreTeamSummary[];
  userTeam?: CoreTeamSummary;
  latestNews: NewsEvent[];
  autosave?: {
    dateISO: string;
    checksum: string;
  };
  staticPublishing: {
    total: number;
    pending: number;
    generated: number;
  };
}

function winPct(team: LeagueTeam): number {
  const games = team.wins + team.losses;
  return games ? Math.round((team.wins / games) * 1000) / 1000 : 0;
}

function streakLabel(team: LeagueTeam): string {
  const pct = winPct(team);
  if (team.wins + team.losses === 0) return 'No games';
  if (pct >= 0.65) return 'Surging';
  if (pct >= 0.52) return 'Winning';
  if (pct >= 0.42) return 'Uneven';
  return 'Sliding';
}

function summarizeTeam(team: LeagueTeam, loop?: TeamLoopState): CoreTeamSummary {
  return {
    teamId: team.id,
    name: team.fullName,
    wins: team.wins,
    losses: team.losses,
    winPct: winPct(team),
    gamesPlayed: team.wins + team.losses,
    fatigue: Math.round((loop?.fatigue ?? 0) * 10) / 10,
    morale: Math.round((loop?.morale ?? 50) * 10) / 10,
    transactionPressure: Math.round((loop?.transactionPressure ?? 0) * 10) / 10,
    streakLabel: streakLabel(team),
    isUser: team.isUser,
  };
}

export function buildCoreLoopSummary(state: LeagueState): CoreLoopSummary {
  const standings = [...state.league.teams]
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.strength - a.strength)
    .map((team) => summarizeTeam(team, state.teams[team.id]));
  const userTeam = standings.find((team) => team.isUser);
  const latestSave = state.saves[0];
  const staticGenerated = state.staticContent.filter((item) => item.lastGeneratedISO).length;
  const staticPending = state.staticContent.filter((item) => item.dirty).length;

  return {
    dateISO: state.calendar.dateISO,
    season: state.league.season,
    day: state.calendar.day,
    seasonDay: state.calendar.seasonDay,
    phase: state.calendar.phase,
    gamesToday: state.lastResults.filter((game) => game.season === state.league.season).length,
    standings,
    userTeam,
    latestNews: state.news.slice(0, 8),
    autosave: latestSave
      ? {
          dateISO: latestSave.dateISO,
          checksum: latestSave.checksum,
        }
      : undefined,
    staticPublishing: {
      total: state.staticContent.length,
      pending: staticPending,
      generated: staticGenerated,
    },
  };
}
