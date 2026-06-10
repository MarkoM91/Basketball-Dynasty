import type { Franchise, League, Player } from '../types/game';
import { uid } from '../data/scenarios';
import {
  attachDraftOrder,
  buildDraftOrder,
  getUserDraftPickNumber,
  pinUserDraftPick,
} from './draftOrder';
import { generateFreeAgentPool } from './freeAgency';
import { buildLeagueFreeAgentPool, tickLeagueRosterContracts, runLeagueAiRenewals } from './leagueWorld';
import { seedRFAOffers } from './rfa';

export interface ContractRenewalSummary {
  reSigned: string[];
  expiring: string[];
  rookieDeals: string[];
}

/** Seeded pseudo-random — deterministic per player+season so saves are stable. */
function seededRand(playerId: string, season: number, salt = 0): number {
  let h = (season + salt * 997) * 2654435761;
  for (let i = 0; i < playerId.length; i++) h ^= playerId.charCodeAt(i) * 40503;
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * BBGM-inspired: development speed scales with gap to potential.
 * Large gap = fast growth. Near ceiling = slow.
 */
function gapFactor(gap: number): number {
  if (gap >= 20) return 3.0;
  if (gap >= 15) return 2.2;
  if (gap >= 10) return 1.6;
  if (gap >= 6)  return 1.0;
  if (gap >= 3)  return 0.5;
  if (gap >= 1)  return 0.2;
  return 0; // at or above ceiling
}

/**
 * Age-based development multiplier for the growth phase (< 26).
 * Younger players are more volatile — bigger upside AND bigger bust risk.
 */
function youthMultiplier(age: number): number {
  if (age <= 20) return 1.25;
  if (age <= 22) return 1.0;
  if (age <= 24) return 0.8;
  return 0.6; // 25 — approaching peak
}

/**
 * Decline rate for veterans. Steepens sharply at 33+, brutal at 36+.
 * BBGM-style: no floor — players can fall far.
 */
function declineRate(age: number, workEthic: Player['workEthic']): number {
  const ethicBonus = workEthic === 'Elite' ? 0.6 : workEthic === 'High' ? 0.3 : workEthic === 'Low' ? -0.3 : 0;
  let base: number;
  if (age <= 30)      base = 0.5;
  else if (age <= 32) base = 1.2;
  else if (age <= 34) base = 2.0;
  else if (age <= 36) base = 3.2;
  else                base = 4.5;
  return Math.max(0.2, base - ethicBonus);
}

function moraleMod(morale: Player['morale']): number {
  if (morale === 'Happy') return 0.3;
  if (morale === 'Frustrated' || morale === 'Angry') return -0.5;
  return 0;
}

/** Playing time matters — starters get real reps, deep bench players stagnate. */
function minutesMod(mpg: number): number {
  if (mpg >= 30) return 0.4;
  if (mpg >= 24) return 0.2;
  if (mpg >= 16) return 0;
  if (mpg >= 8)  return -0.2;
  return -0.5; // DNP-level — almost no development
}

/** Step hiddenOverall one point toward true overall each season. Reveals when gap < 2. */
function tickHiddenOverall(p: Player, trueOverall: number): number | undefined {
  if (p.hiddenOverall === undefined) return undefined;
  const diff = trueOverall - p.hiddenOverall;
  if (Math.abs(diff) < 2) return undefined; // fully revealed
  return p.hiddenOverall + Math.sign(diff);
}

function developOnePlayer(p: Player, season: number): Player {
  const rand  = seededRand(p.id, season, 0);
  const rand2 = seededRand(p.id, season, 1);
  const rand3 = seededRand(p.id, season, 2);

  const age = p.age;
  // Use true overall for development math if hidden
  const trueOvr = p.overall;
  const gap = p.potential - trueOvr;

  const mpgMod   = minutesMod(p.minutesPerGame ?? 20);
  const moraleMd = moraleMod(p.morale);

  // ── DECLINE PHASE (29+) ──────────────────────────────────────────────────
  if (age >= 29) {
    const rate = declineRate(age, p.workEthic);
    // Small chance a veteran defies age for one more year (10% if 29-31, rare after)
    const defiesAge = age <= 31 && rand > 0.90;
    if (defiesAge && gap > 0) {
      const defiedOvr = Math.min(p.potential, trueOvr + 1);
      return {
        ...p,
        age: age + 1,
        overall: defiedOvr,
        prevOverall: trueOvr,
        hiddenOverall: tickHiddenOverall(p, defiedOvr),
        devTrend: 'Stable',
      };
    }
    const noise = (rand2 - 0.5) * 1.0;
    // Morale and minutes soften the blow slightly
    const delta = -(rate + noise) + moraleMd * 0.4 + mpgMod * 0.3;
    const next = Math.round(Math.max(55, trueOvr + delta));
    return {
      ...p,
      age: age + 1,
      overall: next,
      prevOverall: trueOvr,
      hiddenOverall: tickHiddenOverall(p, next),
      devTrend: next >= trueOvr ? 'Stable' : 'Down',
    };
  }

  // ── PEAK PHASE (26-28) ───────────────────────────────────────────────────
  if (age >= 26) {
    let delta = 0;
    if (gap >= 4) delta = 0.6;
    else if (gap >= 1) delta = 0.2;
    const noise = (rand - 0.5) * 1.5;
    delta += noise + moraleMd * 0.3 + mpgMod * 0.2;
    const next = Math.round(Math.max(trueOvr - 1, Math.min(p.potential, trueOvr + delta)));
    return {
      ...p,
      age: age + 1,
      overall: next,
      prevOverall: trueOvr,
      hiddenOverall: tickHiddenOverall(p, next),
      devTrend: next > trueOvr ? 'Up' : next === trueOvr ? 'Stable' : 'Down',
    };
  }

  // ── DEVELOPMENT PHASE (≤ 25) ─────────────────────────────────────────────
  const bustChance = p.role === 'Prospect' ? 0.28 : 0.12;
  const isBust = rand < bustChance;
  const isGem  = age <= 23 && rand3 > 0.94 && gap >= 6;

  const devFocusBoost = p.devFocus ? 0.6 : 0;
  const workBoost = p.workEthic === 'Elite' ? 0.8 : p.workEthic === 'High' ? 0.4 : p.workEthic === 'Low' ? -0.6 : 0;

  let baseDelta = gapFactor(gap) * youthMultiplier(age) + devFocusBoost + workBoost + moraleMd + mpgMod;

  if (isBust) baseDelta = (rand2 - 0.7) * 0.8;
  if (isGem)  baseDelta += 2;

  const noise = (rand2 - 0.5) * (age <= 21 ? 2.0 : 1.4);
  baseDelta += noise;

  const ceiling = isGem ? p.potential + 2 : p.potential;
  const next = Math.round(Math.max(trueOvr - 1, Math.min(ceiling, trueOvr + baseDelta)));
  const diff = next - trueOvr;

  const devTrend: Player['devTrend'] =
    diff >= 1 ? 'Up' :
    diff === 0 ? (isBust && age <= 24 ? 'Stalled' : 'Stable') :
    'Down';

  return {
    ...p,
    age: age + 1,
    overall: next,
    prevOverall: trueOvr,
    hiddenOverall: tickHiddenOverall(p, next),
    devTrend,
    potential: isGem ? Math.max(p.potential, next + 1) : p.potential,
  };
}

/** Advance all players by one year: age +1, OVR drifts toward potential. */
export function developPlayers(franchise: Franchise): Franchise {
  return {
    ...franchise,
    roster: franchise.roster.map((p) => developOnePlayer(p, franchise.season)),
  };
}

/** Run once when the calendar year turns — all contracts lose a year. */
export function tickSeasonContracts(franchise: Franchise): Franchise {
  const coachYears = Math.max(0, (franchise.coach.contractYearsRemaining ?? 2) - 1);
  return {
    ...franchise,
    coach: {
      ...franchise.coach,
      contractYearsRemaining: coachYears,
    },
    roster: franchise.roster.map((p) => {
      const years = Math.max(0, p.contract.yearsRemaining - 1);
      return {
        ...p,
        contract: {
          ...p.contract,
          yearsRemaining: years,
          isExpiring: years === 0,
          birdYears: years > 0 ? (p.contract.birdYears ?? 1) + 1 : p.contract.birdYears,
        },
      };
    }),
  };
}

/** After the draft: enter renewal window before free agency opens. */
export function processContractRenewals(
  franchise: Franchise,
  rookieNames: string[] = [],
): {
  franchise: Franchise;
  summary: ContractRenewalSummary;
} {
  const expiring = franchise.roster
    .filter((p) => p.contract.yearsRemaining === 0 || p.contract.isExpiring)
    .map((p) => `${p.firstName} ${p.lastName}`);

  return {
    franchise: {
      ...franchise,
      phase: 'contract_renewals',
    },
    summary: { reSigned: [], expiring, rookieDeals: rookieNames },
  };
}

export function openFreeAgencyAfterRenewals(franchise: Franchise, league: League): { franchise: Franchise; league: League } {
  let nextLeague = runLeagueAiRenewals(league, franchise);
  let pool = buildLeagueFreeAgentPool(nextLeague, franchise, franchise.pendingFreeAgents ?? []);
  if (pool.length < 8) {
    pool = [...pool, ...generateFreeAgentPool(Math.max(6, 12 - pool.length))].sort((a, b) => b.overall - a.overall);
  }
  return {
    franchise: {
      ...franchise,
      phase: 'free_agency',
      freeAgents: pool,
      pendingFreeAgents: [],
      rfaOffers: seedRFAOffers(franchise, nextLeague),
    },
    league: nextLeague,
  };
}

export function prepareDraftScouting(
  franchise: Franchise,
  league: League,
  priorLeague?: League,
  priorPlayoffs?: Franchise['playoffs'],
  options?: { pinnedPick?: number },
): { franchise: Franchise; league: League } {
  const orderSource = priorLeague ?? league;
  let nextLeague = league;

  if (!nextLeague.draftOrder?.length) {
    nextLeague = attachDraftOrder(
      nextLeague,
      buildDraftOrder(orderSource, franchise.city, franchise.name, priorPlayoffs ?? franchise.playoffs),
    );
  }

  let pick =
    options?.pinnedPick ??
    getUserDraftPickNumber(nextLeague, franchise.city, franchise.name);

  if (options?.pinnedPick != null) {
    nextLeague = pinUserDraftPick(nextLeague, franchise.city, franchise.name, options.pinnedPick);
    pick = options.pinnedPick;
  }

  const developed = developPlayers(franchise);
  const ticked = tickSeasonContracts(developed);

  nextLeague = tickLeagueRosterContracts(nextLeague, franchise);

  return {
    franchise: {
      ...ticked,
      phase: 'draft_scouting',
      draftPickNumber: pick,
      draftNight: undefined,
      draftRecap: undefined,
      freeAgents: [],
      rfaOffers: [],
      cap: { ...ticked.cap, mleUsed: false, baeUsed: false },
    },
    league: nextLeague,
  };
}

export function formatRenewalHeadline(summary: ContractRenewalSummary): string {
  const parts: string[] = [];
  if (summary.rookieDeals.length) {
    parts.push(`${summary.rookieDeals.length} rookie deal${summary.rookieDeals.length === 1 ? '' : 's'} signed`);
  }
  if (summary.reSigned.length) {
    parts.push(`${summary.reSigned.length} player${summary.reSigned.length === 1 ? '' : 's'} re-signed`);
  }
  if (summary.expiring.length) {
    parts.push(`${summary.expiring.length} renewal${summary.expiring.length === 1 ? '' : 's'} pending`);
  }
  return parts.length ? parts.join(' · ') : 'Contract ledger updated.';
}

export function rememberRenewals(franchise: Franchise, summary: ContractRenewalSummary): Franchise {
  return {
    ...franchise,
    memory: [
      {
        id: uid('mem'),
        season: franchise.season,
        week: franchise.week,
        text: `Offseason contracts: ${formatRenewalHeadline(summary)}`,
        type: 'contract',
      },
      ...franchise.memory,
    ],
  };
}
