/**
 * Game plan, team styles and fatigue.
 *
 * The plan persists between games. Each choice is scored against YOUR roster profile and the
 * OPPONENT's, so the same plan is right against one team and wrong against another:
 *  - Focus (inside / balanced / threes): your shooting or inside scoring vs their perimeter or
 *    rim defense.
 *  - Defense (drop / switch / trap their star): what you're good at defending vs what they do.
 *  - Pace (slow / normal / fast): athleticism and stamina edge, and it changes the RANDOMNESS of
 *    the game — fast helps underdogs, slow protects favourites.
 *  - Rotation (8 / 9 / 10): how heavily the top players count tonight, and how tired they get.
 * Fatigue lowers a player's effective rating and raises injury risk; resting him tonight costs a
 * little now and keeps him fresh.
 *
 * Every number here is used by BOTH the sim and the Game Day odds, so the odds are honest.
 * Edges are in unamplified strength points (≈ 3–4% win chance each near 50/50).
 */
import type { Franchise, GamePlan, League, LeagueTeam, Player } from '../types/game';
import { getTeamById } from '../data/league';
import { derivePlayerRatings } from '../lib/playerRatings';
import { getTeamRoster } from './leagueWorld';

export const DEFAULT_GAME_PLAN: GamePlan = { pace: 'normal', focus: 'balanced', defense: 'switch', rotation: 9 };

export function planOf(franchise: Franchise): GamePlan {
  return { ...DEFAULT_GAME_PLAN, ...(franchise.gamePlan ?? {}) };
}

// ── Fatigue ──────────────────────────────────────────────────────────────────
/** Rating points lost to fatigue: nothing up to 50, then up to −6 at 100. */
export function fatiguePenalty(fatigue = 0): number {
  return fatigue <= 50 ? 0 : ((Math.min(100, fatigue) - 50) / 50) * 6;
}

export function effectiveOverall(p: Player): number {
  return p.overall - fatiguePenalty(p.fatigue);
}

export function fatigueLabel(fatigue = 0): 'Fresh' | 'Tired' | 'Exhausted' {
  return fatigue >= 75 ? 'Exhausted' : fatigue >= 50 ? 'Tired' : 'Fresh';
}

/** Fatigue added per game. Fatigue settles at load / RECOVERY_RATE: tight 8 ≈ 67, normal ≈ 47, deep ≈ 33. */
const STARTER_LOAD: Record<GamePlan['rotation'], number> = { 8: 20, 9: 14, 10: 10 };
const BENCH_LOAD = 6;
const PACE_LOAD: Record<GamePlan['pace'], number> = { slow: 0.9, normal: 1, fast: 1.15 };
const RECOVERY_RATE = 0.3;
const REST_RECOVERY = 25;

/** Rested players sit out tonight: for this game they count as unavailable (like injured). */
export function withRestApplied(franchise: Franchise): Franchise {
  const rest = franchise.restTonight ?? [];
  if (!rest.length) return franchise;
  return { ...franchise, roster: franchise.roster.map((p) => (rest.includes(p.id) ? { ...p, injured: true } : p)) };
}

/** Fatigue after one game: everyone recovers some, the rotation pays for its minutes. */
export function applyGameFatigue(roster: Player[], starterIds: string[], plan: GamePlan, restIds: string[] = []): Player[] {
  const healthy = roster.filter((p) => !p.injured && !restIds.includes(p.id));
  const starters = new Set(starterIds.filter((id) => healthy.some((p) => p.id === id)));
  const bench = healthy
    .filter((p) => !starters.has(p.id))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, Math.max(0, plan.rotation - starters.size));
  const benchIds = new Set(bench.map((p) => p.id));
  const pace = PACE_LOAD[plan.pace];
  return roster.map((p) => {
    const before = p.fatigue ?? 0;
    let f = before * (1 - RECOVERY_RATE);
    if (restIds.includes(p.id)) f -= REST_RECOVERY;
    else if (starters.has(p.id)) f += STARTER_LOAD[plan.rotation] * pace;
    else if (benchIds.has(p.id)) f += BENCH_LOAD * pace;
    const next = Math.round(Math.max(0, Math.min(100, f)));
    return next === before ? p : { ...p, fatigue: next };
  });
}

/** Rotation weights (who matters tonight). Tight leans on the top; deep spreads minutes. */
export const ROTATION_WEIGHTS_BY_SIZE: Record<GamePlan['rotation'], number[]> = {
  8: [1.9, 1.6, 1.4, 1.2, 1.1, 0.8, 0.6, 0.4, 0, 0],
  9: [1.6, 1.35, 1.2, 1.05, 1, 0.8, 0.65, 0.5, 0.35, 0.25],
  10: [1.5, 1.25, 1.1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.45, 0.35],
};

// ── Team profiles ────────────────────────────────────────────────────────────
export interface TeamProfile {
  three: number;
  inside: number;
  rimD: number;
  perimD: number;
  ath: number;
  pass: number;
  stamina: number;
  /** How far their best player stands above their top eight — what a trap can take away. */
  starGap: number;
}

const PROFILE_KEYS: (keyof TeamProfile)[] = ['three', 'inside', 'rimD', 'perimD', 'ath', 'pass', 'stamina', 'starGap'];

export function teamProfile(roster: Player[]): TeamProfile {
  const top = [...roster].filter((p) => !p.injured).sort((a, b) => b.overall - a.overall).slice(0, 8);
  const n = Math.max(1, top.length);
  const r = top.map((p) => derivePlayerRatings(p));
  const avg = (f: (x: (typeof r)[number]) => number) => r.reduce((s, x) => s + f(x), 0) / n;
  const avgOvr = top.reduce((s, p) => s + p.overall, 0) / n;
  return {
    three: avg((x) => x.tp),
    inside: avg((x) => (x.fg + x.po) / 2),
    rimD: avg((x) => x.di),
    perimD: avg((x) => x.dp),
    ath: avg((x) => x.ath),
    pass: avg((x) => x.ps),
    stamina: avg((x) => x.endu),
    starGap: (top[0]?.overall ?? avgOvr) - avgOvr,
  };
}

let averageCache: { key: string; avg: TeamProfile } | null = null;

export function leagueAverageProfile(league: League, franchise?: Franchise | null): TeamProfile {
  const key = `${league.season}-${league.teams.length}`;
  if (averageCache?.key === key) return averageCache.avg;
  const profiles = league.teams.map((t) => teamProfile(getTeamRoster(league, t, franchise)));
  const avg = {} as TeamProfile;
  for (const k of PROFILE_KEYS) avg[k] = profiles.reduce((s, p) => s + p[k], 0) / Math.max(1, profiles.length);
  averageCache = { key, avg };
  return avg;
}

/** AI coaches play to their own strengths: shoot if they shoot, attack inside if they don't. */
export function aiPlan(profile: TeamProfile, avg: TeamProfile): GamePlan {
  const shoot = profile.three - avg.three;
  const paint = profile.inside - avg.inside;
  return {
    pace: profile.ath - avg.ath > 4 ? 'fast' : 'normal',
    focus: Math.max(shoot, paint) < 2 ? 'balanced' : shoot >= paint ? 'threes' : 'inside',
    defense: profile.rimD - avg.rimD > profile.perimD - avg.perimD + 3 ? 'drop' : 'switch',
    rotation: 9,
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Overall weight of the game plan, tuned so the right plan is worth ~3–8% win chance. */
const PLAN_IMPACT = 2.2;

/** One side's edge from its plan against the other side. */
export function planEdge(us: TeamProfile, them: TeamProfile, avg: TeamProfile, plan: GamePlan): number {
  let e = 0;
  // Focus
  if (plan.focus === 'threes') e += 0.11 * (us.three - avg.three) + 0.11 * (avg.perimD - them.perimD);
  if (plan.focus === 'inside') e += 0.11 * (us.inside - avg.inside) + 0.11 * (avg.rimD - them.rimD);
  // Defense
  if (plan.defense === 'switch') e += 0.08 * (us.perimD - avg.perimD);
  if (plan.defense === 'drop') e += 0.08 * (us.rimD - avg.rimD) - 0.08 * (them.three - avg.three);
  // Trapping only pays against a one-man team; ball-movers punish it.
  if (plan.defense === 'trap') e += 0.25 * (them.starGap - avg.starGap) - 0.1 * (them.pass - avg.pass) - 0.4;
  // Pace
  if (plan.pace === 'fast') e += 0.08 * (us.ath - them.ath) + 0.05 * (us.stamina - avg.stamina);
  if (plan.pace === 'slow') e += 0.07 * (us.pass - avg.pass);
  return clamp(e * PLAN_IMPACT, -4, 4);
}

export const PACE_VARIANCE: Record<GamePlan['pace'], number> = { slow: 0.75, normal: 1, fast: 1.3 };

export interface Matchup {
  /** Net plan edge (ours minus theirs), unamplified strength points. */
  edge: number;
  /** Multiplier on game-night randomness (fast games are more random). */
  varianceScale: number;
  opponentPlan: GamePlan;
}

export function matchupFor(
  franchise: Franchise,
  league: League,
  opponentId: string,
  plan: GamePlan = planOf(franchise),
): Matchup | null {
  const opp: LeagueTeam | undefined = getTeamById(league, opponentId);
  if (!opp) return null;
  const avg = leagueAverageProfile(league, franchise);
  const us = teamProfile(franchise.roster);
  const them = teamProfile(getTeamRoster(league, opp, franchise));
  const opponentPlan = aiPlan(them, avg);
  const edge = planEdge(us, them, avg, plan) - planEdge(them, us, avg, opponentPlan);
  return { edge, varianceScale: PACE_VARIANCE[plan.pace], opponentPlan };
}
