import type { Player } from '../types/game';

const ROOKIE_SCALE_MIN = 2_000_000;
const ROOKIE_SCALE_MAX = 11_500_000;

function looksLikeRookieScale(player: Player): boolean {
  if (player.age > 23) return false;
  const { yearsRemaining, annualSalary } = player.contract;
  if (yearsRemaining < 1 || yearsRemaining > 4) return false;
  return annualSalary >= ROOKIE_SCALE_MIN && annualSalary <= ROOKIE_SCALE_MAX;
}

/** Infer draft year from a standard 4-year rookie deal when saves lack metadata. */
function inferDraftSeason(player: Player, season: number): number | undefined {
  if (player.draftSeason !== undefined) return player.draftSeason;
  if (player.contract.signedVia === 'rookie' || looksLikeRookieScale(player)) {
    const yearsLeft = player.contract.yearsRemaining;
    if (yearsLeft >= 1 && yearsLeft <= 4) {
      return season - (4 - yearsLeft);
    }
  }
  return undefined;
}

/** True for players in their first NBA season on the roster. */
export function isRookie(player: Player, season: number): boolean {
  return inferDraftSeason(player, season) === season;
}

export function rosterRookies(roster: Player[], season: number): Player[] {
  return roster.filter((p) => isRookie(p, season));
}

/** Draft slot label for roster table, e.g. "#12". */
export function rookiePickLabel(player: Player, season: number): string | null {
  if (!isRookie(player, season)) return null;
  if (player.draftPick !== undefined) return `#${player.draftPick}`;
  return 'R';
}

export function rookieDraftSeason(player: Player, season: number): number | undefined {
  return inferDraftSeason(player, season);
}
