import type { Franchise, League, LeagueTeam, Player } from '../types/game';
import { getStandings, getTeamById } from '../data/league';
import { derivePlayerRatings } from '../lib/playerRatings';
import { getTeamRoster } from './leagueWorld';
import { teamRegularSeasonRecord } from './regularSeasonRecord';
import { PLAYOFF_TEAM_COUNT } from './playoffs';
import { lineupModifiers, lineupTalent } from './simulation';
import { NBA_HOME_EDGE, NBA_WIN_PROB_SCALE, TALENT_GAP_AMPLIFIER } from './stats';

/** The sim's fatigue for the 2nd game of a week (see simulateSingleGame). */
export const BACK_TO_BACK_FATIGUE = 1.4;

type StyleKey = 'tp' | 'fg' | 'di' | 'dp' | 'reb' | 'ath' | 'ps';

const STRENGTH_LABEL: Record<StyleKey, string> = {
  tp: 'Lives from three',
  fg: 'Scores inside',
  di: 'Protects the rim',
  dp: 'Pressures the perimeter',
  reb: 'Crashes the glass',
  ath: 'Athletic, runs in transition',
  ps: 'Moves the ball',
};

const WEAKNESS_LABEL: Record<StyleKey, string> = {
  tp: 'poor shooting',
  fg: 'little inside scoring',
  di: 'weak interior defense',
  dp: 'weak perimeter defense',
  reb: 'loses the glass',
  ath: 'slow in transition',
  ps: 'stagnant offense',
};

const KEYS: StyleKey[] = ['tp', 'fg', 'di', 'dp', 'reb', 'ath', 'ps'];

/** Minutes-weighted rating profile of a team's top eight. */
function teamProfile(roster: Player[]): Record<StyleKey, number> {
  const top = [...roster].filter((p) => !p.injured).sort((a, b) => b.overall - a.overall).slice(0, 8);
  const out = {} as Record<StyleKey, number>;
  for (const k of KEYS) {
    out[k] = top.reduce((s, p) => s + derivePlayerRatings(p)[k], 0) / Math.max(1, top.length);
  }
  return out;
}

let leagueAverageCache: { key: string; avg: Record<StyleKey, number> } | null = null;

function leagueAverageProfile(league: League, franchise: Franchise): Record<StyleKey, number> {
  const key = `${league.season}-${league.teams.length}`;
  if (leagueAverageCache?.key === key) return leagueAverageCache.avg;
  const profiles = league.teams.map((t) => teamProfile(getTeamRoster(league, t, franchise)));
  const avg = {} as Record<StyleKey, number>;
  for (const k of KEYS) avg[k] = profiles.reduce((s, p) => s + p[k], 0) / Math.max(1, profiles.length);
  leagueAverageCache = { key, avg };
  return avg;
}

export interface ScoutingReport {
  record: string;
  star?: { name: string; overall: number; position: string };
  strength: string;
  weakness: string;
  line: string;
}

/** One-line opponent scouting from their roster ratings. Descriptive only in Polish. */
export function scoutOpponent(league: League, opponentId: string, franchise: Franchise): ScoutingReport | null {
  const team = getTeamById(league, opponentId);
  if (!team) return null;
  const roster = getTeamRoster(league, team, franchise);
  const profile = teamProfile(roster);
  const avg = leagueAverageProfile(league, franchise);
  const deltas = KEYS.map((k) => ({ k, d: profile[k] - avg[k] })).sort((a, b) => b.d - a.d);
  const best = [...roster].sort((a, b) => b.overall - a.overall)[0];
  const rec = teamRegularSeasonRecord(team);
  const strength = STRENGTH_LABEL[deltas[0].k];
  const weakness = WEAKNESS_LABEL[deltas[deltas.length - 1].k];
  return {
    record: `${rec.wins}–${rec.losses}`,
    star: best ? { name: `${best.firstName} ${best.lastName}`, overall: best.overall, position: best.position } : undefined,
    strength,
    weakness,
    line: `${strength} · ${weakness}`,
  };
}

export interface WinOdds {
  win: number;
  you: number;
  them: number;
  /** Plain-language factors, biggest first: "+5 talent", "Home court", "2nd game this week". */
  reasons: string[];
}

/**
 * Pre-game odds using exactly the sim's model (simulateSingleGame), including the back-to-back
 * fatigue the old Game Day odds left out.
 */
export function gameDayOdds(
  franchise: Franchise,
  starterIds: string[],
  opponentStrengthValue: number,
  home: boolean,
  secondGameOfWeek: boolean,
): WinOdds {
  const talent = lineupTalent(franchise, starterIds);
  const mods = lineupModifiers(franchise, starterIds);
  const fatigue = secondGameOfWeek ? BACK_TO_BACK_FATIGUE : 0;
  const talentPts = (talent - opponentStrengthValue) * TALENT_GAP_AMPLIFIER;
  const homePts = home ? NBA_HOME_EDGE : 0;
  const diff = talentPts + mods - fatigue + homePts;
  const win = Math.round(100 / (1 + Math.exp(-diff / (NBA_WIN_PROB_SCALE * 1.15))));

  const factors: { label: string; weight: number }[] = [];
  const gap = Math.round(talent - opponentStrengthValue);
  if (gap !== 0) factors.push({ label: `${gap > 0 ? '+' : ''}${gap} talent`, weight: Math.abs(talentPts) });
  if (home) factors.push({ label: 'Home court', weight: homePts });
  else factors.push({ label: 'On the road', weight: 0.5 });
  if (secondGameOfWeek) factors.push({ label: '2nd game this week', weight: fatigue });
  // Only mention chemistry/coaching when it's big enough to notice — it's near-constant per team.
  if (Math.abs(mods) >= 2) {
    factors.push({ label: mods > 0 ? 'Team chemistry & coaching' : 'Morale & chemistry drag', weight: Math.abs(mods) });
  }
  factors.sort((a, b) => b.weight - a.weight);

  return {
    win,
    you: Math.round(talent),
    them: Math.round(opponentStrengthValue),
    reasons: factors.slice(0, 3).map((f) => f.label),
  };
}

/** "Now #6 of 30 · 1.5 back of #5" (or "· 2 back of the playoffs" outside the top 16). */
export function standingsLine(league: League): string | null {
  const table = getStandings(league);
  const idx = table.findIndex((t) => t.isUser);
  if (idx < 0) return null;
  const me = teamRegularSeasonRecord(table[idx]);
  const gb = (t: LeagueTeam) => {
    const r = teamRegularSeasonRecord(t);
    return ((r.wins - me.wins) + (me.losses - r.losses)) / 2;
  };
  const fmt = (n: number) => (n === Math.floor(n) ? `${n}` : n.toFixed(1));
  const parts = [`Now #${idx + 1} of ${table.length}`];
  if (idx > 0) {
    const ahead = gb(table[idx - 1]);
    parts.push(ahead > 0 ? `${fmt(ahead)} back of #${idx}` : `tied with #${idx}`);
  }
  const playoffCut = PLAYOFF_TEAM_COUNT;
  if (idx >= playoffCut) {
    const back = gb(table[playoffCut - 1]);
    if (back > 0) parts.push(`${fmt(back)} back of the playoffs`);
  }
  return parts.join(' · ');
}
