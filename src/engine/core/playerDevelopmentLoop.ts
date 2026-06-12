import type { Player } from '../../types/game';
import { getTeamRoster, setTeamRoster } from '../leagueWorld';
import type { LeagueState, NewsEvent } from './models';
import type { Rng } from './rng';
import { syncCoreTeamsFromRosters } from './teamSync';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function dailyDevelopmentChance(player: Player): number {
  if (player.injured || player.age >= 28 || player.overall >= player.potential) return 0;
  const minutes = player.minutesPerGame >= 28 ? 1 : player.minutesPerGame >= 18 ? 0.65 : 0.25;
  const ethic = player.workEthic === 'Elite' ? 1.35 : player.workEthic === 'High' ? 1.05 : player.workEthic === 'Low' ? 0.45 : 0.8;
  const gap = clamp(player.potential - player.overall, 0, 24);
  return (0.0015 + gap * 0.00022) * minutes * ethic;
}

function dailyDeclineChance(player: Player): number {
  if (player.age < 30) return 0;
  const age = player.age >= 35 ? 0.006 : player.age >= 33 ? 0.0035 : 0.0018;
  const ethic = player.workEthic === 'Elite' ? 0.55 : player.workEthic === 'High' ? 0.75 : player.workEthic === 'Low' ? 1.25 : 1;
  return age * ethic;
}

export function processPlayerDevelopment(state: LeagueState, rng: Rng): LeagueState {
  let league = state.league;
  let franchise = state.franchise;
  const news: NewsEvent[] = [];

  for (const team of league.teams) {
    const roster = getTeamRoster(league, team, franchise);
    const next = roster.map((player) => {
      if (rng.chance(dailyDevelopmentChance(player))) {
        const overall = Math.min(player.potential, player.overall + 1);
        if (overall > player.overall && overall >= 78) {
          news.push({
            id: `news-${state.calendar.day}-${player.id}-dev`,
            dateISO: state.calendar.dateISO,
            season: league.season,
            type: 'development',
            headline: `${player.firstName} ${player.lastName} is showing real development gains.`,
            teamId: team.id,
            playerId: player.id,
            severity: overall >= 84 ? 'major' : 'normal',
          });
        }
        return { ...player, overall, devTrend: 'Up' as const };
      }
      if (rng.chance(dailyDeclineChance(player))) {
        return { ...player, overall: Math.max(55, player.overall - 1), devTrend: 'Down' as const };
      }
      return player;
    });

    league = setTeamRoster(league, team, next);
    if (team.isUser && franchise) franchise = { ...franchise, roster: next };
  }

  return {
    ...state,
    league: syncCoreTeamsFromRosters(league, franchise),
    franchise,
    news: [...news, ...state.news],
  };
}
