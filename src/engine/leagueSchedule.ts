import type { League, LeagueMatchup, LeagueTeam } from '../types/game';
import { hashString } from '../lib/visuals/hash';

export const SCHEDULE_GAMES_PER_WEEK = 2;
export const SCHEDULE_WEEKS = 41;
export const SEASON_GAME_COUNT = 82;
export const TRADE_DEADLINE_WEEK = 32;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** One flex round: each team plays once (15 pairings for 30 teams). */
function flexRoundPairIndices(n: number, round: number): [number, number][] {
  const rotatable = Array.from({ length: n - 1 }, (_, i) => i);
  const r = round % (n - 1);
  const rotated = [...rotatable.slice(r), ...rotatable.slice(0, r)];
  const ordered = [...rotated, n - 1];
  const pairs: [number, number][] = [];
  for (let i = 0; i < n / 2; i += 1) {
    pairs.push([ordered[i], ordered[n - 1 - i]]);
  }
  return pairs;
}

function teamGameCounts(schedule: LeagueMatchup[], teamIds: string[]): Map<string, number> {
  const counts = new Map(teamIds.map((id) => [id, 0]));
  for (const game of schedule) {
    counts.set(game.homeTeamId, (counts.get(game.homeTeamId) ?? 0) + 1);
    counts.set(game.awayTeamId, (counts.get(game.awayTeamId) ?? 0) + 1);
  }
  return counts;
}

function isBalancedSchedule(schedule: LeagueMatchup[], teamIds: string[]): boolean {
  if (!schedule.length) return false;
  const counts = teamGameCounts(schedule, teamIds);
  return teamIds.every((id) => counts.get(id) === SEASON_GAME_COUNT);
}

export function scheduleNeedsRebuild(schedule: LeagueMatchup[] | undefined, teamIds: string[]): boolean {
  if (!schedule?.length) return true;
  if (!isBalancedSchedule(schedule, teamIds)) return true;
  const maxWeek = schedule.reduce((max, m) => Math.max(max, m.week), 0);
  return maxWeek < SCHEDULE_WEEKS;
}

/** Build a balanced 82-game schedule: home-and-home vs all 29 opponents + 24 flex games. */
export function buildLeagueSchedule(teams: LeagueTeam[], season: number): LeagueMatchup[] {
  const ids = [...teams].map((t) => t.id).sort();
  const n = ids.length;
  if (n < 2) return [];

  const raw: { homeTeamId: string; awayTeamId: string; salt: number }[] = [];

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      raw.push({ homeTeamId: ids[i], awayTeamId: ids[j], salt: 0 });
      raw.push({ homeTeamId: ids[j], awayTeamId: ids[i], salt: 1 });
    }
  }

  const flexRounds = SEASON_GAME_COUNT - (n - 1) * 2;
  for (let round = 0; round < flexRounds; round += 1) {
    for (const [a, b] of flexRoundPairIndices(n, round)) {
      const homeFirst = hashString(`${season}-flex-${ids[a]}-${ids[b]}-${round}`) % 2 === 0;
      raw.push({
        homeTeamId: homeFirst ? ids[a] : ids[b],
        awayTeamId: homeFirst ? ids[b] : ids[a],
        salt: 100 + round,
      });
    }
  }

  raw.sort(
    (a, b) =>
      hashString(`${season}-${a.homeTeamId}-${a.awayTeamId}-${a.salt}`) -
      hashString(`${season}-${b.homeTeamId}-${b.awayTeamId}-${b.salt}`),
  );

  const weekCounts = Array.from({ length: SCHEDULE_WEEKS }, () => new Map<string, number>());
  const assigned: LeagueMatchup[] = [];

  for (const game of raw) {
    let placed = false;
    for (let w = 0; w < SCHEDULE_WEEKS && !placed; w += 1) {
      const homeCount = weekCounts[w].get(game.homeTeamId) ?? 0;
      const awayCount = weekCounts[w].get(game.awayTeamId) ?? 0;
      if (homeCount >= SCHEDULE_GAMES_PER_WEEK || awayCount >= SCHEDULE_GAMES_PER_WEEK) continue;

      const week = w + 1;
      assigned.push({
        id: `lm-${season}-w${week}-${assigned.length}`,
        week,
        gameInWeek: 0,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
      });
      weekCounts[w].set(game.homeTeamId, homeCount + 1);
      weekCounts[w].set(game.awayTeamId, awayCount + 1);
      placed = true;
    }

    if (!placed) {
      const week = SCHEDULE_WEEKS;
      assigned.push({
        id: `lm-${season}-w${week}-overflow-${assigned.length}`,
        week,
        gameInWeek: 0,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
      });
    }
  }

  const byWeekTeam = new Map<string, LeagueMatchup[]>();
  for (const m of assigned) {
    for (const teamId of [m.homeTeamId, m.awayTeamId]) {
      const key = `${m.week}-${teamId}`;
      const list = byWeekTeam.get(key) ?? [];
      list.push(m);
      byWeekTeam.set(key, list);
    }
  }

  for (const [, list] of byWeekTeam) {
    list.sort((a, b) => pairKey(a.homeTeamId, a.awayTeamId).localeCompare(pairKey(b.homeTeamId, b.awayTeamId)));
    list.forEach((m, idx) => {
      m.gameInWeek = idx + 1;
    });
  }

  return assigned.sort((a, b) => a.week - b.week || a.gameInWeek - b.gameInWeek);
}

export function ensureLeagueSchedule(league: League): League {
  const teamIds = league.teams.map((t) => t.id);
  if (league.schedule?.length && !scheduleNeedsRebuild(league.schedule, teamIds)) return league;
  return { ...league, schedule: buildLeagueSchedule(league.teams, league.season) };
}

export function getWeekMatchups(league: League, week: number): LeagueMatchup[] {
  const schedule = ensureLeagueSchedule(league).schedule ?? [];
  return schedule.filter((m) => m.week === week);
}

export function getUserWeekMatchups(league: League, userTeamId: string, week: number): LeagueMatchup[] {
  return getWeekMatchups(league, week).filter(
    (m) => m.homeTeamId === userTeamId || m.awayTeamId === userTeamId,
  );
}

export function userOpponentIdsForWeek(league: League, userTeamId: string, week: number): string[] {
  return getUserWeekMatchups(league, userTeamId, week).map((m) =>
    m.homeTeamId === userTeamId ? m.awayTeamId : m.homeTeamId,
  );
}

export function expectedWinsForStrength(strength: number, games = SEASON_GAME_COUNT): number {
  const winRate = 1 / (1 + Math.exp(-(strength - 75) / 6.5));
  return Math.round(games * winRate);
}
