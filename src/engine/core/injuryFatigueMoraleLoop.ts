import type { Franchise, MoraleLevel, Player } from '../../types/game';
import { getTeamRoster, setTeamRoster } from '../leagueWorld';
import type { LeagueState, NewsEvent } from './models';
import type { Rng } from './rng';
import { syncCoreTeamsFromRosters } from './teamSync';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function moraleFromScore(score: number): MoraleLevel {
  if (score >= 70) return 'Happy';
  if (score >= 42) return 'Stable';
  if (score >= 20) return 'Concerned';
  if (score >= 5) return 'Frustrated';
  return 'Angry';
}

function recoverPlayer(player: Player): Player {
  if (!player.injured || !player.injuryWeeks) return player;
  const remaining = player.injuryWeeks - 1 / 7;
  if (remaining > 0) return { ...player, injuryWeeks: Math.round(remaining * 10) / 10 };
  const { injured, injuryWeeks, ...rest } = player;
  return {
    ...rest,
    role: rest.overall >= 84 ? 'Star' : rest.overall >= 78 ? 'Starter' : 'Rotation',
  };
}

function injuryProbability(player: Player, teamFatigue: number): number {
  const risk = player.injuryRisk === 'High' ? 0.00145 : player.injuryRisk === 'Medium' ? 0.00085 : 0.0004;
  const minutes = Math.max(0, player.minutesPerGame - 24) * 0.000055;
  return risk + teamFatigue * 0.000018 + minutes;
}

function maybeInjure(player: Player, teamFatigue: number, rng: Rng): Player {
  if (player.injured) return player;
  if (!rng.chance(injuryProbability(player, teamFatigue))) return player;
  const weeks = player.injuryRisk === 'High' ? rng.int(2, 7) : rng.int(1, 4);
  return {
    ...player,
    injured: true,
    injuryWeeks: weeks,
    role: 'Injured',
  };
}

export function processInjuryFatigueMorale(state: LeagueState, rng: Rng): LeagueState {
  let league = state.league;
  let franchise: Franchise | undefined = state.franchise;
  const teams = { ...state.teams };
  const news: NewsEvent[] = [];

  for (const team of league.teams) {
    const prior = teams[team.id] ?? {
      teamId: team.id,
      fatigue: 0,
      morale: 50,
      transactionPressure: 0,
    };
    const rested = Math.max(0, prior.fatigue - (prior.lastGameDay === state.calendar.day ? 2 : 7));
    const recent = team.wins + team.losses > 0 ? team.wins / Math.max(1, team.wins + team.losses) : 0.5;
    const moraleDrift = recent >= 0.6 ? 0.6 : recent <= 0.38 ? -0.7 : 0.1;
    teams[team.id] = {
      ...prior,
      fatigue: Math.round(rested * 10) / 10,
      morale: clamp(Math.round((prior.morale + moraleDrift) * 10) / 10, 0, 100),
      transactionPressure: clamp(prior.transactionPressure * 0.985 + (team.losses > team.wins ? 0.05 : -0.03), 0, 100),
    };

    const before = getTeamRoster(league, team, franchise);
    const after = before.map((p) => maybeInjure(recoverPlayer(p), teams[team.id].fatigue, rng));
    const injury = after.find((p, idx) => p.injured && !before[idx]?.injured);
    const recovery = before.find((p, idx) => p.injured && !after[idx]?.injured);

    if (injury) {
      news.push({
        id: `news-${state.calendar.day}-${team.id}-${injury.id}-injury`,
        dateISO: state.calendar.dateISO,
        season: league.season,
        type: 'injury',
        headline: `${injury.firstName} ${injury.lastName} will miss roughly ${injury.injuryWeeks} weeks.`,
        teamId: team.id,
        playerId: injury.id,
        severity: injury.overall >= 84 ? 'major' : 'normal',
      });
    }
    if (recovery) {
      news.push({
        id: `news-${state.calendar.day}-${team.id}-${recovery.id}-return`,
        dateISO: state.calendar.dateISO,
        season: league.season,
        type: 'injury',
        headline: `${recovery.firstName} ${recovery.lastName} is cleared to return.`,
        teamId: team.id,
        playerId: recovery.id,
        severity: 'minor',
      });
    }

    league = setTeamRoster(league, team, after);
    if (team.isUser && franchise) {
      franchise = {
        ...franchise,
        roster: after,
        lockerRoom: moraleFromScore(teams[team.id].morale),
        fanMood: moraleFromScore(teams[team.id].morale + (team.wins - team.losses)),
      };
    }
  }

  return {
    ...state,
    league: syncCoreTeamsFromRosters(league, franchise),
    franchise,
    teams,
    news: [...news, ...state.news],
  };
}
