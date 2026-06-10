import type { Franchise, League, LeagueTeam, TeamStrategy } from '../types/game';
import { uid } from './scenarios';
import { resolveTeamFullName, resolveTeamIdentity } from './teamNames';
import { getTeamVisual } from '../lib/visuals/teamLogos';
import { initialTeamScoring } from '../engine/stats';
import { SEASON_GAME_COUNT, seedLeagueRecords } from '../engine/leagueSimulation';
import { teamRegularSeasonRecord } from '../engine/regularSeasonRecord';
import { buildLeagueSchedule, ensureLeagueSchedule } from '../engine/leagueSchedule';
import { PROBALLERS_RATINGS } from './proballersRatings';
import { teamStarFromRatings, teamStrengthFromRatings } from '../engine/proballersPlayer';
import { strategyForFranchise, teamRatingStrength } from '../engine/scenarioDifficulty';
import { ensureLeagueRosters } from '../engine/leagueWorld';

export const LEAGUE_TEAM_TEMPLATES: { city: string; name: string; market: 'Small' | 'Mid' | 'Large' }[] = [
  { city: 'Boston', name: 'Harbor', market: 'Large' },
  { city: 'Brooklyn', name: 'Union', market: 'Large' },
  { city: 'New York', name: 'Skyline', market: 'Large' },
  { city: 'Philadelphia', name: 'Colonials', market: 'Large' },
  { city: 'Toronto', name: 'Sentinel', market: 'Large' },
  { city: 'Chicago', name: 'Gale', market: 'Large' },
  { city: 'Cleveland', name: 'Rust', market: 'Mid' },
  { city: 'Detroit', name: 'Assembly', market: 'Mid' },
  { city: 'Indiana', name: 'Velocity', market: 'Small' },
  { city: 'Milwaukee', name: 'Hops', market: 'Small' },
  { city: 'Atlanta', name: 'Peachtree', market: 'Mid' },
  { city: 'Charlotte', name: 'Mint', market: 'Mid' },
  { city: 'Miami', name: 'Surge', market: 'Large' },
  { city: 'Orlando', name: 'Aurora', market: 'Mid' },
  { city: 'Washington', name: 'Monument', market: 'Large' },
  { city: 'Denver', name: 'Altitude', market: 'Mid' },
  { city: 'Minnesota', name: 'Northstar', market: 'Small' },
  { city: 'Oklahoma City', name: 'Voltage', market: 'Small' },
  { city: 'Portland', name: 'Rose', market: 'Small' },
  { city: 'Utah', name: 'Mesa', market: 'Small' },
  { city: 'Golden State', name: 'Spectrum', market: 'Large' },
  { city: 'LA', name: 'Current', market: 'Large' },
  { city: 'LA', name: 'Cosmos', market: 'Large' },
  { city: 'Phoenix', name: 'Sol', market: 'Mid' },
  { city: 'Sacramento', name: 'Republic', market: 'Mid' },
  { city: 'Dallas', name: 'Lasso', market: 'Mid' },
  { city: 'Houston', name: 'Comets', market: 'Large' },
  { city: 'Memphis', name: 'Sound', market: 'Small' },
  { city: 'New Orleans', name: 'Bayou', market: 'Small' },
  { city: 'San Antonio', name: 'Mission', market: 'Small' },
];

export function pickStrategy(strength: number): TeamStrategy {
  if (strength >= 86) return Math.random() > 0.5 ? 'all_in' : 'contend';
  if (strength >= 80) return 'contend';
  if (strength >= 76) return Math.random() > 0.5 ? 'playin' : 'retool';
  if (strength >= 72) return 'developing';
  if (strength >= 68) return 'playin';
  if (strength >= 64) return 'retool';
  return Math.random() > 0.4 ? 'rebuild' : 'tank';
}

export function createLeague(
  season: number,
  userCity: string,
  userName: string,
  userStrength: number,
  userRecord?: { wins: number; losses: number },
  userStrategy: TeamStrategy = 'contend',
): League {
  const userIdentity = resolveTeamIdentity(userCity, userName);
  const teams: LeagueTeam[] = LEAGUE_TEAM_TEMPLATES.map((t, i) => {
    const isUser = t.city === userIdentity.city && t.name === userIdentity.name;
    const teamKey = `${t.city}|${t.name}`;
    const rated = PROBALLERS_RATINGS[teamKey];
    const derivedStrength = rated && rated.length >= 8
      ? teamStrengthFromRatings(rated)
      : clamp(62 + Math.floor(Math.random() * 28) + (i % 5) - 2, 62, 91);
    const derivedStar = rated?.length
      ? teamStarFromRatings(rated)
      : clamp(derivedStrength + 4 + (i % 7), 68, 94);
    const strength = isUser ? userStrength : derivedStrength;
    const strategy = isUser ? userStrategy : pickStrategy(strength);
    const gamesPlayed =
      isUser && userRecord ? userRecord.wins + userRecord.losses : 0;
    const wins = isUser && userRecord ? userRecord.wins : 0;
    const losses = isUser && userRecord ? userRecord.losses : 0;
    const scoring = initialTeamScoring(strength);
    scoring.scoreGames = gamesPlayed;

    return {
      id: uid('tm'),
      city: t.city,
      name: t.name,
      fullName: `${t.city} ${t.name}`,
      abbrev: getTeamVisual(t.city, t.name).abbrev,
      primaryColor: getTeamVisual(t.city, t.name).primary,
      market: t.market,
      strategy,
      wins,
      losses,
      regularWins: wins,
      regularLosses: losses,
      strength: Math.round(strength * 10) / 10,
      payroll: Math.round(strength * 1.45 * 1_000_000),
      starOverall: isUser ? clamp(Math.round(userStrength + 4), 68, 94) : clamp(derivedStar, 68, 94),
      taxAverse: t.market === 'Small' || Math.random() > 0.55,
      isUser,
      ...scoring,
    };
  });

  const userTeam = teams.find((t) => t.isUser);
  const balanced = seedLeagueRecords(
    teams,
    userRecord ? userRecord.wins + userRecord.losses : 0,
    userTeam?.id,
    userRecord,
  );

  return { season, teams: balanced, schedule: buildLeagueSchedule(balanced, season), draftOrder: [], draftLotteryLog: [], rosters: {} };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function linkLeagueToFranchise(
  franchise: { city: string; name: string; leagueTeamId?: string },
  league: League,
): { franchise: typeof franchise & { leagueTeamId: string }; league: League } {
  const identity = resolveTeamIdentity(franchise.city, franchise.name);
  const userTeam = league.teams.find((t) => t.city === identity.city && t.name === identity.name);
  if (!userTeam) return { franchise: { ...franchise, leagueTeamId: franchise.leagueTeamId ?? '' }, league };

  return {
    franchise: {
      ...franchise,
      city: identity.city,
      name: identity.name,
      leagueTeamId: userTeam.id,
    },
    league: {
      ...league,
      teams: league.teams.map((t) => ({ ...t, isUser: t.id === userTeam.id })),
    },
  };
}

export function syncUserTeam(
  league: League,
  franchise: {
    city: string;
    name: string;
    record: { wins: number; losses: number };
    regularSeasonRecord?: { wins: number; losses: number };
    cap: { payroll: number };
    market: 'Small' | 'Mid' | 'Large';
    roster: { overall: number; injured?: boolean }[];
    teamScoring?: { ppgFor: number; ppgAgainst: number; games: number };
    scenarioId?: Franchise['scenarioId'];
    window?: Franchise['window'];
    gameLog?: Franchise['gameLog'];
    season?: number;
    leagueTeamId?: string;
  },
  userRecord?: { wins: number; losses: number },
): League {
  const identity = resolveTeamIdentity(franchise.city, franchise.name);
  const strength = franchise.scenarioId
    ? teamRatingStrength(franchise as Franchise)
    : franchise.roster.length
      ? franchise.roster.filter((p) => !('injured' in p && p.injured)).reduce((s, p) => s + p.overall, 0) /
        Math.max(1, franchise.roster.length)
      : 75;
  const strategy = franchise.scenarioId || franchise.window
    ? strategyForFranchise(franchise as Franchise)
    : undefined;
  const reg = userRecord ?? franchise.regularSeasonRecord ?? franchise.record;

  return {
    ...league,
    teams: league.teams.map((t) => {
      if (t.city !== identity.city || t.name !== identity.name) return normalizeLeagueTeam(t);
      const played = franchise.teamScoring?.games ?? 0;
      const scoring =
        played > 0
          ? {
              ppgFor: franchise.teamScoring!.ppgFor,
              ppgAgainst: franchise.teamScoring!.ppgAgainst,
              scoreGames: reg.wins + reg.losses,
            }
          : {
              ppgFor: t.ppgFor,
              ppgAgainst: t.ppgAgainst,
              scoreGames: t.scoreGames,
            };
      return normalizeLeagueTeam({
        ...t,
        wins: reg.wins,
        losses: reg.losses,
        regularWins: reg.wins,
        regularLosses: reg.losses,
        strength: Math.round(strength * 10) / 10,
        strategy: strategy ?? t.strategy,
        payroll: franchise.cap.payroll,
        market: franchise.market,
        starOverall: Math.max(...franchise.roster.map((p) => p.overall)),
        ...scoring,
      });
    }),
  };
}

export function normalizeLeagueTeam(t: LeagueTeam): LeagueTeam {
  const { city, name } = resolveTeamIdentity(t.city, t.name);
  const visual = getTeamVisual(city, name);
  const reg = teamRegularSeasonRecord(t);
  const fallback = initialTeamScoring(t.strength);
  return {
    ...t,
    city,
    name,
    fullName: `${city} ${name}`,
    abbrev: visual.abbrev,
    primaryColor: visual.primary,
    wins: reg.wins,
    losses: reg.losses,
    regularWins: reg.wins,
    regularLosses: reg.losses,
    ppgFor: t.ppgFor ?? fallback.ppgFor,
    ppgAgainst: t.ppgAgainst ?? fallback.ppgAgainst,
    scoreGames: t.scoreGames ?? reg.wins + reg.losses,
  };
}

export function normalizeLeague(league: League, userFranchise?: Franchise | null): League {
  const withSchedule = ensureLeagueSchedule({
    ...league,
    teams: league.teams.map(normalizeLeagueTeam),
  });
  const withRosters = ensureLeagueRosters(withSchedule, userFranchise);
  return {
    ...withRosters,
    draftOrder: (league.draftOrder ?? []).map((entry) => ({
      ...entry,
      teamName: resolveTeamFullName(entry.teamName),
    })),
    draftLotteryLog: league.draftLotteryLog ?? [],
  };
}

export function getUserTeam(league: League): LeagueTeam | undefined {
  return league.teams.find((t) => t.isUser);
}

export function getTeamById(league: League, id: string): LeagueTeam | undefined {
  return league.teams.find((t) => t.id === id);
}

export function getStandings(league: League): LeagueTeam[] {
  return [...league.teams]
    .sort((a, b) => {
      const regA = teamRegularSeasonRecord(a);
      const regB = teamRegularSeasonRecord(b);
      const pctA = regA.wins / Math.max(1, regA.wins + regA.losses);
      const pctB = regB.wins / Math.max(1, regB.wins + regB.losses);
      if (pctB !== pctA) return pctB - pctA;
      if (regB.wins !== regA.wins) return regB.wins - regA.wins;
      return regA.losses - regB.losses;
    })
    .map((t) => {
      const reg = teamRegularSeasonRecord(t);
      return { ...t, wins: reg.wins, losses: reg.losses };
    });
}

export { SEASON_GAME_COUNT };

export function strategyLabel(s: TeamStrategy): string {
  switch (s) {
    case 'all_in': return 'All-in';
    case 'contend': return 'Contending';
    case 'playin': return 'Play-in push';
    case 'developing': return 'Developing';
    case 'retool': return 'Retooling';
    case 'rebuild': return 'Rebuilding';
    case 'tank': return 'Tanking';
  }
}

export function teamWantsPicks(strategy: TeamStrategy): boolean {
  return strategy === 'rebuild' || strategy === 'tank' || strategy === 'developing';
}

export function teamWantsVeterans(strategy: TeamStrategy): boolean {
  return strategy === 'all_in' || strategy === 'contend' || strategy === 'playin';
}

export { resolveTeamFullName };
