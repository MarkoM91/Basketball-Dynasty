import type {
  Franchise,
  LeagueTeam,
  Ownership,
  PendingEvent,
  Player,
  ScenarioId,
  SeasonReview,
  TradeOffer,
} from '../types/game';
import { uid } from '../data/scenarios';
import { strategyForFranchise } from './scenarioDifficulty';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

interface OwnerMandate {
  targetWinPct: number;
  rewardsDevelopment: boolean;
  playoffRequired: boolean;
  winNowPressure: number;
  developmentBonus: number;
}

const MANDATES: Record<ScenarioId, OwnerMandate> = {
  lottery_rebuild: {
    targetWinPct: 0.38,
    rewardsDevelopment: true,
    playoffRequired: false,
    winNowPressure: 0.15,
    developmentBonus: 4,
  },
  stuck_middle: {
    targetWinPct: 0.52,
    rewardsDevelopment: false,
    playoffRequired: true,
    winNowPressure: 0.55,
    developmentBonus: 1,
  },
  aging_contender: {
    targetWinPct: 0.62,
    rewardsDevelopment: false,
    playoffRequired: true,
    winNowPressure: 0.95,
    developmentBonus: 0,
  },
  small_market_star: {
    targetWinPct: 0.58,
    rewardsDevelopment: false,
    playoffRequired: true,
    winNowPressure: 0.72,
    developmentBonus: 2,
  },
};

function mandateFor(franchise: Franchise): OwnerMandate {
  if (franchise.scenarioId && MANDATES[franchise.scenarioId]) {
    return MANDATES[franchise.scenarioId];
  }
  if (franchise.window.includes('Rebuild')) return MANDATES.lottery_rebuild;
  if (franchise.window === 'Expensive Mediocrity') return MANDATES.stuck_middle;
  if (franchise.window === 'Aging Contender') return MANDATES.aging_contender;
  return MANDATES.small_market_star;
}

export function evaluateJobSecurity(franchise: Franchise): number {
  let score = franchise.jobSecurity;
  const games = franchise.record.wins + franchise.record.losses;
  const winPct = franchise.record.wins / Math.max(1, games);
  const mandate = mandateFor(franchise);

  if (mandate.rewardsDevelopment) {
    const youngDev = franchise.roster.filter((p) => p.age < 24 && p.devTrend === 'Up').length;
    const youngMinutes = franchise.roster.filter((p) => p.age < 24 && (p.minutesPerGame ?? 0) >= 18).length;
    score += youngDev * mandate.developmentBonus - 2;
    score += youngMinutes * 1.5;
    if (games >= 20) {
      if (winPct > mandate.targetWinPct + 0.1) score -= 5;
      else if (winPct <= mandate.targetWinPct + 0.06) score += 4;
    }
  } else {
    score += (winPct - mandate.targetWinPct) * 35 * mandate.winNowPressure;
    if (mandate.playoffRequired) {
      score += franchise.playoffOdds > 55 ? 4 : franchise.playoffOdds < 35 ? -7 : -1;
    }
    if (franchise.scenarioId === 'aging_contender' && franchise.playoffOdds < 48 && games > 28) {
      score -= 6;
    }
    if (franchise.scenarioId === 'stuck_middle' && winPct >= 0.44 && winPct <= 0.52 && games > 30) {
      score -= 4;
    }
  }

  score += (franchise.ownership.confidence - 50) * 0.05;
  score -= franchise.cap.inLuxuryTax && !mandate.rewardsDevelopment ? 3 : 0;
  score -= franchise.cap.inSecondApron ? 5 : 0;

  const floor = mandate.rewardsDevelopment ? 18 : 5;
  return clamp(Math.round(score), floor, 99);
}

export function refreshOwnershipEvaluation(franchise: Franchise): Ownership {
  const mandate = mandateFor(franchise);
  const games = franchise.record.wins + franchise.record.losses;
  const winPct = games > 0 ? franchise.record.wins / games : 0;
  let { evaluation, confidence, patience } = franchise.ownership;

  if (franchise.scenarioId === 'lottery_rebuild') {
    const devCount = franchise.roster.filter((p) => p.age < 24 && p.devTrend === 'Up').length;
    if (devCount >= 3) evaluation = 'Ownership likes the young core trajectory.';
    else if (winPct > 0.5 && games > 25) {
      evaluation = 'Owner worries wins are slowing the rebuild.';
      confidence = Math.max(10, confidence - 3);
    } else evaluation = 'Patient rebuild — development beats standings.';
  } else if (franchise.scenarioId === 'aging_contender') {
    if (franchise.playoffOdds < 45) {
      evaluation = 'Win-now window closing — playoffs are mandatory.';
      patience = Math.max(8, patience - 4);
    } else evaluation = 'Championship or bust. No excuses.';
  } else if (franchise.scenarioId === 'stuck_middle') {
    evaluation =
      winPct < 0.45
        ? 'Ownership wants a direction — tank or push, not drift.'
        : 'Play-in is not good enough anymore.';
  } else if (franchise.scenarioId === 'small_market_star') {
    const star = franchise.roster.find((p) => p.isStar);
    evaluation = star
      ? `${star.firstName} ${star.lastName} expects roster upgrades this season.`
      : evaluation;
  } else if (mandate.rewardsDevelopment) {
    evaluation = 'Development over wins — for now.';
  }

  if (franchise.jobSecurity < 35) patience = Math.max(5, patience - 2);
  if (franchise.jobSecurity > 78) confidence = Math.min(95, confidence + 2);

  return { ...franchise.ownership, evaluation, confidence, patience };
}

export function adjustSeasonReview(
  franchise: Franchise,
  review: SeasonReview,
  playoffResult?: string,
): SeasonReview {
  const mandate = mandateFor(franchise);
  const winPct = franchise.record.wins / Math.max(1, franchise.record.wins + franchise.record.losses);

  if (mandate.rewardsDevelopment && winPct < mandate.targetWinPct + 0.1) {
    const young = franchise.roster.filter((p) => p.age <= 23).length;
    if (young >= 4) {
      return {
        ...review,
        grade: review.grade === 'D' || review.grade === 'F' ? 'C+' : review.grade,
        ownershipVerdict: 'Losses hurt, but the young core showed progress. Stay the course.',
        offseasonPriority: 'Protect picks, develop the core, avoid short-term veteran deals.',
      };
    }
  }

  if (franchise.scenarioId === 'aging_contender') {
    if (!playoffResult || playoffResult === 'Missed Playoffs') {
      return {
        grade: 'F',
        ownershipVerdict: 'Win-now mandate failed. Your job is on the line.',
        primaryIssue: 'Wasted championship window',
        offseasonPriority: 'All-in trade or teardown — decide now.',
      };
    }
    if (playoffResult.includes('First Round')) {
      return {
        grade: 'D',
        ownershipVerdict: 'Early exit with this payroll is unacceptable.',
        primaryIssue: 'Title window slipping away',
        offseasonPriority: 'Major roster upgrade required.',
      };
    }
  }

  if (franchise.scenarioId === 'stuck_middle' && winPct >= 0.42 && winPct <= 0.54) {
    return {
      ...review,
      grade: 'C',
      ownershipVerdict: 'Mediocre again. Ownership demands a plan, not another play-in.',
      offseasonPriority: 'Commit to a lane — sell picks for stars or sell stars for picks.',
    };
  }

  if (franchise.scenarioId === 'small_market_star' && playoffResult === 'Missed Playoffs') {
    return {
      ...review,
      grade: 'D+',
      ownershipVerdict: 'Star patience is running out. Next season must show progress.',
      primaryIssue: 'Roster not good enough around franchise player',
      offseasonPriority: 'Upgrade supporting cast without breaking future flexibility.',
    };
  }

  return review;
}

export interface TradeMarketModifiers {
  pickIncomingBias: number;
  starSalePressure: number;
  contenderPremium: number;
  suppressWinNowOffers: boolean;
}

export function tradeMarketModifiers(franchise: Franchise): TradeMarketModifiers {
  const strategy = strategyForFranchise(franchise);
  if (strategy === 'rebuild' || strategy === 'tank') {
    return { pickIncomingBias: 2, starSalePressure: 0.85, contenderPremium: 0.6, suppressWinNowOffers: true };
  }
  if (strategy === 'all_in') {
    return { pickIncomingBias: 0, starSalePressure: 0, contenderPremium: 1.45, suppressWinNowOffers: false };
  }
  if (strategy === 'contend') {
    return { pickIncomingBias: 0, starSalePressure: 0.15, contenderPremium: 1.25, suppressWinNowOffers: false };
  }
  return { pickIncomingBias: 1, starSalePressure: 0.35, contenderPremium: 0.95, suppressWinNowOffers: false };
}

export function applyTradeMarketModifiers(offers: TradeOffer[], franchise: Franchise): TradeOffer[] {
  const mod = tradeMarketModifiers(franchise);
  return offers.map((o) => {
    let delta = o.analysis.titleOddsDelta;
    if (mod.suppressWinNowOffers && delta > 0) delta = Math.round(delta * 0.65);
    else if (mod.contenderPremium > 1 && delta > 0) delta = Math.round(delta * mod.contenderPremium);
    else if (mod.contenderPremium < 1 && delta > 0) delta = Math.round(delta * mod.contenderPremium);
    return { ...o, analysis: { ...o.analysis, titleOddsDelta: delta } };
  });
}

/** How many top first-round slots get a quality bump — bad teams see stronger boards. */
export function draftClassQualityBias(franchise: Franchise): number {
  const pick = franchise.draftPickNumber ?? 14;
  let bias = Math.max(0, 16 - pick);

  const prior = franchise.regularSeasonRecord ?? franchise.record;
  const priorGames = prior.wins + prior.losses;
  if (priorGames >= 40) {
    const winPct = prior.wins / priorGames;
    if (winPct < 0.32) bias += 5;
    else if (winPct < 0.42) bias += 3;
    else if (winPct > 0.58) bias -= 3;
  }

  if (franchise.scenarioId === 'lottery_rebuild') bias += 2;
  if (franchise.scenarioId === 'aging_contender') bias -= 2;

  return clamp(bias, 0, 20);
}

interface CareerBeat {
  id: string;
  scenarioId: ScenarioId;
  minSeason: number;
  triggerWeek: number;
  phase?: Franchise['phase'];
  build: (f: Franchise) => PendingEvent;
}

function franchiseStar(franchise: Franchise): Player | undefined {
  return franchise.roster.find((p) => p.isStar) ?? [...franchise.roster].sort((a, b) => b.overall - a.overall)[0];
}

const CAREER_BEATS: CareerBeat[] = [
  {
    id: 'lottery_s2_star_help',
    scenarioId: 'lottery_rebuild',
    minSeason: 2,
    triggerWeek: 10,
    build: (f) => {
      const star = franchiseStar(f);
      const name = star ? `${star.firstName} ${star.lastName}` : 'Your cornerstone';
      return {
        id: uid('ev'),
        type: 'star_unhappy',
        title: 'Cornerstone Wants Help',
        body: `${name} told the front office he is tired of losing close games alone. "I want to compete, but I need a real second option — or clarity on the timeline."`,
        options: [
          { id: 'promise', label: 'Promise roster upgrade by deadline', effects: 'Star calms down. Pressure to deliver at deadline.' },
          { id: 'timeline', label: 'Reaffirm multi-year rebuild timeline', effects: 'Star morale dips. Job security stable with ownership.' },
          { id: 'trade', label: 'Quietly gauge trade market', effects: 'Opens star-sale offers. Leak risk.' },
        ],
      };
    },
  },
  {
    id: 'lottery_s3_extension',
    scenarioId: 'lottery_rebuild',
    minSeason: 3,
    triggerWeek: 28,
    phase: 'trade_deadline',
    build: (f) => {
      const star = franchiseStar(f);
      const name = star ? `${star.firstName} ${star.lastName}` : 'Your star';
      return {
        id: uid('ev'),
        type: 'ownership',
        title: 'Extension Crossroads',
        body: `${name}'s camp wants an extension talk before the deadline. Ownership: "We can extend on a team-friendly deal, or trade him for a pick haul — not both."`,
        options: [
          { id: 'extend', label: 'Open extension talks', effects: 'Locks in star. Limits future cap flexibility.' },
          { id: 'trade', label: 'Shop the star now', effects: 'Premium pick offers incoming.' },
          { id: 'wait', label: 'Table talks until offseason', effects: 'Star frustration grows. Keeps options open.' },
        ],
      };
    },
  },
  {
    id: 'contender_s2_injury',
    scenarioId: 'aging_contender',
    minSeason: 2,
    triggerWeek: 14,
    build: (f) => {
      const star = franchiseStar(f);
      const name = star ? `${star.firstName} ${star.lastName}` : 'A core veteran';
      return {
        id: uid('ev'),
        type: 'ownership',
        title: 'Window Warning',
        body: `${name} is logging heavy minutes at age ${star?.age ?? 33}. The training staff flagged load management. Ownership expects you to push for a top-4 seed anyway.`,
        options: [
          { id: 'push', label: 'Push for wins — limit rest', effects: 'Playoff odds up. Injury risk rises.' },
          { id: 'manage', label: 'Manage minutes — protect legs', effects: 'Star happy. Owner confidence dips slightly.' },
          { id: 'trade', label: 'Add depth before deadline', effects: 'Opens win-now trade market.' },
        ],
      };
    },
  },
  {
    id: 'contender_s3_tax',
    scenarioId: 'aging_contender',
    minSeason: 3,
    triggerWeek: 32,
    phase: 'trade_deadline',
    build: (f) => ({
      id: uid('ev'),
      type: 'ownership',
      title: 'Luxury Tax Ultimatum',
      body: `Projected tax bill: $${Math.round((f.cap.taxBill || 12_000_000) / 1_000_000)}M. Ownership: "One more move puts us deep in the tax. It has to be the piece that wins a title."`,
      options: [
        { id: 'all_in', label: 'Pay the tax — go all in', effects: 'Owner expects Finals. Job security tied to playoffs.' },
        { id: 'hold', label: 'Stand pat — trust the core', effects: 'Tax avoided. Star may grumble.' },
        { id: 'shed', label: 'Shed salary for flexibility', effects: 'Future flexibility. Win-now window narrows.' },
      ],
    }),
  },
  {
    id: 'middle_s2_fork',
    scenarioId: 'stuck_middle',
    minSeason: 2,
    triggerWeek: 8,
    build: (f) => ({
      id: uid('ev'),
      type: 'ownership',
      title: 'Direction Fork',
      body: `Record: ${f.record.wins}–${f.record.losses}. Ownership called a meeting: "We are tired of play-in purgatory. Commit to a path by the trade deadline."`,
      options: [
        { id: 'tank', label: 'Sell veterans — embrace lottery odds', effects: 'Pick offers improve. Fan mood drops.' },
        { id: 'push', label: 'Trade picks for a star push', effects: 'Win-now offers unlock. Future mortgaged.' },
        { id: 'status', label: 'Run it back — incremental moves only', effects: 'Owner patience shrinks. Lowest risk path.' },
      ],
    }),
  },
  {
    id: 'middle_s3_ultimatum',
    scenarioId: 'stuck_middle',
    minSeason: 3,
    triggerWeek: 20,
    build: (f) => ({
      id: uid('ev'),
      type: 'ownership',
      title: 'Ownership Ultimatum',
      body: `Playoff odds sit at ${f.playoffOdds}%. The owner told media: "This roster should be a playoff team. If not, changes happen at the top."`,
      options: [
        { id: 'respond', label: 'Publicly back the roster — win out', effects: 'Pressure rises. Team responds or collapses.' },
        { id: 'shakeup', label: 'Shake up rotation or coaching', effects: 'Locker room volatility. Short-term bump possible.' },
        { id: 'trade', label: 'Force a major trade', effects: 'Opens aggressive trade market.' },
      ],
    }),
  },
  {
    id: 'small_s2_upgrade',
    scenarioId: 'small_market_star',
    minSeason: 2,
    triggerWeek: 12,
    build: (f) => {
      const star = franchiseStar(f);
      return {
        id: uid('ev'),
        type: 'star_unhappy',
        title: 'Star Demands Upgrades',
        body: `${star?.firstName ?? 'Your'} ${star?.lastName ?? 'star'}'s agent leaked that other teams are calling. "He will not waste his prime on a first-round exit."`,
        options: [
          { id: 'add', label: 'Commit assets for a second star', effects: 'Contender offers appear. Picks on the table.' },
          { id: 'reassure', label: 'Reassure star — internal growth plan', effects: 'Star mood stabilizes. Playoff pressure remains.' },
          { id: 'listen', label: 'Listen to trade offers', effects: 'Star market opens. Small-market backlash.' },
        ],
      };
    },
  },
  {
    id: 'small_s3_free_agency',
    scenarioId: 'small_market_star',
    minSeason: 3,
    triggerWeek: 1,
    phase: 'contract_renewals',
    build: (f) => {
      const star = franchiseStar(f);
      const name = star ? `${star.firstName} ${star.lastName}` : 'Your franchise star';
      return {
        id: uid('ev'),
        type: 'ownership',
        title: 'Extension Deadline',
        body: `${name} can test free agency next summer without an extension. Ownership: "Max him and build around him, or trade him while we still get value."`,
        options: [
          { id: 'max', label: 'Prepare max extension offer', effects: 'Star locked long-term. Cap sheet tightens.' },
          { id: 'trade', label: 'Explore sign-and-trade / deal now', effects: 'Star trade packages incoming.' },
          { id: 'evaluate', label: 'Wait — evaluate after this season', effects: 'Star loyalty tested. Keeps flexibility.' },
        ],
      };
    },
  },
];

export function generateCareerBeat(franchise: Franchise): { event: PendingEvent; beatId: string } | null {
  const seen = new Set(franchise.careerBeatsSeen ?? []);
  if (!franchise.scenarioId) return null;

  for (const beat of CAREER_BEATS) {
    if (seen.has(beat.id)) continue;
    if (beat.scenarioId !== franchise.scenarioId) continue;
    if (franchise.season < beat.minSeason) continue;
    if (franchise.week !== beat.triggerWeek) continue;
    if (beat.phase && franchise.phase !== beat.phase) continue;
    return { event: beat.build(franchise), beatId: beat.id };
  }
  return null;
}

export function markCareerBeatSeen(franchise: Franchise, beatId: string): Franchise {
  const seen = franchise.careerBeatsSeen ?? [];
  if (seen.includes(beatId)) return franchise;
  return { ...franchise, careerBeatsSeen: [...seen, beatId] };
}

export function resolveCareerEvent(
  franchise: Franchise,
  event: PendingEvent,
  optionId: string,
): Franchise {
  let next = franchise;

  if (event.type === 'star_unhappy') {
    if (optionId === 'promise' || optionId === 'reassure') {
      next = {
        ...next,
        starHappiness: 'Happy',
        starHappinessReason: 'Front office promised roster help.',
        ownership: { ...next.ownership, confidence: clamp(next.ownership.confidence + 3, 10, 95) },
      };
    } else if (optionId === 'timeline') {
      next = {
        ...next,
        starHappiness: 'Concerned',
        starHappinessReason: 'Rebuild timeline reaffirmed.',
        jobSecurity: clamp(next.jobSecurity + 4, 5, 99),
      };
    } else if (optionId === 'trade' || optionId === 'listen') {
      next = {
        ...next,
        starHappiness: 'Frustrated',
        starHappinessReason: 'Trade rumors circulating.',
      };
    } else if (optionId === 'add') {
      next = {
        ...next,
        starHappiness: 'Stable',
        ownership: { ...next.ownership, confidence: clamp(next.ownership.confidence - 2, 10, 95) },
      };
    }
  }

  if (event.type === 'ownership') {
    if (optionId === 'tank' || optionId === 'timeline') {
      next = {
        ...next,
        jobSecurity: clamp(next.jobSecurity + 5, 5, 99),
        ownership: { ...next.ownership, patience: clamp(next.ownership.patience + 5, 5, 95) },
      };
    } else if (optionId === 'push' || optionId === 'all_in' || optionId === 'respond') {
      next = {
        ...next,
        jobSecurity: clamp(next.jobSecurity - 3, 5, 99),
        ownership: { ...next.ownership, confidence: clamp(next.ownership.confidence + 4, 10, 95) },
      };
    } else if (optionId === 'manage' || optionId === 'hold' || optionId === 'status' || optionId === 'evaluate') {
      next = {
        ...next,
        ownership: { ...next.ownership, patience: clamp(next.ownership.patience - 3, 5, 95) },
      };
    } else if (optionId === 'max' || optionId === 'extend') {
      next = {
        ...next,
        starHappiness: 'Happy',
        ownership: { ...next.ownership, confidence: clamp(next.ownership.confidence + 5, 10, 95) },
      };
    } else if (optionId === 'shed') {
      next = {
        ...next,
        titleOdds: Math.max(0, next.titleOdds - 4),
        ownership: { ...next.ownership, confidence: clamp(next.ownership.confidence - 4, 10, 95) },
      };
    }
  }

  return next;
}

/** Extra trade offers shaped by career window — caller supplies player factory. */
export function buildCareerTradeExtras(
  franchise: Franchise,
  partners: LeagueTeam[],
  makePlayer: (team: LeagueTeam, role: 'star' | 'vet' | 'wing') => Player,
): TradeOffer[] {
  const mod = tradeMarketModifiers(franchise);
  const offers: TradeOffer[] = [];
  const young = franchise.roster.filter((p) => p.age < 25 && p.overall >= 68 && !p.isStar);
  const star = franchise.roster.find((p) => p.isStar);

  if (mod.pickIncomingBias > 0 && young.length) {
    const partner = partners.find((t) => t.strategy === 'all_in' || t.strategy === 'contend') ?? partners[0];
    offers.push({
      id: uid('tr'),
      partnerTeam: partner.fullName,
      incoming: {
        description: '2028 unprotected 1st + 2029 1st (top-8 protected)',
        players: [],
        picks: [
          { year: 2028, round: 1, originalTeam: partner.name },
          { year: 2029, round: 1, originalTeam: partner.name, protections: 'top-8 protected' },
        ],
      },
      outgoing: {
        description: `${young[0].firstName} ${young[0].lastName} — young core asset`,
        players: [young[0]],
        picks: [],
      },
      analysis: {
        shortTerm: 'Rotation thins immediately.',
        longTerm: `${partner.fullName} overpaying for upside — strong pick return for a rebuild.`,
        lockerRoom: 'Honest rebuild signal to the locker room.',
        fanReaction: 'Polarizing — future vs. present.',
        mediaRisk: 'Low if picks convey.',
        titleOddsDelta: -7,
      },
      expiresWeek: franchise.week + 2,
    });
  }

  if (mod.contenderPremium >= 1.2 && franchise.draftPicks.length >= 1) {
    const partner = partners.find((t) => t.strategy === 'rebuild' || t.strategy === 'tank') ?? partners[partners.length - 1];
    const rental = makePlayer(partner, 'star');
    const pick = franchise.draftPicks[0];
    offers.push({
      id: uid('tr'),
      partnerTeam: partner.fullName,
      incoming: {
        description: `${rental.overall} OVR rental star — playoff pedigree`,
        players: [rental],
        picks: [],
      },
      outgoing: {
        description: `${pick.year} ${pick.round === 1 ? '1st' : '2nd'} + salary filler`,
        players: franchise.roster.filter((p) => p.role === 'Bench').slice(0, 1),
        picks: [pick],
      },
      analysis: {
        shortTerm: 'Title odds spike — win-now move.',
        longTerm: `${partner.fullName} selling their star for picks.`,
        lockerRoom: 'Stars appreciate the commitment.',
        fanReaction: 'Ecstatic — championship push.',
        mediaRisk: 'High if rental walks in free agency.',
        titleOddsDelta: 14,
      },
      expiresWeek: franchise.week + 1,
    });
  }

  if (mod.starSalePressure >= 0.7 && star && franchise.window.includes('Rebuild')) {
    const partner = partners.find((t) => t.market === 'Large' && (t.strategy === 'all_in' || t.strategy === 'contend'));
    if (partner) {
      offers.push({
        id: uid('tr'),
        partnerTeam: partner.fullName,
        incoming: {
          description: 'Three first-round picks + young starting-caliber wing',
          players: [makePlayer(partner, 'wing')],
          picks: [
            { year: 2027, round: 1, originalTeam: partner.name },
            { year: 2028, round: 1, originalTeam: partner.name },
            { year: 2030, round: 1, originalTeam: partner.name },
          ],
        },
        outgoing: {
          description: `${star.firstName} ${star.lastName} — franchise star`,
          players: [star],
          picks: [],
        },
        analysis: {
          shortTerm: 'Immediate step back.',
          longTerm: 'Historic pick haul — sets up the next core.',
          lockerRoom: 'Devastating short-term, honest rebuild signal.',
          fanReaction: 'Polarizing.',
          mediaRisk: 'High if picks land low.',
          titleOddsDelta: -18,
        },
        expiresWeek: franchise.week + 3,
      });
    }
  }

  return offers;
}