import type { Franchise, GameResult, League, LeagueTeam } from '../types/game';
import { normalizeLeagueTeam } from '../data/league';
import { ensureLeagueSchedule, getWeekMatchups } from './leagueSchedule';
import { buildSeasonSchedule, SEASON_GAME_COUNT } from './schedule';
import { mergeLeagueTeamScoring, simulateTeamGameScores } from './stats';

export { SEASON_GAME_COUNT };

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

export function simulateLeagueWeek(
  league: League,
  userTeamId: string,
  week: number,
  userGames: UserWeekGame[] = [],
): League {
  const scheduled = ensureLeagueSchedule(league);
  let teams = scheduled.teams.map(normalizeLeagueTeam);
  const userTeam = teams.find((t) => t.id === userTeamId);
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
      }
      continue;
    }

    const home = teams.find((t) => t.id === m.homeTeamId);
    const away = teams.find((t) => t.id === m.awayTeamId);
    if (!home || !away) continue;

    const result = simulateTeamGameScores(home.strength, away.strength, 2.5);
    teams = teams.map((t) => {
      if (t.id === home.id) return teamAfterGame(t, result.won, result.teamScore, result.oppScore);
      if (t.id === away.id) return teamAfterGame(t, !result.won, result.oppScore, result.teamScore);
      return t;
    });
  }

  if (userTeam) {
    teams = teams.map((t) => (t.id === userTeamId ? normalizeLeagueTeam(userTeam) : t));
  }

  return { ...scheduled, teams: teams.map(normalizeLeagueTeam) };
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
