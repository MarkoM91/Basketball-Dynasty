import type { DevFocus, DraftPick, Franchise, PendingEvent, Player, TradeOffer } from '../types/game';
import { rookieScaleSalary } from './salaries';
import { uid } from '../data/scenarios';
import { pickKey } from './cap';
import { resolveCareerEvent } from './careerMode';
import { DRAFT_TEAM_COUNT } from './draftNight';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ── Trade Analyzer ─────────────────────────────────────────────────────────

/** Score a single player as a trade asset (0–100 scale). */
export function scorePlayer(p: Player): number {
  const base = p.overall;

  // Age curve: peak at 26-28, bonus for youth, penalty for old
  const ageMod =
    p.age <= 22 ? 12 :
    p.age <= 24 ? 8 :
    p.age <= 26 ? 4 :
    p.age <= 28 ? 0 :
    p.age <= 30 ? -4 :
    p.age <= 32 ? -10 :
    p.age <= 34 ? -18 : -28;

  // Upside bonus: big gap to potential is valuable
  const upsideMod = Math.round((p.potential - p.overall) * 0.35);

  // Contract efficiency: cheap contracts are assets, bloated ones are liabilities
  const expectedSalary = (p.overall / 100) * 45_000_000;
  const contractMod =
    p.contract.annualSalary < expectedSalary * 0.65 ? 8 :
    p.contract.annualSalary < expectedSalary * 0.9 ? 3 :
    p.contract.annualSalary > expectedSalary * 1.4 ? -8 :
    p.contract.annualSalary > expectedSalary * 1.15 ? -3 : 0;

  // Injury penalty
  const injuryMod = p.injured ? -6 : 0;

  return clamp(base + ageMod + upsideMod + contractMod + injuryMod, 0, 120);
}

/** Score a draft pick as a trade asset. */
export function scorePick(pick: DraftPick, currentSeason: number): number {
  const yearsOut = Math.max(0, pick.year - currentSeason);
  const futureDiscount = yearsOut * 3; // picks further out = less certain
  const isProtected = typeof pick.protections === 'string' && pick.protections.length > 0;
  if (pick.round === 1) return Math.max(10, (isProtected ? 28 : 38) - futureDiscount);
  return Math.max(5, (isProtected ? 10 : 16) - futureDiscount);
}

export type TradeVerdict = 'great' | 'good' | 'fair' | 'overpay' | 'bad' | 'empty';

export interface TradeScore {
  youSend: number;       // total points you give away
  youGet: number;        // total points you receive
  delta: number;         // youGet - youSend (positive = you win)
  verdict: TradeVerdict;
  label: string;         // human-readable verdict
  breakdown: {
    outgoingPlayers: { name: string; score: number }[];
    incomingPlayers: { name: string; score: number }[];
    outgoingPicks: { label: string; score: number }[];
    incomingPicks: { label: string; score: number }[];
  };
}

function verdictFromDelta(delta: number, youSend: number, youGet: number): { verdict: TradeVerdict; label: string } {
  if (youSend === 0 && youGet === 0) return { verdict: 'empty', label: 'No assets selected' };
  if (delta >= 20) return { verdict: 'great', label: 'Strong win for you' };
  if (delta >= 8)  return { verdict: 'good',  label: 'Slight win for you' };
  if (delta >= -7) return { verdict: 'fair',  label: 'Roughly fair' };
  if (delta >= -18) return { verdict: 'overpay', label: 'You overpay slightly' };
  return { verdict: 'bad', label: 'You overpay significantly' };
}

/** Score both sides of a proposed trade and return a verdict. */
export function scoreTrade(
  franchise: Franchise,
  outgoingPlayerIds: string[],
  outgoingPickKeys: string[],
  incomingPlayers: Player[],
  incomingPicks: DraftPick[],
): TradeScore {
  const outPlayers = franchise.roster.filter((p) => outgoingPlayerIds.includes(p.id));
  const outPicks = franchise.draftPicks.filter((pk) => outgoingPickKeys.includes(pickKey(pk)));

  const outPlayerScores = outPlayers.map((p) => ({ name: `${p.firstName} ${p.lastName}`, score: scorePlayer(p) }));
  const inPlayerScores = incomingPlayers.map((p) => ({ name: `${p.firstName} ${p.lastName}`, score: scorePlayer(p) }));
  const outPickScores = outPicks.map((pk) => ({ label: `${pk.year} R${pk.round}`, score: scorePick(pk, franchise.season) }));
  const inPickScores = incomingPicks.map((pk) => ({ label: `${pk.year} R${pk.round}`, score: scorePick(pk, franchise.season) }));

  const youSend = [...outPlayerScores, ...outPickScores].reduce((s, x) => s + x.score, 0);
  const youGet  = [...inPlayerScores, ...inPickScores].reduce((s, x) => s + x.score, 0);
  const delta = youGet - youSend;

  const { verdict, label } = verdictFromDelta(delta, youSend, youGet);

  return {
    youSend,
    youGet,
    delta,
    verdict,
    label,
    breakdown: {
      outgoingPlayers: outPlayerScores,
      incomingPlayers: inPlayerScores,
      outgoingPicks: outPickScores,
      incomingPicks: inPickScores,
    },
  };
}

// ── End Trade Analyzer ──────────────────────────────────────────────────────

export function generateLockerRoomEvent(franchise: Franchise): PendingEvent | null {
  const frustrated = franchise.roster.find((p) => p.morale === 'Frustrated' || p.morale === 'Concerned');
  if (!frustrated || Math.random() > 0.35) return null;

  return {
    id: uid('ev'),
    type: 'locker_room',
    title: 'Locker Room Issue',
    body: `${frustrated.firstName} ${frustrated.lastName} is frustrated with his touches since the rotation shifted. His agent told reporters he wants "clarity about his role."`,
    options: [
      { id: 'meet', label: 'Meet with player — promise defined role', effects: 'Morale improves. Coach flexibility reduced.' },
      { id: 'coach', label: "Back the coach's rotation", effects: 'Coach trust rises. Player morale falls.' },
      { id: 'trade', label: 'Explore trade market quietly', effects: 'Reveals offers. Leak risk.' },
      { id: 'ignore', label: 'Ignore for now', effects: 'No immediate change. Tension may grow.' },
    ],
  };
}

export function generateDeadlineEvent(franchise: Franchise): PendingEvent | null {
  if (franchise.phase !== 'trade_deadline') return null;
  return {
    id: uid('ev'),
    type: 'trade_deadline',
    title: 'Trade Deadline: 6 Hours Remaining',
    body: `Record: ${franchise.record.wins}–${franchise.record.losses}. Playoff odds: ${franchise.playoffOdds}%. Star happiness: ${franchise.starHappiness}. Cap flexibility: ${franchise.cap.effectiveRoom > 5_000_000 ? 'Moderate' : 'Fragile'}.`,
    options: [
      { id: 'review', label: 'Review best available offer', effects: 'Opens trade market.' },
      { id: 'hold', label: 'Hold assets — stand pat', effects: 'Star may react. Future flexibility preserved.' },
      { id: 'cheap', label: 'Search cheaper wing options', effects: 'Lower cost, smaller upgrade.' },
    ],
  };
}

export const DEV_PLANS: Record<DevFocus, { improves: string; risk: string; timeline: string; bestFor: string }> = {
  'Primary Ball Handler': {
    improves: 'Handle, passing, pick-and-roll reads',
    risk: 'Slower defensive development',
    timeline: '8–12 weeks',
    bestFor: 'Young guards with creation potential',
  },
  'Catch-and-Shoot Wing': {
    improves: 'Spot-up shooting, footwork, off-ball movement',
    risk: 'Isolation scoring stagnates',
    timeline: '6–10 weeks',
    bestFor: 'Wings with stroke but limited handle',
  },
  'Defensive Stopper': {
    improves: 'On-ball defense, help rotations, physicality',
    risk: 'Offensive usage may drop',
    timeline: '8–14 weeks',
    bestFor: 'Athletic wings and guards',
  },
  'Rim Protector': {
    improves: 'Block timing, vertical spacing, pick coverage',
    risk: 'Foul rate may rise early',
    timeline: '10–14 weeks',
    bestFor: 'Centers with length',
  },
  'Stretch Big': {
    improves: 'Three-point shooting, pick-and-pop reads',
    risk: 'Post defense development slows',
    timeline: '8–12 weeks',
    bestFor: 'Mobile bigs with touch',
  },
  'Sixth Man Scorer': {
    improves: 'Pull-up shooting, bench creation, pace',
    risk: 'Starter habits hard to build later',
    timeline: '6–8 weeks',
    bestFor: 'High-potential guards off the bench',
  },
  'Playmaking Big': {
    improves: 'Passing, short-roll reads, decision speed',
    risk: 'Post scoring focus reduced',
    timeline: '10–14 weeks',
    bestFor: 'Skilled forwards and centers',
  },
  'Off-Ball Movement': {
    improves: 'Cuts, screens, gravity without the ball',
    risk: 'Ball-handling growth slows',
    timeline: '6–10 weeks',
    bestFor: 'Wings in motion systems',
  },
  'Strength & Conditioning': {
    improves: 'Durability, foul drawing, finishing through contact',
    risk: 'Skill reps reduced',
    timeline: '4–8 weeks',
    bestFor: 'Injury-prone or thin-framed players',
  },
  'Injury Recovery': {
    improves: 'Return timeline, load management readiness',
    risk: 'No skill development this block',
    timeline: 'Varies',
    bestFor: 'Injured roster players',
  },
};

export function executeTrade(franchise: Franchise, offer: TradeOffer): Franchise {
  const outgoingIds = new Set(offer.outgoing.players.map((p) => p.id));
  let roster = franchise.roster.filter((p) => !outgoingIds.has(p.id));
  roster = [...roster, ...offer.incoming.players];

  let draftPicks = [...franchise.draftPicks];
  for (const op of offer.outgoing.picks) {
    // Remove the FIRST matching pick (year + round + originalTeam) so two same-year/round
    // picks from different teams stay distinguishable.
    const idx = draftPicks.findIndex(
      (d) => d.year === op.year && d.round === op.round && (d.originalTeam ?? '') === (op.originalTeam ?? ''),
    );
    if (idx >= 0) {
      draftPicks.splice(idx, 1);
    } else {
      // Legacy offers without originalTeam recorded — fall back to year/round match
      const fallback = draftPicks.findIndex((d) => d.year === op.year && d.round === op.round);
      if (fallback >= 0) draftPicks.splice(fallback, 1);
    }
  }
  draftPicks = [...draftPicks, ...offer.incoming.picks];

  // Keep draftNight in sync — remove traded pick slots from userPickNumbers
  let draftNight = franchise.draftNight;
  if (draftNight?.active && offer.outgoing.picks.length > 0) {
    const tradedRounds = new Set(offer.outgoing.picks.map((p) => p.round));
    const updatedPickNumbers = draftNight.userPickNumbers.filter(
      (n) => !tradedRounds.has(n <= DRAFT_TEAM_COUNT ? 1 : 2),
    );
    if (updatedPickNumbers.length !== draftNight.userPickNumbers.length) {
      const onClock = updatedPickNumbers.includes(draftNight.currentPick);
      draftNight = {
        ...draftNight,
        userPickNumbers: updatedPickNumbers,
        userPickNumber: updatedPickNumbers[0] ?? draftNight.userPickNumber,
        onClock,
      };
    }
  }

  const memory = [
    {
      id: uid('mem'),
      season: franchise.season,
      week: franchise.week,
      text: `Trade completed with ${offer.partnerTeam}. ${offer.analysis.shortTerm}`,
      type: 'trade' as const,
    },
    ...franchise.memory,
  ];

  return {
    ...franchise,
    roster,
    draftPicks,
    draftNight,
    tradeOffers: franchise.tradeOffers.filter((t) => t.id !== offer.id),
    tradeBlock: {
      playerIds: (franchise.tradeBlock?.playerIds ?? []).filter((id) => !outgoingIds.has(id)),
      pickKeys: (franchise.tradeBlock?.pickKeys ?? []).filter(
        (k) => !offer.outgoing.picks.some((p) => pickKey(p) === k),
      ),
    },
    titleOdds: clamp(franchise.titleOdds + offer.analysis.titleOddsDelta, 0, 40),
    memory,
    ownership: {
      ...franchise.ownership,
      confidence: clamp(franchise.ownership.confidence + (offer.analysis.titleOddsDelta > 0 ? 4 : -3), 10, 95),
    },
  };
}

export function setDevFocus(franchise: Franchise, playerId: string, focus: DevFocus): Franchise {
  const roster = franchise.roster.map((p) =>
    p.id === playerId ? { ...p, devFocus: focus } : p,
  );
  return { ...franchise, roster };
}

export function resolveEvent(franchise: Franchise, eventId: string, optionId: string): Franchise {
  const event = franchise.pendingEvents.find((e) => e.id === eventId);
  if (!event) return franchise;

  let updated: Franchise = {
    ...franchise,
    pendingEvents: franchise.pendingEvents.filter((e) => e.id !== eventId),
  };

  if (event.type === 'locker_room') {
    if (optionId === 'meet') {
      updated.lockerRoom = 'Stable';
      updated.roster = updated.roster.map((p) =>
        p.morale === 'Frustrated' || p.morale === 'Concerned' ? { ...p, morale: 'Stable' } : p,
      );
    } else if (optionId === 'coach') {
      updated.coach = { ...updated.coach, lockerRoom: 'Stable' };
      updated.roster = updated.roster.map((p) =>
        p.morale === 'Frustrated' ? { ...p, morale: 'Angry' } : p,
      );
    } else if (optionId === 'trade') {
      /* trade offers refreshed in game store with league context */
    }
  }

  if (event.type === 'star_unhappy' || event.type === 'ownership') {
    updated = resolveCareerEvent(updated, event, optionId);
    if (optionId === 'trade' || optionId === 'listen' || optionId === 'add' || optionId === 'shakeup') {
      /* trade offers refreshed in game store with league context */
    }
  }

  if (event.type === 'trade_deadline' && optionId === 'review') {
    /* trade offers refreshed in game store with league context */
  }

  return updated;
}

export function draftProspect(
  franchise: Franchise,
  prospectId: string,
  pickNumber?: number,
): Franchise {
  const prospect =
    franchise.draftBoard.find((p) => p.id === prospectId) ??
    franchise.draftNight?.board.find((p) => p.id === prospectId) ??
    franchise.draftStash?.find((s) => s.prospect.id === prospectId)?.prospect;
  if (!prospect) return franchise;

  const trueOvr = prospect.trueOverall ?? prospect.scoutedOverall[1];
  const pot = prospect.truePotential ?? prospect.potential[1];
  const pickLabel = pickNumber ?? franchise.draftPickNumber ?? '?';
  const roundLabel = typeof pickLabel === 'number' && pickLabel > 30 ? 'Round 2' : 'Round 1';

  // Scouting fuzz: what the GM sees ≠ true OVR for first 2-3 seasons
  // hiddenOverall stores the true value; overall is the GM's estimate
  const scoutFuzz = Math.round((Math.random() - 0.5) * 6); // ±3
  const displayOvr = Math.max(prospect.floor, Math.min(prospect.ceiling, trueOvr + scoutFuzz));
  // Only apply fuzz if it would actually be different
  const hasHidden = Math.abs(scoutFuzz) >= 2;

  const player: Player = {
    id: uid('pl'),
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    age: prospect.age,
    position: prospect.position,
    overall: trueOvr,
    hiddenOverall: hasHidden ? displayOvr : undefined,
    potential: pot,
    draftSeason: franchise.season,
    draftPick: typeof pickLabel === 'number' ? pickLabel : undefined,
    contract: {
      yearsRemaining: 4,
      annualSalary: rookieScaleSalary(typeof pickLabel === 'number' ? pickLabel : 20),
      isMax: false,
      isExpiring: false,
      signedVia: 'rookie',
    },
    morale: 'Happy',
    // Most rookies are raw prospects — only high-OVR older draftees are starters day 1
    role: trueOvr >= 68 ? 'Starter' : trueOvr >= 60 ? 'Rotation' : 'Prospect',
    // Trade value driven by gap to potential (large gap = high upside = valuable)
    tradeValue: pot - trueOvr >= 22 ? 'High' : pot - trueOvr >= 14 ? 'Medium' : 'Low',
    devTrend: 'Up',
    injuryRisk: prospect.medicalFlag ? 'Medium' : 'Low',
    systemFit: 'Fair',
    gmNote: prospect.scoutNote,
    workEthic: prospect.workEthic,
    // Raw rookies get limited minutes; higher OVR = more ready = more PT
    minutesPerGame: trueOvr >= 65 ? 20 : trueOvr >= 58 ? 14 : 8,
  };

  return {
    ...franchise,
    roster: [...franchise.roster, player],
    memory: [
      {
        id: uid('mem'),
        season: franchise.season,
        week: franchise.week,
        text: `${roundLabel}: Drafted ${prospect.firstName} ${prospect.lastName} at pick #${pickLabel}. Scouts said: "${prospect.scoutNote}"`,
        type: 'draft',
      },
      ...franchise.memory,
    ],
  };
}
