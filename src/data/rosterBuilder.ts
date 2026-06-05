import type { Franchise, Player, Position } from '../types/game';
import { buildNameRegistry, takeTeamRosterName, takeUniqueName } from './names';
import { makePlayer, playerName } from './scenarios';
import { depthFillerSalary } from '../engine/salaries';

export const ROSTER_SIZE = 18;

export const POSITION_TARGETS: Record<Position, number> = {
  PG: 3,
  SG: 3,
  SF: 4,
  PF: 4,
  C: 4,
};

function countByPosition(roster: Player[]): Record<Position, number> {
  const counts: Record<Position, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  for (const p of roster) counts[p.position] += 1;
  return counts;
}

type TeamIdentity = { city: string; name: string };

function fillerPlayer(
  position: Position,
  overall: number,
  potential: number,
  age: number,
  usedNames: Set<string>,
  salt: number,
  team?: TeamIdentity,
  nameSlot = 0,
): Player {
  let firstName: string;
  let lastName: string;
  let playerPosition = position;

  if (team) {
    const named = takeTeamRosterName(team.city, team.name, nameSlot, usedNames, salt);
    firstName = named.firstName;
    lastName = named.lastName;
    if (named.position) playerPosition = named.position;
  } else {
    const named = takeUniqueName(usedNames, salt);
    firstName = named.firstName;
    lastName = named.lastName;
  }

  return makePlayer({
    firstName,
    lastName,
    position: playerPosition,
    age,
    overall,
    potential,
    role: overall >= 78 ? 'Rotation' : overall >= 72 ? 'Bench' : 'Prospect',
    contract: {
      yearsRemaining: 1 + (salt % 3),
      annualSalary: depthFillerSalary(overall, age),
      isMax: false,
      isExpiring: salt % 4 === 0,
    },
    minutesPerGame: overall >= 75 ? 18 : overall >= 70 ? 12 : 6,
    gmNote: 'Depth piece on a standard 18-man roster.',
    morale: 'Stable',
    injuryRisk: age >= 30 ? 'Medium' : 'Low',
  });
}

/** Ensures every franchise carries a full 18-man NBA-style roster. */
export function fillRosterTo18(core: Player[], team?: TeamIdentity): Player[] {
  let roster =
    core.length > ROSTER_SIZE
      ? [...core].sort((a, b) => b.overall - a.overall).slice(0, ROSTER_SIZE)
      : [...core];

  if (roster.length >= ROSTER_SIZE) return roster;
  const counts = countByPosition(roster);
  const usedNames = buildNameRegistry([roster]);
  let fillerIndex = 0;

  const avgOvr = roster.reduce((s, p) => s + p.overall, 0) / Math.max(1, roster.length);

  const addAt = (pos: Position) => {
    const ovr = Math.max(65, Math.min(76, Math.round(avgOvr - 8 - (fillerIndex % 5) + (fillerIndex % 4))));
    const pot = Math.min(88, ovr + 4 + (fillerIndex % 6));
    const age = 20 + (fillerIndex % 12);
    roster.push(
      fillerPlayer(pos, ovr, pot, age, usedNames, fillerIndex, team, roster.length + fillerIndex),
    );
    counts[pos] += 1;
    fillerIndex += 1;
  };

  (Object.keys(POSITION_TARGETS) as Position[]).forEach((pos) => {
    while (counts[pos] < POSITION_TARGETS[pos] && roster.length < ROSTER_SIZE) {
      addAt(pos);
    }
  });

  while (roster.length < ROSTER_SIZE) {
    const pos = (Object.keys(POSITION_TARGETS) as Position[]).sort(
      (a, b) => POSITION_TARGETS[a] - counts[a] - (POSITION_TARGETS[b] - counts[b]),
    )[0];
    addAt(pos);
  }

  return roster;
}

export function applyRosterSize(franchise: Franchise): Franchise {
  const roster = fillRosterTo18(franchise.roster, { city: franchise.city, name: franchise.name });
  if (roster.length === franchise.roster.length && roster.every((p, i) => p.id === franchise.roster[i]?.id)) {
    return franchise;
  }
  return { ...franchise, roster };
}

export function rosterLabel(p: Player): string {
  return playerName(p);
}
