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

  for (let pick = 1; pick <= pool.length; pick += 1) {
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

export function pinUserDraftPick(
  league: League,
  city: string,
  name: string,
  targetPick: number,
): League {
  if (!league.draftOrder?.length) return league;

  const pick = Math.max(1, Math.min(DRAFT_TEAM_COUNT, targetPick));
  const key = teamKey(city, name);
  const byPick = [...league.draftOrder].sort((a, b) => a.pick - b.pick);
  const userIndex = byPick.findIndex((entry) => teamKey(entry.city, entry.name) === key);
  const targetIndex = pick - 1;
  if (userIndex < 0 || userIndex === targetIndex) return league;

  const [userEntry] = byPick.splice(userIndex, 1);
  byPick.splice(targetIndex, 0, userEntry);

  const order = byPick.map((entry, index) => ({
    ...entry,
    pick: index + 1,
  }));

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
  const pick = getUserDraftPickNumber(league, city, name);
  const slot = league.draftOrder?.find((entry) => entry.pick === pick);
  if (!slot) return `Your pick: #${pick}`;

  if (slot.source === 'lottery') {
    const jump = slot.expectedPick && slot.expectedPick > pick
      ? ` (moved up from #${slot.expectedPick} slot)`
      : '';
    return `#${pick} via lottery${jump} — ${slot.teamName}`;
  }
  return `#${pick} — reverse playoff-team record (${slot.teamName})`;
}
