import type { DraftPick, Franchise, FreeAgent, League, LeagueTeam, Player, Prospect, TeamStrategy } from '../types/game';
import { getTeamById, normalizeLeagueTeam, strategyLabel, teamWantsPicks, teamWantsVeterans } from '../data/league';
import { ROSTER_SIZE } from '../data/rosterBuilder';
import { uid, playerName } from '../data/scenarios';
import { evaluateTradeForTeam } from './league';
import { generateTeamRoster } from './leagueRosters';
import { CAP_LIMIT, canSignFreeAgentAtPayroll } from './cap';
import { faMarketTier } from './freeAgency';
import { freeAgentAskingSalary, marketSalary, rookieScaleSalary } from './salaries';
import { buildLeagueSchedule } from './leagueSchedule';
import { initialTeamScoring } from './stats';
import { seedLeagueRecords } from './leagueSimulation';
import { teamKey } from './draftOrder';
import { DRAFT_TEAM_COUNT as DRAFT_ROUND_SIZE } from './draftNight';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pickStrategy(strength: number): TeamStrategy {
  if (strength >= 86) return Math.random() > 0.5 ? 'all_in' : 'contend';
  if (strength >= 80) return 'contend';
  if (strength >= 76) return Math.random() > 0.5 ? 'playin' : 'retool';
  if (strength >= 72) return 'developing';
  if (strength >= 68) return 'playin';
  if (strength >= 64) return 'retool';
  return Math.random() > 0.4 ? 'rebuild' : 'tank';
}

export function teamRosterKey(city: string, name: string): string {
  return `${city}|${name}`;
}

export function rosterPayroll(players: Player[]): number {
  return players.reduce((s, p) => s + p.contract.annualSalary, 0);
}

/** Top-8 + bench blend — mirrors user team rating logic. */
export function strengthFromRoster(players: Player[]): number {
  const active = players.filter((p) => !p.injured);
  if (!active.length) return 62;
  const sorted = [...active].sort((a, b) => b.overall - a.overall);
  const top8 = sorted.slice(0, 8);
  const bench = sorted.slice(5, 12);
  const topAvg = top8.reduce((s, p) => s + p.overall, 0) / top8.length;
  const benchAvg = bench.length
    ? bench.reduce((s, p) => s + p.overall, 0) / bench.length
    : topAvg - 7;
  return Math.round((topAvg * 0.82 + benchAvg * 0.18) * 10) / 10;
}

export function injuryStrengthPenalty(players: Player[]): number {
  return players
    .filter((p) => p.injured)
    .reduce((pen, p) => {
      if (p.overall >= 84) return pen + 2.8;
      if (p.overall >= 78) return pen + 1.6;
      return pen + 0.7;
    }, 0);
}

export function depthBoost(players: Player[]): number {
  const active = players.filter((p) => !p.injured);
  const bench = [...active].sort((a, b) => b.overall - a.overall).slice(5, 11);
  if (bench.length < 3) return -1.2;
  const avg = bench.reduce((s, p) => s + p.overall, 0) / bench.length;
  if (avg >= 76) return 1.4;
  if (avg >= 72) return 0.6;
  if (avg < 68) return -0.8;
  return 0;
}

export function getTeamRoster(
  league: League,
  team: LeagueTeam,
  userFranchise?: Franchise | null,
): Player[] {
  const key = teamRosterKey(team.city, team.name);
  if (team.isUser && userFranchise) return userFranchise.roster;
  return league.rosters?.[key] ?? generateTeamRoster(team);
}

export function setTeamRoster(league: League, team: LeagueTeam, roster: Player[]): League {
  const key = teamRosterKey(team.city, team.name);
  return {
    ...league,
    rosters: { ...(league.rosters ?? {}), [key]: roster },
  };
}

export function syncUserRosterToLeague(league: League, franchise: Franchise): League {
  const user = league.teams.find((t) => t.isUser);
  if (!user) return league;
  return setTeamRoster(league, user, franchise.roster);
}

export function refreshTeamFromRoster(team: LeagueTeam, roster: Player[]): LeagueTeam {
  const strength = strengthFromRoster(roster);
  const starOverall = Math.max(...roster.map((p) => p.overall), team.starOverall);
  return normalizeLeagueTeam({
    ...team,
    strength,
    payroll: rosterPayroll(roster),
    starOverall: clamp(starOverall, 68, 94),
    strategy: team.isUser ? team.strategy : pickStrategy(strength),
  });
}

export function syncTeamsFromRosters(league: League, userFranchise?: Franchise | null): League {
  const teams = league.teams.map((t) => {
    const roster = getTeamRoster(league, t, userFranchise);
    return refreshTeamFromRoster(t, roster);
  });
  return { ...league, teams };
}

export function ensureLeagueRosters(league: League, userFranchise?: Franchise | null): League {
  const rosters: Record<string, Player[]> = { ...(league.rosters ?? {}) };
  for (const team of league.teams) {
    const key = teamRosterKey(team.city, team.name);
    if (team.isUser && userFranchise?.roster.length) {
      rosters[key] = userFranchise.roster;
    } else if (!rosters[key]?.length) {
      rosters[key] = generateTeamRoster(team).map((p) => ({
        ...p,
        contract: {
          ...p.contract,
          birdYears: p.contract.birdYears ?? clamp(1 + (p.overall >= team.starOverall - 2 ? 2 : 0), 1, 4),
        },
      }));
    }
  }
  return syncTeamsFromRosters({ ...league, rosters }, userFranchise);
}

export function effectiveGameStrength(
  league: League,
  teamId: string,
  userFranchise?: Franchise | null,
  week?: number,
): number {
  const team = getTeamById(league, teamId);
  if (!team) return 75;
  const roster = getTeamRoster(league, team, userFranchise);
  let str = strengthFromRoster(roster) + depthBoost(roster);
  str -= injuryStrengthPenalty(roster);
  if (week && week > 0) str -= 0.35;
  if (team.isUser) return Math.round(clamp(str, 58, 96) * 10) / 10;
  return Math.round(clamp(str + 0.6, 58, 96) * 10) / 10;
}

export function tickLeagueRosterContracts(league: League, userFranchise?: Franchise | null): League {
  let next = { ...league };
  for (const team of league.teams) {
    if (team.isUser && userFranchise) continue;
    const roster = getTeamRoster(next, team, userFranchise).map((p) => {
      const years = Math.max(0, p.contract.yearsRemaining - 1);
      return {
        ...p,
        contract: {
          ...p.contract,
          yearsRemaining: years,
          isExpiring: years === 0,
          birdYears: years > 0 ? (p.contract.birdYears ?? 1) + 1 : p.contract.birdYears,
        },
      };
    });
    next = setTeamRoster(next, team, roster);
  }
  return syncTeamsFromRosters(next, userFranchise);
}

export function runLeagueAiRenewals(league: League, userFranchise?: Franchise | null): League {
  let next = { ...league };
  for (const team of league.teams) {
    if (team.isUser) continue;
    let roster = getTeamRoster(next, team, userFranchise);
    const kept: Player[] = [];
    for (const p of roster) {
      if (p.contract.yearsRemaining > 0) {
        kept.push(p);
        continue;
      }
      const star = p.overall >= team.starOverall - 2 || p.isStar;
      const badDeal = p.contract.annualSalary > marketSalary(p.overall, p.age) * 1.35;
      const renew =
        star ||
        (p.overall >= 78 && team.strategy !== 'rebuild' && team.strategy !== 'tank') ||
        (p.overall >= 74 && !badDeal && Math.random() > 0.35);
      if (renew) {
        const years = p.overall >= 80 ? 3 : 2;
        const salary = Math.round(p.contract.annualSalary * (0.92 + Math.random() * 0.12));
        kept.push({
          ...p,
          contract: {
            yearsRemaining: years,
            annualSalary: salary,
            isMax: p.contract.isMax,
            isExpiring: false,
            birdYears: (p.contract.birdYears ?? 1) + 1,
          },
        });
      } else {
        kept.push({
          ...p,
          contract: { ...p.contract, yearsRemaining: 0, isExpiring: true },
        });
      }
    }
    next = setTeamRoster(next, team, kept.slice(0, ROSTER_SIZE));
  }
  return syncTeamsFromRosters(next, userFranchise);
}

export function playerToFreeAgent(player: Player, fromTeam?: string): FreeAgent {
  const priorities: FreeAgent['priorities'] = [];
  if (player.overall >= 82) priorities.push('winning', 'role');
  else if (player.overall >= 76) priorities.push('role', 'money');
  else priorities.push('money', 'role');
  if (Math.random() > 0.5) priorities.push('market');

  return {
    id: uid('fa'),
    firstName: player.firstName,
    lastName: player.lastName,
    age: player.age,
    position: player.position,
    overall: player.overall,
    potential: player.potential,
    askingSalary: freeAgentAskingSalary(player.overall, player.age),
    askingYears: player.overall >= 80 ? 4 : 2 + Math.floor(Math.random() * 2),
    priorities: [...new Set(priorities)],
    interest: 20 + Math.floor(Math.random() * 25),
    scoutNote: fromTeam
      ? `Former ${fromTeam} — real NBA free agent with league experience.`
      : 'League free agent.',
    archetype: player.role,
    signed: false,
    userPitchAttempts: 0,
    formerTeam: fromTeam,
  };
}

export function collectLeagueFreeAgents(
  league: League,
  userFranchise?: Franchise | null,
  extra: Player[] = [],
): FreeAgent[] {
  const agents: FreeAgent[] = [];
  for (const team of league.teams) {
    if (team.isUser) continue;
    const roster = getTeamRoster(league, team, userFranchise);
    for (const p of roster) {
      if (p.contract.yearsRemaining === 0 || p.contract.isExpiring) {
        agents.push(playerToFreeAgent(p, team.fullName));
      }
    }
  }
  for (const p of extra) {
    agents.push(playerToFreeAgent(p, `${userFranchise?.city ?? 'Your'} ${userFranchise?.name ?? 'team'}`));
  }
  return agents.sort((a, b) => b.overall - a.overall);
}

export function buildLeagueFreeAgentPool(
  league: League,
  userFranchise: Franchise,
  releasedPlayers: Player[] = [],
): FreeAgent[] {
  const fromLeague = collectLeagueFreeAgents(league, userFranchise, releasedPlayers);
  return fromLeague.slice(0, 28);
}

function aiTeamCapRoom(team: LeagueTeam): number {
  return Math.max(0, CAP_LIMIT - team.payroll);
}

export function simLeagueFreeAgency(
  league: League,
  freeAgents: FreeAgent[],
  signedIds: Set<string>,
  userFranchise?: Franchise | null,
): { league: League; headlines: string[]; remaining: FreeAgent[] } {
  let next = ensureLeagueRosters(league, userFranchise);
  const headlines: string[] = [];
  const pool = freeAgents.filter((fa) => !fa.signed && !signedIds.has(fa.id));

  for (const fa of pool.sort((a, b) => b.overall - a.overall)) {
    if (fa.signed || signedIds.has(fa.id)) continue;

    const suitors = next.teams
      .filter((t) => !t.isUser)
      .map((t) => {
        let score = t.strength * 0.35;
        if (t.strategy === 'all_in' || t.strategy === 'contend') score += 14;
        if (fa.priorities.includes('money') && aiTeamCapRoom(t) > 8_000_000) score += 10;
        if (fa.priorities.includes('winning') && t.strength >= 80) score += 12;
        return { team: t, score };
      })
      .sort((a, b) => b.score - a.score);

    const winner = suitors[0]?.team;
    if (!winner) continue;

    const salary = Math.round(fa.askingSalary * (0.94 + Math.random() * 0.1));
    const capCheck = canSignFreeAgentAtPayroll(winner.payroll, salary, winner.taxAverse);
    if (!capCheck.ok && faMarketTier(fa.overall) !== 'depth') continue;

    let roster = getTeamRoster(next, winner, userFranchise);
    if (roster.length >= ROSTER_SIZE) roster = roster.slice(0, ROSTER_SIZE - 1);

    const player: Player = {
      id: uid('pl'),
      firstName: fa.firstName,
      lastName: fa.lastName,
      age: fa.age,
      position: fa.position,
      overall: fa.overall,
      potential: fa.potential,
      contract: {
        yearsRemaining: fa.askingYears,
        annualSalary: salary,
        isMax: false,
        isExpiring: false,
        birdYears: 1,
        signedVia: capCheck.useException === 'MLE' ? 'mle' : 'standard',
      },
      morale: 'Stable',
      role: fa.overall >= 80 ? 'Starter' : 'Rotation',
      tradeValue: fa.overall >= 80 ? 'High' : 'Medium',
      devTrend: 'Stable',
      injuryRisk: 'Low',
      systemFit: 'Good',
      gmNote: `Signed in free agency by ${winner.fullName}.`,
      workEthic: 'High',
      minutesPerGame: fa.overall >= 80 ? 28 : 18,
      isStar: fa.overall >= winner.starOverall - 2,
    };

    roster = [...roster, player];
    next = setTeamRoster(next, winner, roster);
    signedIds.add(fa.id);
    fa.signed = true;

    if (faMarketTier(fa.overall) !== 'depth') {
      headlines.push(`${winner.fullName} signs ${playerName(fa)} (${fa.overall} OVR).`);
    }
  }

  next = syncTeamsFromRosters(next, userFranchise);
  const remaining = freeAgents.map((fa) =>
    signedIds.has(fa.id) ? { ...fa, signed: true } : fa,
  );
  return { league: next, headlines, remaining };
}

export function executeLeagueTrades(
  league: League,
  userFranchise?: Franchise | null,
): { league: League; headlines: string[] } {
  let next = ensureLeagueRosters(league, userFranchise);
  const headlines: string[] = [];
  const sellers = next.teams.filter(
    (t) => !t.isUser && (teamWantsPicks(t.strategy) || t.strategy === 'rebuild' || t.strategy === 'tank'),
  );
  const buyers = next.teams.filter(
    (t) => !t.isUser && (teamWantsVeterans(t.strategy) || t.strategy === 'all_in' || t.strategy === 'contend'),
  );

  if (!sellers.length || !buyers.length || Math.random() > 0.55) {
    return { league: next, headlines };
  }

  const seller = sellers[Math.floor(Math.random() * sellers.length)];
  const buyer = buyers[Math.floor(Math.random() * buyers.length)];
  if (seller.id === buyer.id) return { league: next, headlines };

  const sellerRoster = getTeamRoster(next, seller, userFranchise);
  const buyerRoster = getTeamRoster(next, buyer, userFranchise);

  const outgoing = sellerRoster.find((p) => p.overall >= 78 && p.age >= 27 && !p.injured);
  const incoming = buyerRoster.find((p) => p.age <= 25 && p.potential >= 80 && p.overall <= 82);
  if (!outgoing || !incoming) return { league: next, headlines };

  const sellerEval = evaluateTradeForTeam(seller, [incoming], [], [outgoing], []);
  const buyerEval = evaluateTradeForTeam(buyer, [outgoing], [], [incoming], []);
  if (sellerEval.score < 52 || buyerEval.score < 52) return { league: next, headlines };

  const newSeller = sellerRoster.filter((p) => p.id !== outgoing.id).concat(incoming);
  const newBuyer = buyerRoster.filter((p) => p.id !== incoming.id).concat(outgoing);

  next = setTeamRoster(next, seller, newSeller);
  next = setTeamRoster(next, buyer, newBuyer);
  next = syncTeamsFromRosters(next, userFranchise);

  headlines.push(
    `${buyer.fullName} (${strategyLabel(buyer.strategy)}) trades for ${outgoing.firstName} ${outgoing.lastName} — ${seller.fullName} adds ${incoming.firstName} ${incoming.lastName}.`,
  );
  return { league: next, headlines };
}

export function applyUserTradeToLeague(
  league: League,
  franchise: Franchise,
  partnerTeamId: string,
  outgoingPlayers: Player[],
  incomingPlayers: Player[],
  outgoingPicks?: DraftPick[],
  incomingPicks?: DraftPick[],
): League {
  let next = syncUserRosterToLeague(league, franchise);
  const partner = getTeamById(next, partnerTeamId);
  if (!partner) return next;

  // Update player rosters
  let partnerRoster = getTeamRoster(next, partner, franchise);
  // incomingPlayers = players that LEFT the partner (going to user) — remove them
  const inIds = new Set(incomingPlayers.map((p) => p.id));
  partnerRoster = partnerRoster.filter((p) => !inIds.has(p.id));
  // outgoingPlayers = players that CAME TO the partner (from user) — add them
  for (const p of outgoingPlayers) {
    if (!partnerRoster.some((r) => r.id === p.id)) partnerRoster.push(p);
  }
  next = setTeamRoster(next, partner, partnerRoster.slice(0, ROSTER_SIZE));

  // Update draftOrder so AI draft simulation uses correct team ownership
  if ((outgoingPicks?.length || incomingPicks?.length) && next.draftOrder?.length) {
    const order = [...next.draftOrder];
    const userKey = teamKey(franchise.city, franchise.name);
    const partnerKey = teamKey(partner.city, partner.name);

    // Outgoing picks: user's slot → partner
    for (const pick of outgoingPicks ?? []) {
      const idx = order.findIndex(
        (e) =>
          teamKey(e.city, e.name) === userKey &&
          (pick.round === 1 ? e.pick <= DRAFT_ROUND_SIZE : e.pick > DRAFT_ROUND_SIZE),
      );
      if (idx >= 0) {
        order[idx] = { ...order[idx], city: partner.city, name: partner.name, teamName: partner.fullName };
      }
    }

    // Incoming picks: partner's slot → user
    for (const pick of incomingPicks ?? []) {
      const idx = order.findIndex(
        (e) =>
          teamKey(e.city, e.name) === partnerKey &&
          (pick.round === 1 ? e.pick <= DRAFT_ROUND_SIZE : e.pick > DRAFT_ROUND_SIZE),
      );
      if (idx >= 0) {
        order[idx] = { ...order[idx], city: franchise.city, name: franchise.name, teamName: `${franchise.city} ${franchise.name}` };
      }
    }

    next = { ...next, draftOrder: order };
  }

  return syncTeamsFromRosters(next, franchise);
}

export function prospectToRookie(
  prospect: Prospect,
  pickNumber: number,
  team: LeagueTeam,
  draftSeason: number,
): Player {
  const overall = prospect.scoutedOverall[1] ?? prospect.scoutedOverall[0];
  const salary = rookieScaleSalary(pickNumber);
  return {
    id: uid('pl'),
    firstName: prospect.firstName,
    lastName: prospect.lastName,
    age: prospect.age ?? 20,
    position: prospect.position,
    overall,
    potential: prospect.potential[1] ?? prospect.potential[0],
    draftSeason,
    draftPick: pickNumber,
    contract: {
      yearsRemaining: 4,
      annualSalary: salary,
      isMax: false,
      isExpiring: false,
      birdYears: 1,
      signedVia: 'rookie',
    },
    morale: 'Stable',
    role: pickNumber <= 14 ? 'Prospect' : 'Bench',
    tradeValue: pickNumber <= 14 ? 'Medium' : 'Low',
    devTrend: 'Up',
    injuryRisk: prospect.medicalFlag ? 'Medium' : 'Low',
    systemFit: 'Fair',
    gmNote: `Drafted #${pickNumber} by ${team.fullName}.`,
    workEthic: 'High',
    minutesPerGame: pickNumber <= 14 ? 18 : 8,
  };
}

export function addDraftPickToLeague(
  league: League,
  pickNumber: number,
  prospect: Prospect,
  userFranchise?: Franchise | null,
): League {
  const order = league.draftOrder ?? [];
  const entry = order[pickNumber - 1];
  if (!entry) return league;
  const team = league.teams.find((t) => t.city === entry.city && t.name === entry.name);
  if (!team || team.isUser) return league;

  let next = ensureLeagueRosters(league, userFranchise);
  const rookie = prospectToRookie(prospect, pickNumber, team, userFranchise?.season ?? league.season);
  let roster = getTeamRoster(next, team, userFranchise);
  roster = [...roster, rookie].slice(0, ROSTER_SIZE);
  next = setTeamRoster(next, team, roster);
  return syncTeamsFromRosters(next, userFranchise);
}

export function tickLeagueInjuries(league: League, userFranchise?: Franchise | null): League {
  let next = { ...league };
  for (const team of league.teams) {
    if (team.isUser) continue;
    const roster = getTeamRoster(next, team, userFranchise).map((p) => {
      if (p.injured && p.injuryWeeks) {
        const remaining = p.injuryWeeks - 1;
        if (remaining <= 0) {
          const { injured, injuryWeeks, ...rest } = p;
          return rest;
        }
        return { ...p, injuryWeeks: remaining };
      }
      if (p.injured) return p;
      const risk = p.injuryRisk === 'High' ? 0.06 : p.injuryRisk === 'Medium' ? 0.04 : 0.025;
      if (Math.random() > risk) return p;
      const weeks = 1 + Math.floor(Math.random() * 3);
      return { ...p, injured: true, injuryWeeks: weeks, role: 'Injured' as const };
    });
    next = setTeamRoster(next, team, roster);
  }
  return syncTeamsFromRosters(next, userFranchise);
}

export function advanceLeagueSeason(
  prior: League,
  franchise: Franchise,
  season: number,
): League {
  let league: League = {
    ...prior,
    season,
    draftOrder: [],
    draftLotteryLog: [],
  };
  league = ensureLeagueRosters(league, franchise);
  league = tickLeagueRosterContracts(league, franchise);
  league = runLeagueAiRenewals(league, franchise);

  const userTeam = league.teams.find((t) => t.isUser);
  const balanced = seedLeagueRecords(league.teams, 0, userTeam?.id, { wins: 0, losses: 0 });
  league = {
    ...league,
    teams: balanced.map((t) => {
      const scoring = initialTeamScoring(t.strength);
      return normalizeLeagueTeam({
        ...t,
        wins: 0,
        losses: 0,
        regularWins: 0,
        regularLosses: 0,
        ...scoring,
        scoreGames: 0,
      });
    }),
    schedule: buildLeagueSchedule(balanced, season),
  };
  return syncTeamsFromRosters(league, franchise);
}
