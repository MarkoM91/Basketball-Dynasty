import type {
  CapOutlook,
  Franchise,
  Player,
  Prospect,
  Scenario,
  ScenarioId,
  WindowStatus,
} from '../types/game';
import { fillRosterTo18 } from './rosterBuilder';
import { takeTeamRosterName } from './names';
import { marketSalary } from '../engine/salaries';
import { buildTeamCoach } from '../engine/coaches';
import { LEAGUE_CALENDAR_YEAR } from './leagueWorld';

let idCounter = 0;
export function uid(prefix = 'p'): string {
  return `${prefix}_${++idCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function makePlayer(partial: Partial<Player> & Pick<Player, 'firstName' | 'lastName' | 'position' | 'overall' | 'potential'>): Player {
  const age = partial.age ?? 24;
  const overall = partial.overall;
  const potential = partial.potential;
  return {
    id: uid('pl'),
    age,
    contract: partial.contract ?? { yearsRemaining: 2, annualSalary: 12_000_000, isMax: false, isExpiring: false },
    morale: partial.morale ?? 'Stable',
    role: partial.role ?? 'Starter',
    tradeValue: partial.tradeValue ?? (overall >= 85 ? 'Premium' : overall >= 78 ? 'High' : overall >= 72 ? 'Medium' : 'Low'),
    devTrend: partial.devTrend ?? 'Stable',
    injuryRisk: partial.injuryRisk ?? 'Low',
    systemFit: partial.systemFit ?? 'Good',
    gmNote: partial.gmNote ?? '',
    workEthic: partial.workEthic ?? 'High',
    minutesPerGame: partial.minutesPerGame ?? 28,
    ...partial,
    overall,
    potential,
  };
}

export function makeProspect(partial: Partial<Prospect> & Pick<Prospect, 'firstName' | 'lastName' | 'position' | 'archetype'>): Prospect {
  const low = partial.scoutedOverall?.[0] ?? 65;
  const high = partial.scoutedOverall?.[1] ?? low + 6;
  const potLow = partial.potential?.[0] ?? 78;
  const potHigh = partial.potential?.[1] ?? potLow + 10;
  return {
    id: uid('pr'),
    age: partial.age ?? 19,
    scoutedOverall: [low, high],
    potential: [potLow, potHigh],
    floor: partial.floor ?? low - 4,
    ceiling: partial.ceiling ?? potHigh,
    bustRisk: partial.bustRisk ?? 'Medium',
    workEthic: partial.workEthic ?? 'High',
    personality: partial.personality ?? 'Competitive',
    interviewGrade: partial.interviewGrade ?? 'Coachable, confident',
    workoutGrade: partial.workoutGrade ?? 'Solid',
    scoutNote: partial.scoutNote ?? 'Tools are obvious. Upside depends on shooting development.',
    trueOverall: partial.trueOverall ?? Math.round((low + high) / 2 + (Math.random() * 4 - 2)),
    truePotential: partial.truePotential ?? Math.round((potLow + potHigh) / 2 + (Math.random() * 6 - 3)),
    ...partial,
  };
}

function baseCap(payroll: number): CapOutlook {
  const capLimit = 140_000_000;
  const luxuryTaxLine = 170_000_000;
  const secondApron = 189_000_000;
  const inLuxuryTax = payroll > luxuryTaxLine;
  return {
    payroll,
    capLimit,
    luxuryTaxLine,
    secondApron,
    inLuxuryTax,
    inSecondApron: payroll > secondApron,
    projectedRoom: Math.max(0, capLimit - payroll),
    deadMoney: payroll > 155_000_000 ? 2_400_000 : 0,
    taxBill: inLuxuryTax ? Math.round((payroll - luxuryTaxLine) * 1.75) : 0,
    mleAvailable: inLuxuryTax ? 5_000_000 : 12_800_000,
    roomAvailable: Math.max(0, capLimit - payroll),
    baeAvailable: inLuxuryTax ? 0 : 4_700_000,
    hardCapped: payroll > secondApron,
    warnings: inLuxuryTax
      ? ['Luxury tax active. Ownership expects deep playoff run to justify cost.']
      : payroll > capLimit * 0.95
        ? ['Cap space tight. Max extension could push team into tax by next season.']
        : [],
  };
}

function windowFromRoster(roster: Player[]): { window: WindowStatus; coreAge: number } {
  const core = roster.filter((p) => p.overall >= 75);
  const avgAge = core.length ? core.reduce((s, p) => s + p.age, 0) / core.length : 24;
  const stars = roster.filter((p) => p.overall >= 85).length;
  const avgOvr = roster.reduce((s, p) => s + p.overall, 0) / roster.length;

  let window: WindowStatus = 'Developing Core';
  if (stars >= 2 && avgAge < 28) window = 'Title Contender';
  else if (stars >= 1 && avgAge < 27) window = 'Rising Contender';
  else if (stars >= 1 && avgAge >= 30) window = 'Aging Contender';
  else if (avgOvr < 72) window = 'Early Rebuild';
  else if (avgOvr < 74 && avgAge < 24) window = 'Deep Rebuild';
  else if (avgOvr >= 76 && stars === 0) window = 'Expensive Mediocrity';
  else if (avgAge >= 31) window = 'Post-Dynasty Decline';

  return { window, coreAge: Math.round(avgAge * 10) / 10 };
}

function scenarioFranchise(
  city: string,
  name: string,
  roster: Player[],
  extras: Partial<Franchise>,
): Omit<Franchise, 'id'> {
  const payroll = roster.reduce((s, p) => s + p.contract.annualSalary, 0);
  const { window, coreAge } = windowFromRoster(roster);
  return {
    leagueTeamId: '',
    city,
    name,
    market: extras.market ?? 'Mid',
    record: extras.record ?? { wins: 0, losses: 0 },
    season: extras.season ?? 3,
    week: extras.week ?? 1,
    phase: extras.phase ?? 'regular_season',
    roster: fillRosterTo18(roster),
    draftPicks: extras.draftPicks ?? [
      { year: LEAGUE_CALENDAR_YEAR + 2, round: 1, originalTeam: name, protections: 'Top-8 protected' },
      { year: LEAGUE_CALENDAR_YEAR + 3, round: 1, originalTeam: name },
      { year: LEAGUE_CALENDAR_YEAR + 1, round: 2, originalTeam: name },
    ],
    coach: extras.coach ?? buildTeamCoach(city, name),
    ownership: extras.ownership ?? {
      goal: 'Reach playoffs and win a series',
      evaluation: 'On track, but watching payroll closely.',
      risk: 'Missing playoffs reduces job security.',
      confidence: 62,
      patience: 55,
    },
    fanMood: extras.fanMood ?? 'Stable',
    lockerRoom: extras.lockerRoom ?? 'Stable',
    window,
    coreAge,
    cap: baseCap(payroll),
    jobSecurity: extras.jobSecurity ?? 68,
    starHappiness: extras.starHappiness ?? 'Stable',
    starHappinessReason: extras.starHappinessReason,
    playoffOdds: extras.playoffOdds ?? 58,
    titleOdds: extras.titleOdds ?? 4,
    media: extras.media ?? [],
    memory: extras.memory ?? [],
    pendingEvents: extras.pendingEvents ?? [],
    tradeOffers: extras.tradeOffers ?? [],
    tradeBlock: extras.tradeBlock ?? { playerIds: [], pickKeys: [] },
    submittedProposals: extras.submittedProposals ?? [],
    tradeNegotiation: extras.tradeNegotiation ?? null,
    draftBoard: extras.draftBoard ?? [],
    draftPickNumber: extras.draftPickNumber,
    gmName: 'You',
    strategyIdentity: extras.strategyIdentity ?? 'Undefined',
    freeAgents: extras.freeAgents ?? [],
    madePlayoffs: extras.madePlayoffs ?? false,
    ghosts: extras.ghosts ?? [],
    gameLog: extras.gameLog ?? [],
    coachMarket: extras.coachMarket ?? [],
    rfaOffers: extras.rfaOffers ?? [],
    startingFive: extras.startingFive ?? [],
    gamesThisWeek: extras.gamesThisWeek ?? 0,
  };
}

export function buildCustomFranchise(
  city: string,
  name: string,
  market: 'Small' | 'Mid' | 'Large',
): Omit<Franchise, 'id'> {
  const strength = 72 + Math.floor(Math.random() * 12);
  const wins = 0;
  const losses = 0;
  const positions: Player['position'][] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const usedNames = new Set<string>();
  const core = positions.map((position, index) => {
    const overall = strength + (index === 2 ? 5 : index === 4 ? 3 : index === 0 ? 2 : 0);
    const potential = Math.min(94, overall + 6 + (index === 2 ? 4 : 0));
    const named = takeTeamRosterName(city, name, index, usedNames, index * 19);
    const isStar = index === 2;
    return makePlayer({
      firstName: named.firstName,
      lastName: named.lastName,
      position: named.position ?? position,
      age: 23 + index,
      overall,
      potential,
      isStar,
      role: isStar ? 'Star' : 'Starter',
      contract: {
        yearsRemaining: 2 + (index % 2),
        annualSalary: marketSalary(overall, 24 + index),
        isMax: false,
        isExpiring: index === 1,
      },
      gmNote: isStar ? 'Best player on the roster — build around him or trade the timeline.' : 'Core rotation piece.',
    });
  });

  return scenarioFranchise(city, name, core, {
    market,
    record: { wins, losses },
    season: 1,
    week: 1,
    phase: 'regular_season',
    strategyIdentity: 'Fresh start — your vision sets the timeline.',
    ownership: {
      goal: 'Build a winner with patience and smart cap moves.',
      evaluation: 'New GM hire. Prove the direction in year one.',
      risk: 'Another losing season tests ownership patience.',
      confidence: 55,
      patience: 60,
    },
    jobSecurity: 72,
    playoffOdds: clamp(Math.round(45 + (strength - 72) * 2), 8, 78),
    titleOdds: clamp(Math.round(strength - 68), 1, 12),
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  aging_contender: {
    id: 'aging_contender',
    title: 'Aging Contender',
    hook: 'Star in his prime. Expensive roster. Title now.',
    briefing: 'Limited picks, heavy payroll, every move under a microscope.',
    firstDecision: 'Trade future assets for win-now defense, or protect flexibility and risk the star walking?',
    franchise: scenarioFranchise('Chicago', 'Gale', [
      makePlayer({
        firstName: 'Derek', lastName: 'Derozann', position: 'SF', age: 31, overall: 91, potential: 91,
        role: 'Franchise Player', isStar: true, contract: { yearsRemaining: 2, annualSalary: 42_000_000, isMax: true, isExpiring: false },
        morale: 'Concerned', gmNote: 'Wants veteran help before the deadline. Extension talks loom.',
        minutesPerGame: 34, systemFit: 'Excellent', devTrend: 'Stable',
      }),
      makePlayer({
        firstName: 'Marcus', lastName: 'Ellis', position: 'PF', age: 29, overall: 82, potential: 84,
        role: 'Starter', contract: { yearsRemaining: 3, annualSalary: 28_000_000, isMax: false, isExpiring: false },
        gmNote: 'Reliable two-way starter. Trade value high if you pivot.',
      }),
      makePlayer({
        firstName: 'Kai', lastName: 'Reed', position: 'C', age: 33, overall: 79, potential: 79,
        role: 'Starter', contract: { yearsRemaining: 1, annualSalary: 18_000_000, isMax: false, isExpiring: true },
        injuryRisk: 'High', gmNote: 'Rim protection eroding. Expiring deal could be trade chip.',
      }),
      makePlayer({
        firstName: 'Tyrese', lastName: 'Walker', position: 'PG', age: 27, overall: 77, potential: 80,
        role: 'Starter', contract: { yearsRemaining: 2, annualSalary: 14_000_000, isMax: false, isExpiring: false },
        gmNote: 'Floor general, limited creation in clutch moments.',
      }),
      makePlayer({
        firstName: 'Brandon', lastName: 'Hayes', position: 'SF', age: 26, overall: 74, potential: 78,
        role: 'Rotation', contract: { yearsRemaining: 2, annualSalary: 8_000_000, isMax: false, isExpiring: false },
        gmNote: '3-and-D wing. Good trade filler.',
      }),
      makePlayer({
        firstName: 'Noah', lastName: 'Murphy', position: 'SG', age: 24, overall: 71, potential: 82,
        role: 'Sixth Man', contract: { yearsRemaining: 3, annualSalary: 4_200_000, isMax: false, isExpiring: false },
        devTrend: 'Up', gmNote: 'Breakout candidate if minutes stabilize.',
      }),
    ], {
      record: { wins: 24, losses: 18 },
      week: 12,
      strategyIdentity: 'Win now — title window closing',
      ownership: {
        goal: 'Win a championship within 2 seasons',
        evaluation: 'Playoff team, but payroll concerns mounting.',
        risk: 'Early exit could trigger roster overhaul demands.',
        confidence: 55,
        patience: 35,
      },
      starHappiness: 'Concerned',
      starHappinessReason: 'Wants defensive help before trade deadline.',
      playoffOdds: 74,
      titleOdds: 11,
      jobSecurity: 58,
      market: 'Large',
    }),
  },

  lottery_rebuild: {
    id: 'lottery_rebuild',
    title: 'Lottery Rebuild',
    hook: 'No. 2 pick. Young, raw roster.',
    briefing: 'Fans are patient — for now. This draft defines the decade.',
    firstDecision: 'Draft the explosive guard with bust risk, or the safe defensive anchor?',
    franchise: scenarioFranchise('Portland', 'Rose', [
      makePlayer({
        firstName: 'Jalen', lastName: 'Brooks', position: 'SG', age: 21, overall: 74, potential: 90,
        role: 'Star', isStar: true, contract: { yearsRemaining: 1, annualSalary: 9_500_000, isMax: false, isExpiring: true, isRestricted: true, birdYears: 3 },
        devTrend: 'Up', gmNote: 'Franchise cornerstone. Needs defensive growth and a better supporting cast.',
        minutesPerGame: 32,
      }),
      makePlayer({
        firstName: 'Mateo', lastName: 'King', position: 'SF', age: 20, overall: 68, potential: 86,
        role: 'Prospect', contract: { yearsRemaining: 3, annualSalary: 5_100_000, isMax: false, isExpiring: false },
        devTrend: 'Up', gmNote: 'Athletic wing. Jumper is the swing skill.',
      }),
      makePlayer({
        firstName: 'Chris', lastName: 'Davis', position: 'PF', age: 22, overall: 70, potential: 82,
        role: 'Starter', contract: { yearsRemaining: 2, annualSalary: 3_800_000, isMax: false, isExpiring: false },
        gmNote: 'Energy big. Fouls too much.',
      }),
      makePlayer({
        firstName: 'Andre', lastName: 'Williams', position: 'PG', age: 23, overall: 69, potential: 80,
        role: 'Rotation', contract: { yearsRemaining: 1, annualSalary: 2_100_000, isMax: false, isExpiring: false },
        gmNote: 'Backup guard with creation flashes.',
      }),
      makePlayer({
        firstName: 'Malik', lastName: 'Johnson', position: 'C', age: 25, overall: 72, potential: 76,
        role: 'Starter', contract: { yearsRemaining: 2, annualSalary: 11_000_000, isMax: false, isExpiring: false },
        gmNote: 'Veteran anchor on a bad contract. Trade candidate.',
        tradeValue: 'Medium',
      }),
    ], {
      record: { wins: 18, losses: 28 },
      week: 1,
      phase: 'draft_scouting',
      draftPickNumber: 2,
      strategyIdentity: 'Rebuild — accumulate young talent',
      ownership: {
        goal: 'Build a sustainable contender within 4 seasons',
        evaluation: 'Patient with losses if young core develops.',
        risk: 'Draft misses will shorten ownership patience.',
        confidence: 70,
        patience: 80,
      },
      fanMood: 'Stable',
      playoffOdds: 8,
      titleOdds: 0,
      jobSecurity: 75,
      market: 'Small',
      draftBoard: [
        makeProspect({ firstName: 'Ray', lastName: 'Donovan', position: 'C', archetype: 'Defensive Anchor', scoutedOverall: [68, 72], potential: [78, 84], bustRisk: 'Low', scoutNote: 'High floor defensive center. Limited offensive upside.', workoutGrade: 'Elite defensive drills' }),
        makeProspect({ firstName: 'Vincent', lastName: 'Wembanyamma', position: 'C', archetype: 'Explosive Creator', scoutedOverall: [66, 74], potential: [86, 94], bustRisk: 'High', scoutNote: 'Unlimited upside. Decision-making and defense are major concerns.', personality: 'Confident, streaky', medicalFlag: 'Minor ankle history' }),
        makeProspect({ firstName: 'Eli', lastName: 'Shaw', position: 'SF', archetype: 'Ready-Now Shooter', scoutedOverall: [70, 73], potential: [76, 82], bustRisk: 'Low', scoutNote: 'Older wing. Can help immediately, limited star ceiling.', age: 22 }),
      ],
    }),
  },

  stuck_middle: {
    id: 'stuck_middle',
    title: 'Stuck Middle',
    hook: '38–44 every year. No cap room, no star, no lottery luck.',
    briefing: 'Ownership wants the play-in. The fan base wants a reset.',
    firstDecision: 'Sell veterans at the deadline, or chase the play-in and stay mediocre?',
    franchise: scenarioFranchise('Charlotte', 'Mint', [
      makePlayer({
        firstName: 'Devin', lastName: 'Carter', position: 'SG', age: 28, overall: 80, potential: 82,
        role: 'Star', isStar: true, contract: { yearsRemaining: 3, annualSalary: 31_000_000, isMax: false, isExpiring: false },
        morale: 'Frustrated', gmNote: 'Good player, not a true franchise star. Wants clearer direction.',
      }),
      makePlayer({
        firstName: 'Jordan', lastName: 'Thompson', position: 'PF', age: 30, overall: 76, potential: 76,
        role: 'Starter', contract: { yearsRemaining: 2, annualSalary: 19_000_000, isMax: false, isExpiring: false },
        gmNote: 'Solid starter on an expiring-ish timeline.',
      }),
      makePlayer({
        firstName: 'Isaiah', lastName: 'Murphy', position: 'SF', age: 26, overall: 74, potential: 78,
        role: 'Starter', contract: { yearsRemaining: 3, annualSalary: 14_000_000, isMax: false, isExpiring: false },
      }),
      makePlayer({
        firstName: 'Cam', lastName: 'Reed', position: 'PG', age: 24, overall: 72, potential: 81,
        role: 'Rotation', devTrend: 'Up', gmNote: 'Best trade asset if you commit to rebuild.',
      }),
      makePlayer({
        firstName: 'Elijah', lastName: 'Hayes', position: 'C', age: 29, overall: 73, potential: 73,
        role: 'Starter', contract: { yearsRemaining: 1, annualSalary: 12_000_000, isMax: false, isExpiring: true },
      }),
    ], {
      record: { wins: 22, losses: 22 },
      week: 18,
      phase: 'trade_deadline',
      strategyIdentity: 'Mediocrity trap — choose a direction',
      ownership: { goal: 'Make playoffs this season', evaluation: 'Frustrated with annual play-in losses.', risk: 'Another .500 season may cost your job.', confidence: 45, patience: 40 },
      fanMood: 'Frustrated',
      lockerRoom: 'Concerned',
      playoffOdds: 52,
      titleOdds: 1,
      jobSecurity: 48,
      market: 'Mid',
    }),
  },

  small_market_star: {
    id: 'small_market_star',
    title: 'Small-Market Star',
    hook: '24-year-old star hits free agency. Prove you can contend.',
    briefing: 'One season to sell him on the franchise — or trade him.',
    firstDecision: 'Max him now and build around the contract, or trade him before he walks for nothing?',
    franchise: scenarioFranchise('Milwaukee', 'Hops', [
      makePlayer({
        firstName: 'Gideon', lastName: 'Antetokounmppo', position: 'PF', age: 24, overall: 88, potential: 93,
        role: 'Franchise Player', isStar: true, contract: { yearsRemaining: 1, annualSalary: 12_800_000, isMax: false, isExpiring: true },
        morale: 'Concerned', gmNote: 'Extension eligible. Wants proof of contention before committing long-term.',
        tradeValue: 'Premium',
      }),
      makePlayer({
        firstName: 'Marcus', lastName: 'King', position: 'PG', age: 26, overall: 76, potential: 80,
        role: 'Starter', contract: { yearsRemaining: 2, annualSalary: 16_000_000, isMax: false, isExpiring: false },
        gmNote: 'Secondary creator. Needs a defensive wing beside him.',
      }),
      makePlayer({
        firstName: 'Tyrese', lastName: 'Brooks', position: 'SG', age: 22, overall: 71, potential: 85,
        role: 'Prospect', devTrend: 'Up', contract: { yearsRemaining: 3, annualSalary: 3_200_000, isMax: false, isExpiring: false },
        gmNote: 'Shooter with star potential if defense catches up.',
      }),
      makePlayer({
        firstName: 'Darius', lastName: 'Mason', position: 'C', age: 27, overall: 75, potential: 77,
        role: 'Starter', contract: { yearsRemaining: 2, annualSalary: 13_500_000, isMax: false, isExpiring: false },
      }),
      makePlayer({
        firstName: 'Brandon', lastName: 'Walker', position: 'SF', age: 25, overall: 72, potential: 78,
        role: 'Rotation', contract: { yearsRemaining: 1, annualSalary: 5_500_000, isMax: false, isExpiring: true },
      }),
    ], {
      record: { wins: 26, losses: 16 },
      week: 10,
      strategyIdentity: 'Prove-it season — retain the star',
      starHappiness: 'Concerned',
      starHappinessReason: 'Waiting on roster moves before extension talks.',
      ownership: { goal: 'Extend star and reach Conference Finals', evaluation: 'Supports win-now moves if cost-controlled.', risk: 'Losing star in free agency is unacceptable.', confidence: 60, patience: 50 },
      playoffOdds: 68,
      titleOdds: 5,
      jobSecurity: 65,
      market: 'Small',
    }),
  },
};

export function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

export function playerName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}
