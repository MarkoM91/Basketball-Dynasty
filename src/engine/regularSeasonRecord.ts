import type { Franchise, League, LeagueTeam } from '../types/game';
import { buildSeasonSchedule, scheduleRecord } from './schedule';
import { SEASON_GAME_COUNT } from './schedule';

export type WinLossRecord = { wins: number; losses: number };

function clampRecordToSeasonLength(record: WinLossRecord): WinLossRecord {
  const total = record.wins + record.losses;
  if (total <= 0) return { wins: 0, losses: 0 };
  if (total <= SEASON_GAME_COUNT) return record;
  const wins = Math.round((record.wins / total) * SEASON_GAME_COUNT);
  return { wins, losses: SEASON_GAME_COUNT - wins };
}

/** Regular-season W–L for a league team (standings / seeds — never includes playoffs). */
export function teamRegularSeasonRecord(team: LeagueTeam): WinLossRecord {
  if (team.regularWins != null && team.regularLosses != null) {
    return { wins: team.regularWins, losses: team.regularLosses };
  }
  return clampRecordToSeasonLength({ wins: team.wins, losses: team.losses });
}

/** Regular-season W–L for the user franchise. */
export function franchiseRegularSeasonRecord(franchise: Franchise, league?: League): WinLossRecord {
  if (franchise.regularSeasonRecord) return franchise.regularSeasonRecord;
  if (league) {
    return scheduleRecord(buildSeasonSchedule(franchise, league));
  }
  return clampRecordToSeasonLength(franchise.record);
}

export function freezeRegularSeasonRecords(league: League): League {
  return {
    ...league,
    teams: league.teams.map((t) => {
      const reg = teamRegularSeasonRecord(t);
      return {
        ...t,
        regularWins: reg.wins,
        regularLosses: reg.losses,
      };
    }),
  };
}

export function freezeFranchiseRegularSeasonRecord(
  franchise: Franchise,
  league?: League,
): Franchise {
  const reg = franchiseRegularSeasonRecord(franchise, league);
  return {
    ...franchise,
    regularSeasonRecord: reg,
    record: reg,
  };
}
