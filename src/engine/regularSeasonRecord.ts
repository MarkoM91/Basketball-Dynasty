import type { Franchise, League, LeagueTeam } from '../types/game';
import { buildSeasonSchedule, scheduleRecord, SEASON_GAME_COUNT } from './schedule';

export type WinLossRecord = { wins: number; losses: number };

function clampRecordToSeasonLength(record: WinLossRecord): WinLossRecord {
  const total = record.wins + record.losses;
  if (total <= 0) return { wins: 0, losses: 0 };
  if (total <= SEASON_GAME_COUNT) return record;
  const wins = Math.round((record.wins / total) * SEASON_GAME_COUNT);
  return { wins, losses: SEASON_GAME_COUNT - wins };
}

/** User W–L from the game log + league schedule (source of truth during the season). */
export function recordFromSchedule(franchise: Franchise, league: League): WinLossRecord {
  return scheduleRecord(buildSeasonSchedule(franchise, league));
}

/** Regular-season W–L for a league team (standings / seeds — never includes playoffs). */
export function teamRegularSeasonRecord(team: LeagueTeam): WinLossRecord {
  if (team.regularWins != null && team.regularLosses != null) {
    return { wins: team.regularWins, losses: team.regularLosses };
  }
  return clampRecordToSeasonLength({ wins: team.wins, losses: team.losses });
}

/** Regular-season W–L for the user franchise — matches dashboard & standings. */
export function franchiseRegularSeasonRecord(franchise: Franchise, league?: League): WinLossRecord {
  if (franchise.regularSeasonRecord) return franchise.regularSeasonRecord;
  if (league) {
    const fromSchedule = recordFromSchedule(franchise, league);
    if (fromSchedule.wins + fromSchedule.losses > 0) return fromSchedule;
  }
  return clampRecordToSeasonLength(franchise.record);
}

/** Keep franchise.record aligned with simmed games in the game log. */
export function syncFranchiseRecordFromSchedule(franchise: Franchise, league: League): Franchise {
  if (franchise.regularSeasonRecord) return franchise;
  const reg = recordFromSchedule(franchise, league);
  if (reg.wins + reg.losses === 0) return franchise;
  return { ...franchise, record: reg };
}

export function leagueRegularSeasonComplete(league: League): boolean {
  return league.teams.every((t) => teamRegularSeasonRecord(t).wins + teamRegularSeasonRecord(t).losses === SEASON_GAME_COUNT);
}

export function leagueRecordsNeedReconcile(league: League): boolean {
  const totals = league.teams.map((t) => {
    const reg = teamRegularSeasonRecord(t);
    return reg.wins + reg.losses;
  });
  if (!totals.length) return false;
  const unique = new Set(totals);
  if (unique.size > 1) return true;
  const only = totals[0] ?? 0;
  return only > 0 && only !== SEASON_GAME_COUNT;
}

export function freezeRegularSeasonRecords(league: League): League {
  return {
    ...league,
    teams: league.teams.map((t) => {
      const reg = teamRegularSeasonRecord(t);
      return {
        ...t,
        wins: reg.wins,
        losses: reg.losses,
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
