import type { Franchise, GameLogEntry, GameResult, League, LeagueStatLeader, LeagueStatSnapshot, Player, PlayerSeasonStats, Position } from '../types/game';
import { takeUniqueName } from '../data/names';
import { playerName, uid } from '../data/scenarios';
function emptyStats(): NonNullable<Player['seasonStats']> {
  return { games: 0, ppg: 0, rpg: 0, apg: 0, mpg: 0 };
}

export function estimatePER(stats: PlayerSeasonStats): number | null {
  if (stats.games === 0 || stats.mpg <= 0) return null;
  const raw = ((stats.ppg + stats.rpg * 1.15 + stats.apg * 1.25) / stats.mpg) * 15;
  return Math.round(raw * 10) / 10;
}

export function statDelta(current: number, prior: number | undefined): number | null {
  if (prior === undefined) return null;
  return Math.round((current - prior) * 10) / 10;
}

export function initialTeamScoring(strength: number): {
  ppgFor: number;
  ppgAgainst: number;
  scoreGames: number;
} {
  const net = (strength - 75) * 0.35;
  return {
    ppgFor: Math.round((105 + net + (Math.random() - 0.5) * 8) * 10) / 10,
    ppgAgainst: Math.round((105 - net + (Math.random() - 0.5) * 8) * 10) / 10,
    scoreGames: 0,
  };
}

export function mergeTeamScoring(
  current: { ppgFor: number; ppgAgainst: number; games: number } | undefined,
  teamScore: number,
  oppScore: number,
): { ppgFor: number; ppgAgainst: number; games: number } {
  const prev = current ?? { ppgFor: 0, ppgAgainst: 0, games: 0 };
  const games = prev.games + 1;
  return {
    games,
    ppgFor: Math.round(((prev.ppgFor * prev.games + teamScore) / games) * 10) / 10,
    ppgAgainst: Math.round(((prev.ppgAgainst * prev.games + oppScore) / games) * 10) / 10,
  };
}

export function mergeLeagueTeamScoring(
  current: { ppgFor: number; ppgAgainst: number; scoreGames: number },
  teamScore: number,
  oppScore: number,
): { ppgFor: number; ppgAgainst: number; scoreGames: number } {
  const games = current.scoreGames + 1;
  return {
    scoreGames: games,
    ppgFor: Math.round(((current.ppgFor * current.scoreGames + teamScore) / games) * 10) / 10,
    ppgAgainst: Math.round(((current.ppgAgainst * current.scoreGames + oppScore) / games) * 10) / 10,
  };
}

/** Logistic scale — higher = more parity (NBA-like). Was 6 (too swingy toward favorites). */
export const NBA_WIN_PROB_SCALE = 9.5;
/** Night-to-night variance in strength points. */
export const NBA_GAME_VARIANCE = 13;
/** Home court in strength points (~3–4% win prob at parity). */
export const NBA_HOME_EDGE = 1.6;

export function nbaWinProbability(strengthDiff: number, variance = NBA_GAME_VARIANCE): number {
  const adjusted = strengthDiff + (Math.random() - 0.5) * variance;
  return 1 / (1 + Math.exp(-adjusted / NBA_WIN_PROB_SCALE));
}

export function simulateTeamGameScores(
  teamStrength: number,
  oppStrength: number,
  homeAdvantage = 0,
  opts?: { isUserTeam?: boolean; isPlayoffs?: boolean },
): {
  teamScore: number;
  oppScore: number;
  won: boolean;
} {
  let teamStr = teamStrength;
  let oppStr = oppStrength;
  if (opts?.isUserTeam) {
    teamStr -= 2.4;
    oppStr += 1;
  }
  const homeAdv = homeAdvantage + (opts?.isPlayoffs ? 0.4 : 0);
  const diff = teamStr + homeAdv - oppStr;
  const variance = (Math.random() - 0.5) * NBA_GAME_VARIANCE;
  const adjusted = diff + variance;
  const winProb = 1 / (1 + Math.exp(-adjusted / NBA_WIN_PROB_SCALE));
  const won = Math.random() < winProb;

  const base = 108 + (Math.random() - 0.5) * 10;
  const margin = Math.abs(adjusted) * 0.28 + Math.random() * 6;
  const teamScore = Math.round(won ? base + margin : base - margin);
  const oppScore = Math.round(won ? base - margin : base + margin);

  return {
    teamScore: Math.max(88, Math.min(138, teamScore)),
    oppScore: Math.max(88, Math.min(138, oppScore)),
    won,
  };
}

function statRates(player: Player): { ppg: number; rpg: number; apg: number; mpg: number } {
  const ovr = player.overall;
  const pos = player.position;
  const usage = player.minutesPerGame / 36;
  const ppg = (8 + ovr * 0.28 + (pos === 'SG' || pos === 'SF' ? 3 : 0)) * usage;
  const rpg = (2 + ovr * 0.06 + (pos === 'C' || pos === 'PF' ? 4 : 0)) * usage;
  const apg = (1.5 + ovr * 0.05 + (pos === 'PG' ? 4 : pos === 'SG' ? 1.5 : 0)) * usage;
  const mpg = Math.min(38, player.minutesPerGame + (Math.random() - 0.5) * 4);
  return { ppg, rpg, apg, mpg };
}

function gameBoxScore(player: Player): { pts: number; reb: number; ast: number; min: number } {
  const base = statRates(player);
  const variance = 0.75 + Math.random() * 0.5;
  return {
    pts: Math.max(0, Math.round(base.ppg * variance)),
    reb: Math.max(0, Math.round(base.rpg * variance)),
    ast: Math.max(0, Math.round(base.apg * variance)),
    min: Math.max(8, Math.round(base.mpg * variance)),
  };
}

function mergeStats(
  current: Player['seasonStats'] | undefined,
  box: { pts: number; reb: number; ast: number; min: number },
): NonNullable<Player['seasonStats']> {
  const prev = current ?? emptyStats();
  const games = prev.games + 1;
  return {
    games,
    ppg: Math.round(((prev.ppg * prev.games + box.pts) / games) * 10) / 10,
    rpg: Math.round(((prev.rpg * prev.games + box.reb) / games) * 10) / 10,
    apg: Math.round(((prev.apg * prev.games + box.ast) / games) * 10) / 10,
    mpg: Math.round(((prev.mpg * prev.games + box.min) / games) * 10) / 10,
  };
}

export function applyGameStats(
  franchise: Franchise,
  results: GameResult[],
  starterIds?: string[],
): { franchise: Franchise; logEntries: GameLogEntry[] } {
  let roster = [...franchise.roster];
  const logEntries: GameLogEntry[] = [];
  const ids =
    starterIds ??
    (franchise.startingFive?.length === 5 ? franchise.startingFive : undefined);

  for (const result of results) {
    const starters = ids
      ? roster.filter((p) => ids.includes(p.id) && !p.injured)
      : roster.filter((p) => !p.injured);
    const bench = ids
      ? roster.filter((p) => !p.injured && !ids.includes(p.id))
      : [];

    const starterBoxes = starters.map((p) => ({ player: p, box: gameBoxScore(p) }));
    const benchSample = bench
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((p) => ({
        player: p,
        box: {
          pts: Math.max(0, Math.round(gameBoxScore(p).pts * 0.45)),
          reb: Math.max(0, Math.round(gameBoxScore(p).reb * 0.45)),
          ast: Math.max(0, Math.round(gameBoxScore(p).ast * 0.45)),
          min: Math.max(5, Math.round(gameBoxScore(p).min * 0.35)),
        },
      }));

    const boxes = [...starterBoxes, ...benchSample];

    let topScorer = boxes[0];
    let topRebounder = boxes[0];
    let topAssister = boxes[0];
    for (const entry of boxes) {
      if (entry.box.pts > topScorer.box.pts) topScorer = entry;
      if (entry.box.reb > topRebounder.box.reb) topRebounder = entry;
      if (entry.box.ast > topAssister.box.ast) topAssister = entry;
    }

    roster = roster.map((p) => {
      const match = boxes.find((b) => b.player.id === p.id);
      if (!match) return p;
      return { ...p, seasonStats: mergeStats(p.seasonStats, match.box) };
    });

    logEntries.push({
      ...result,
      id: uid('gm'),
      season: franchise.season,
      week: franchise.week,
      gameInWeek: result.gameInWeek,
      topScorer: topScorer
        ? { name: playerName(topScorer.player), pts: topScorer.box.pts }
        : undefined,
      topRebounder: topRebounder
        ? { name: playerName(topRebounder.player), reb: topRebounder.box.reb }
        : undefined,
      topAssister: topAssister
        ? { name: playerName(topAssister.player), ast: topAssister.box.ast }
        : undefined,
    });
  }

  return { franchise: { ...franchise, roster }, logEntries };
}

function syntheticLeader(
  rank: number,
  category: 'ppg' | 'rpg' | 'apg',
  league: League,
  userRoster: Player[],
  usedNames: Set<string>,
): LeagueStatLeader {
  const userStar = userRoster
    .filter((p) => p.seasonStats && p.seasonStats.games > 0)
    .sort((a, b) => (b.seasonStats?.ppg ?? 0) - (a.seasonStats?.ppg ?? 0))[rank - 1];

  if (userStar && rank <= 3 && Math.random() > 0.45) {
    const val =
      category === 'ppg'
        ? userStar.seasonStats!.ppg
        : category === 'rpg'
          ? userStar.seasonStats!.rpg
          : userStar.seasonStats!.apg;
    return {
      rank,
      playerName: playerName(userStar),
      teamName: `${league.teams.find((t) => t.isUser)?.fullName ?? 'Your team'}`,
      position: userStar.position,
      value: val,
      isUser: true,
    };
  }

  const team = league.teams[Math.floor(Math.random() * league.teams.length)];
  const base =
    category === 'ppg' ? 18 + Math.random() * 14 : category === 'rpg' ? 6 + Math.random() * 8 : 4 + Math.random() * 7;
  const { firstName, lastName } = takeUniqueName(usedNames, rank * 11 + category.length);
  const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  return {
    rank,
    playerName: `${firstName} ${lastName}`,
    teamName: team.fullName,
    position: positions[rank % positions.length],
    value: Math.round(base * 10) / 10,
    isUser: false,
  };
}

export function buildLeagueStatSnapshot(league: League, franchise: Franchise): LeagueStatSnapshot {
  const usedNames = new Set<string>();
  const build = (cat: 'ppg' | 'rpg' | 'apg') =>
    [1, 2, 3, 4, 5].map((rank) => syntheticLeader(rank, cat, league, franchise.roster, usedNames));

  const ppg = build('ppg').sort((a, b) => b.value - a.value).map((l, i) => ({ ...l, rank: i + 1 }));
  const rpg = build('rpg').sort((a, b) => b.value - a.value).map((l, i) => ({ ...l, rank: i + 1 }));
  const apg = build('apg').sort((a, b) => b.value - a.value).map((l, i) => ({ ...l, rank: i + 1 }));
  return { ppg, rpg, apg };
}
