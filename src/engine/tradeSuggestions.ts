import type { Franchise, League, TradeProposal, TradeValidation } from '../types/game';
import { getTeamById, teamWantsPicks, teamWantsVeterans } from '../data/league';
import { formatMoney, playerName, uid } from '../data/scenarios';
import { pickKey } from './cap';
import { generatePartnerTradeAssets, pickDescription, validateProposal } from './tradeBuilder';

export interface DealSuggestion {
  id: string;
  title: string;
  detail: string;
  projectedScore: number;
  scoreGain: number;
  proposal: TradeProposal;
}

function cloneProposal(p: TradeProposal): TradeProposal {
  return {
    ...p,
    incomingPlayers: [...p.incomingPlayers],
    outgoingPlayerIds: [...p.outgoingPlayerIds],
    incomingPicks: [...p.incomingPicks],
    outgoingPickKeys: [...p.outgoingPickKeys],
  };
}

function trySuggestion(
  franchise: Franchise,
  league: League,
  proposal: TradeProposal,
  baseScore: number,
  title: string,
  detail: string,
): DealSuggestion | null {
  const validation = validateProposal(franchise, league, proposal);
  if (!validation.salaryMatch || !validation.partnerSalaryMatch) return null;
  if (validation.partnerAcceptScore <= baseScore && validation.partnerAcceptScore < 62) return null;

  return {
    id: uid('sug'),
    title,
    detail,
    projectedScore: validation.partnerAcceptScore,
    scoreGain: validation.partnerAcceptScore - baseScore,
    proposal,
  };
}

export function suggestDealFixes(
  franchise: Franchise,
  league: League,
  proposal: TradeProposal,
  current: TradeValidation,
): DealSuggestion[] {
  if (!proposal.partnerTeamId) return [];

  const partner = getTeamById(league, proposal.partnerTeamId);
  if (!partner) return [];

  const baseScore = current.partnerAcceptScore;
  const candidates: DealSuggestion[] = [];
  const base = cloneProposal(proposal);

  const unusedPicks = franchise.draftPicks.filter(
    (p) => !base.outgoingPickKeys.includes(pickKey(p)),
  );
  const unusedRoster = franchise.roster.filter(
    (p) => !base.outgoingPlayerIds.includes(p.id) && !p.isStar && !p.injured,
  );
  const partnerAssets = generatePartnerTradeAssets(partner);
  const unusedIncoming = partnerAssets.filter((p) => !base.incomingPlayers.some((x) => x.id === p.id));

  if (!current.salaryMatch) {
    const filler = partnerAssets.find((p) => p.contract.isExpiring || p.contract.annualSalary >= 10_000_000);
    if (filler) {
      const next = cloneProposal(base);
      next.incomingPlayers = [...next.incomingPlayers, filler];
      const sug = trySuggestion(
        franchise,
        league,
        next,
        baseScore,
        'Balance salary',
        `Take back ${playerName(filler)} ($${(filler.contract.annualSalary / 1_000_000).toFixed(1)}M) so your deal clears the cap.`,
      );
      if (sug) candidates.push(sug);
    }

    const outgoingFiller = unusedRoster
      .filter((p) => p.contract.annualSalary >= 8_000_000)
      .sort((a, b) => b.contract.annualSalary - a.contract.annualSalary)[0];
    if (outgoingFiller) {
      const next = cloneProposal(base);
      next.outgoingPlayerIds = [...next.outgoingPlayerIds, outgoingFiller.id];
      const sug = trySuggestion(
        franchise,
        league,
        next,
        baseScore,
        'Send salary filler',
        `Include ${playerName(outgoingFiller)} (${formatMoney(outgoingFiller.contract.annualSalary)}) to satisfy 125% matching.`,
      );
      if (sug) candidates.push(sug);
    }
  }

  if (!current.partnerSalaryMatch) {
    const salaryBack = partnerAssets.find((p) => p.contract.annualSalary >= 12_000_000);
    if (salaryBack && !base.incomingPlayers.some((p) => p.id === salaryBack.id)) {
      const next = cloneProposal(base);
      next.incomingPlayers = [...next.incomingPlayers, salaryBack];
      const sug = trySuggestion(
        franchise,
        league,
        next,
        baseScore,
        'Help partner match',
        `Take back ${playerName(salaryBack)} so ${partner.fullName} can legally absorb your outgoing salary.`,
      );
      if (sug) candidates.push(sug);
    }
  }

  if (current.capWarnings.some((w) => w.includes('luxury tax')) && unusedRoster.length) {
    const expiring = [...unusedRoster]
      .filter((p) => p.contract.isExpiring || p.contract.yearsRemaining <= 1)
      .sort((a, b) => b.contract.annualSalary - a.contract.annualSalary)[0];
    if (expiring && !base.outgoingPlayerIds.includes(expiring.id)) {
      const next = cloneProposal(base);
      next.outgoingPlayerIds = [...next.outgoingPlayerIds, expiring.id];
      const sug = trySuggestion(
        franchise,
        league,
        next,
        baseScore,
        'Shed salary',
        `Move ${playerName(expiring)} to avoid creeping into the tax.`,
      );
      if (sug) candidates.push(sug);
    }
  }

  if (teamWantsPicks(partner.strategy) && unusedPicks.length) {
    const pick = unusedPicks.find((p) => p.round === 2) ?? unusedPicks[0];
    const next = cloneProposal(base);
    next.outgoingPickKeys = [...next.outgoingPickKeys, pickKey(pick)];
    const sug = trySuggestion(
      franchise,
      league,
      next,
      baseScore,
      'Add draft pick',
      `Attach ${pickDescription(pick)} — ${partner.fullName} is pick-hunting.`,
    );
    if (sug) candidates.push(sug);
  }

  if (baseScore < 55 && unusedPicks.some((p) => p.round === 1)) {
    const pick = unusedPicks.find((p) => p.round === 1)!;
    const next = cloneProposal(base);
    next.outgoingPickKeys = [...next.outgoingPickKeys, pickKey(pick)];
    const sug = trySuggestion(
      franchise,
      league,
      next,
      baseScore,
      'Include first-round pick',
      `Offer ${pickDescription(pick)} to close the value gap.`,
    );
    if (sug) candidates.push(sug);
  }

  if (unusedRoster.length) {
    const bench = [...unusedRoster].sort((a, b) => a.overall - b.overall)[0];
    const next = cloneProposal(base);
    next.outgoingPlayerIds = [...next.outgoingPlayerIds, bench.id];
    const sug = trySuggestion(
      franchise,
      league,
      next,
      baseScore,
      'Add rotation player',
      `Include ${playerName(bench)} (${bench.overall} OVR) as sweetener.`,
    );
    if (sug) candidates.push(sug);
  }

  if (teamWantsVeterans(partner.strategy) && base.incomingPlayers.every((p) => p.age < 26)) {
    const vet = partnerAssets.find((p) => p.age >= 28);
    if (vet) {
      const next = cloneProposal(base);
      next.incomingPlayers = [vet];
      const sug = trySuggestion(
        franchise,
        league,
        next,
        baseScore,
        'Target win-now piece',
        `${partner.fullName} wants veterans — pivot to ${playerName(vet)} (${vet.overall} OVR).`,
      );
      if (sug) candidates.push(sug);
    }
  }

  if (unusedIncoming.length && base.outgoingPlayerIds.length === 1) {
    const star = base.outgoingPlayerIds
      .map((id) => franchise.roster.find((p) => p.id === id))
      .find((p) => p && p.overall >= 82);
    if (star) {
      const second = unusedIncoming[0];
      const next = cloneProposal(base);
      next.incomingPlayers = [...next.incomingPlayers, second];
      const sug = trySuggestion(
        franchise,
        league,
        next,
        baseScore,
        'Two-for-one return',
        `Ask for ${playerName(second)} in addition to your current return.`,
      );
      if (sug) candidates.push(sug);
    }
  }

  const unique = new Map<string, DealSuggestion>();
  for (const c of candidates) {
    const key = `${c.title}-${c.projectedScore}`;
    if (!unique.has(key) || (unique.get(key)!.projectedScore < c.projectedScore)) {
      unique.set(key, c);
    }
  }

  return [...unique.values()]
    .sort((a, b) => b.projectedScore - a.projectedScore || b.scoreGain - a.scoreGain)
    .slice(0, 4);
}

export function partnerInterestLabel(score: number): string {
  if (score >= 72) return 'Very interested';
  if (score >= 62) return 'Would accept';
  if (score >= 52) return 'On the fence';
  if (score >= 40) return 'Unlikely';
  return 'No interest';
}
