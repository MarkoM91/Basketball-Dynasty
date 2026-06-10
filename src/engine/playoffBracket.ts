import type { League, PlayoffRound, PlayoffSeries, PlayoffState } from '../types/game';
import { getStandings, getTeamById } from '../data/league';
import { PLAYOFF_TEAM_COUNT, roundLabel, seriesScoreline } from './playoffs';

export const BRACKET_ROUNDS: PlayoffRound[] = ['First Round', 'Quarterfinals', 'Semifinals', 'Finals'];

export function getAllBracketSeries(state: PlayoffState): PlayoffSeries[] {
  const history = state.bracketHistory ?? [];
  const seen = new Set(history.map((series) => series.id));
  const merged = [...history];
  for (const series of state.series) {
    if (!seen.has(series.id)) merged.push(series);
  }
  return merged;
}

export function groupSeriesByRound(series: PlayoffSeries[]): Record<PlayoffRound, PlayoffSeries[]> {
  const grouped: Record<PlayoffRound, PlayoffSeries[]> = {
    'First Round': [],
    Quarterfinals: [],
    Semifinals: [],
    Finals: [],
    Complete: [],
  };
  for (const item of series) {
    grouped[item.round].push(item);
  }
  for (const round of BRACKET_ROUNDS) {
    grouped[round].sort((a, b) => a.higherSeed.seed - b.higherSeed.seed);
  }
  return grouped;
}

export function findUserEliminationSeries(
  state: PlayoffState,
  userTeamId: string,
): PlayoffSeries | undefined {
  return getAllBracketSeries(state).find(
    (series) =>
      series.userInvolved &&
      series.complete &&
      series.winnerId &&
      series.winnerId !== userTeamId,
  );
}

export function userSeedInPlayoffs(league: League, userTeamId: string): number | undefined {
  const standings = getStandings(league).slice(0, PLAYOFF_TEAM_COUNT);
  const index = standings.findIndex((team) => team.id === userTeamId);
  return index >= 0 ? index + 1 : undefined;
}

export function opponentInSeries(series: PlayoffSeries, teamId: string): { teamId: string; seed: number } {
  return series.higherSeed.teamId === teamId ? series.lowerSeed : series.higherSeed;
}

export function userSeriesScore(series: PlayoffSeries, userTeamId: string): string {
  const userIsHigher = series.higherSeed.teamId === userTeamId;
  const userWins = userIsHigher ? series.higherWins : series.lowerWins;
  const oppWins = userIsHigher ? series.lowerWins : series.higherWins;
  return `${userWins}–${oppWins}`;
}

export function buildPlayoffRunSummary(state: PlayoffState, league: League, userTeamId: string): string {
  const userTeam = getTeamById(league, userTeamId);
  const seed = userSeedInPlayoffs(league, userTeamId);
  const seedLabel = seed ? `#${seed} ` : '';

  if (state.userResult === 'Champions') {
    return `${seedLabel}${userTeam?.fullName ?? 'Your team'} — league champions.`;
  }

  const elimination = findUserEliminationSeries(state, userTeamId);
  if (elimination) {
    const opponent = opponentInSeries(elimination, userTeamId);
    const opponentName = getTeamById(league, opponent.teamId)?.fullName ?? 'Opponent';
    return `${seedLabel}${userTeam?.fullName ?? 'Your team'} eliminated in the ${roundLabel(elimination.round).toLowerCase()} by ${opponentName} (${userSeriesScore(elimination, userTeamId)}).`;
  }

  const fallback = buildFallbackFirstRoundSeries(league, userTeamId, state.userResult);
  if (fallback) {
    const opponent = opponentInSeries(fallback, userTeamId);
    const opponentName = getTeamById(league, opponent.teamId)?.fullName ?? 'Opponent';
    return `${seedLabel}${userTeam?.fullName ?? 'Your team'} eliminated in the first round by ${opponentName} (${userSeriesScore(fallback, userTeamId)}).`;
  }

  if (state.userResult === 'Missed playoffs') {
    return `${userTeam?.fullName ?? 'Your team'} missed the top 16 — watching the league bracket.`;
  }
  if (state.userResult) return `${seedLabel}${userTeam?.fullName ?? 'Your team'} — ${state.userResult}.`;
  if (state.userEliminated) return `${seedLabel}${userTeam?.fullName ?? 'Your team'} — eliminated.`;

  const active = state.series.find((series) => series.userInvolved && !series.complete);
  if (active) {
    const opponent = opponentInSeries(active, userTeamId);
    const opponentName = getTeamById(league, opponent.teamId)?.fullName ?? 'Opponent';
    return `${seedLabel}${userTeam?.fullName ?? 'Your team'} alive in ${roundLabel(active.round).toLowerCase()} vs ${opponentName} (${userSeriesScore(active, userTeamId)}).`;
  }

  return `${seedLabel}${userTeam?.fullName ?? 'Your team'} — tracking the bracket.`;
}

export function bracketHasFullHistory(state: PlayoffState): boolean {
  const grouped = groupSeriesByRound(getAllBracketSeries(state));
  if (state.round === 'Complete') {
    return grouped['First Round'].length >= PLAYOFF_TEAM_COUNT / 2;
  }
  return (state.bracketHistory?.length ?? 0) > 0 || state.round === 'First Round';
}

export function buildFallbackFirstRoundSeries(
  league: League,
  userTeamId: string,
  userResult?: string,
): PlayoffSeries | undefined {
  if (!userResult?.includes('First Round')) return undefined;
  const seed = userSeedInPlayoffs(league, userTeamId);
  if (!seed) return undefined;

  const standings = getStandings(league).slice(0, PLAYOFF_TEAM_COUNT);
  const userIndex = seed - 1;
  const opponentIndex = PLAYOFF_TEAM_COUNT - 1 - userIndex;
  const userTeam = standings[userIndex];
  const opponent = standings[opponentIndex];
  if (!userTeam || !opponent) return undefined;

  const higher = userIndex < opponentIndex
    ? { teamId: userTeam.id, seed }
    : { teamId: opponent.id, seed: opponentIndex + 1 };
  const lower = userIndex < opponentIndex
    ? { teamId: opponent.id, seed: opponentIndex + 1 }
    : { teamId: userTeam.id, seed };

  const userIsHigher = userTeam.id === higher.teamId;

  return {
    id: 'fallback-user-r1',
    round: 'First Round',
    higherSeed: higher,
    lowerSeed: lower,
    higherWins: userIsHigher ? 1 : 4,
    lowerWins: userIsHigher ? 4 : 1,
    games: [],
    complete: true,
    winnerId: opponent.id,
    userInvolved: true,
  };
}

export function formatMatchupLine(series: PlayoffSeries, league: League): string {
  return seriesScoreline(series, league);
}
