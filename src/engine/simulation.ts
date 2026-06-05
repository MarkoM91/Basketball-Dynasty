import type { Franchise, GameResult, League, MediaItem, MoraleLevel, Player, PlayerRole, Position, WindowStatus } from '../types/game';
import { uid } from '../data/scenarios';
import { rookieScaleSalary } from './salaries';
import { computeCapOutlook } from './cap';
import { opponentStrength, scheduledGameAt, type ScheduleGame, SCHEDULE_GAMES_PER_WEEK, SEASON_GAME_COUNT } from './schedule';
import { applyGameStats, mergeTeamScoring, simulateTeamGameScores } from './stats';

export const GAMES_PER_WEEK = SCHEDULE_GAMES_PER_WEEK;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function moraleModifier(m: MoraleLevel): number {
  switch (m) {
    case 'Happy': return 2;
    case 'Stable': return 0;
    case 'Concerned': return -1;
    case 'Frustrated': return -2;
    case 'Angry': return -4;
  }
}

export function autoStartingFive(franchise: Franchise): string[] {
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const available = [...franchise.roster]
    .filter((p) => !p.injured)
    .sort((a, b) => b.overall - a.overall);
  const picked: string[] = [];
  const used = new Set<string>();

  for (const pos of positions) {
    const match =
      available.find((p) => p.position === pos && !used.has(p.id)) ??
      available.find((p) => !used.has(p.id));
    if (match) {
      picked.push(match.id);
      used.add(match.id);
    }
  }

  while (picked.length < 5) {
    const next = available.find((p) => !used.has(p.id));
    if (!next) break;
    picked.push(next.id);
    used.add(next.id);
  }

  return picked;
}

export function validateStartingFive(
  franchise: Franchise,
  starterIds: string[],
): { ok: boolean; error?: string } {
  if (starterIds.length !== 5) {
    return { ok: false, error: 'Pick exactly 5 starters.' };
  }
  const unique = new Set(starterIds);
  if (unique.size !== 5) {
    return { ok: false, error: 'Each starter must be a different player.' };
  }
  for (const id of starterIds) {
    const player = franchise.roster.find((p) => p.id === id);
    if (!player) return { ok: false, error: 'Invalid player on lineup card.' };
    if (player.injured) return { ok: false, error: `${player.firstName} ${player.lastName} is injured.` };
  }
  return { ok: true };
}

export function lineupStrength(franchise: Franchise, starterIds: string[]): number {
  const starters = starterIds
    .map((id) => franchise.roster.find((p) => p.id === id))
    .filter(Boolean) as Player[];
  if (starters.length < 5) return rosterStrength(franchise);

  const talent = starters.reduce((s, p) => s + p.overall, 0) / starters.length;
  const moraleBonus = moraleModifier(franchise.lockerRoom);
  const coachBonus = (franchise.coach.devRating + franchise.coach.playoffRating) / 40;
  const chemistry = franchise.starHappiness === 'Happy' ? 2 : franchise.starHappiness === 'Angry' ? -3 : 0;
  const starBoost = starters.some((p) => p.isStar) ? 1.5 : 0;
  return talent + moraleBonus + coachBonus + chemistry + starBoost;
}

function rosterStrength(franchise: Franchise): number {
  const ids = franchise.startingFive?.length === 5 ? franchise.startingFive : autoStartingFive(franchise);
  return lineupStrength(franchise, ids);
}
export function simulateSingleGame(
  franchise: Franchise,
  league: League | undefined,
  starterIds: string[],
  scheduled?: ScheduleGame,
): GameResult {
  const strength = lineupStrength(franchise, starterIds);

  let home: boolean;
  let oppName: string;
  let oppStrength: number;
  let gameInWeek: number | undefined;

  if (scheduled && league) {
    home = scheduled.home;
    oppName = scheduled.opponentName;
    oppStrength = opponentStrength(league, scheduled.opponentId);
    gameInWeek = scheduled.gameInWeek;
  } else if (league) {
    const gameSlot = (franchise.gamesThisWeek ?? 0) + 1;
    const fallback = scheduledGameAt(franchise, league, franchise.week, gameSlot);
    if (fallback) {
      home = fallback.home;
      oppName = fallback.opponentName;
      oppStrength = opponentStrength(league, fallback.opponentId);
      gameInWeek = fallback.gameInWeek;
    } else {
      const pool = league.teams.filter((t) => !t.isUser);
      const team = pool[Math.floor(Math.random() * pool.length)];
      home = Math.random() > 0.5;
      oppName = team?.fullName ?? 'Unknown';
      oppStrength = team?.strength ?? 75;
      gameInWeek = gameSlot;
    }
  } else {
    home = Math.random() > 0.5;
    oppName = 'League opponent';
    oppStrength = 72 + Math.random() * 18;
  }

  const homeAdv = home ? 2.5 : 0;
  const result = simulateTeamGameScores(strength, oppStrength, homeAdv);
  const teamScore = result.teamScore;
  const oppScore = result.oppScore;
  const won = result.won;
  const diff = strength + homeAdv - oppStrength;

  let note = won
    ? 'Your starting five controlled tempo and closed strong.'
    : 'Starting unit struggled — rotation depth hurt you.';
  if (won && diff > 8) note = 'Starters dominated — bench sealed it in the fourth.';
  if (!won && diff < -8) note = 'Mismatch on the floor — lineup may need a tweak.';

  return {
    opponent: oppName,
    home,
    teamScore,
    oppScore,
    won,
    note,
    gameInWeek,
  };
}

export function simulateWeekGames(
  franchise: Franchise,
  league?: League,
  gamesCount = GAMES_PER_WEEK,
  starterIds?: string[],
): GameResult[] {
  const ids =
    starterIds ??
    (franchise.startingFive?.length === 5 ? franchise.startingFive : autoStartingFive(franchise));
  const results: GameResult[] = [];

  const startSlot = (franchise.gamesThisWeek ?? 0) + 1;
  for (let i = 0; i < gamesCount; i++) {
    const gameInWeek = startSlot + i;
    const scheduled =
      league ? scheduledGameAt(franchise, league, franchise.week, gameInWeek) : undefined;
    results.push(simulateSingleGame(franchise, league, ids, scheduled));
  }

  return results;
}
export function processWeekResults(
  franchise: Franchise,
  results: GameResult[],
  starterIds?: string[],
): { franchise: Franchise; logEntries: import('../types/game').GameLogEntry[] } {
  const withStats = applyGameStats(franchise, results, starterIds);
  return {
    franchise: {
      ...withStats.franchise,
      gameLog: [...withStats.logEntries, ...franchise.gameLog].slice(0, 80),
    },
    logEntries: withStats.logEntries,
  };
}

export function applyGameResults(franchise: Franchise, results: GameResult[]): Franchise {
  if (results.length === 0) return franchise;

  const played = franchise.regularSeasonRecord
    ? franchise.regularSeasonRecord.wins + franchise.regularSeasonRecord.losses
    : franchise.record.wins + franchise.record.losses;
  if (played >= SEASON_GAME_COUNT) return franchise;

  const wins = results.filter((r) => r.won).length;
  const losses = results.length - wins;
  let record = {
    wins: franchise.record.wins + wins,
    losses: franchise.record.losses + losses,
  };
  const total = record.wins + record.losses;
  if (total > SEASON_GAME_COUNT) {
    const overflow = total - SEASON_GAME_COUNT;
    if (losses >= overflow) {
      record = { wins: record.wins, losses: record.losses - overflow };
    } else {
      record = {
        wins: record.wins - (overflow - losses),
        losses: record.losses - losses,
      };
    }
  }

  const winPct = record.wins / Math.max(1, record.wins + record.losses);
  const playoffOdds = clamp(Math.round(winPct * 100 + (franchise.window.includes('Contender') ? 8 : -5)), 2, 98);
  const titleOdds = clamp(Math.round(playoffOdds * 0.12 + (franchise.roster.some((p) => p.overall >= 90) ? 4 : 0)), 0, 35);

  const headline = results[results.length - 1];
  const media: MediaItem = {
    id: uid('med'),
    headline: headline.won
      ? `${franchise.city} ${franchise.name} edge ${headline.opponent.split(' ')[0]} in tight finish`
      : `${franchise.name} stumble late against ${headline.opponent}`,
    week: franchise.week,
    season: franchise.season,
    tone: headline.won ? 'positive' : 'negative',
  };

  let teamScoring = franchise.teamScoring;
  for (const result of results) {
    teamScoring = mergeTeamScoring(teamScoring, result.teamScore, result.oppScore);
  }

  return {
    ...franchise,
    record,
    teamScoring,
    playoffOdds,
    titleOdds,
    media: [media, ...franchise.media].slice(0, 12),
  };
}

export function advanceDevelopment(franchise: Franchise): Franchise {
  const roster = franchise.roster.map((p) => {
    if (p.injured || p.age >= 32 || p.overall >= p.potential) return p;
    if (!p.devFocus) return p;

    const minutesFactor = p.minutesPerGame >= 24 ? 1 : p.minutesPerGame >= 12 ? 0.4 : 0.1;
    const ethicFactor = p.workEthic === 'Elite' ? 1.2 : p.workEthic === 'High' ? 1 : 0.6;
    const coachFactor = franchise.coach.devRating / 80;
    const scoutingFactor = (franchise.scoutingBudget ?? 5) / 10;
    const chance = minutesFactor * ethicFactor * coachFactor * scoutingFactor * 0.35;

    if (Math.random() > chance) return p;

    const gain = p.age < 23 ? 1 : 0.5;
    const newOvr = Math.min(p.potential, Math.round(p.overall + gain));
    return {
      ...p,
      overall: newOvr,
      devTrend: newOvr > p.overall ? 'Up' as const : p.devTrend,
    };
  });

  return { ...franchise, roster };
}

export function rollInjuries(franchise: Franchise): { franchise: Franchise; injuryNote?: string } {
  const candidate = franchise.roster.find(
    (p) => !p.injured && p.injuryRisk !== 'Low' && Math.random() < (p.injuryRisk === 'High' ? 0.08 : 0.04),
  );
  if (!candidate) return { franchise };

  const weeks = 2 + Math.floor(Math.random() * 6);
  const roster = franchise.roster.map((p) =>
    p.id === candidate.id
      ? { ...p, injured: true, injuryWeeks: weeks, role: 'Injured' as const }
      : p,
  );

  return {
    franchise: { ...franchise, roster, lockerRoom: downgradeMorale(franchise.lockerRoom) },
    injuryNote: `${candidate.firstName} ${candidate.lastName} expected out ${weeks} weeks.`,
  };
}

export function tickInjuries(franchise: Franchise): Franchise {
  const roster = franchise.roster.map((p) => {
    if (!p.injured || !p.injuryWeeks) return p;
    const remaining = p.injuryWeeks - 1;
    if (remaining <= 0) {
      const role: PlayerRole = p.overall >= 80 ? 'Starter' : 'Rotation';
      const { injured, injuryWeeks, ...rest } = p;
      return { ...rest, role };
    }
    return { ...p, injuryWeeks: remaining };
  });
  return { ...franchise, roster };
}

function downgradeMorale(m: MoraleLevel): MoraleLevel {
  const order: MoraleLevel[] = ['Happy', 'Stable', 'Concerned', 'Frustrated', 'Angry'];
  const idx = order.indexOf(m);
  return order[Math.min(order.length - 1, idx + 1)];
}

function upgradeMorale(m: MoraleLevel): MoraleLevel {
  const order: MoraleLevel[] = ['Happy', 'Stable', 'Concerned', 'Frustrated', 'Angry'];
  const idx = order.indexOf(m);
  return order[Math.max(0, idx - 1)];
}

export function computeWindow(franchise: Franchise): WindowStatus {
  const core = franchise.roster.filter((p) => p.overall >= 75);
  const avgAge = core.length ? core.reduce((s, p) => s + p.age, 0) / core.length : 24;
  const stars = franchise.roster.filter((p) => p.overall >= 85).length;
  const avgOvr = franchise.roster.reduce((s, p) => s + p.overall, 0) / franchise.roster.length;

  if (stars >= 2 && avgAge < 28) return 'Title Contender';
  if (stars >= 1 && avgAge < 27) return 'Rising Contender';
  if (stars >= 1 && avgAge >= 30) return 'Aging Contender';
  if (avgOvr < 72) return 'Early Rebuild';
  if (avgOvr >= 76 && stars === 0) return 'Expensive Mediocrity';
  if (avgAge >= 31) return 'Post-Dynasty Decline';
  return 'Developing Core';
}

export function updateJobSecurity(franchise: Franchise): number {
  let score = franchise.jobSecurity;
  const winPct = franchise.record.wins / Math.max(1, franchise.record.wins + franchise.record.losses);

  if (franchise.window.includes('Rebuild') || franchise.window.includes('Developing')) {
    const youngDev = franchise.roster.filter((p) => p.age < 24 && p.devTrend === 'Up').length;
    score += youngDev * 2 - 1;
  } else {
    score += (winPct - 0.5) * 30;
    score += franchise.playoffOdds > 60 ? 3 : -4;
  }

  score += (franchise.ownership.confidence - 50) * 0.05;
  score -= franchise.cap.inLuxuryTax ? 2 : 0;
  return clamp(Math.round(score), 5, 99);
}

export function refreshCap(franchise: Franchise): Franchise {
  return {
    ...franchise,
    cap: computeCapOutlook(franchise),
    window: computeWindow(franchise),
    coreAge: Math.round(
      (franchise.roster.filter((p) => p.overall >= 75).reduce((s, p) => s + p.age, 0) /
        Math.max(1, franchise.roster.filter((p) => p.overall >= 75).length)) * 10,
    ) / 10,
  };
}

export function phaseLabel(phase: Franchise['phase']): string {
  const labels: Record<Franchise['phase'], string> = {
    offseason: 'Offseason',
    draft_scouting: 'Draft Scouting',
    draft_night: 'Draft Night',
    contract_renewals: 'Contract Renewals',
    free_agency: 'Free Agency',
    training_camp: 'Training Camp',
    regular_season: 'Regular Season',
    trade_deadline: 'Trade Deadline',
    playoffs: 'Playoffs',
    season_review: 'Season Review',
  };
  return labels[phase];
}

export function statusFromRecord(f: Franchise): string {
  const games = f.record.wins + f.record.losses;
  if (games === 0) return 'Season opener ahead';
  if (f.playoffOdds >= 75) return 'Playoff team';
  if (f.playoffOdds >= 45) return 'Play-in race';
  if (f.window.includes('Rebuild')) return 'Rebuild — every win matters';
  return 'Outside playoffs — time to climb';
}

export function moraleAfterWinStreak(franchise: Franchise, wins: number): MoraleLevel {
  if (wins >= 2) return upgradeMorale(franchise.lockerRoom);
  if (wins === 0) return downgradeMorale(franchise.lockerRoom);
  return franchise.lockerRoom;
}

export function prospectToPlayer(
  prospect: import('../types/game').Prospect,
  pickNumber = 20,
): Player {
  const ovr = prospect.trueOverall ?? prospect.scoutedOverall[1];
  const pot = prospect.truePotential ?? prospect.potential[1];
  return {
    id: uid('pl'),
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    age: prospect.age,
    position: prospect.position,
    overall: ovr,
    potential: pot,
    contract: {
      yearsRemaining: 4,
      annualSalary: rookieScaleSalary(pickNumber),
      isMax: false,
      isExpiring: false,
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
}
