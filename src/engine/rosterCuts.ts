import { ROSTER_SIZE } from '../data/rosterBuilder';
import { pendingRenewalCount } from './contractRenewals';
import type { Franchise, Player } from '../types/game';
import { uid } from '../data/scenarios';
import { playerName } from '../data/scenarios';

/** Roster may exceed the limit during offseason — cuts happen at training camp. */
export function isOffseasonRosterFlex(phase: Franchise['phase']): boolean {
  return (
    phase === 'draft_scouting' ||
    phase === 'draft_night' ||
    phase === 'contract_renewals' ||
    phase === 'free_agency'
  );
}

export function canWaiveForRosterSpot(phase: Franchise['phase']): boolean {
  return isOffseasonRosterFlex(phase) || phase === 'training_camp';
}

export function rosterOverCount(franchise: Franchise): number {
  return Math.max(0, franchise.roster.length - ROSTER_SIZE);
}

export function rosterCutsNeeded(franchise: Franchise): number {
  return rosterOverCount(franchise);
}

export function rosterHasRoom(franchise: Franchise): boolean {
  return franchise.roster.length < ROSTER_SIZE;
}

export function rosterFullMessage(): string {
  return `Roster full (${ROSTER_SIZE}/${ROSTER_SIZE}). Waive or trade someone before signing.`;
}

export function canOpenFreeAgency(franchise: Franchise): {
  ok: boolean;
  reason?: string;
} {
  const pending = pendingRenewalCount(franchise);
  if (pending > 0) {
    return { ok: false, reason: 'Finish all contract renewals first.' };
  }
  return { ok: true };
}

export function canOpenRegularSeason(franchise: Franchise): {
  ok: boolean;
  reason?: string;
} {
  const over = rosterOverCount(franchise);
  if (over > 0) {
    return {
      ok: false,
      reason: `Cut ${over} player${over === 1 ? '' : 's'} to reach ${ROSTER_SIZE} before opening the season.`,
    };
  }
  return { ok: true };
}

export function waiveablePlayers(franchise: Franchise): Player[] {
  return franchise.roster.filter((p) => !p.isStar && p.role !== 'Franchise Player' && p.role !== 'Star');
}

export function waiveOffseasonPlayer(franchise: Franchise, playerId: string): Franchise | null {
  if (!canWaiveForRosterSpot(franchise.phase)) return null;
  const player = franchise.roster.find((p) => p.id === playerId);
  if (!player) return null;
  if (player.isStar || player.role === 'Franchise Player' || player.role === 'Star') return null;

  const name = playerName(player);
  return {
    ...franchise,
    roster: franchise.roster.filter((p) => p.id !== playerId),
    pendingFreeAgents: [...(franchise.pendingFreeAgents ?? []), player],
    memory: [
      {
        id: uid('mem'),
        season: franchise.season,
        week: franchise.week,
        text: `Waived ${name} in the offseason to trim the roster.`,
        type: 'contract',
      },
      ...franchise.memory,
    ],
  };
}
