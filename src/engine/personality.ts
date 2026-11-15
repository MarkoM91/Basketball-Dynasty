/**
 * Player personalities. Every player has one or two traits that change how he plays, develops,
 * negotiates and reacts. Traits are derived from the player's id (stable, and existing saves get
 * them without a migration); players created from a free agent or prospect copy them across.
 */
import type { Franchise, PendingEvent, Player, PlayerTrait } from '../types/game';
import { hashString } from '../lib/visuals/hash';
import { uid } from '../data/scenarios';

export interface TraitInfo {
  label: string;
  /** One line for chips and tooltips. */
  short: string;
  tone: 'good' | 'bad' | 'mixed';
}

export const TRAITS: Record<PlayerTrait, TraitInfo> = {
  leader: { label: 'Mentor', short: 'Young teammates develop faster', tone: 'good' },
  gym_rat: { label: 'Gym rat', short: 'Develops faster', tone: 'good' },
  clutch: { label: 'Clutch', short: 'Lifts the team in close games', tone: 'good' },
  iron_man: { label: 'Iron man', short: 'Tires slower, rarely injured', tone: 'good' },
  loyal: { label: 'Loyal', short: 'Re-signs cheaper, never demands a trade', tone: 'good' },
  ring_chaser: { label: 'Wants a ring', short: 'Loves contenders, wants out of losing', tone: 'mixed' },
  diva: { label: 'Diva', short: 'Must start, or the locker room hears about it', tone: 'bad' },
  mercenary: { label: 'Mercenary', short: 'Follows the money', tone: 'mixed' },
};

type TraitSubject = { id: string; age: number; overall: number; traits?: PlayerTrait[] };

const EXCLUSIVE: [PlayerTrait, PlayerTrait][] = [
  ['loyal', 'mercenary'],
  ['loyal', 'diva'],
  ['leader', 'diva'],
];

/** The player's traits (stored ones win; otherwise derived deterministically from the id). */
export function playerTraits(p: TraitSubject): PlayerTrait[] {
  if (p.traits) return p.traits;
  const h = hashString(`${p.id}|traits`);
  const weights: [PlayerTrait, number][] = [
    ['leader', p.age >= 29 ? 5.5 : 0],
    ['gym_rat', p.age <= 25 ? 4 : 1.5],
    ['clutch', p.overall >= 78 ? 3 : 1],
    ['iron_man', 2],
    ['loyal', 2.5],
    ['ring_chaser', p.age >= 29 ? 3.5 : p.overall >= 80 ? 1.5 : 0.5],
    ['diva', p.overall >= 78 ? 2 : 0.8],
    ['mercenary', 2],
  ];
  // About a third of players have a second trait (stars more often).
  const count = (h % 100) < (p.overall >= 82 ? 55 : 30) ? 2 : 1;
  const out: PlayerTrait[] = [];
  let seed = h;
  for (let i = 0; i < 6 && out.length < count; i++) {
    seed = hashString(`${seed}|${i}`);
    const pool = weights.filter(
      ([t, w]) => w > 0 && !out.includes(t) && !EXCLUSIVE.some(([a, b]) => (out.includes(a) && t === b) || (out.includes(b) && t === a)),
    );
    const total = pool.reduce((s, [, w]) => s + w, 0);
    let roll = ((seed % 10_000) / 10_000) * total;
    for (const [t, w] of pool) {
      roll -= w;
      if (roll <= 0) {
        out.push(t);
        break;
      }
    }
  }
  return out;
}

export function hasTrait(p: TraitSubject, t: PlayerTrait): boolean {
  return playerTraits(p).includes(t);
}

// ── Effects ──────────────────────────────────────────────────────────────────

/** Unamplified strength points: clutch starters lift the team, a benched diva drags it. */
export function traitLineupEdge(roster: Player[], starterIds: string[]): number {
  const starters = roster.filter((p) => starterIds.includes(p.id) && !p.injured);
  const clutch = Math.min(2, starters.filter((p) => hasTrait(p, 'clutch')).length) * 0.4;
  const benchedDivas = roster.filter(
    (p) => !p.injured && !starterIds.includes(p.id) && p.overall >= 78 && hasTrait(p, 'diva'),
  ).length;
  return clutch - Math.min(2, benchedDivas) * 0.6;
}

/** Fatigue load multiplier. */
export function fatigueLoadFactor(p: Player): number {
  return hasTrait(p, 'iron_man') ? 0.7 : 1;
}

/** Injury chance multiplier. */
export function injuryFactor(p: Player): number {
  return hasTrait(p, 'iron_man') ? 0.4 : 1;
}

/** Development chance multiplier for one player on this roster. */
export function developmentFactor(p: Player, roster: Player[]): number {
  let f = hasTrait(p, 'gym_rat') ? 1.4 : 1;
  if (p.age <= 24 && roster.some((m) => m.id !== p.id && !m.injured && hasTrait(m, 'leader'))) f *= 1.3;
  return f;
}

/** Salary multiplier when re-signing with his current team. */
export function renewalSalaryFactor(p: Player): number {
  if (hasTrait(p, 'loyal')) return 0.88;
  if (hasTrait(p, 'mercenary')) return 1.1;
  return 1;
}

/** Free-agent interest shift for your team, with a reason to show. */
export function freeAgentTraitInterest(
  fa: TraitSubject,
  franchise: Franchise,
  pitch?: string,
): { delta: number; reason?: string } {
  const games = franchise.record.wins + franchise.record.losses;
  const winPct = games ? franchise.record.wins / games : 0.5;
  const contender = franchise.window.includes('Contender') || franchise.playoffOdds >= 60;
  let delta = 0;
  let reason: string | undefined;
  if (hasTrait(fa, 'ring_chaser')) {
    if (contender) {
      delta += 12;
      reason = 'Wants a ring — likes your chances';
    } else if (winPct < 0.4 || franchise.window.includes('Rebuild')) {
      delta -= 18;
      reason = "Wants a ring — won't sign with a loser";
    }
  }
  if (hasTrait(fa, 'mercenary')) {
    if (pitch === 'max_offer') {
      delta += 8;
      reason = reason ?? 'Mercenary — the money talks';
    } else if (pitch === 'team_friendly') {
      delta -= 10;
      reason = reason ?? 'Mercenary — insulted by a discount';
    }
  }
  if (hasTrait(fa, 'diva') && pitch === 'featured_role') {
    delta += 8;
    reason = reason ?? 'Diva — loves the spotlight promise';
  }
  return { delta, reason };
}

// ── Demands ──────────────────────────────────────────────────────────────────

const demandKey = (franchise: Franchise, p: Player) => `demand-${franchise.season}-${p.id}`;

/**
 * At most one personality-driven demand per week: a ring chaser on a losing team wants out, a
 * benched diva wants to start. Each player demands at most once a season.
 */
export function generateTraitDemand(franchise: Franchise): { event: PendingEvent; key: string } | null {
  if (franchise.phase !== 'regular_season' && franchise.phase !== 'trade_deadline') return null;
  if (franchise.pendingEvents.some((e) => e.type === 'player_demand')) return null;
  const seen = new Set(franchise.careerBeatsSeen ?? []);
  const games = franchise.record.wins + franchise.record.losses;
  const winPct = games ? franchise.record.wins / games : 0.5;
  const starters = franchise.startingFive ?? [];
  const name = (p: Player) => `${p.firstName} ${p.lastName}`;

  const chaser = franchise.roster.find(
    (p) =>
      !p.injured && p.overall >= 80 && hasTrait(p, 'ring_chaser') && !hasTrait(p, 'loyal') &&
      franchise.week >= 8 && games >= 10 && winPct < 0.45 && !seen.has(demandKey(franchise, p)),
  );
  if (chaser) {
    return {
      key: demandKey(franchise, chaser),
      event: {
        id: uid('ev'),
        type: 'player_demand',
        playerId: chaser.id,
        title: `${name(chaser)} wants out`,
        body: `${name(chaser)} (${chaser.overall} OVR, 'Wants a ring') told his agent he didn't come here to lose. At ${franchise.record.wins}–${franchise.record.losses}, he wants a contender — here or somewhere else.`,
        options: [
          { id: 'promise', label: 'Promise to add talent', effects: 'He calms down for now. Locker room watches whether you deliver.' },
          { id: 'trade', label: 'Shop him to contenders', effects: 'Opens the trade market. He stays professional.' },
          { id: 'ignore', label: 'Tell him to play', effects: 'He sulks. Morale and chemistry drop.' },
        ],
      },
    };
  }

  const diva = franchise.roster.find(
    (p) =>
      !p.injured && p.overall >= 78 && hasTrait(p, 'diva') && starters.length === 5 && !starters.includes(p.id) &&
      franchise.week >= 2 && !seen.has(demandKey(franchise, p)),
  );
  if (diva) {
    return {
      key: demandKey(franchise, diva),
      event: {
        id: uid('ev'),
        type: 'player_demand',
        playerId: diva.id,
        title: `${name(diva)} wants to start`,
        body: `${name(diva)} (${diva.overall} OVR, Diva) is unhappy coming off the bench and said so after practice. Teammates are noticing.`,
        options: [
          { id: 'start', label: 'Put him in the starting five', effects: 'He replaces your weakest starter. Happy again.' },
          { id: 'bench', label: 'He earns it like everyone else', effects: 'Coach backs you. He sulks and the locker room tightens.' },
          { id: 'trade', label: 'Shop him', effects: 'Opens the trade market.' },
        ],
      },
    };
  }
  return null;
}

const MORALE_ORDER = ['Happy', 'Stable', 'Concerned', 'Frustrated', 'Angry'] as const;
const worse = (m: Player['morale'], steps = 1): Player['morale'] =>
  MORALE_ORDER[Math.min(MORALE_ORDER.length - 1, MORALE_ORDER.indexOf(m) + steps)];

export function resolveTraitDemand(franchise: Franchise, event: PendingEvent, optionId: string): Franchise {
  const player = franchise.roster.find((p) => p.id === event.playerId);
  if (!player) return franchise;
  const setMorale = (morale: Player['morale']) =>
    franchise.roster.map((p) => (p.id === player.id ? { ...p, morale } : p));

  switch (optionId) {
    case 'promise':
      return { ...franchise, roster: setMorale('Concerned') };
    case 'trade':
      return { ...franchise, roster: setMorale('Stable') };
    case 'ignore':
      return {
        ...franchise,
        roster: setMorale(worse(player.morale, 2)),
        lockerRoom: worse(franchise.lockerRoom),
        starHappiness: player.isStar ? 'Frustrated' : franchise.starHappiness,
      };
    case 'start': {
      const five = franchise.startingFive ?? [];
      // Replace an injured starter first, then his own position, then the weakest.
      const rank = (p: Player) => (p.injured ? 0 : p.position === player.position ? 1 : 2);
      const weakest = five
        .map((id) => franchise.roster.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p))
        .sort((a, b) => rank(a) - rank(b) || a.overall - b.overall)[0];
      const startingFive = weakest ? five.map((id) => (id === weakest.id ? player.id : id)) : five;
      return { ...franchise, startingFive, roster: setMorale('Happy') };
    }
    case 'bench':
      return { ...franchise, roster: setMorale('Angry'), lockerRoom: worse(franchise.lockerRoom) };
    default:
      return franchise;
  }
}
