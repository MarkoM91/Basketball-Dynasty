import type { Franchise, Player, ScenarioId, TeamStrategy, WindowStatus } from '../types/game';
import { expectedWinsForStrength } from './leagueSchedule';

interface ScenarioProfile {
  window: WindowStatus;
  strategy: TeamStrategy;
  /** Subtracted from lineup strength in game sim — models thin roster / bad fit. */
  simPenalty: number;
  /** Extra penalty when bench depth is thin (lottery teams). */
  depthSimPenalty: number;
  reshape: (franchise: Franchise) => Player[];
}

const WINDOW_LADDER: WindowStatus[] = [
  'Deep Rebuild',
  'Early Rebuild',
  'Developing Core',
  'Expensive Mediocrity',
  'Rising Contender',
  'Aging Contender',
  'Title Contender',
  'Post-Dynasty Decline',
];

const PROFILES: Record<ScenarioId, ScenarioProfile> = {
  lottery_rebuild: {
    window: 'Deep Rebuild',
    strategy: 'rebuild',
    simPenalty: 5,
    depthSimPenalty: 2.5,
    reshape: (f) => reshapeRebuildRoster(f),
  },
  stuck_middle: {
    window: 'Expensive Mediocrity',
    strategy: 'playin',
    simPenalty: 2,
    depthSimPenalty: 1,
    reshape: (f) => reshapeMediocreRoster(f, { cap: 83, depthPenalty: 4 }),
  },
  aging_contender: {
    window: 'Aging Contender',
    strategy: 'all_in',
    simPenalty: 2,
    depthSimPenalty: 1,
    reshape: (f) => reshapeContenderRoster(f, { floor: 76, starBoost: 1 }),
  },
  small_market_star: {
    window: 'Rising Contender',
    strategy: 'contend',
    simPenalty: 1,
    depthSimPenalty: 0,
    reshape: (f) => reshapeContenderRoster(f, { floor: 70, starBoost: 0 }),
  },
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function windowRank(w: WindowStatus): number {
  const idx = WINDOW_LADDER.indexOf(w);
  return idx >= 0 ? idx : 2;
}

function starPlayerId(roster: Player[]): string | undefined {
  return roster.find((p) => p.isStar)?.id ?? [...roster].sort((a, b) => b.overall - a.overall)[0]?.id;
}

function roleForOverall(overall: number, isStarPlayer: boolean): Player['role'] {
  if (isStarPlayer) return 'Star';
  if (overall >= 76) return 'Starter';
  if (overall >= 72) return 'Rotation';
  if (overall >= 67) return 'Bench';
  return 'Prospect';
}

/** Lottery rebuild — one young star (~80–82), thin NBA-quality depth. Target ~28–38 wins year 1. */
function reshapeRebuildRoster(franchise: Franchise): Player[] {
  const starId = starPlayerId(franchise.roster);
  const sorted = [...franchise.roster].sort((a, b) => b.overall - a.overall);
  const rankById = new Map(sorted.map((p, i) => [p.id, i]));

  return franchise.roster.map((p) => {
    const rank = rankById.get(p.id) ?? 99;

    if (p.id === starId) {
      const overall = Math.min(p.overall, 82);
      return {
        ...p,
        overall,
        potential: clamp(Math.min(p.potential, overall + 12), overall, 92),
        isStar: true,
        role: 'Star',
        age: Math.min(p.age, 25),
        gmNote: p.gmNote || 'Young cornerstone — promising, not a finished star yet.',
      };
    }

    let overall: number;
    if (rank === 1 || rank === 2) {
      overall = p.age <= 24
        ? clamp(Math.min(p.overall, 72), 58, 72)
        : clamp(p.overall - 12, 55, 68);
    } else if (rank < 8) {
      overall = clamp(p.overall - 14, 55, 68);
    } else {
      overall = clamp(p.overall - 9, 52, 64);
    }

    return {
      ...p,
      overall,
      potential: clamp(p.potential - 6, overall, overall + 8),
      isStar: false,
      role: roleForOverall(overall, false),
      age: rank < 10 ? Math.min(p.age, 24) : p.age,
    };
  });
}

function reshapeMediocreRoster(
  franchise: Franchise,
  opts: { cap: number; depthPenalty: number },
): Player[] {
  const sorted = [...franchise.roster].sort((a, b) => b.overall - a.overall);
  const keepIds = new Set(sorted.slice(0, 3).map((p) => p.id));
  return franchise.roster.map((p) => {
    if (keepIds.has(p.id)) {
      const overall = Math.min(p.overall, opts.cap);
      return { ...p, overall, role: roleForOverall(overall, p.isStar ?? false) };
    }
    const overall = clamp(p.overall - opts.depthPenalty, 60, 77);
    return { ...p, overall, isStar: false, role: roleForOverall(overall, false) };
  });
}

function reshapeContenderRoster(
  franchise: Franchise,
  opts: { floor: number; starBoost: number },
): Player[] {
  const starId = starPlayerId(franchise.roster);
  return franchise.roster.map((p) => {
    let overall = Math.max(p.overall, opts.floor);
    if (p.id === starId && opts.starBoost) overall = Math.min(95, overall + opts.starBoost);
    return { ...p, overall, role: roleForOverall(overall, p.id === starId) };
  });
}

export function rosterTopEightAvg(roster: Player[]): number {
  const top = [...roster].sort((a, b) => b.overall - a.overall).slice(0, 8);
  return top.reduce((s, p) => s + p.overall, 0) / Math.max(1, top.length);
}

function oddsFromRoster(franchise: Franchise, window: WindowStatus): { playoffOdds: number; titleOdds: number } {
  const strength = teamRatingStrength(franchise);
  const expectedWins = expectedWinsForStrength(strength);
  const winPct = expectedWins / 82;
  let playoffOdds = Math.round(winPct * 100);
  let titleOdds = Math.round(Math.max(0, (strength - 78) * 1.2));

  if (window.includes('Rebuild')) {
    playoffOdds = Math.min(playoffOdds, window === 'Deep Rebuild' ? 12 : 20);
    titleOdds = 0;
  } else if (window === 'Expensive Mediocrity') {
    playoffOdds = clamp(playoffOdds, 32, 55);
    titleOdds = clamp(titleOdds, 0, 2);
  } else if (window === 'Aging Contender') {
    playoffOdds = clamp(playoffOdds, 65, 90);
    titleOdds = clamp(titleOdds, 5, 16);
  } else if (window === 'Rising Contender') {
    playoffOdds = clamp(playoffOdds, 48, 75);
    titleOdds = clamp(titleOdds, 2, 9);
  }

  return { playoffOdds, titleOdds };
}

/** Idempotent — re-applies scenario roster shape after parody-name sync. */
export function ensureScenarioRosterShape(franchise: Franchise): Franchise {
  if (!franchise.scenarioId) return franchise;
  const profile = PROFILES[franchise.scenarioId];
  const roster = profile.reshape(franchise);
  return { ...franchise, roster };
}

/** Effective team strength for sims + league sync — not raw ProBallers average. */
export function teamRatingStrength(franchise: Franchise): number {
  const top8 = rosterTopEightAvg(franchise.roster);
  let strength = top8;

  if (franchise.scenarioId) {
    strength -= PROFILES[franchise.scenarioId].simPenalty * 0.35;
  } else if (franchise.window.includes('Rebuild')) {
    strength -= 2;
  }

  const benchQuality = [...franchise.roster]
    .sort((a, b) => b.overall - a.overall)
    .slice(5, 12)
    .reduce((s, p) => s + p.overall, 0) / 7;
  strength = strength * 0.82 + benchQuality * 0.18;

  return Math.round(strength * 10) / 10;
}

function scenarioWindowCeiling(franchise: Franchise): WindowStatus {
  if (!franchise.scenarioId) return 'Title Contender';

  const top8 = rosterTopEightAvg(franchise.roster);
  const startSeason = franchise.scenarioStartSeason ?? franchise.season;
  const yearsIn = Math.max(1, franchise.season - startSeason + 1);

  if (franchise.scenarioId === 'lottery_rebuild') {
    if (top8 < 69 || yearsIn < 2) return 'Deep Rebuild';
    if (top8 < 71 || yearsIn < 3) return 'Early Rebuild';
    if (top8 < 74 || yearsIn < 4) return 'Developing Core';
    if (top8 < 77 || yearsIn < 5) return 'Rising Contender';
    return 'Rising Contender';
  }

  if (franchise.scenarioId === 'stuck_middle') {
    if (yearsIn < 2) return 'Expensive Mediocrity';
    if (top8 < 76) return 'Expensive Mediocrity';
    if (top8 < 79) return 'Rising Contender';
    return 'Title Contender';
  }

  if (franchise.scenarioId === 'aging_contender') {
    return top8 >= 80 ? 'Title Contender' : 'Aging Contender';
  }

  return PROFILES[franchise.scenarioId].window;
}

function computeRawWindow(franchise: Franchise): WindowStatus {
  const core = franchise.roster.filter((p) => p.overall >= 75);
  const avgAge = core.length ? core.reduce((s, p) => s + p.age, 0) / core.length : 24;
  const stars = franchise.roster.filter((p) => p.overall >= 85).length;
  const avgOvr = franchise.roster.reduce((s, p) => s + p.overall, 0) / franchise.roster.length;

  if (stars >= 2 && avgAge < 28) return 'Title Contender';
  if (stars >= 1 && avgAge < 27) return 'Rising Contender';
  if (stars >= 1 && avgAge >= 30) return 'Aging Contender';
  if (avgOvr < 68) return 'Deep Rebuild';
  if (avgOvr < 71) return 'Early Rebuild';
  if (avgOvr >= 76 && stars === 0) return 'Expensive Mediocrity';
  if (avgAge >= 31) return 'Post-Dynasty Decline';
  return 'Developing Core';
}

/** Slow window progression — max +1 tier per season for scenario careers. */
export function evolveFranchiseWindow(franchise: Franchise): WindowStatus {
  if (!franchise.scenarioId) return computeRawWindow(franchise);

  const profile = PROFILES[franchise.scenarioId];
  const ceiling = scenarioWindowCeiling(franchise);
  const raw = computeRawWindow(franchise);
  const ceilingRank = windowRank(ceiling);
  const rawRank = Math.min(windowRank(raw), ceilingRank);
  const currentRank = windowRank(franchise.window);
  const profileRank = windowRank(profile.window);

  const targetRank = Math.max(profileRank, Math.min(rawRank, ceilingRank));

  if (targetRank > currentRank) {
    const lastBump = franchise.scenarioLastWindowSeason ?? startSeason(franchise) - 1;
    if (franchise.season <= lastBump) {
      return WINDOW_LADDER[currentRank];
    }
    return WINDOW_LADDER[Math.min(currentRank + 1, targetRank, ceilingRank)];
  }

  if (targetRank < currentRank - 1) {
    return WINDOW_LADDER[currentRank - 1];
  }

  return WINDOW_LADDER[Math.max(targetRank, profileRank)];
}

function startSeason(franchise: Franchise): number {
  return franchise.scenarioStartSeason ?? franchise.season;
}

export function windowSeasonBump(franchise: Franchise, newWindow: WindowStatus): Partial<Franchise> {
  if (!franchise.scenarioId) return {};
  if (windowRank(newWindow) > windowRank(franchise.window)) {
    return { scenarioLastWindowSeason: franchise.season };
  }
  return {};
}

export function refreshScenarioOdds(franchise: Franchise): { playoffOdds: number; titleOdds: number } {
  return oddsFromRoster(franchise, franchise.window);
}

export function strategyForFranchise(franchise: Franchise): TeamStrategy {
  if (franchise.scenarioId) {
    return PROFILES[franchise.scenarioId].strategy;
  }
  if (franchise.window.includes('Rebuild')) return 'rebuild';
  if (franchise.window === 'Expensive Mediocrity') return 'playin';
  if (franchise.window === 'Aging Contender') return 'all_in';
  return 'contend';
}

export function lineupSimAdjustment(franchise: Franchise): number {
  let adj = 0;
  if (franchise.scenarioId) {
    adj -= PROFILES[franchise.scenarioId].simPenalty;
  } else if (franchise.window.includes('Deep Rebuild')) {
    adj -= 5;
  } else if (franchise.window.includes('Early Rebuild')) {
    adj -= 3;
  } else if (franchise.window === 'Expensive Mediocrity') {
    adj -= 2;
  } else if (franchise.window.includes('Contender')) {
    adj += 0;
  }

  if (franchise.scenarioId === 'lottery_rebuild' || franchise.window.includes('Rebuild')) {
    const bench = [...franchise.roster]
      .sort((a, b) => b.overall - a.overall)
      .slice(5, 12);
    const benchAvg = bench.reduce((s, p) => s + p.overall, 0) / Math.max(1, bench.length);
    if (benchAvg < 66) adj -= 2;
    else if (benchAvg < 68) adj -= 1;
  }

  return adj;
}

export function applyScenarioProfile(
  franchise: Franchise,
  scenarioId: ScenarioId | null,
): Franchise {
  if (!scenarioId) return franchise;

  const profile = PROFILES[scenarioId];
  const roster = profile.reshape(franchise);
  const shaped: Franchise = {
    ...franchise,
    roster,
    scenarioId,
    window: profile.window,
    scenarioStartSeason: franchise.scenarioStartSeason ?? franchise.season,
  };
  const odds = oddsFromRoster(shaped, profile.window);

  return {
    ...shaped,
    playoffOdds: odds.playoffOdds,
    titleOdds: odds.titleOdds,
  };
}
