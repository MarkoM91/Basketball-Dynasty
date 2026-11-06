import type { DraftOrderEntry, League, PlayoffState } from '../types/game';
import { getStandings } from '../data/league';
import { PLAYOFF_TEAM_COUNT } from './playoffs';

const DRAFT_TEAM_COUNT = 30;

/** NBA-style lottery weights (top 14 picks). */
const LOTTERY_WEIGHTS = [140, 140, 140, 125, 105, 90, 75, 65, 55, 45, 35, 25, 18, 17];

export interface DraftOrderResult {
  order: DraftOrderEntry[];
  lotteryLog: string[];
  userPick: number;
}

export function teamKey(city: string, name: string): string {
  return `${city}|${name}`;
}

function recordRank(a: { wins: number; losses: number }, b: { wins: number; losses: number }): number {
  if (a.wins !== b.wins) return a.wins - b.wins;
  return b.losses - a.losses;
}

function runLottery(
  lotteryTeams: ReturnType<typeof getStandings>,
): { ordered: typeof lotteryTeams; log: string[] } {
  const pool = lotteryTeams.map((team, index) => ({
    team,
    weight: LOTTERY_WEIGHTS[index] ?? 10,
    expectedPick: index + 1,
  }));
  const ordered: typeof lotteryTeams = [];
  const log: string[] = [];

  // Iterate the ORIGINAL count — pool shrinks every draw, so `pick <= pool.length` stopped after
  // 7 of 14 lottery picks and half the lottery teams never received a first-rounder.
  const picks = pool.length;
  for (let pick = 1; pick <= picks; pick += 1) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * total;
    let winner = 0;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        winner = i;
        break;
      }
    }

    const { team, weight, expectedPick } = pool[winner];
    ordered.push(team);
    const jump = expectedPick - pick;
    if (jump >= 2) {
      log.push(`Lottery: ${team.fullName} jumps to #${pick} (${(weight / 10).toFixed(1)}% odds, +${jump} spots).`);
    } else if (pick === 1) {
      log.push(`Lottery: ${team.fullName} wins the #1 pick (${(weight / 10).toFixed(1)}% odds).`);
    }
    pool.splice(winner, 1);
  }

  return { ordered, log };
}

/**
 * NBA draft order:
 * - Picks 1–14: lottery among teams that missed the playoffs (by prior regular-season record).
 * - Picks 15–30: reverse regular-season record among the 16 playoff teams.
 */
export function buildDraftOrder(
  league: League,
  userCity?: string,
  userName?: string,
  _playoffs?: PlayoffState,
): DraftOrderResult {
  const standings = getStandings(league);
  const lotteryTeams = [...standings].slice(PLAYOFF_TEAM_COUNT).reverse();
  const playoffTeams = standings.slice(0, PLAYOFF_TEAM_COUNT);
  const playoffByRecord = [...playoffTeams].sort(recordRank);

  const { ordered: lotteryOrder, log: lotteryLog } = runLottery(lotteryTeams);
  const order: DraftOrderEntry[] = [];

  lotteryOrder.forEach((team, index) => {
    order.push({
      pick: index + 1,
      city: team.city,
      name: team.name,
      teamName: team.fullName,
      source: 'lottery',
      expectedPick: lotteryTeams.findIndex((t) => t.id === team.id) + 1,
    });
  });

  playoffByRecord.forEach((team, index) => {
    order.push({
      pick: 15 + index,
      city: team.city,
      name: team.name,
      teamName: team.fullName,
      source: 'playoff_record',
    });
  });

  order.push(...secondRoundFrom(order));

  const userKey = userCity && userName ? teamKey(userCity, userName) : undefined;
  const userEntry = userKey
    ? order.find((entry) => teamKey(entry.city, entry.name) === userKey)
    : undefined;

  if (userEntry?.source === 'lottery') {
    lotteryLog.unshift(`${userEntry.teamName} holds the #${userEntry.pick} pick after the lottery.`);
  } else if (userEntry?.source === 'playoff_record') {
    lotteryLog.unshift(
      `${userEntry.teamName} picks #${userEntry.pick} — reverse order among playoff teams by regular-season record.`,
    );
  }

  return {
    order,
    lotteryLog,
    userPick: userEntry?.pick ?? 14,
  };
}

/**
 * Round 2 (#31–60) mirrors round 1 order — the same rule the game uses for your own picks
 * (second-rounder = 30 + first-round slot). Having real entries means 2nd-round picks can be
 * traded and the receiving team actually drafts with them.
 */
export function secondRoundFrom(order: DraftOrderEntry[]): DraftOrderEntry[] {
  return order
    .filter((entry) => entry.pick <= DRAFT_TEAM_COUNT)
    .sort((a, b) => a.pick - b.pick)
    .map((entry) => ({
      pick: entry.pick + DRAFT_TEAM_COUNT,
      city: entry.city,
      name: entry.name,
      teamName: entry.teamName,
      source: entry.source,
    }));
}

/**
 * Repair saves made before the lottery/round-2 fixes: fill round-1 holes (lottery teams the old
 * loop skipped) worst-record-first, then mirror round 2. Leaves a complete order untouched.
 */
export function repairDraftOrder(league: League): League {
  const order = league.draftOrder ?? [];
  if (!order.length) return league;
  const roundOne = order.filter((e) => e.pick <= DRAFT_TEAM_COUNT);
  const hasRoundTwo = order.some((e) => e.pick > DRAFT_TEAM_COUNT);
  if (roundOne.length >= DRAFT_TEAM_COUNT && hasRoundTwo) return league;

  const filled = [...roundOne];
  if (filled.length < DRAFT_TEAM_COUNT) {
    const used = new Set(filled.map((e) => teamKey(e.city, e.name)));
    const missingTeams = [...getStandings(league)].reverse().filter((t) => !used.has(teamKey(t.city, t.name)));
    const taken = new Set(filled.map((e) => e.pick));
    let i = 0;
    for (let pick = 1; pick <= DRAFT_TEAM_COUNT && i < missingTeams.length; pick += 1) {
      if (taken.has(pick)) continue;
      const team = missingTeams[i++];
      filled.push({ pick, city: team.city, name: team.name, teamName: team.fullName, source: 'lottery' });
    }
  }
  filled.sort((a, b) => a.pick - b.pick);
  const roundTwo = hasRoundTwo ? order.filter((e) => e.pick > DRAFT_TEAM_COUNT) : secondRoundFrom(filled);
  return { ...league, draftOrder: [...filled, ...roundTwo] };
}

export function pinUserDraftPick(
  league: League,
  city: string,
  name: string,
  targetPick: number,
): League {
  if (!league.draftOrder?.length) return league;

  const pick = Math.max(1, Math.min(DRAFT_TEAM_COUNT, targetPick));
  const key = teamKey(city, name);
  const byPick = [...league.draftOrder]
    .filter((entry) => entry.pick <= DRAFT_TEAM_COUNT)
    .sort((a, b) => a.pick - b.pick);
  const userIndex = byPick.findIndex((entry) => teamKey(entry.city, entry.name) === key);
  const targetIndex = pick - 1;
  if (userIndex < 0 || userIndex === targetIndex) return league;

  const [userEntry] = byPick.splice(userIndex, 1);
  byPick.splice(targetIndex, 0, userEntry);

  const roundOne = byPick.map((entry, index) => ({
    ...entry,
    pick: index + 1,
  }));
  const order = [...roundOne, ...secondRoundFrom(roundOne)];

  return {
    ...league,
    draftOrder: order,
    draftLotteryLog: [
      `${userEntry.teamName} holds the #${pick} pick (scenario).`,
      ...(league.draftLotteryLog ?? []),
    ],
  };
}

export function attachDraftOrder(league: League, result: DraftOrderResult): League {
  return {
    ...league,
    draftOrder: result.order,
    draftLotteryLog: result.lotteryLog,
  };
}

export function getUserDraftPickNumber(league: League, city: string, name: string): number {
  const key = teamKey(city, name);
  const entry = league.draftOrder?.find((slot) => teamKey(slot.city, slot.name) === key);
  return entry?.pick ?? 14;
}

export function teamNameForDraftPick(league: League, pick: number): string {
  const slot = league.draftOrder?.find((entry) => entry.pick === pick);
  if (slot) return slot.teamName;

  const standings = getStandings(league);
  const reverse = [...standings].reverse();
  return reverse[(pick - 1) % reverse.length]?.fullName ?? 'Unknown';
}

export function teamIdForDraftPick(league: League, pick: number): string | undefined {
  const slot = league.draftOrder?.find((entry) => entry.pick === pick);
  if (!slot) return undefined;
  return league.teams.find((t) => t.city === slot.city && t.name === slot.name)?.id;
}

export function draftPickSummary(league: League, city: string, name: string): string {
  const key = teamKey(city, name);
  const userName = `${city} ${name}`;
  const order = [...(league.draftOrder ?? [])].sort((a, b) => a.pick - b.pick);
  const owned = order.filter((entry) => teamKey(entry.city, entry.name) === key);
  const tradedAway = order.filter((entry) => entry.via === userName && teamKey(entry.city, entry.name) !== key);
  const tradedNote = tradedAway.length
    ? ` Traded: ${tradedAway.map((e) => `#${e.pick} → ${e.teamName}`).join(', ')}.`
    : '';

  // No fallback to "#14" — after trading every pick, the user genuinely holds none.
  if (!owned.length) {
    return order.length ? `You hold no picks in this draft.${tradedNote}` : `Your pick: #${getUserDraftPickNumber(league, city, name)}`;
  }

  const first = owned[0];
  let lead: string;
  if (first.via) {
    lead = `#${first.pick} via ${first.via}`;
  } else if (first.source === 'lottery') {
    const jump = first.expectedPick && first.expectedPick > first.pick
      ? ` (moved up from #${first.expectedPick} slot)`
      : '';
    lead = `#${first.pick} via lottery${jump}`;
  } else {
    lead = `#${first.pick} — reverse playoff-team record`;
  }
  const others = owned.slice(1).map((e) => (e.via ? `#${e.pick} (via ${e.via})` : `#${e.pick}`));
  return `Your picks: ${[lead, ...others].join(', ')}.${tradedNote}`;
}
