import type { FreeAgent, Franchise, League, LeagueTeam, PitchType } from '../types/game';
import { takeUniqueName } from '../data/names';
import { uid, playerName, formatMoney } from '../data/scenarios';
import { applyRosterSize } from '../data/rosterBuilder';
import { strategyLabel } from '../data/league';
import { canSignFreeAgent } from './cap';
import { freeAgentAskingSalary, isMaxContract } from './salaries';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const ARCHETYPES = ['Two-way wing', 'Stretch big', 'Backup guard', 'Rim runner', 'Veteran scorer', '3-and-D wing'];

/** Basketball GM–style tier — drives suitors, interest caps, and sign thresholds. */
export type FaMarketTier = 'star' | 'starter' | 'rotation' | 'depth';

export function faMarketTier(overall: number): FaMarketTier {
  if (overall >= 84) return 'star';
  if (overall >= 80) return 'starter';
  if (overall >= 75) return 'rotation';
  return 'depth';
}

export function marketHeatLabel(fa: FreeAgent): string {
  const tier = faMarketTier(fa.overall);
  const suitors = fa.suitorCount ?? (fa.topOfferTeam ? 2 : 0);
  if (tier === 'star' || suitors >= 5) return 'Frenzy — max offers everywhere';
  if (tier === 'starter' || suitors >= 3) return 'Hot market — beat several bids';
  if (suitors >= 2 || tier === 'rotation') return 'Moderate interest';
  if (suitors >= 1) return 'Light competition';
  return 'Quiet — realistic on a fair deal';
}

function rollSuitorCount(tier: FaMarketTier): number {
  switch (tier) {
    case 'star':
      return 5 + Math.floor(Math.random() * 4);
    case 'starter':
      return 3 + Math.floor(Math.random() * 3);
    case 'rotation':
      return 1 + Math.floor(Math.random() * 2);
    case 'depth':
      return Math.random() > 0.7 ? 1 : 0;
  }
}

function startingInterest(tier: FaMarketTier): number {
  switch (tier) {
    case 'star':
      return 8 + Math.floor(Math.random() * 10);
    case 'starter':
      return 12 + Math.floor(Math.random() * 14);
    case 'rotation':
      return 20 + Math.floor(Math.random() * 18);
    case 'depth':
      return 30 + Math.floor(Math.random() * 22);
  }
}

function scoutNoteForTier(tier: FaMarketTier, contested: boolean): string {
  if (tier === 'star') {
    return contested
      ? 'All-League caliber. League-wide bidding war — max money and fit required.'
      : 'Star talent on the market. Expect heavy interest the moment you pitch.';
  }
  if (tier === 'starter') {
    return contested
      ? 'Starting-caliber. Multiple teams circling — outbid or sell the role hard.'
      : 'Solid starter. Market will heat up once offers go public.';
  }
  if (tier === 'rotation') {
    return contested
      ? 'Rotation piece with options. Win the role pitch or match the lead offer.'
      : 'Reliable rotation player. Fair money and minutes can get it done.';
  }
  return contested
    ? 'Depth signing with a little competition — still beat the minimum.'
    : 'Replacement-level market. Should sign if the money is honest.';
}

function contestedMarket(tier: FaMarketTier, suitors: number): boolean {
  if (tier === 'star') return true;
  if (tier === 'starter') return suitors >= 2 || Math.random() > 0.12;
  if (tier === 'rotation') return suitors >= 2 || Math.random() > 0.5;
  return suitors >= 1 && Math.random() > 0.62;
}

function scoreRivalSuitability(team: LeagueTeam, fa: FreeAgent): number {
  let score = team.strength * 0.4;
  if (team.strategy === 'all_in') score += 18;
  else if (team.strategy === 'contend') score += 14;
  else if (team.strategy === 'playin') score += 6;
  if (fa.priorities.includes('winning') && (team.strategy === 'contend' || team.strategy === 'all_in')) score += 12;
  if (fa.priorities.includes('market')) {
    score += team.market === 'Large' ? 14 : team.market === 'Mid' ? 5 : -6;
  }
  if (fa.priorities.includes('money') && team.payroll < 130_000_000) score += 8;
  return score;
}

export function pickRivalTeam(league: League, fa: FreeAgent): LeagueTeam | undefined {
  const suitors = league.teams
    .filter((t) => !t.isUser)
    .sort((a, b) => scoreRivalSuitability(b, fa) - scoreRivalSuitability(a, fa));
  return suitors[0];
}

export function rivalOfferSalary(fa: FreeAgent, team: LeagueTeam): number {
  const tier = faMarketTier(fa.overall);
  let bid =
    tier === 'depth'
      ? fa.askingSalary * (0.98 + Math.random() * 0.05)
      : fa.askingSalary * (0.94 + Math.random() * 0.14);
  if (team.strategy === 'all_in' || team.strategy === 'contend') bid *= tier === 'depth' ? 1.01 : 1.05;
  if (fa.priorities.includes('money')) bid *= tier === 'depth' ? 1.01 : 1.04;
  if (fa.priorities.includes('market') && team.market === 'Large') bid *= tier === 'depth' ? 1.01 : 1.06;
  if (tier === 'star') bid *= 1.06;
  else if (tier === 'starter') bid *= 1.03;
  if (tier === 'depth') return Math.round(Math.min(bid, fa.askingSalary * 1.06));
  return Math.round(bid);
}

function seedMarketLeader(fa: FreeAgent, league: League): FreeAgent {
  if (fa.signed) return fa;

  const tier = faMarketTier(fa.overall);
  const suitorCount = fa.suitorCount ?? rollSuitorCount(tier);
  const rival = pickRivalTeam(league, fa);
  const contested = contestedMarket(tier, suitorCount);

  if (!contested || !rival) {
    return {
      ...fa,
      suitorCount,
      scoutNote: scoutNoteForTier(tier, false),
    };
  }

  return {
    ...fa,
    suitorCount,
    topOfferTeam: rival.fullName,
    rivalOfferSalary: rivalOfferSalary(fa, rival),
    scoutNote: scoutNoteForTier(tier, true),
  };
}

function baseInterest(franchise: Franchise, fa: FreeAgent, league: League): number {
  const tier = faMarketTier(fa.overall);
  let interest = fa.interest;
  const winPct = franchise.record.wins / Math.max(1, franchise.record.wins + franchise.record.losses);

  if (fa.priorities.includes('winning')) {
    interest += franchise.playoffOdds * 0.35;
    interest += franchise.titleOdds * 0.5;
    if (franchise.window.includes('Contender')) interest += 12;
  }
  if (fa.priorities.includes('money')) {
    interest += franchise.cap.projectedRoom / 2_000_000;
    if (franchise.cap.inLuxuryTax) interest -= 15;
  }
  if (fa.priorities.includes('role')) {
    const needsPos = franchise.roster.filter((p) => p.position === fa.position).length;
    if (needsPos <= 2) interest += 15;
    if (franchise.roster.some((p) => p.isStar && p.position !== fa.position)) interest += 8;
  }
  if (fa.priorities.includes('market')) {
    interest += franchise.market === 'Large' ? 18 : franchise.market === 'Mid' ? 6 : -8;
  }

  interest += winPct * 20;
  if (franchise.starHappiness === 'Happy') interest += 5;
  if (franchise.starHappiness === 'Angry') interest -= 10;

  const contenders = league.teams.filter((t) => t.strategy === 'contend' || t.strategy === 'all_in').length;
  interest -= contenders * 1.5;

  const suitors = fa.suitorCount ?? 0;
  if (fa.topOfferTeam) {
    const rivalPenalty =
      tier === 'star' ? 22 : tier === 'starter' ? 16 : tier === 'rotation' ? 8 : 3;
    interest -= rivalPenalty + (fa.userPitchAttempts ?? 0) * (tier === 'depth' ? 2 : 5);
    if (suitors > 1 && tier !== 'depth') interest -= Math.max(0, suitors - 1) * 3;
    if (fa.rivalOfferSalary && fa.rivalOfferSalary > fa.askingSalary) {
      interest -= tier === 'depth' ? 4 : 10;
    }
  } else if (suitors >= 3) {
    interest -= (suitors - 2) * 4;
  }

  const tierCeiling = tier === 'star' ? 48 : tier === 'starter' ? 58 : tier === 'rotation' ? 72 : 88;
  return clamp(Math.round(interest), 5, tierCeiling);
}

function rollTierOverall(tier: FaMarketTier): number {
  switch (tier) {
    case 'star':
      return clamp(82 + Math.floor(Math.random() * 5), 82, 86);
    case 'starter':
      return clamp(78 + Math.floor(Math.random() * 3), 78, 80);
    case 'rotation':
      return clamp(74 + Math.floor(Math.random() * 4), 74, 77);
    case 'depth':
      return clamp(68 + Math.floor(Math.random() * 6), 68, 73);
  }
}

export function generateFreeAgentPool(count = 10): FreeAgent[] {
  const tierSlots: FaMarketTier[] = ['star', 'star', 'starter', 'starter', 'starter', 'rotation', 'rotation', 'rotation', 'depth', 'depth'];
  const agents: FreeAgent[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i += 1) {
    const tier = tierSlots[i] ?? 'depth';
    const { firstName, lastName } = takeUniqueName(usedNames, i * 17);
    const overall = rollTierOverall(tier);
    const age = clamp(23 + Math.floor(Math.random() * 12), 23, 34);
    const askingSalary = freeAgentAskingSalary(overall, age);
    const priorities: FreeAgent['priorities'] = [];
    if (overall >= 82) priorities.push('winning', 'role');
    else if (overall >= 76) priorities.push('role', 'money');
    else priorities.push('money', 'role');
    if (Math.random() > 0.55) priorities.push('market');

    agents.push({
      id: uid('fa'),
      firstName,
      lastName,
      age,
      position: rand(['PG', 'SG', 'SF', 'PF', 'C'] as const),
      overall,
      potential: clamp(overall + Math.floor(Math.random() * 8), overall, 92),
      askingSalary,
      askingYears: overall >= 80 ? 4 : 2 + Math.floor(Math.random() * 2),
      priorities: [...new Set(priorities)],
      interest: startingInterest(tier),
      suitorCount: rollSuitorCount(tier),
      scoutNote: scoutNoteForTier(tier, tier === 'star' || tier === 'starter'),
      archetype: rand(ARCHETYPES),
      signed: false,
      userPitchAttempts: 0,
    });
  }
  return agents.sort((a, b) => b.overall - a.overall);
}

export function refreshFreeAgentInterest(franchise: Franchise, league: League): FreeAgent[] {
  return franchise.freeAgents.map((fa) => {
    if (fa.signed) return fa;
    const seeded = seedMarketLeader(fa, league);
    const tier = faMarketTier(seeded.overall);
    let interest = baseInterest(franchise, seeded, league);
    if (seeded.topOfferTeam) {
      const cap =
        tier === 'star'
          ? 38 - (seeded.userPitchAttempts ?? 0) * 4
          : tier === 'starter'
            ? 48 - (seeded.userPitchAttempts ?? 0) * 3
            : tier === 'rotation'
              ? 58 - (seeded.userPitchAttempts ?? 0) * 2
              : 72;
      interest = Math.min(interest, cap);
    }
    return { ...seeded, interest: clamp(interest, 5, 95) };
  });
}

function pitchBonus(
  pitch: PitchType,
  franchise: Franchise,
  fa: FreeAgent,
): { bonus: number; rolePromise: string; salaryMult: number; yearsAdjust: number } {
  const tier = faMarketTier(fa.overall);
  const starDampen = tier === 'star' ? 0.55 : tier === 'starter' ? 0.75 : 1;

  switch (pitch) {
    case 'max_offer':
      return {
        bonus: Math.round(18 * starDampen),
        salaryMult: tier === 'star' ? 1.1 : 1.08,
        yearsAdjust: 0,
        rolePromise: 'Starter minutes expected.',
      };
    case 'team_friendly':
      return {
        bonus: Math.round(-10 * (tier === 'depth' ? 0.6 : 1)),
        salaryMult: tier === 'depth' ? 0.9 : 0.88,
        yearsAdjust: -1,
        rolePromise: 'Clear rotation role, team-friendly deal.',
      };
    case 'win_now':
      return {
        bonus: Math.round((franchise.window.includes('Contender') ? 14 : 4) * starDampen),
        salaryMult: 0.95,
        yearsAdjust: 0,
        rolePromise: 'Join a team built to win now.',
      };
    case 'featured_role':
      return {
        bonus: Math.round((fa.priorities.includes('role') ? 16 : 6) * starDampen),
        salaryMult: 1.02,
        yearsAdjust: 0,
        rolePromise: 'Featured role in closing lineups promised.',
      };
  }
}

function baseSignThreshold(tier: FaMarketTier): number {
  switch (tier) {
    case 'star':
      return 84;
    case 'starter':
      return 72;
    case 'rotation':
      return 58;
    case 'depth':
      return 42;
  }
}

function signThreshold(fa: FreeAgent, salary: number, rivalSalary: number): number {
  const tier = faMarketTier(fa.overall);
  let threshold = baseSignThreshold(tier);
  const suitors = fa.suitorCount ?? 0;

  if (fa.topOfferTeam) {
    threshold += tier === 'star' ? 14 : tier === 'starter' ? 10 : tier === 'rotation' ? 4 : 1;
  }
  if (suitors >= 4) threshold += 4;
  else if (suitors >= 2 && tier !== 'depth') threshold += 2;

  if ((fa.userPitchAttempts ?? 0) >= 1) threshold += tier === 'depth' ? 1 : 4;
  if ((fa.userPitchAttempts ?? 0) >= 2) threshold += tier === 'depth' ? 1 : 5;

  if (rivalSalary > salary) {
    threshold += tier === 'star' ? 14 : tier === 'starter' ? 10 : tier === 'rotation' ? 4 : 0;
  } else if (rivalSalary > salary * 0.98 && tier !== 'depth') {
    threshold += tier === 'star' ? 8 : 5;
  }

  const min = tier === 'depth' ? 38 : tier === 'rotation' ? 48 : 60;
  const max = tier === 'star' ? 94 : tier === 'starter' ? 88 : 82;
  return clamp(threshold, min, max);
}

function beatMargin(tier: FaMarketTier, pitch: PitchType, attempts: number): number {
  const escalation = 1 + attempts * (tier === 'star' ? 0.035 : tier === 'starter' ? 0.025 : tier === 'depth' ? 0.005 : 0.012);
  if (tier === 'depth') return escalation;
  if (tier === 'rotation') {
    const base = pitch === 'max_offer' || pitch === 'featured_role' ? 1.0 : 1.02;
    return base * escalation;
  }
  let premium =
    tier === 'star'
      ? pitch === 'max_offer'
        ? 1.05
        : 1.1
      : pitch === 'max_offer'
        ? 1.03
        : 1.06;
  if (pitch === 'team_friendly') premium += tier === 'star' ? 0.1 : 0.05;
  return premium * escalation;
}

function salaryBeatsRival(
  pitch: PitchType,
  salary: number,
  rivalSalary: number,
  attempts: number,
  customSalary: boolean,
  tier: FaMarketTier,
): boolean {
  if (!rivalSalary) return true;
  const margin = beatMargin(tier, pitch, attempts);
  if (customSalary) {
    return salary >= Math.round(rivalSalary * margin);
  }
  return salary >= Math.round(rivalSalary * margin);
}

export function minSalaryToSign(fa: FreeAgent, pitch: PitchType = 'max_offer'): number {
  const rival = fa.rivalOfferSalary;
  if (!rival) return fa.askingSalary;
  const tier = faMarketTier(fa.overall);
  return Math.round(rival * beatMargin(tier, pitch, fa.userPitchAttempts ?? 0));
}

export function offerSalaryBounds(franchise: Franchise, fa: FreeAgent): {
  min: number;
  ask: number;
  rival: number | undefined;
  suggested: number;
  max: number;
} {
  const tier = faMarketTier(fa.overall);
  const ask = fa.askingSalary;
  const rival = fa.rivalOfferSalary;
  const suggested = rival
    ? minSalaryToSign(fa, 'max_offer')
    : Math.round(ask * (tier === 'depth' ? 1.0 : 1.05));
  const max = Math.max(
    suggested,
    Math.round(ask * (tier === 'star' ? 1.15 : 1.12)),
    franchise.cap.projectedRoom > 0 ? franchise.cap.projectedRoom : ask,
  );
  return {
    min: Math.round(ask * (tier === 'depth' ? 0.88 : 0.82)),
    ask,
    rival,
    suggested,
    max,
  };
}

function evaluateOffer(
  franchise: Franchise,
  league: League,
  fa: FreeAgent,
  pitch: PitchType,
  offeredSalary?: number,
  offeredYears?: number,
): {
  salary: number;
  years: number;
  interest: number;
  threshold: number;
  rivalSalary: number;
  beatsRival: boolean;
  capOk: boolean;
  capReason: string;
  capException?: string;
  signed: boolean;
  customSalary: boolean;
} {
  const tier = faMarketTier(fa.overall);
  const rival = pickRivalTeam(league, fa);
  const attempts = fa.userPitchAttempts ?? 0;
  const rivalSalary =
    fa.rivalOfferSalary ??
    (rival ? rivalOfferSalary(fa, rival) : Math.round(fa.askingSalary * (0.96 + Math.random() * 0.1)));

  const pitchFx = pitchBonus(pitch, franchise, fa);
  const customSalary = offeredSalary !== undefined;
  const salary = offeredSalary ?? Math.round(fa.askingSalary * pitchFx.salaryMult);
  const years = offeredYears ?? Math.max(1, fa.askingYears + pitchFx.yearsAdjust);

  let interest = baseInterest(franchise, fa, league);
  let pitchImpact = pitchFx.bonus;
  if (fa.topOfferTeam) {
    const mult = tier === 'star' ? 0.25 : tier === 'starter' ? 0.38 : tier === 'rotation' ? 0.55 : 0.72;
    pitchImpact = Math.round(pitchImpact * mult);
  }
  if (pitch === 'team_friendly' && fa.topOfferTeam && tier !== 'depth') pitchImpact -= 8;
  interest += pitchImpact;

  if (customSalary && fa.priorities.includes('money')) {
    interest += Math.min(tier === 'star' ? 6 : 10, Math.round((salary - fa.askingSalary) / 800_000));
  }
  if (customSalary && rivalSalary && salary > rivalSalary) {
    interest += Math.min(tier === 'star' ? 10 : 14, Math.round((salary - rivalSalary) / (tier === 'star' ? 800_000 : 600_000)));
  }

  if (salary + franchise.cap.payroll > franchise.cap.capLimit && pitch !== 'team_friendly') {
    interest -= 20;
  }

  const capCheck = canSignFreeAgent(franchise, salary, pitch === 'team_friendly' ? 'minimum' : 'standard');
  if (fa.topOfferTeam && pitch === 'team_friendly' && salary < rivalSalary) {
    interest -= tier === 'star' ? 18 : 14;
  }

  const threshold = signThreshold(fa, salary, rivalSalary);
  const beatsRival = salaryBeatsRival(pitch, salary, rivalSalary, attempts, customSalary, tier);
  const signed = capCheck.ok && interest >= threshold && beatsRival;

  return {
    salary,
    years,
    interest,
    threshold,
    rivalSalary,
    beatsRival,
    capOk: capCheck.ok,
    capReason: capCheck.reason,
    capException: capCheck.useException,
    signed,
    customSalary,
  };
}

export function previewOffer(
  franchise: Franchise,
  league: League,
  fa: FreeAgent,
  pitch: PitchType,
  offeredSalary: number,
  offeredYears?: number,
): {
  beatsRival: boolean;
  capOk: boolean;
  capReason: string;
  rivalSalary: number;
  projectedInterest: number;
  signThreshold: number;
  likelySign: boolean;
} {
  const ev = evaluateOffer(franchise, league, fa, pitch, offeredSalary, offeredYears);
  return {
    beatsRival: ev.beatsRival,
    capOk: ev.capOk,
    capReason: ev.capReason,
    rivalSalary: ev.rivalSalary,
    projectedInterest: ev.interest,
    signThreshold: ev.threshold,
    likelySign: ev.signed,
  };
}

function failureMessage(
  fa: FreeAgent,
  rival: LeagueTeam | undefined,
  interest: number,
  rivalSalary: number,
  salary: number,
): string {
  const tier = faMarketTier(fa.overall);
  const rivalName = fa.topOfferTeam ?? rival?.fullName ?? 'another contender';
  const suitors = fa.suitorCount ?? 0;
  const beatNote =
    rivalSalary && salary < rivalSalary
      ? ` Lead offer ~$${(rivalSalary / 1_000_000).toFixed(1)}M.`
      : '';

  if (tier === 'star') {
    return `${playerName(fa)} is a league-wide target (${suitors || 'several'} suitors). Your pitch landed at ${interest}% — need max money above market to steal him from ${rivalName}.${beatNote}`;
  }
  if ((fa.userPitchAttempts ?? 0) >= 2 && fa.topOfferTeam) {
    return `${playerName(fa)} is close to ${rivalName}.${beatNote} One more max offer might flip him — or walk.`;
  }
  if (fa.topOfferTeam) {
    return `${playerName(fa)} leans ${rivalName} (${strategyLabel(rival?.strategy ?? 'contend')}). Interest ${interest}%.${beatNote}`;
  }
  return `${playerName(fa)} wants more time. Interest at ${interest}%.`;
}

export function pitchFreeAgent(
  franchise: Franchise,
  league: League,
  agentId: string,
  pitch: PitchType,
  offeredSalary?: number,
  offeredYears?: number,
): { franchise: Franchise; message: string; signed: boolean } {
  const fa = franchise.freeAgents.find((a) => a.id === agentId && !a.signed);
  if (!fa) return { franchise, message: 'Target unavailable.', signed: false };

  const rival = pickRivalTeam(league, fa);
  const attempts = fa.userPitchAttempts ?? 0;
  const ev = evaluateOffer(franchise, league, fa, pitch, offeredSalary, offeredYears);
  const rivalSalary = ev.rivalSalary;
  const salary = ev.salary;
  const years = ev.years;
  const interest = ev.interest;
  const pitchFx = pitchBonus(pitch, franchise, fa);
  const capException = ev.capException ?? 'room';
  const tier = faMarketTier(fa.overall);

  if (!ev.capOk) {
    return {
      franchise,
      message: `Cap office blocked the deal: ${ev.capReason}`,
      signed: false,
    };
  }

  const signed = ev.signed;

  if (!signed) {
    const escalate = tier === 'star' ? 1.025 : tier === 'starter' ? 1.02 : tier === 'depth' ? 1.003 : 1.01;
    const nextRivalSalary = Math.round(Math.max(rivalSalary, salary * 0.99) * (escalate + attempts * (tier === 'depth' ? 0.003 : 0.012)));
    const beatTarget = minSalaryToSign({ ...fa, rivalOfferSalary: nextRivalSalary, userPitchAttempts: attempts + 1 }, pitch);
    const msg =
      !ev.beatsRival && fa.topOfferTeam
        ? tier === 'depth' || tier === 'rotation'
          ? `${playerName(fa)} will sign if you offer ${formatMoney(beatTarget)}/yr — matches ${fa.topOfferTeam}'s bid.`
          : `${playerName(fa)} passed on ${formatMoney(salary)}/yr — need ${formatMoney(beatTarget)}+ to flip him from ${fa.topOfferTeam}.`
        : failureMessage(fa, rival, interest, nextRivalSalary, salary);
    const interestCap =
      tier === 'star' ? 42 : tier === 'starter' ? 50 : tier === 'rotation' ? 62 : 78;
    return {
      franchise: {
        ...franchise,
        freeAgents: franchise.freeAgents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                interest: clamp(Math.min(interest, interestCap - attempts * (tier === 'depth' ? 2 : 4)), 5, 90),
                topOfferTeam: a.topOfferTeam ?? rival?.fullName,
                rivalOfferSalary: nextRivalSalary,
                suitorCount:
                  tier === 'depth'
                    ? a.suitorCount ?? 1
                    : Math.max(a.suitorCount ?? 1, tier === 'star' ? 5 : 2),
                userPitchAttempts: attempts + 1,
              }
            : a,
        ),
      },
      message: msg,
      signed: false,
    };
  }

  const player = {
    id: uid('pl'),
    firstName: fa.firstName,
    lastName: fa.lastName,
    age: fa.age,
    position: fa.position,
    overall: fa.overall,
    potential: fa.potential,
    contract: {
      yearsRemaining: years,
      annualSalary: salary,
      isMax: isMaxContract(fa.overall, salary),
      isExpiring: false,
    },
    morale: 'Happy' as const,
    role: fa.overall >= 80 ? ('Starter' as const) : ('Rotation' as const),
    tradeValue: fa.overall >= 80 ? ('High' as const) : ('Medium' as const),
    devTrend: 'Stable' as const,
    injuryRisk: 'Low' as const,
    systemFit: 'Good' as const,
    gmNote: fa.topOfferTeam
      ? `Stolen from ${fa.topOfferTeam} in free agency. ${pitchFx.rolePromise}`
      : `Signed via free agency. ${pitchFx.rolePromise}`,
    workEthic: 'High' as const,
    minutesPerGame: fa.overall >= 80 ? 30 : 22,
  };

  return {
    franchise: applyRosterSize({
      ...franchise,
      roster: [...franchise.roster, player],
      freeAgents: franchise.freeAgents.map((a) =>
        a.id === agentId ? { ...a, signed: true, interest: 100, topOfferTeam: undefined, rivalOfferSalary: undefined } : a,
      ),
      memory: [
        {
          id: uid('mem'),
          season: franchise.season,
          week: franchise.week,
          text: `Signed ${fa.firstName} ${fa.lastName} (${fa.overall} OVR) — ${years}yr / $${(salary / 1_000_000).toFixed(1)}M. ${pitchFx.rolePromise}`,
          type: 'contract',
        },
        ...franchise.memory,
      ],
    }),
    message: fa.topOfferTeam
      ? `You flipped ${fa.firstName} ${fa.lastName} off ${fa.topOfferTeam} on ${formatMoney(salary)}/yr. ${years}-year deal via ${capException}. ${pitchFx.rolePromise}`
      : `Contract agreed. ${fa.firstName} ${fa.lastName} joins on ${formatMoney(salary)}/yr × ${years} years via ${capException}. ${pitchFx.rolePromise}`,
    signed: true,
  };
}

export function simAISignings(franchise: Franchise, league: League): { franchise: Franchise; headlines: string[] } {
  const headlines: string[] = [];
  const remaining = franchise.freeAgents.filter((a) => !a.signed);
  const signedIds = new Set<string>();

  for (const fa of remaining) {
    const tier = faMarketTier(fa.overall);
    if (!fa.topOfferTeam) continue;

    let commitChance = 0.15;
    if (tier === 'star') commitChance = 0.62 + (fa.userPitchAttempts ?? 0) * 0.08;
    else if (tier === 'starter') commitChance = 0.45 + (fa.userPitchAttempts ?? 0) * 0.06;
    else if (tier === 'rotation') commitChance = 0.28 + (fa.userPitchAttempts ?? 0) * 0.04;

    if (Math.random() < commitChance) {
      signedIds.add(fa.id);
      headlines.push(`${playerName(fa)} commits to ${fa.topOfferTeam} — your window closed.`);
    }
  }

  const openRotation = remaining.filter((a) => !signedIds.has(a.id) && !a.signed && faMarketTier(a.overall) === 'rotation');
  const openDepth = remaining.filter((a) => !signedIds.has(a.id) && !a.signed && faMarketTier(a.overall) === 'depth');
  const aiPool = [...openRotation, ...openDepth].sort((a, b) => b.overall - a.overall);

  const signCount = Math.min(4, Math.floor(aiPool.length * 0.45));
  for (let i = 0; i < signCount; i += 1) {
    const fa = aiPool[i];
    if (!fa) break;
    signedIds.add(fa.id);
    const team = pickRivalTeam(league, fa);
    headlines.push(`${playerName(fa)} signs with ${team?.fullName ?? 'a rival'} — market clearing.`);
  }

  return {
    franchise: {
      ...franchise,
      freeAgents: franchise.freeAgents.map((a) =>
        signedIds.has(a.id) ? { ...a, signed: true } : a,
      ),
    },
    headlines,
  };
}

export function pitchLabel(p: PitchType): string {
  const labels: Record<PitchType, string> = {
    max_offer: 'Max offer — pay the market',
    team_friendly: 'Team-friendly — preserve cap room',
    win_now: 'Win-now pitch — sacrifice dollars',
    featured_role: 'Featured role promise',
  };
  return labels[p];
}

export function pitchDescription(p: PitchType): string {
  const desc: Record<PitchType, string> = {
    max_offer: 'Highest money. Required to flip stars in bidding wars.',
    team_friendly: 'Below market. Works on depth — rarely wins stars.',
    win_now: 'Sell contention. Stars still want dollars on top.',
    featured_role: 'Promise minutes. Helps mid-tier more than elites.',
  };
  return desc[p];
}

export function rivalPitchWarning(fa: FreeAgent): string | undefined {
  if (!fa.topOfferTeam || fa.signed) return undefined;
  const tier = faMarketTier(fa.overall);
  const attempts = fa.userPitchAttempts ?? 0;
  const suitors = fa.suitorCount ?? 0;
  const salaryNote = fa.rivalOfferSalary
    ? ` (~$${(fa.rivalOfferSalary / 1_000_000).toFixed(1)}M/yr)`
    : '';

  if (tier === 'star') {
    return `${suitors || 'Several'} teams in — leaning ${fa.topOfferTeam}${salaryNote}. Max offer required.`;
  }
  if (tier === 'depth' || tier === 'rotation') {
    if (fa.rivalOfferSalary) {
      return `Offer from ${fa.topOfferTeam}${salaryNote}. Match ${formatMoney(fa.rivalOfferSalary)} to land him.`;
    }
    return `Light interest — a fair offer should work.`;
  }
  if (attempts >= 2) {
    return `Leaning hard toward ${fa.topOfferTeam}${salaryNote}. Beat the bid or walk.`;
  }
  return `Leaning toward ${fa.topOfferTeam}${salaryNote}. Match or beat to flip him.`;
}
