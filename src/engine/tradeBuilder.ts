import type { DraftPick, Franchise, FranchiseGhost, League, LeagueTeam, Player, Prospect, TradeOffer } from '../types/game';
import { uid, playerName } from '../data/scenarios';
import { evaluateTradeForTeam } from './league';
import { getTeamById } from '../data/league';
import { formatCap, pickKey, userTradeCapWarnings, validateTradeSalaryMatchAtPayroll, estimateTeamPayroll, SECOND_APRON, capTradeScoreAdjust } from './cap';
import { clearTeamRosterCache, generateTeamRoster } from './leagueRosters';
import type { TradeProposal, TradeValidation } from '../types/game';

export function generatePartnerTradeAssets(partner: LeagueTeam): Player[] {
  return generateTeamRoster(partner);
}

export function clearPartnerTradeAssetCache(): void {
  clearTeamRosterCache();
}

export function pickDescription(pick: DraftPick): string {
  return `${pick.year} ${pick.round === 1 ? '1st' : '2nd'}${pick.protections ? ` (${pick.protections})` : ''}`;
}

export function buildTradeOfferFromProposal(
  franchise: Franchise,
  league: League,
  proposal: TradeProposal,
): TradeOffer | null {
  const partner = getTeamById(league, proposal.partnerTeamId);
  if (!partner) return null;

  const incomingPlayers = proposal.incomingPlayers;
  const outgoingPlayers = proposal.outgoingPlayerIds
    .map((id) => franchise.roster.find((p) => p.id === id))
    .filter(Boolean) as Player[];

  const incomingPicks = proposal.incomingPicks;
  const outgoingPicks = proposal.outgoingPickKeys
    .map((k) => franchise.draftPicks.find((p) => pickKey(p) === k))
    .filter(Boolean) as DraftPick[];

  const validation = validateProposal(franchise, league, proposal);
  if (!validation.valid && validation.errors.length) {
    return null;
  }

  const evalResult = evaluateTradeForTeam(
    partner,
    outgoingPlayers,
    outgoingPicks,
    incomingPlayers,
    incomingPicks,
  );

  const titleOddsDelta = evalResult.score >= 65 ? 8 : evalResult.score >= 50 ? 3 : -4;

  return {
    id: uid('tr'),
    partnerTeam: partner.fullName,
    partnerTeamId: partner.id,
    incoming: {
      description: incomingPlayers.map((p) => playerName(p)).join(', ') || 'Assets incoming',
      players: incomingPlayers,
      picks: incomingPicks,
    },
    outgoing: {
      description: [
        ...outgoingPlayers.map((p) => playerName(p)),
        ...outgoingPicks.map(pickDescription),
      ].join(', ') || 'Assets outgoing',
      players: outgoingPlayers,
      picks: outgoingPicks,
    },
    analysis: {
      shortTerm: evalResult.score >= 60 ? 'Roster talent shifts immediately.' : 'Marginal short-term impact.',
      longTerm: `${partner.fullName} (${evalResult.verdict}) — accept score ${evalResult.score}%.`,
      lockerRoom: outgoingPlayers.some((p) => p.isStar) ? 'Stars may react to roster shake-up.' : 'Locker room manageable.',
      fanReaction: evalResult.score >= 70 ? 'Fans excited.' : evalResult.score <= 40 ? 'Fan backlash likely.' : 'Mixed reaction.',
      mediaRisk: evalResult.score < 45 ? 'National media will call it a fleece if it fails.' : 'Moderate scrutiny.',
      titleOddsDelta,
      partnerAcceptScore: evalResult.score,
    },
    expiresWeek: franchise.week + 2,
  };
}

export function validateProposal(
  franchise: Franchise,
  league: League,
  proposal: TradeProposal,
): TradeValidation {
  const errors: string[] = [];
  const partner = getTeamById(league, proposal.partnerTeamId);
  if (!partner) errors.push('Select a trade partner.');

  const incomingPlayers = proposal.incomingPlayers;
  const outgoingPlayers = proposal.outgoingPlayerIds
    .map((id) => franchise.roster.find((p) => p.id === id))
    .filter(Boolean) as Player[];

  if (!incomingPlayers.length && !proposal.incomingPicks.length && !outgoingPlayers.length && !proposal.outgoingPickKeys.length) {
    errors.push('Add players or picks to the trade.');
  }

  const incomingSalary = incomingPlayers.reduce((s, p) => s + p.contract.annualSalary, 0);
  const outgoingSalary = outgoingPlayers.reduce((s, p) => s + p.contract.annualSalary, 0);
  const userCap = userTradeCapWarnings(franchise, incomingSalary, outgoingSalary);
  const match = userCap.match;

  if (!match.ok) errors.push(match.message);

  let partnerAcceptScore = 50;
  let partnerVerdict = 'Incomplete proposal.';
  let partnerCapNote = '';
  let partnerProjectedPayroll = 0;
  let partnerSalaryMatch = true;
  const incomingPicks = proposal.incomingPicks;
  const outgoingPicks = proposal.outgoingPickKeys
    .map((k) => franchise.draftPicks.find((p) => pickKey(p) === k))
    .filter(Boolean) as DraftPick[];

  if (partner) {
    const partnerGets = outgoingPlayers;
    const partnerSends = incomingPlayers;
    const partnerGetsPicks = outgoingPicks;
    const partnerSendsPicks = incomingPicks;
    const partnerGetsSalary = partnerGets.reduce((s, p) => s + p.contract.annualSalary, 0);
    const partnerSendsSalary = partnerSends.reduce((s, p) => s + p.contract.annualSalary, 0);
    const partnerPayroll = estimateTeamPayroll(partner);
    const partnerMatch = validateTradeSalaryMatchAtPayroll(
      partnerPayroll,
      partnerPayroll > SECOND_APRON,
      partnerGetsSalary,
      partnerSendsSalary,
    );
    partnerProjectedPayroll = partnerMatch.projectedPayroll;
    partnerSalaryMatch = partnerMatch.ok;
    if (!partnerMatch.ok) {
      errors.push(`${partner.fullName} cap office: ${partnerMatch.message}`);
    }

    const ev = evaluateTradeForTeam(partner, partnerGets, partnerGetsPicks, partnerSends, partnerSendsPicks);
    partnerAcceptScore = ev.score;
    partnerVerdict = ev.verdict;
    partnerCapNote = capTradeScoreAdjust(partner, partnerGetsSalary, partnerSendsSalary).note;

    const blockBoost =
      outgoingPlayers.filter((p) => franchise.tradeBlock?.playerIds.includes(p.id)).length * 4 +
      outgoingPicks.filter((p) => franchise.tradeBlock?.pickKeys.includes(pickKey(p))).length * 3;
    if (blockBoost) {
      partnerAcceptScore = Math.min(72, partnerAcceptScore + blockBoost);
      partnerVerdict = `${partnerVerdict} Assets listed on your trade block — partner interest up.`;
    }
  }

  return {
    valid: errors.length === 0 && partnerAcceptScore >= 48,
    salaryMatch: match.ok,
    salaryDelta: incomingSalary - outgoingSalary,
    partnerAcceptScore,
    partnerVerdict,
    capImpact:
      incomingSalary > outgoingSalary
        ? `Payroll rises by ${formatCap(incomingSalary - outgoingSalary)}.`
        : incomingSalary < outgoingSalary
          ? `Creates ${formatCap(outgoingSalary - incomingSalary)} flexibility.`
          : 'Neutral salary impact.',
    capWarnings: userCap.warnings,
    partnerCapNote,
    userProjectedPayroll: userCap.projectedPayroll,
    partnerProjectedPayroll,
    partnerSalaryMatch,
    allowedIncoming: match.allowedIncoming,
    errors,
  };
}

export function generateCounterOffer(
  franchise: Franchise,
  league: League,
  proposal: TradeProposal,
): TradeOffer | null {
  const partner = getTeamById(league, proposal.partnerTeamId);
  if (!partner) return null;

  const base = buildTradeOfferFromProposal(franchise, league, proposal);
  if (!base) return null;

  const score = base.analysis.partnerAcceptScore ?? 50;
  if (score >= 62) return { ...base, isCounter: false };

  const validation = validateProposal(franchise, league, proposal);
  const capPushback =
    !validation.partnerSalaryMatch || validation.partnerCapNote.includes('ownership avoids')
      ? ' Their front office wants salary relief or a cleaner cap sheet.'
      : validation.salaryDelta > 8_000_000
        ? ' They balk at absorbing that much new money without sweeteners.'
        : '';

  const counterNote =
    score < 45
      ? `${partner.fullName} rejects outright. Counter: add a protected pick or balance salary.${capPushback}`
      : `${partner.fullName} countered — wants additional draft compensation.${capPushback}`;

  return {
    ...base,
    id: uid('tr'),
    isCounter: true,
    analysis: {
      ...base.analysis,
      longTerm: counterNote,
      mediaRisk: 'Counter on the table — leak risk if talks stall.',
      partnerAcceptScore: Math.min(58, score + 12),
    },
  };
}

export function recordTradeGhosts(
  franchise: Franchise,
  offer: TradeOffer,
): FranchiseGhost[] {
  const ghosts: FranchiseGhost[] = [];
  const season = franchise.season;
  const week = franchise.week;

  for (const p of offer.outgoing.players) {
    if (p.isStar || p.overall >= 84) {
      ghosts.push({
        id: uid('gh'),
        season,
        week,
        type: 'traded_player',
        title: `Traded ${playerName(p)}`,
        story: `You moved ${playerName(p)} in a deal with ${offer.partnerTeam}. The locker room will remember.`,
        severity: p.isStar ? 'haunting' : 'major',
        subjectName: playerName(p),
        watchNote: 'If they thrive elsewhere, this trade defines your tenure.',
      });
    }
  }

  for (const pick of offer.outgoing.picks) {
    if (pick.round === 1) {
      ghosts.push({
        id: uid('gh'),
        season,
        week,
        type: 'traded_pick',
        title: `Mortgaged ${pick.year} first-round pick`,
        story: `You sent ${pickDescription(pick)} to ${offer.partnerTeam}. If it conveys high, analysts will bury you.`,
        severity: pick.protections ? 'major' : 'haunting',
        subjectName: pickDescription(pick),
        watchNote: 'Track where this pick lands — it may become a franchise ghost.',
      });
    }
  }

  return ghosts;
}

export function recordPassedProspectGhost(
  franchise: Franchise,
  passed: Prospect,
  chosen: Prospect,
): FranchiseGhost | null {
  if (passed.bustRisk === 'Low') return null;
  const potHigh = passed.potential[1];
  if (potHigh < 88) return null;

  return {
    id: uid('gh'),
    season: franchise.season,
    week: franchise.week,
    type: 'passed_pick',
    title: `Passed on ${playerName(passed)}`,
    story: `You drafted ${playerName(chosen)} instead. Scouts loved ${playerName(passed)}'s ceiling (${potHigh} pot).`,
    severity: passed.bustRisk === 'High' ? 'major' : 'minor',
    subjectName: playerName(passed),
    watchNote: 'If they become a star, this pick haunts the war room.',
  };
}

export function resolveGhostWatch(franchise: Franchise): FranchiseGhost[] {
  const updates: FranchiseGhost[] = [];
  for (const ghost of franchise.ghosts) {
    if (ghost.watchNote && !ghost.story.includes('UPDATE:') && Math.random() > 0.82) {
      const haunting = ghost.type === 'passed_pick'
        ? `${ghost.subjectName} is averaging starter minutes for a contender.`
        : ghost.type === 'traded_pick'
          ? `The pick you traded is currently projected top-5.`
          : `${ghost.subjectName} made All-League elsewhere.`;
      updates.push({
        ...ghost,
        story: `${ghost.story} UPDATE: ${haunting}`,
        severity: 'haunting',
      });
    } else {
      updates.push(ghost);
    }
  }
  return updates;
}
