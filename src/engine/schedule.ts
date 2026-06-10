import type { Franchise, League } from '../types/game';
import { getTeamById } from '../data/league';
import { effectiveGameStrength } from './leagueWorld';
import {
  ensureLeagueSchedule,
  getUserWeekMatchups,
  SCHEDULE_GAMES_PER_WEEK,
  SCHEDULE_WEEKS,
  SEASON_GAME_COUNT,
  TRADE_DEADLINE_WEEK,
} from './leagueSchedule';

export interface ScheduleGame {
  id: string;
  week: number;
  gameInWeek: number;
  opponentId: string;
  opponentName: string;
  home: boolean;
  played: boolean;
  won?: boolean;
  score?: string;
}

export { SCHEDULE_WEEKS, SCHEDULE_GAMES_PER_WEEK, SEASON_GAME_COUNT, TRADE_DEADLINE_WEEK };

export function buildSeasonSchedule(franchise: Franchise, league: League): ScheduleGame[] {
  const userId = franchise.leagueTeamId;
  if (!userId) return [];

  const scheduled = ensureLeagueSchedule(league);
  const games: ScheduleGame[] = [];

  for (let week = 1; week <= SCHEDULE_WEEKS; week += 1) {
    const matchups = getUserWeekMatchups(scheduled, userId, week).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    matchups.forEach((m, idx) => {
      const home = m.homeTeamId === userId;
      const opponentId = home ? m.awayTeamId : m.homeTeamId;
      const opponent = getTeamById(scheduled, opponentId);
      games.push({
        id: m.id,
        week,
        gameInWeek: idx + 1,
        opponentId,
        opponentName: opponent?.fullName ?? 'League opponent',
        home,
        played: false,
      });
    });
  }

  const log = franchise.gameLog ?? [];
  for (const game of games) {
    const match =
      log.find(
        (entry) =>
          entry.season === franchise.season &&
          entry.week === game.week &&
          entry.gameInWeek === game.gameInWeek,
      ) ??
      log.find(
        (entry) =>
          entry.season === franchise.season &&
          entry.week === game.week &&
          entry.opponent === game.opponentName,
      );

    if (match) {
      game.played = true;
      game.won = match.won;
      game.score = `${match.teamScore}–${match.oppScore}`;
    }
  }

  return games;
}

export function scheduledGameAt(
  franchise: Franchise,
  league: League,
  week: number,
  gameInWeek: number,
): ScheduleGame | undefined {
  return buildSeasonSchedule(franchise, league).find(
    (g) => g.week === week && g.gameInWeek === gameInWeek,
  );
}

export function currentScheduledGame(franchise: Franchise, league: League): ScheduleGame | undefined {
  const gameInWeek = (franchise.gamesThisWeek ?? 0) + 1;
  return scheduledGameAt(franchise, league, franchise.week, gameInWeek);
}

export function nextScheduledGame(franchise: Franchise, league: League): ScheduleGame | undefined {
  return buildSeasonSchedule(franchise, league).find((g) => !g.played && g.week >= franchise.week);
}

export function scheduleRecord(schedule: ScheduleGame[]): { wins: number; losses: number } {
  let wins = 0;
  let losses = 0;
  for (const g of schedule) {
    if (!g.played || g.won === undefined) continue;
    if (g.won) wins += 1;
    else losses += 1;
  }
  return { wins, losses };
}

export function opponentStrength(
  league: League,
  opponentId: string,
  userFranchise?: Franchise | null,
  week?: number,
): number {
  return Math.round(effectiveGameStrength(league, opponentId, userFranchise, week));
}
