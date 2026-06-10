import type { LeagueTeam, Player } from '../types/game';
import { ROSTER_SIZE } from '../data/rosterBuilder';
import { hashString } from '../lib/visuals/hash';
import { buildPlayerFromSlot } from './proballersPlayer';

const teamRosterCache = new Map<string, Player[]>();

/** Deterministic 18-man roster — one parody name + proballers profile per slot (0–17). */
export function generateTeamRoster(team: LeagueTeam): Player[] {
  const cached = teamRosterCache.get(team.id);
  if (cached) return cached;

  const usedNames = new Set<string>();
  const roster: Player[] = [];

  for (let slot = 0; slot < ROSTER_SIZE; slot += 1) {
    roster.push(
      buildPlayerFromSlot(
        team.city,
        team.name,
        slot,
        usedNames,
        hashString(`${team.id}-player-${slot}`),
        team,
        { id: `pl_${team.id}_${slot}` },
      ),
    );
  }

  roster.sort((a, b) => b.overall - a.overall);

  teamRosterCache.set(team.id, roster);
  return roster;
}

export function clearTeamRosterCache(): void {
  teamRosterCache.clear();
}
