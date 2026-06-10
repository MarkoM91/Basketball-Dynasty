import type { DraftPick, Franchise, League, LeagueTeam, Player, TradeOffer } from '../types/game';
import { getStandings, getTeamById, normalizeLeagueTeam, strategyLabel, teamWantsPicks, teamWantsVeterans } from '../data/league';
import { teamRegularSeasonRecord } from './regularSeasonRecord';
import { uid } from '../data/scenarios';
import { capTradeScoreAdjust } from './cap';
import { SEASON_GAME_COUNT } from './leagueSimulation';
import { executeLeagueTrades as executeLeagueTradesFromWorld } from './leagueWorld';
import {
  applyTradeMarketModifiers,
  buildCareerTradeExtras,
  tradeMarketModifiers,
} from './careerMode';

export { simulateLeagueWeek, SEASON_GAME_COUNT, SCHEDULE_WEEKS, TRADE_DEADLINE_WEEK, formatWinPct } from './leagueSimulation';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function playerTradePoints(p: Player): number {
  let pts = p.overall * 1.2;
  pts += (p.potential - p.overall) * 0.8;
  pts -= p.age * 0.4;
  if (p.contract.isMax) pts -= 8;
  if (p.contract.yearsRemaining <= 1) pts += 3;
  if (p.isStar) pts += 12;
  if (p.injured) pts -= 15;
  if (p.morale === 'Angry') pts -= 4;
  return pts;
}

export function pickTradePoints(pick: DraftPick): number {
  const roundBase = pick.round === 1 ? 28 : 10;
  const protectionPenalty = pick.protections ? 8 : 0;
  const yearPenalty = Math.max(0, pick.year - 2027) * 3;
  return roundBase - protectionPenalty - yearPenalty;
}

export function evaluateTradeForTeam(
  team: LeagueTeam,
  incomingPlayers: Player[],
  incomingPicks: DraftPick[],
  outgoingPlayers: Player[],
  outgoingPicks: DraftPick[],
): { score: number; verdict: string } {
  let score = 50;

  const inPts =
    incomingPlayers.reduce((s, p) => s + playerTradePoints(p), 0) +
    incomingPicks.reduce((s, p) => s + pickTradePoints(p), 0);
  const outPts =
    outgoingPlayers.reduce((s, p) => s + playerTradePoints(p), 0) +
    outgoingPicks.reduce((s, p) => s + pickTradePoints(p), 0);

  score += (inPts - outPts) * 0.6;

  const getsStar = incomingPlayers.some((p) => p.overall >= 85);
  const givesStar = outgoingPlayers.some((p) => p.overall >= 85);
  const getsPicks = incomingPicks.length > 0;
  const givesPicks = outgoingPicks.length > 0;
  const getsYoung = incomingPlayers.some((p) => p.age < 24 && p.potential >= 82);
  const getsVeteran = incomingPlayers.some((p) => p.age >= 28 && p.overall >= 78);

  if (teamWantsPicks(team.strategy) && getsPicks) score += 12;
  if (teamWantsPicks(team.strategy) && givesStar) score += 8;
  if (teamWantsPicks(team.strategy) && getsVeteran) score -= 10;

  if (teamWantsVeterans(team.strategy) && getsVeteran) score += 10;
  if (teamWantsVeterans(team.strategy) && getsStar) score += 14;
  if (teamWantsVeterans(team.strategy) && givesPicks) score -= 12;
  if (teamWantsVeterans(team.strategy) && getsYoung && !getsStar) score -= 6;

  if (team.taxAverse) {
    const salaryIn = incomingPlayers.reduce((s, p) => s + p.contract.annualSalary, 0);
    const salaryOut = outgoingPlayers.reduce((s, p) => s + p.contract.annualSalary, 0);
    if (salaryIn > salaryOut + 5_000_000) score -= 15;
    if (salaryOut > salaryIn) score += 5;
  }

  const salaryIn = incomingPlayers.reduce((s, p) => s + p.contract.annualSalary, 0);
  const salaryOut = outgoingPlayers.reduce((s, p) => s + p.contract.annualSalary, 0);
  const capFx = capTradeScoreAdjust(team, salaryIn, salaryOut);
  score += capFx.scoreAdjust;

  if (team.market === 'Large' && getsStar) score += 4;

  let verdict = 'Fair value — could go either way.';
  if (score >= 72) verdict = 'Strong fit for their timeline.';
  else if (score >= 58) verdict = 'Acceptable if they need the fit.';
  else if (score <= 35) verdict = 'They would reject this loudly.';
  else if (score <= 48) verdict = 'Likely rejected unless desperate.';

  return { score: clamp(Math.round(score), 0, 100), verdict };
}

export function ensureUserPlayoffSeed(league: League): League {
  const standings = getStandings(league);
  const userIdx = standings.findIndex((t) => t.isUser);
  if (userIdx < 0 || userIdx < 16) return league;

  const sixteenth = standings[15];
  return {
    ...league,
    teams: league.teams.map((t) => {
      if (!t.isUser) return t;
      const wins = Math.max(t.wins, sixteenth.wins + 1);
      const losses = Math.min(t.losses, Math.max(0, SEASON_GAME_COUNT - wins));
      return normalizeLeagueTeam({
        ...t,
        wins,
        losses,
        regularWins: wins,
        regularLosses: losses,
      });
    }),
  };
}

export function simulateLeagueTrades(league: League, userFranchise?: Franchise | null): string[] {
  const { headlines } = executeLeagueTradesFromWorld(league, userFranchise);
  return headlines;
}

function makeIncomingPlayer(team: LeagueTeam, role: 'star' | 'vet' | 'wing'): Player {
  if (role === 'star') {
    return {
      id: uid('pl'),
      firstName: 'Grant',
      lastName: 'Whitfield',
      age: 31,
      position: 'PF',
      overall: clamp(team.starOverall - 4, 82, 90),
      potential: clamp(team.starOverall - 4, 82, 90),
      contract: { yearsRemaining: 3, annualSalary: 38_000_000, isMax: false, isExpiring: false },
      morale: 'Stable',
      role: 'Star',
      tradeValue: 'Premium',
      devTrend: 'Stable',
      injuryRisk: 'Medium',
      systemFit: 'Good',
      gmNote: `All-Star caliber fit for ${team.fullName}'s win-now push.`,
      workEthic: 'High',
      minutesPerGame: 32,
    };
  }
  if (role === 'vet') {
    return {
      id: uid('pl'),
      firstName: 'Vince',
      lastName: 'Cole',
      age: 30,
      position: 'SF',
      overall: 78,
      potential: 78,
      contract: { yearsRemaining: 2, annualSalary: 14_000_000, isMax: false, isExpiring: false },
      morale: 'Stable',
      role: 'Starter',
      tradeValue: 'Medium',
      devTrend: 'Stable',
      injuryRisk: 'Low',
      systemFit: 'Good',
      gmNote: 'Switchable defender, low usage.',
      workEthic: 'High',
      minutesPerGame: 28,
    };
  }
  return {
    id: uid('pl'),
    firstName: 'Andre',
    lastName: 'Brooks',
    age: 29,
    position: 'SG',
    overall: 76,
    potential: 76,
    contract: { yearsRemaining: 2, annualSalary: 11_000_000, isMax: false, isExpiring: false },
    morale: 'Stable',
    role: 'Starter',
    tradeValue: 'Medium',
    devTrend: 'Stable',
    injuryRisk: 'Low',
    systemFit: 'Good',
    gmNote: '3-and-D wing with playoff experience.',
    workEthic: 'High',
    minutesPerGame: 26,
  };
}

export function generateLeagueTradeOffers(franchise: Franchise, league: League): TradeOffer[] {
  if (franchise.phase !== 'trade_deadline' && franchise.phase !== 'regular_season') return [];

  const partners = league.teams.filter((t) => !t.isUser);
  const mod = tradeMarketModifiers(franchise);
  const offers: TradeOffer[] = [];
  const young = franchise.roster.filter((p) => p.age < 26 && p.overall < 80);
  const star = franchise.roster.find((p) => p.isStar);
  const bench = franchise.roster.filter((p) => p.role === 'Bench' || p.role === 'Rotation');

  if (young.length && franchise.draftPicks.length && !mod.suppressWinNowOffers) {
    const partner = partners.find((t) => teamWantsVeterans(t.strategy)) ?? partners[0];
    const outgoing = young[0];
    const pick = franchise.draftPicks[0];
    const incoming = makeIncomingPlayer(partner, partner.strategy === 'all_in' ? 'star' : 'vet');
    const evalResult = evaluateTradeForTeam(partner, [incoming], [], [outgoing], [pick]);

    offers.push({
      id: uid('tr'),
      partnerTeam: partner.fullName,
      incoming: {
        description: `${incoming.overall} OVR ${incoming.position} — ${partner.strategy === 'all_in' ? 'win-now star' : ' playoff-tested veteran'}`,
        players: [incoming],
        picks: [],
      },
      outgoing: {
        description: `${outgoing.firstName} ${outgoing.lastName} + ${pick.year} ${pick.round === 1 ? '1st' : '2nd'}`,
        players: [outgoing],
        picks: [pick],
      },
      analysis: {
        shortTerm: 'Improves title odds by ~11%. Addresses half-court defense.',
        longTerm: `Sacrifices ${pick.year} pick. ${partner.fullName} (${strategyLabel(partner.strategy)}) ${evalResult.verdict}`,
        lockerRoom: 'Veteran presence calms stars seeking help.',
        fanReaction: 'Excited — win-now signal.',
        mediaRisk: evalResult.score < 50 ? 'Partner may counter hard — offer skews their way.' : 'High if you exit early.',
        titleOddsDelta: 11,
      },
      expiresWeek: franchise.week + 2,
    });
  }

  if (bench.length && franchise.draftPicks.length && !mod.suppressWinNowOffers) {
    const partner = partners.find((t) => t.taxAverse && teamWantsVeterans(t.strategy)) ?? partners[1] ?? partners[0];
    const pick = franchise.draftPicks[0];
    const incoming = makeIncomingPlayer(partner, 'wing');
    const evalResult = evaluateTradeForTeam(partner, [incoming], [], [bench[0]], [pick]);

    offers.push({
      id: uid('tr'),
      partnerTeam: partner.fullName,
      incoming: {
        description: 'Defensive wing — switchable, playoff ready',
        players: [incoming],
        picks: [],
      },
      outgoing: {
        description: `Protected first, ${bench[0].firstName} ${bench[0].lastName}`,
        players: [bench[0]],
        picks: [pick],
      },
      analysis: {
        shortTerm: 'Defense improves immediately. Offense still thin.',
        longTerm: `${partner.fullName} acceptance likelihood: ${evalResult.score}%. ${evalResult.verdict}`,
        lockerRoom: 'Star appreciates defensive commitment.',
        fanReaction: 'Mixed — help now vs. mortgaged future.',
        mediaRisk: 'Moderate.',
        titleOddsDelta: 6,
      },
      expiresWeek: franchise.week + 1,
    });
  }

  if (star && (franchise.window.includes('Rebuild') || franchise.window === 'Early Rebuild') && mod.starSalePressure >= 0.5) {
    const partner = partners.find((t) => teamWantsPicks(t.strategy) && t.market === 'Large') ?? partners[0];
    offers.push({
      id: uid('tr'),
      partnerTeam: partner.fullName,
      incoming: {
        description: 'Two unprotected first-round picks + young core pieces',
        players: [],
        picks: [
          { year: 2027, round: 1, originalTeam: partner.name },
          { year: 2029, round: 1, originalTeam: partner.name },
        ],
      },
      outgoing: {
        description: `${star.firstName} ${star.lastName} — franchise star`,
        players: [star],
        picks: [],
      },
      analysis: {
        shortTerm: 'Team gets worse immediately.',
        longTerm: `${partner.fullName} is ${strategyLabel(partner.strategy)} — hungry for star talent.`,
        lockerRoom: 'Devastating short-term, honest rebuild signal.',
        fanReaction: 'Polarizing.',
        mediaRisk: 'High if picks land low.',
        titleOddsDelta: -15,
      },
      expiresWeek: franchise.week + 3,
    });
  }

  offers.push(...buildCareerTradeExtras(franchise, partners, makeIncomingPlayer));

  return applyTradeMarketModifiers(offers, franchise).slice(0, 4);
}

export function userMadePlayoffs(league: League): boolean {
  const standings = getStandings(league);
  const user = standings.find((t) => t.isUser);
  if (!user) return false;
  const seed = standings.indexOf(user) + 1;
  const reg = teamRegularSeasonRecord(user);
  const winPct = reg.wins / Math.max(1, reg.wins + reg.losses);
  return seed <= 12 && winPct >= 0.42;
}

export function getUserSeed(league: League): number {
  const standings = getStandings(league);
  const user = standings.find((t) => t.isUser);
  return user ? standings.indexOf(user) + 1 : 16;
}

export function getTeamName(league: League, teamId: string): string {
  return getTeamById(league, teamId)?.fullName ?? 'Unknown';
}
