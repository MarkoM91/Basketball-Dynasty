import type { LeagueTeam } from '../../types/game';
import { playerName } from '../../data/scenarios';
import { evaluateTradeForTeam } from '../league';
import { getTeamRoster, setTeamRoster } from '../leagueWorld';
import { marketSalary } from '../salaries';
import type { LeagueState, NewsEvent } from './models';
import type { Rng } from './rng';
import { syncCoreTeamsFromRosters } from './teamSync';

function pressureFor(team: LeagueTeam): number {
  const games = team.wins + team.losses;
  const winPct = games ? team.wins / games : 0.5;
  if (team.strategy === 'all_in' || team.strategy === 'contend') return winPct < 0.52 ? 0.65 : 0.28;
  if (team.strategy === 'rebuild' || team.strategy === 'tank') return winPct > 0.45 ? 0.42 : 0.18;
  return 0.25;
}

export function processContractFreeAgencyAi(state: LeagueState, rng: Rng): LeagueState {
  const phase = state.calendar.phase;
  if (phase !== 'regular_season' && phase !== 'trade_deadline' && phase !== 'free_agency') return state;

  let league = state.league;
  const news: NewsEvent[] = [];

  if (phase === 'free_agency') {
    return state;
  }

  if (!rng.chance(phase === 'trade_deadline' ? 0.2 : 0.035)) return state;

  const teams = league.teams.filter((t) => !t.isUser);
  const buyers = teams.filter((t) => pressureFor(t) > 0.4).sort((a, b) => pressureFor(b) - pressureFor(a));
  const sellers = teams.filter((t) => t.strategy === 'rebuild' || t.strategy === 'tank' || t.losses > t.wins + 8);
  const buyer = rng.pick(buyers);
  const seller = rng.pick(sellers.filter((t) => t.id !== buyer?.id));
  if (!buyer || !seller) return state;

  const sellerRoster = getTeamRoster(league, seller, state.franchise);
  const buyerRoster = getTeamRoster(league, buyer, state.franchise);
  const veteran = sellerRoster
    .filter((p) => p.age >= 27 && p.overall >= 76 && !p.injured)
    .sort((a, b) => b.overall - a.overall)[0];
  const young = buyerRoster
    .filter((p) => p.age <= 25 && p.potential >= p.overall + 5 && p.contract.annualSalary <= marketSalary(p.overall, p.age))
    .sort((a, b) => b.potential - a.potential)[0];
  if (!veteran || !young) return state;

  const sellerEval = evaluateTradeForTeam(seller, [young], [], [veteran], []);
  const buyerEval = evaluateTradeForTeam(buyer, [veteran], [], [young], []);
  if (sellerEval.score < 50 || buyerEval.score < 50) return state;

  league = setTeamRoster(
    league,
    seller,
    sellerRoster.filter((p) => p.id !== veteran.id).concat(young),
  );
  league = setTeamRoster(
    league,
    buyer,
    buyerRoster.filter((p) => p.id !== young.id).concat(veteran),
  );

  news.push({
    id: `news-${state.calendar.day}-${buyer.id}-${seller.id}-trade`,
    dateISO: state.calendar.dateISO,
    season: league.season,
    type: 'transaction',
    headline: `${buyer.fullName} acquire ${playerName(veteran)} from ${seller.fullName} for ${playerName(young)}.`,
    teamId: buyer.id,
    playerId: veteran.id,
    severity: veteran.overall >= 82 ? 'major' : 'normal',
  });

  return {
    ...state,
    league: syncCoreTeamsFromRosters(league, state.franchise),
    news: [...news, ...state.news],
  };
}
