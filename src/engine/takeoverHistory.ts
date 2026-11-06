import type { Franchise, GameLogEntry, League } from '../types/game';
import { uid } from '../data/scenarios';
import { normalizeLeagueTeam } from '../data/league';
import { buildSeasonSchedule } from './schedule';
import { SCHEDULE_GAMES_PER_WEEK, SCHEDULE_WEEKS } from './leagueSchedule';
import { catchUpLeagueThroughWeek } from './leagueSimulation';
import { initialTeamScoring, mergeTeamScoring } from './stats';

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Mid-season takeover: give the franchise a real history instead of a bare W–L number.
 *
 * Before this existed, a scenario like "22–22 at the deadline" seeded every AI team with 44 games,
 * then the week catch-up simulated weeks 1–17 on top of that (AI teams ended up at ~77 games) while
 * the user's record lived only in a field that the schedule-driven record sync later overwrote.
 *
 * Now: the calendar week matches games played, the user's pre-takeover games are written to the
 * game log (same win% as the scenario), and the whole league is replayed from 0–0 through the
 * week before takeover — so every team has the same games played and the records are consistent.
 */
export function backfillTakeoverHistory(
  franchise: Franchise,
  league: League,
): { franchise: Franchise; league: League } {
  const target = franchise.record;
  const played = target.wins + target.losses;
  if (played <= 0 || !franchise.leagueTeamId) return { franchise, league };

  const week = Math.min(SCHEDULE_WEEKS, Math.floor(played / SCHEDULE_GAMES_PER_WEEK) + 1);
  const fresh: League = {
    ...league,
    teams: league.teams.map((t) =>
      normalizeLeagueTeam({
        ...t,
        wins: 0,
        losses: 0,
        regularWins: 0,
        regularLosses: 0,
        ...initialTeamScoring(t.strength),
        scoreGames: 0,
      }),
    ),
    schedule: (league.schedule ?? []).map((m) => ({ ...m, played: false })),
  };

  const atWeek: Franchise = { ...franchise, week, gamesThisWeek: 0, gameLog: [], regularSeasonRecord: undefined };
  const userGames = buildSeasonSchedule(atWeek, fresh).filter((g) => g.week < week);
  const n = userGames.length;
  const wins = Math.round((target.wins / played) * n);
  const outcomes = shuffle(Array.from({ length: n }, (_, i) => i < wins));

  let teamScoring: Franchise['teamScoring'];
  const gameLog: GameLogEntry[] = userGames.map((g, i) => {
    const won = outcomes[i];
    const winner = 104 + Math.floor(Math.random() * 20);
    const loser = winner - (1 + Math.floor(Math.random() * 17));
    const teamScore = won ? winner : loser;
    const oppScore = won ? loser : winner;
    teamScoring = mergeTeamScoring(teamScoring, teamScore, oppScore);
    return {
      id: uid('gl'),
      season: franchise.season,
      week: g.week,
      gameInWeek: g.gameInWeek,
      opponent: g.opponentName,
      home: g.home,
      teamScore,
      oppScore,
      won,
      note: 'Played before you took over the front office.',
    };
  });

  const withHistory: Franchise = {
    ...atWeek,
    gameLog,
    teamScoring,
    record: { wins, losses: n - wins },
  };
  const replayed = catchUpLeagueThroughWeek(fresh, franchise.leagueTeamId, withHistory, week - 1);
  return { franchise: withHistory, league: replayed };
}
