import type { Franchise, Player, Position, ScenarioId } from '../types/game';
import { buildNameRegistry, personNameKey, takeUniqueName } from './names';
import { makePlayer, playerName } from './scenarios';
import { depthFillerSalary } from '../engine/salaries';
import { buildPlayerFromSlot, getTeamSlotRating } from '../engine/proballersPlayer';
import { getTeamParodyRoster } from './parodyRoster';

export const ROSTER_SIZE = 18;

function isOffseasonRosterFlex(phase: Franchise['phase']): boolean {
  return phase === 'draft_scouting' || phase === 'draft_night' || phase === 'contract_renewals';
}

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

function playerHasSeasonLine(existing: Player): boolean {
  return (existing.seasonStats?.games ?? 0) > 0;
}

function mergeSlotPlayer(template: Player, existing: Player, preserveRatings = false): Player {
  const played = playerHasSeasonLine(existing);
  return {
    ...template,
    id: existing.id,
    firstName: template.firstName,
    lastName: template.lastName,
    position: template.position,
    overall: played ? existing.overall : preserveRatings ? existing.overall : template.overall,
    potential: played ? existing.potential : preserveRatings ? existing.potential : template.potential,
    age: played ? existing.age : preserveRatings ? existing.age : template.age,
    minutesPerGame: played
      ? (existing.minutesPerGame ?? template.minutesPerGame)
      : template.minutesPerGame,
    contract: existing.contract,
    seasonStats: existing.seasonStats,
    priorSeasonStats: existing.priorSeasonStats ?? template.priorSeasonStats,
    role: existing.role ?? template.role,
    gmNote: existing.gmNote || template.gmNote,
    morale: existing.morale,
    isStar: existing.isStar || template.isStar,
    injured: existing.injured,
    devTrend: existing.devTrend,
    tradeValue: existing.tradeValue,
    systemFit: existing.systemFit,
    workEthic: existing.workEthic,
    injuryRisk: existing.injuryRisk,
  };
}

function matchPlayerToSlot(
  pool: Player[],
  template: Player,
  slot: number,
  team: TeamIdentity,
  claimed: Set<string>,
): Player | undefined {
  const templateKey = personNameKey(template.firstName, template.lastName);

  const byName = pool.find(
    (p) => !claimed.has(p.id) && personNameKey(p.firstName, p.lastName) === templateKey,
  );
  if (byName) return byName;

  const rated = getTeamSlotRating(team.city, team.name, slot);
  if (!rated) return undefined;

  let best: Player | undefined;
  let bestScore = Infinity;
  for (const p of pool) {
    if (claimed.has(p.id)) continue;
    const score =
      Math.abs(p.overall - rated.overall) * 3 +
      Math.abs(p.age - rated.age) +
      Math.abs(p.potential - rated.potential) * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }

  return best && bestScore <= 10 ? best : undefined;
}

/** All 18 slots use official-roster parody names + proballers profiles for league teams. */
function fillLeagueRosterTo18(core: Player[], team: TeamIdentity, scenarioId?: ScenarioId | null): Player[] {
  const preserveRatings = Boolean(scenarioId);
  const pool =
    core.length > ROSTER_SIZE
      ? [...core].sort((a, b) => b.overall - a.overall).slice(0, ROSTER_SIZE)
      : [...core];
  const usedNames = new Set<string>();
  const claimed = new Set<string>();
  const roster: Player[] = [];
  const templateSlots: number[] = [];

  for (let slot = 0; slot < ROSTER_SIZE; slot += 1) {
    const template = buildPlayerFromSlot(
      team.city,
      team.name,
      slot,
      usedNames,
      slot * 17 + slot,
    );
    const existing = matchPlayerToSlot(pool, template, slot, team, claimed);
    if (existing) {
      claimed.add(existing.id);
      roster.push(mergeSlotPlayer(template, existing, preserveRatings));
    } else {
      roster.push(template);
      templateSlots.push(slot);
    }
  }

  const unmatched = pool.filter((p) => !claimed.has(p.id)).sort((a, b) => b.overall - a.overall);
  for (let i = 0; i < templateSlots.length && i < unmatched.length; i += 1) {
    roster[templateSlots[i]] = unmatched[i];
  }

  return roster;
}

function fillerPlayer(
  position: Position,
  overall: number,
  potential: number,
  age: number,
  usedNames: Set<string>,
  salt: number,
): Player {
  const named = takeUniqueName(usedNames, salt);

  return makePlayer({
    firstName: named.firstName,
    lastName: named.lastName,
    position,
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

function fillGenericRosterTo18(core: Player[], team?: TeamIdentity): Player[] {
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
    const slot = roster.length;
    if (team) {
      roster.push(
        buildPlayerFromSlot(team.city, team.name, slot, usedNames, slot * 17 + fillerIndex),
      );
    } else {
      const ovr = Math.max(65, Math.min(76, Math.round(avgOvr - 8 - (fillerIndex % 5) + (fillerIndex % 4))));
      const pot = Math.min(88, ovr + 4 + (fillerIndex % 6));
      const age = 20 + (fillerIndex % 12);
      roster.push(fillerPlayer(pos, ovr, pot, age, usedNames, fillerIndex));
    }
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

export function leagueRosterNeedsResync(roster: Player[], team: TeamIdentity, scenarioId?: ScenarioId | null): boolean {
  if (!getTeamParodyRoster(team.city, team.name).length) return false;
  if (roster.length !== ROSTER_SIZE) return true;

  const expected = fillLeagueRosterTo18([], team, scenarioId);
  return expected.some((exp, slot) => {
    const current = roster[slot];
    if (!current) return true;
    const sameName =
      personNameKey(current.firstName, current.lastName) ===
      personNameKey(exp.firstName, exp.lastName);
    if (!sameName) return true;
    if (scenarioId) return false;
    if (playerHasSeasonLine(current)) return false;
    return Math.abs(current.overall - exp.overall) > 2;
  });
}

/** Normalize roster on load without destroying BBGM overflow or live signings. */
export function normalizeLoadedRoster(franchise: Franchise, players: Player[]): Player[] {
  const team = { city: franchise.city, name: franchise.name };
  const flexOverflow = isOffseasonRosterFlex(franchise.phase) && players.length > ROSTER_SIZE;
  // Never re-pad a roster that already has players — count is authoritative after game start.
  if (flexOverflow || players.length > 0) {
    return players;
  }

  return fillRosterTo18(players, team, franchise.scenarioId);
}

/** Ensures every franchise carries a full 18-man roster with parody names for all 30 league teams. */
export function fillRosterTo18(core: Player[], team?: TeamIdentity, scenarioId?: ScenarioId | null): Player[] {
  if (team && getTeamParodyRoster(team.city, team.name).length) {
    return fillLeagueRosterTo18(core, team, scenarioId);
  }
  return fillGenericRosterTo18(core, team);
}

export function applyRosterSize(franchise: Franchise): Franchise {
  const team = { city: franchise.city, name: franchise.name };

  // Never auto-pad a roster that already has players — padding only belongs at game creation.
  // Trades, signings, cuts, and drafts are the only legitimate way to change roster count.
  if (franchise.roster.length > 0 && franchise.roster.length <= ROSTER_SIZE) {
    return franchise;
  }

  if (franchise.roster.length > ROSTER_SIZE) {
    return franchise;
  }

  if (!leagueRosterNeedsResync(franchise.roster, team, franchise.scenarioId) && franchise.roster.length === ROSTER_SIZE) {
    return franchise;
  }
  const roster = fillRosterTo18(franchise.roster, team, franchise.scenarioId);
  const unchanged =
    roster.length === franchise.roster.length &&
    roster.every((p, i) => {
      const prev = franchise.roster[i];
      return (
        prev &&
        p.id === prev.id &&
        p.firstName === prev.firstName &&
        p.lastName === prev.lastName &&
        p.overall === prev.overall
      );
    });
  if (unchanged) return franchise;
  return { ...franchise, roster };
}

export function rosterLabel(p: Player): string {
  return playerName(p);
}
