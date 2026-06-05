import type { Franchise, League, PlayoffGameResult, PlayoffRound, PlayoffSeries, PlayoffState } from '../types/game';
import { getStandings, getTeamById } from '../data/league';
import { uid } from '../data/scenarios';
import { autoStartingFive, lineupStrength } from './simulation';

export const PLAYOFF_TEAM_COUNT = 16;
function simGame(
  home: { id: string; strength: number; name: string },
  away: { id: string; strength: number; name: string },
  franchise?: Franchise,
  playoff = true,
): PlayoffGameResult {
  const homeAdv = playoff ? 3 : 2.5;
  const variance = (Math.random() - 0.5) * 10;
  const diff = home.strength + homeAdv - away.strength + variance;
  const base = 102 + Math.random() * 10;
  const homeScore = Math.round(base + diff * 0.38);
  const awayScore = Math.round(base - diff * 0.38 + (Math.random() - 0.5) * 6);
  const winnerId = homeScore > awayScore ? home.id : away.id;
  const star = franchise?.roster.find((p) => p.isStar);

  const playByPlay = generatePlayByPlay(home, away, homeScore, awayScore, star, franchise);
  const starLine = star && franchise
    ? `${star.firstName} ${star.lastName}: ${homeScore > awayScore && home.id === franchise.leagueTeamId ? '32 pts, 7 ast — carried fourth quarter' : '24 pts on 9/22 — struggled vs length'}`
    : undefined;

  let note = homeScore > awayScore
    ? 'Home court and role players made the difference.'
    : 'Road team stole momentum with late shot creation.';
  if (Math.abs(homeScore - awayScore) <= 4) note = 'Tight finish — clutch execution decided it.';
  if (Math.abs(homeScore - awayScore) >= 15) note = 'Dominant performance — rotation mismatch exposed.';

  return { homeTeamId: home.id, awayTeamId: away.id, homeScore, awayScore, winnerId, note, playByPlay, starLine };
}

function generatePlayByPlay(
  home: { name: string; id: string },
  away: { name: string; id: string },
  homeScore: number,
  awayScore: number,
  star?: { firstName: string; lastName: string },
  franchise?: Franchise,
): string[] {
  const lines: string[] = [];
  const starName = star ? `${star.firstName} ${star.lastName}` : 'the star';
  const q1h = Math.round(homeScore * 0.24);
  const q1a = Math.round(awayScore * 0.22);
  lines.push(`Q1: ${home.name} ${q1h}–${q1a} ${away.name}. Pace tight, both teams switching everything.`);
  lines.push(`Q2: Bench units trade runs. Coach challenges overturn a charge — momentum swings.`);
  if (franchise) {
    lines.push(`${starName} ${Math.random() > 0.5 ? 'drills' : 'misses'} a pull-up three. Crowd ${Math.random() > 0.5 ? 'erupts' : 'groans'}.`);
  }
  lines.push(`Q3: ${away.name} goes small. ${home.name} attacks the rim — 12 points in the paint this quarter.`);
  const diff = homeScore - awayScore;
  if (Math.abs(diff) <= 5) {
    lines.push(`Q4 2:08: One-possession game. ${starName} draws two free throws.`);
    lines.push(`Q4 0:24: ${diff > 0 ? home.name : away.name} gets the final stop. ${Math.abs(diff) <= 3 ? 'Contested look — no foul.' : 'Rotation sealed the lane.'}`);
  } else {
    lines.push(`Q4: ${Math.abs(diff) >= 10 ? 'Bench clears — series tone set.' : 'Lead safe but not comfortable.'}`);
  }
  lines.push(`Final: ${home.name} ${homeScore}–${awayScore} ${away.name}.`);
  return lines;
}

function makeSeries(
  round: PlayoffRound,
  higher: { teamId: string; seed: number },
  lower: { teamId: string; seed: number },
  userTeamId: string,
): PlayoffSeries {
  return {
    id: uid('sr'),
    round,
    higherSeed: higher,
    lowerSeed: lower,
    higherWins: 0,
    lowerWins: 0,
    games: [],
    complete: false,
    userInvolved: higher.teamId === userTeamId || lower.teamId === userTeamId,
  };
}

export function initPlayoffs(league: League, userTeamId: string): PlayoffState {
  const standings = getStandings(league).slice(0, PLAYOFF_TEAM_COUNT);
  const seeded = standings.map((t, i) => ({ teamId: t.id, seed: i + 1 }));

  const series: PlayoffSeries[] = [];
  for (let i = 0; i < PLAYOFF_TEAM_COUNT / 2; i += 1) {
    series.push(makeSeries('First Round', seeded[i], seeded[PLAYOFF_TEAM_COUNT - 1 - i], userTeamId));
  }

  return {
    active: true,
    round: 'First Round',
    series,
    bracketHistory: [],
    userEliminated: false,
  };
}

export function normalizePlayoffState(state: PlayoffState): PlayoffState {
  return {
    ...state,
    bracketHistory: state.bracketHistory ?? [],
  };
}

function archiveCompletedSeries(state: PlayoffState): PlayoffSeries[] {
  const history = state.bracketHistory ?? [];
  const seen = new Set(history.map((series) => series.id));
  const archived = state.series.filter((series) => series.complete && !seen.has(series.id));
  return archived.length ? [...history, ...archived] : history;
}

export function userPlayoffGamePending(state: PlayoffState, league: League): boolean {
  if (!state.active || state.userEliminated || state.round === 'Complete') return false;
  const userTeamId = league.teams.find((t) => t.isUser)?.id;
  if (!userTeamId) return false;
  return state.series.some((s) => s.userInvolved && !s.complete);
}

export function getUserPlayoffMatchup(
  state: PlayoffState,
  league: League,
): { opponentName: string; seriesLine: string; round: PlayoffRound } | null {
  const userTeamId = league.teams.find((t) => t.isUser)?.id;
  if (!userTeamId) return null;
  const series = state.series.find((s) => s.userInvolved && !s.complete);
  if (!series) return null;
  const oppId =
    series.higherSeed.teamId === userTeamId ? series.lowerSeed.teamId : series.higherSeed.teamId;
  const opponentName = getTeamById(league, oppId)?.fullName ?? 'Opponent';
  return {
    opponentName,
    seriesLine: seriesScoreline(series, league),
    round: series.round,
  };
}
function teamStrength(league: League, teamId: string, franchise?: Franchise): number {
  const team = getTeamById(league, teamId);
  if (!team) return 75;
  if (team.isUser && franchise) {
    const starters =
      franchise.startingFive?.length === 5 ? franchise.startingFive : autoStartingFive(franchise);
    return lineupStrength(franchise, starters);
  }
  return team.strength + (Math.random() * 4 - 2);
}
function advanceSeriesGame(series: PlayoffSeries, league: League, franchise?: Franchise): PlayoffSeries {
  if (series.complete) return series;

  const homeId = series.games.length % 2 === 0 ? series.higherSeed.teamId : series.lowerSeed.teamId;
  const awayId = homeId === series.higherSeed.teamId ? series.lowerSeed.teamId : series.higherSeed.teamId;

  const home = { id: homeId, strength: teamStrength(league, homeId, franchise), name: getTeamById(league, homeId)?.fullName ?? 'Home' };
  const away = { id: awayId, strength: teamStrength(league, awayId, franchise), name: getTeamById(league, awayId)?.fullName ?? 'Away' };
  const game = simGame(home, away, franchise, true);

  let higherWins = series.higherWins;
  let lowerWins = series.lowerWins;
  if (game.winnerId === series.higherSeed.teamId) higherWins += 1;
  else lowerWins += 1;

  const winsNeeded = 4;
  const complete = higherWins >= winsNeeded || lowerWins >= winsNeeded;
  const winnerId = complete
    ? (higherWins >= winsNeeded ? series.higherSeed.teamId : series.lowerSeed.teamId)
    : undefined;

  return {
    ...series,
    higherWins,
    lowerWins,
    games: [...series.games, game],
    complete,
    winnerId,
  };
}

export function simNextPlayoffGame(
  state: PlayoffState,
  league: League,
  franchise: Franchise,
): { state: PlayoffState; lastGame?: PlayoffGameResult; headline?: string; playByPlay?: string[] } {
  if (!state.active || state.round === 'Complete') return { state };

  const userTeamId = league.teams.find((t) => t.isUser)?.id;
  let seriesList = [...state.series];

  const targetIdx = seriesList.findIndex((s) => !s.complete && (s.userInvolved || !userTeamId));
  const simIdx = targetIdx >= 0 ? targetIdx : seriesList.findIndex((s) => !s.complete);
  if (simIdx < 0) {
    const advanced = advanceRound(state, league, franchise);
    return { state: advanced.state, headline: advanced.headline };
  }

  const updated = advanceSeriesGame(seriesList[simIdx], league, franchise);
  seriesList[simIdx] = updated;

  const lastGame = updated.games[updated.games.length - 1];
  const homeName = getTeamById(league, lastGame.homeTeamId)?.fullName ?? 'Home';
  const awayName = getTeamById(league, lastGame.awayTeamId)?.fullName ?? 'Away';
  const headline = `Playoffs: ${homeName} ${lastGame.homeScore}–${lastGame.awayScore} ${awayName}. ${lastGame.note}`;

  let userEliminated = state.userEliminated;
  let userResult = state.userResult;
  if (updated.complete && updated.userInvolved && userTeamId && updated.winnerId !== userTeamId) {
    userEliminated = true;
    userResult = `${updated.round} exit`;
  }

  let nextState: PlayoffState = {
    ...state,
    series: seriesList,
    userEliminated,
    userResult,
  };

  if (seriesList.every((s) => s.complete)) {
    const advanced = advanceRound(nextState, league, franchise);
    return { state: advanced.state, lastGame, headline: advanced.headline ?? headline };
  }

  return { state: nextState, lastGame, headline, playByPlay: lastGame.playByPlay };
}

function pairWinnersBySeed(
  winners: { teamId: string; seed: number }[],
  round: PlayoffRound,
  userTeamId: string,
): PlayoffSeries[] {
  const sorted = [...winners].sort((a, b) => a.seed - b.seed);
  const series: PlayoffSeries[] = [];
  for (let i = 0; i < sorted.length / 2; i += 1) {
    series.push(makeSeries(round, sorted[i], sorted[sorted.length - 1 - i], userTeamId));
  }
  return series;
}

function advanceRound(state: PlayoffState, league: League, franchise: Franchise): { state: PlayoffState; headline?: string } {
  const userTeamId = league.teams.find((t) => t.isUser)?.id ?? '';
  const bracketHistory = archiveCompletedSeries(state);
  const winners = state.series.filter((s) => s.winnerId).map((s) => ({
    teamId: s.winnerId!,
    seed: s.winnerId === s.higherSeed.teamId ? s.higherSeed.seed : s.lowerSeed.seed,
  }));

  if (state.round === 'First Round') {
    return {
      state: { ...state, bracketHistory, round: 'Quarterfinals', series: pairWinnersBySeed(winners, 'Quarterfinals', userTeamId) },
      headline: 'Conference quarterfinals set. Home court still matters — rotations tighten.',
    };
  }

  if (state.round === 'Quarterfinals') {
    return {
      state: { ...state, bracketHistory, round: 'Semifinals', series: pairWinnersBySeed(winners, 'Semifinals', userTeamId) },
      headline: 'Semifinals locked in. Margins shrink — every possession counts.',
    };
  }

  if (state.round === 'Semifinals') {
    const series = pairWinnersBySeed(winners, 'Finals', userTeamId);
    return {
      state: { ...state, bracketHistory, round: 'Finals', series },
      headline: 'Finals berth locked. Ownership expects a championship push.',
    };
  }
  if (state.round === 'Finals') {
    const champId = state.series[0]?.winnerId;
    const champ = champId ? getTeamById(league, champId) : undefined;
    const userWon = champ?.isUser;
    const finalHistory = archiveCompletedSeries({ ...state, bracketHistory });
    return {
      state: {
        ...state,
        bracketHistory: finalHistory,
        round: 'Complete',
        active: false,
        championTeamId: champId,
        championName: champ?.fullName,
        userResult: userWon ? 'Champions' : state.userEliminated ? state.userResult : 'Finals loss',
        userEliminated: !userWon,
      },
      headline: userWon
        ? `Finals: ${franchise.city} ${franchise.name} win the title.`
        : `Season Ends: ${champ?.fullName ?? 'Opponent'} win in ${state.series[0]?.games.length ?? 6} games.`,
    };
  }

  return { state };
}

export function simAllRemainingPlayoffGames(
  state: PlayoffState,
  league: League,
  franchise: Franchise,
): { state: PlayoffState; headlines: string[] } {
  let current = state;
  const headlines: string[] = [];
  let safety = 0;
  while (current.active && current.round !== 'Complete' && safety < 40) {
    const result = simNextPlayoffGame(current, league, franchise);
    current = result.state;
    if (result.headline) headlines.push(result.headline);
    safety += 1;
  }
  return { state: current, headlines };
}

/** Sim every remaining series in the current round, then stop (even if the user is eliminated). */
export function simCurrentPlayoffRound(
  state: PlayoffState,
  league: League,
  franchise: Franchise,
): { state: PlayoffState; headlines: string[] } {
  if (!state.active || state.round === 'Complete') return { state, headlines: [] };

  let current = state;
  const headlines: string[] = [];
  const startingRound = state.round;
  let safety = 0;

  while (current.active && current.round !== 'Complete' && current.round === startingRound && safety < 40) {
    const result = simNextPlayoffGame(current, league, franchise);
    current = result.state;
    if (result.headline) headlines.push(result.headline);
    safety += 1;
  }

  return { state: current, headlines };
}

export function buildSeasonReview(franchise: Franchise, playoffState?: PlayoffState): import('../types/game').SeasonReview {
  const result = playoffState?.userResult ?? 'Missed Playoffs';
  const winPct = franchise.record.wins / Math.max(1, franchise.record.wins + franchise.record.losses);

  if (result === 'Champions') {
    return {
      grade: 'A',
      ownershipVerdict: 'Ownership ecstatic. Job security at maximum.',
      offseasonPriority: 'Retain core, add veteran depth without breaking cap.',
    };
  }
  if (result === 'Finals loss') {
    return {
      grade: 'B+',
      ownershipVerdict: 'Deep run validates direction, but title window pressure rises.',
      primaryIssue: 'Late-game shot creation',
      offseasonPriority: 'Secondary creator or offensive-minded coaching tweak.',
    };
  }
  if (result?.includes('Quarterfinals')) {
    return {
      grade: 'B-',
      ownershipVerdict: 'Second-round exit — close, but not close enough for this payroll.',
      primaryIssue: 'Closing games vs elite teams',
      offseasonPriority: 'Add a two-way wing or upgrade half-court creation.',
    };
  }
  if (result?.includes('Semifinals')) {
    return {
      grade: 'B',
      ownershipVerdict: 'Solid season, but expected more from this payroll.',
      primaryIssue: 'Half-court offense vs elite defenses',
      offseasonPriority: 'Star help or schematic upgrade.',
    };
  }
  if (result?.includes('First Round')) {
    return {
      grade: 'C+',
      ownershipVerdict: 'Early exit raises questions about roster construction.',
      primaryIssue: 'Rotation depth',
      offseasonPriority: 'Trade, draft, or coaching change — choose a path.',
    };
  }
  if (franchise.window.includes('Rebuild') && winPct < 0.45) {
    return {
      grade: 'B-',
      ownershipVerdict: 'Losses acceptable if young core develops.',
      offseasonPriority: 'Hit on draft pick, avoid bad veteran contracts.',
    };
  }
  return {
    grade: 'D',
    ownershipVerdict: 'Missing playoffs with this roster is unacceptable.',
    primaryIssue: 'No clear identity',
    offseasonPriority: 'Rebuild or win-now — stop living in the middle.',
  };
}

export function roundLabel(round: PlayoffRound): string {
  if (round === 'Complete') return 'Complete';
  return round;
}

export function seriesScoreline(series: PlayoffSeries, league: League): string {
  const high = getTeamById(league, series.higherSeed.teamId)?.fullName ?? 'Higher';
  const low = getTeamById(league, series.lowerSeed.teamId)?.fullName ?? 'Lower';
  return `(#${series.higherSeed.seed}) ${high} ${series.higherWins}–${series.lowerWins} ${low} (#${series.lowerSeed.seed})`;
}
