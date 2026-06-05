import type { LeagueTeam, Player, Position } from '../types/game';
import { POSITION_TARGETS, ROSTER_SIZE } from '../data/rosterBuilder';
import { takeTeamRosterName } from '../data/names';
import { hashString, pickInt } from '../lib/visuals/hash';
import { makePlayer } from '../data/scenarios';
import { marketSalary } from './salaries';

const teamRosterCache = new Map<string, Player[]>();

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function rosterOverall(team: LeagueTeam, slot: number): number {
  const seed = hashString(`${team.id}-roster-${slot}`);
  if (slot === 0) return clamp(Math.round(team.starOverall), 68, 94);
  if (slot <= 4) return clamp(Math.round(team.strength + pickInt(seed, -3, 5, 1)), 68, 90);
  if (slot <= 9) return clamp(Math.round(team.strength - 5 + pickInt(seed, -4, 4, 2)), 66, 85);
  return clamp(Math.round(team.strength - 10 + pickInt(seed, -3, 5, 3)), 65, 78);
}

function rosterAge(team: LeagueTeam, slot: number, overall: number): number {
  const seed = hashString(`${team.id}-age-${slot}`);
  if (overall >= team.starOverall - 1) return pickInt(seed, 24, 31, 1);
  if (overall >= team.strength) return pickInt(seed, 22, 30, 2);
  if (overall >= team.strength - 6) return pickInt(seed, 21, 28, 3);
  return pickInt(seed, 19, 26, 4);
}

function rosterRole(overall: number, team: LeagueTeam): Player['role'] {
  if (overall >= team.starOverall - 1) return 'Star';
  if (overall >= team.strength + 1) return 'Starter';
  if (overall >= team.strength - 4) return 'Rotation';
  if (overall >= team.strength - 8) return 'Bench';
  return 'Prospect';
}

function buildLeagueRosterPlayer(
  team: LeagueTeam,
  slot: number,
  usedNames: Set<string>,
  position: Position,
): Player {
  const seed = hashString(`${team.id}-player-${slot}`);
  const overall = rosterOverall(team, slot);
  const age = rosterAge(team, slot, overall);
  const role = rosterRole(overall, team);
  const named = takeTeamRosterName(team.city, team.name, slot, usedNames, seed);
  const playerPosition = named.position ?? position;
  const yearsRemaining = 1 + pickInt(seed, 0, 3, 5);
  const isExpiring = yearsRemaining === 1 && pickInt(seed, 0, 2, 6) === 0;
  const salary = marketSalary(overall, age);

  return makePlayer({
    id: `pl_${team.id}_${slot}`,
    firstName: named.firstName,
    lastName: named.lastName,
    position: playerPosition,
    age,
    overall,
    potential: clamp(overall + pickInt(seed, -2, 8, 4), overall, 94),
    contract: {
      yearsRemaining,
      annualSalary: salary,
      isMax: overall >= team.starOverall - 1 && salary >= 30_000_000,
      isExpiring,
    },
    role,
    isStar: overall >= team.starOverall - 2,
    gmNote: `${team.fullName} roster piece.`,
    minutesPerGame: overall >= 80 ? 30 : overall >= 75 ? 22 : overall >= 70 ? 14 : 6,
    morale: 'Stable',
    injuryRisk: age >= 30 ? 'Medium' : 'Low',
  });
}

/** Deterministic 18-man roster for any league team — cached per team id. */
export function generateTeamRoster(team: LeagueTeam): Player[] {
  const cached = teamRosterCache.get(team.id);
  if (cached) return cached;

  const usedNames = new Set<string>();
  const roster: Player[] = [];
  const counts: Record<Position, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };

  let slot = 0;
  const addAt = (position: Position) => {
    roster.push(buildLeagueRosterPlayer(team, slot, usedNames, position));
    counts[position] += 1;
    slot += 1;
  };

  (Object.keys(POSITION_TARGETS) as Position[]).forEach((position) => {
    while (counts[position] < POSITION_TARGETS[position] && roster.length < ROSTER_SIZE) {
      addAt(position);
    }
  });

  while (roster.length < ROSTER_SIZE) {
    const position = (Object.keys(POSITION_TARGETS) as Position[]).sort(
      (a, b) => POSITION_TARGETS[a] - counts[a] - (POSITION_TARGETS[b] - counts[b]),
    )[0];
    addAt(position);
  }

  roster.sort((a, b) => b.overall - a.overall);

  const rankedNames = new Set<string>();
  const reindexed = roster.map((player, index) => {
    const named = takeTeamRosterName(
      team.city,
      team.name,
      index,
      rankedNames,
      hashString(`${team.id}-name-${index}`),
    );
    return {
      ...player,
      id: `pl_${team.id}_${index}`,
      firstName: named.firstName,
      lastName: named.lastName,
      position: named.position ?? player.position,
      isStar: index === 0 || player.overall >= team.starOverall - 1,
      role: index === 0 ? ('Star' as const) : player.role,
    };
  });

  teamRosterCache.set(team.id, reindexed);
  return reindexed;
}

export function clearTeamRosterCache(): void {
  teamRosterCache.clear();
}
