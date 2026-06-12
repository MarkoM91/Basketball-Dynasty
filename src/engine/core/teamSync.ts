import type { Franchise, League, LeagueTeam, Player, TeamStrategy } from '../../types/game';
import { normalizeLeagueTeam } from '../../data/league';
import { getTeamRoster, rosterPayroll, strengthFromRoster } from '../leagueWorld';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function deterministicStrategy(team: LeagueTeam, strength: number): TeamStrategy {
  if (team.isUser) return team.strategy;
  if (strength >= 86) return team.id.length % 2 === 0 ? 'all_in' : 'contend';
  if (strength >= 80) return 'contend';
  if (strength >= 76) return team.id.length % 2 === 0 ? 'playin' : 'retool';
  if (strength >= 72) return 'developing';
  if (strength >= 68) return 'playin';
  if (strength >= 64) return 'retool';
  return team.id.length % 2 === 0 ? 'rebuild' : 'tank';
}

export function refreshCoreTeam(team: LeagueTeam, roster: Player[]): LeagueTeam {
  const strength = strengthFromRoster(roster);
  return normalizeLeagueTeam({
    ...team,
    strength,
    payroll: rosterPayroll(roster),
    starOverall: clamp(Math.max(...roster.map((p) => p.overall), team.starOverall), 68, 94),
    strategy: deterministicStrategy(team, strength),
  });
}

export function syncCoreTeamsFromRosters(league: League, franchise?: Franchise): League {
  return {
    ...league,
    teams: league.teams.map((team) => refreshCoreTeam(team, getTeamRoster(league, team, franchise))),
  };
}

