import type { LeagueTeam, Player, Position } from '../types/game';
import { PROBALLERS_RATINGS, type SlotRating } from '../data/proballersRatings';
import { takeTeamRosterName } from '../data/names';
import { makePlayer } from '../data/scenarios';
import { marketSalary } from './salaries';
import { hashString, pickInt } from '../lib/visuals/hash';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function teamProballersKey(city: string, name: string): string {
  return `${city}|${name}`;
}

export function getTeamSlotRating(city: string, name: string, slot: number): SlotRating | undefined {
  return PROBALLERS_RATINGS[teamProballersKey(city, name)]?.[slot];
}

/** Top-8 average overall — used for league team strength. */
/** Star-weighted rotation strength — same weights as leagueWorld.strengthFromRoster. */
export function teamStrengthFromRatings(ratings: SlotRating[]): number {
  const weights = [1.6, 1.35, 1.2, 1.05, 1, 0.8, 0.65, 0.5, 0.35, 0.25];
  const sorted = [...ratings].sort((a, b) => b.overall - a.overall);
  let sum = 0;
  let w = 0;
  weights.forEach((x, i) => {
    sum += (sorted[i]?.overall ?? 58) * x;
    w += x;
  });
  return Math.round((sum / w) * 10) / 10;
}

export function teamStarFromRatings(ratings: SlotRating[]): number {
  return Math.max(...ratings.map((r) => r.overall));
}

function fallbackOverall(team: LeagueTeam, slot: number): number {
  const seed = hashString(`${team.id}-roster-${slot}`);
  if (slot === 0) return clamp(Math.round(team.starOverall), 68, 94);
  if (slot <= 4) return clamp(Math.round(team.strength + pickInt(seed, -3, 5, 1)), 68, 90);
  if (slot <= 9) return clamp(Math.round(team.strength - 5 + pickInt(seed, -4, 4, 2)), 66, 85);
  return clamp(Math.round(team.strength - 10 + pickInt(seed, -3, 5, 3)), 65, 78);
}

function fallbackAge(team: LeagueTeam, slot: number, overall: number): number {
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

/**
 * Parody roster data only carries coarse G/F/C buckets (SG/SF/C), which left whole leagues with no
 * point guards or power forwards. Height + per-36 rebounding/playmaking gives a real position.
 */
export function inferPosition(rated: SlotRating | undefined, fallback: Position): Position {
  if (!rated?.heightInches) return fallback;
  const h = rated.heightInches;
  const st = rated.seasonStats;
  const per36 = (v: number) => (st && st.mpg > 0 ? (v / st.mpg) * 36 : 0);
  const ast = per36(st?.apg ?? 0);
  const reb = per36(st?.rpg ?? 0);
  if (ast >= 7 && h <= 81) return 'PG';
  if (h <= 75) return ast >= 4 || fallback !== 'SF' ? 'PG' : 'SG';
  if (h <= 77) return ast >= 6 ? 'PG' : 'SG';
  if (h <= 79) return reb >= 8 ? 'SF' : ast >= 6 ? 'PG' : fallback === 'SF' ? 'SF' : 'SG';
  if (h <= 81) return reb >= 9.5 ? 'PF' : 'SF';
  if (h <= 83) return reb >= 11 && fallback === 'C' ? 'C' : 'PF';
  return 'C';
}

export function buildPlayerFromSlot(
  city: string,
  teamName: string,
  slot: number,
  usedNames: Set<string>,
  seed: number,
  team?: LeagueTeam,
  partial?: Partial<Player> & { id?: string },
): Player {
  const rated = getTeamSlotRating(city, teamName, slot);
  const named = takeTeamRosterName(city, teamName, slot, usedNames, seed);

  const overall = rated?.overall ?? (team ? fallbackOverall(team, slot) : 72);
  const potential = rated?.potential ?? clamp(overall + pickInt(seed, -2, 8, 4), overall, 94);
  const age = rated?.age ?? (team ? fallbackAge(team, slot, overall) : 24);
  const mpg = rated?.mpg ?? (overall >= 80 ? 30 : overall >= 75 ? 22 : overall >= 70 ? 14 : 6);
  const role = partial?.role ?? (team ? rosterRole(overall, team) : overall >= 85 ? 'Star' : 'Starter');
  const yearsRemaining = 1 + pickInt(seed, 0, 3, 5);
  const isExpiring = yearsRemaining === 1 && pickInt(seed, 0, 2, 6) === 0;
  const salary = marketSalary(overall, age);
  const starOverall = team?.starOverall ?? overall + 4;
  const defaultContract = {
    yearsRemaining,
    annualSalary: salary,
    isMax: overall >= starOverall - 1 && salary >= 30_000_000,
    isExpiring,
  };

  const base = {
    id: partial?.id ?? `pl_${city}_${teamName}_${slot}`,
    firstName: named.firstName,
    lastName: named.lastName,
    position: rated?.position ?? inferPosition(rated, named.position ?? partial?.position ?? 'SF'),
    age,
    overall,
    potential,
    contract: partial?.contract ? { ...defaultContract, ...partial.contract } : defaultContract,
    role,
    isStar: overall >= starOverall - 2,
    gmNote: partial?.gmNote ?? (rated?.estimated ? `${city} ${teamName} prospect — development estimate; no prior NBA season line available.` : `${city} ${teamName} roster piece.`),
    minutesPerGame: mpg,
    morale: 'Stable' as const,
    injuryRisk: (age >= 30 ? 'Medium' : 'Low') as Player['injuryRisk'],
    priorSeasonStats: rated?.estimated ? undefined : rated?.seasonStats,
    heightInches: rated?.heightInches,
  };

  return makePlayer({
    ...base,
    ...partial,
    firstName: partial?.firstName ?? base.firstName,
    lastName: partial?.lastName ?? base.lastName,
    position: partial?.position ?? base.position,
    overall,
    potential,
    age,
    minutesPerGame: partial?.minutesPerGame ?? mpg,
    contract: partial?.contract ? { ...defaultContract, ...partial.contract } : base.contract,
    priorSeasonStats: partial?.priorSeasonStats ?? base.priorSeasonStats,
  });
}
