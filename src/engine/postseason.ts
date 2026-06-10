import type { Franchise, League } from '../types/game';
import { getUserSeed, userMadePlayoffs } from './league';
import { reconcileLeagueRegularSeason } from './leagueSimulation';
import {
  freezeFranchiseRegularSeasonRecord,
  freezeRegularSeasonRecords,
  franchiseRegularSeasonRecord,
  leagueRegularSeasonComplete,
} from './regularSeasonRecord';
import { initPlayoffs } from './playoffs';
import { SCHEDULE_WEEKS, SEASON_GAME_COUNT } from './schedule';

export function regularSeasonIsComplete(franchise: Franchise, league: League): boolean {
  if (franchise.week > SCHEDULE_WEEKS) return true;
  const reg = franchiseRegularSeasonRecord(franchise, league);
  if (reg.wins + reg.losses >= SEASON_GAME_COUNT) return true;
  return leagueRegularSeasonComplete(league);
}

export function shouldBeginPostseason(franchise: Franchise, league: League): boolean {
  if (franchise.phase === 'playoffs' || franchise.phase === 'season_review') return false;
  return regularSeasonIsComplete(franchise, league);
}

export function enterPostseason(
  franchise: Franchise,
  league: League,
): { franchise: Franchise; league: League; madePlayoffs: boolean } {
  const reconciled = reconcileLeagueRegularSeason(league, franchise, franchise.leagueTeamId);
  let nextLeague = freezeRegularSeasonRecords(reconciled.league);
  let next = freezeFranchiseRegularSeasonRecord(reconciled.franchise, nextLeague);
  const madePlayoffs = userMadePlayoffs(nextLeague);

  next = {
    ...next,
    madePlayoffs,
    phase: 'playoffs',
    playoffs: initPlayoffs(nextLeague, next.leagueTeamId, madePlayoffs),
    seasonReview: undefined,
  };

  if (!madePlayoffs) {
    next.jobSecurity = Math.max(5, next.jobSecurity - 12);
  }

  return { franchise: next, league: nextLeague, madePlayoffs };
}

export function postseasonToast(madePlayoffs: boolean, franchise: Franchise, league: League): string {
  if (madePlayoffs) {
    return `Playoffs secured as the #${getUserSeed(league)} seed. Every game can end the season.`;
  }
  const reg = franchiseRegularSeasonRecord(franchise, league);
  return `Missed the top 16 (${reg.wins}–${reg.losses}) — follow the league bracket as a spectator.`;
}

/** Repair saves that jumped to season review (or playoffs phase) without a bracket. */
export function repairMissingPostseason(
  franchise: Franchise,
  league: League,
): { franchise: Franchise; league: League; repaired: boolean } {
  if (franchise.playoffs) return { franchise, league, repaired: false };
  if (!regularSeasonIsComplete(franchise, league)) return { franchise, league, repaired: false };

  const shouldRepair =
    franchise.phase === 'season_review' ||
    franchise.phase === 'playoffs';

  if (!shouldRepair) return { franchise, league, repaired: false };

  const entered = enterPostseason(franchise, league);
  return { franchise: entered.franchise, league: entered.league, repaired: true };
}
