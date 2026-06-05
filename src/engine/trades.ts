import type { DevFocus, Franchise, PendingEvent, Player, TradeOffer } from '../types/game';
import { applyRosterSize } from '../data/rosterBuilder';
import { rookieScaleSalary } from './salaries';
import { uid } from '../data/scenarios';
import { pickKey } from './cap';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

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
    body: `Record: ${franchise.record.wins}–${franchise.record.losses}. Playoff odds: ${franchise.playoffOdds}%. Star happiness: ${franchise.starHappiness}. Cap flexibility: ${franchise.cap.projectedRoom > 5_000_000 ? 'Moderate' : 'Fragile'}.`,
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
    draftPicks = draftPicks.filter((d) => !(d.year === op.year && d.round === op.round));
  }
  draftPicks = [...draftPicks, ...offer.incoming.picks];

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

  return applyRosterSize({
    ...franchise,
    roster,
    draftPicks,
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
  });
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
    franchise.draftNight?.board.find((p) => p.id === prospectId);
  if (!prospect) return franchise;

  const ovr = prospect.trueOverall ?? prospect.scoutedOverall[1];
  const pot = prospect.truePotential ?? prospect.potential[1];
  const pickLabel = pickNumber ?? franchise.draftPickNumber ?? '?';
  const roundLabel = typeof pickLabel === 'number' && pickLabel > 30 ? 'Round 2' : 'Round 1';
  const player: Player = {
    id: uid('pl'),
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    age: prospect.age,
    position: prospect.position,
    overall: ovr,
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
    role: ovr >= 75 ? 'Starter' : 'Prospect',
    tradeValue: pot - ovr > 12 ? 'High' : 'Medium',
    devTrend: 'Up',
    injuryRisk: prospect.medicalFlag ? 'Medium' : 'Low',
    systemFit: 'Fair',
    gmNote: prospect.scoutNote,
    workEthic: prospect.workEthic,
    minutesPerGame: ovr >= 72 ? 22 : 12,
  };

  return applyRosterSize({
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
  });
}
