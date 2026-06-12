import type { Player } from '../../types/game';
import { playerName } from '../../data/scenarios';
import { developPlayers, tickSeasonContracts } from '../offseason';
import { getTeamRoster, setTeamRoster } from '../leagueWorld';
import { MIN_SALARY } from '../cap';
import type { AiFreeAgencyBid, LeagueState, NewsEvent } from './models';
import type { Rng } from './rng';
import { syncCoreTeamsFromRosters } from './teamSync';

function alreadyProcessed(state: LeagueState, key: string): boolean {
  return state.history.some((item) => item.id === key);
}

function marker(state: LeagueState, key: string, summary: string) {
  return {
    id: key,
    dateISO: state.calendar.dateISO,
    season: state.league.season,
    summary,
  };
}

function depthSigning(teamId: string, index: number, rng: Rng): Player {
  const positions: Player['position'][] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const overall = 66 + rng.int(0, 6);
  return {
    id: `core-fa-${teamId}-${index}`,
    firstName: ['Marcus', 'Jalen', 'Andre', 'Devon', 'Isaiah'][rng.int(0, 4)],
    lastName: ['Stone', 'Reed', 'Brooks', 'Hayes', 'Porter'][rng.int(0, 4)],
    age: 24 + rng.int(0, 9),
    position: positions[index % positions.length],
    overall,
    potential: overall + rng.int(0, 5),
    contract: {
      yearsRemaining: 1,
      annualSalary: MIN_SALARY,
      isMax: false,
      isExpiring: true,
      signedVia: 'minimum',
    },
    morale: 'Stable',
    role: 'Bench',
    tradeValue: 'Low',
    devTrend: 'Stable',
    injuryRisk: 'Low',
    systemFit: 'Fair',
    gmNote: 'Minimum depth signing from the core offseason loop.',
    workEthic: 'Average',
    minutesPerGame: 8,
  };
}

function buildMarket(state: LeagueState, rng: Rng): AiFreeAgencyBid[] {
  const positions: Player['position'][] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const teams = state.league.teams.filter((team) => !team.isUser);
  return Array.from({ length: 18 }, (_, index) => {
    const overall = index < 2 ? 84 + rng.int(0, 4) : index < 7 ? 78 + rng.int(0, 5) : 70 + rng.int(0, 7);
    const suitors = [...teams]
      .sort((a, b) => b.strength - a.strength)
      .slice(index % 4, index % 4 + 4)
      .map((team) => team.id);
    return {
      id: `core-market-${state.league.season}-${index}`,
      playerName: `${['Malik', 'Tobias', 'Darius', 'Keon', 'Nicolas'][index % 5]} ${['Price', 'Bennett', 'Carter', 'Wells', 'Murray'][rng.int(0, 4)]}`,
      position: positions[index % positions.length],
      overall,
      askingSalary: Math.round((overall >= 84 ? 28_000_000 : overall >= 78 ? 14_000_000 : 3_500_000) * (0.9 + rng.next() * 0.25)),
      suitorTeamIds: suitors,
      daysOpen: 0,
    };
  });
}

function processMarketDay(state: LeagueState, rng: Rng): { market: AiFreeAgencyBid[]; news: NewsEvent[] } {
  const teams = state.league.teams;
  const news: NewsEvent[] = [];
  const market = (state.freeAgencyMarket.length ? state.freeAgencyMarket : buildMarket(state, rng)).map((bid) => {
    if (bid.signedTeamId) return bid;
    const suitorId = rng.pick(bid.suitorTeamIds);
    const suitor = teams.find((team) => team.id === suitorId);
    const premium = suitor?.strategy === 'all_in' || suitor?.strategy === 'contend' ? 1.08 : 1;
    const offer = Math.round(bid.askingSalary * premium * (0.94 + rng.next() * 0.18));
    const leadingAnnualSalary = Math.max(bid.leadingAnnualSalary ?? 0, offer);
    const leadingTeamId = offer >= leadingAnnualSalary ? suitorId : bid.leadingTeamId;
    const daysOpen = bid.daysOpen + 1;
    const signChance = daysOpen >= 8 ? 0.42 : daysOpen >= 4 ? 0.16 : 0.04;
    if (leadingTeamId && rng.chance(signChance)) {
      const winner = teams.find((team) => team.id === leadingTeamId);
      news.push({
        id: `news-${state.calendar.day}-${bid.id}-signed`,
        dateISO: state.calendar.dateISO,
        season: state.league.season,
        type: 'transaction',
        headline: `${winner?.fullName ?? 'A contender'} signs ${bid.playerName} for $${(leadingAnnualSalary / 1_000_000).toFixed(1)}M per year.`,
        teamId: leadingTeamId,
        severity: bid.overall >= 84 ? 'major' : 'normal',
      });
      return { ...bid, leadingAnnualSalary, leadingTeamId, daysOpen, signedTeamId: leadingTeamId };
    }
    return { ...bid, leadingAnnualSalary, leadingTeamId, daysOpen };
  });
  return { market, news };
}

export function processOffseasonPhases(state: LeagueState, rng: Rng): LeagueState {
  const phase = state.calendar.phase;
  let next = state;
  const news: NewsEvent[] = [];

  if (phase === 'draft') {
    const key = `hist-${state.league.season}-core-development`;
    if (!alreadyProcessed(next, key) && next.franchise) {
      const developed = tickSeasonContracts(developPlayers(next.franchise));
      next = {
        ...next,
        franchise: {
          ...developed,
          phase: 'draft_scouting',
          freeAgents: [],
          rfaOffers: [],
        },
        history: [marker(next, key, 'Annual player development and contract ticks processed.'), ...next.history],
      };
      news.push({
        id: `news-${state.calendar.day}-development-report`,
        dateISO: state.calendar.dateISO,
        season: state.league.season,
        type: 'development',
        headline: 'Annual development report posted. Prospects and veterans shifted.',
        severity: 'normal',
      });
    }
  }

  if (phase === 'contract_renewals') {
    const key = `hist-${state.league.season}-renewal-window`;
    if (!alreadyProcessed(next, key)) {
      next = {
        ...next,
        franchise: next.franchise ? { ...next.franchise, phase: 'contract_renewals' } : next.franchise,
        history: [marker(next, key, 'Contract renewal window opened.'), ...next.history],
      };
      news.push({
        id: `news-${state.calendar.day}-renewal-window`,
        dateISO: state.calendar.dateISO,
        season: state.league.season,
        type: 'transaction',
        headline: 'Contract renewal window opened across the league.',
        severity: 'normal',
      });
    }
  }

  if (phase === 'free_agency') {
    const marketDay = processMarketDay(next, rng);
    next = { ...next, freeAgencyMarket: marketDay.market };
    news.push(...marketDay.news);

    const key = `hist-${state.league.season}-ai-depth-signings`;
    if (!alreadyProcessed(next, key)) {
      let league = next.league;
      const signings: string[] = [];
      for (const team of league.teams) {
        const roster = getTeamRoster(league, team, next.franchise);
        if (roster.length >= 14) continue;
        const additions = Array.from({ length: 14 - roster.length }, (_, index) => depthSigning(team.id, index, rng));
        signings.push(`${team.fullName}: ${additions.map(playerName).join(', ')}`);
        league = setTeamRoster(league, team, [...roster, ...additions]);
      }
      next = {
        ...next,
        league: syncCoreTeamsFromRosters(league, next.franchise),
        franchise: next.franchise ? { ...next.franchise, phase: 'free_agency' } : next.franchise,
        history: [marker(next, key, `AI depth signings processed for ${signings.length} teams.`), ...next.history],
      };
      news.push({
        id: `news-${state.calendar.day}-free-agency-depth`,
        dateISO: state.calendar.dateISO,
        season: state.league.season,
        type: 'transaction',
        headline: 'AI teams filled depth slots with minimum contracts.',
        severity: 'minor',
      });
    }
  }

  if (phase === 'training_camp' && next.franchise && next.franchise.phase !== 'training_camp') {
    next = {
      ...next,
      franchise: { ...next.franchise, phase: 'training_camp' },
    };
  }

  return news.length ? { ...next, news: [...news, ...next.news] } : next;
}
