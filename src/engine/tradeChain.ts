import type { Franchise, League, TradeChainProposal, TradeOffer } from '../types/game';
import { getTeamById } from '../data/league';
import { playerName } from '../data/scenarios';
import { evaluateTradeForTeam } from './league';
import { pickKey } from './cap';
import { buildTradeOfferFromProposal, recordTradeGhosts } from './tradeBuilder';

export function validateTradeChain(
  franchise: Franchise,
  league: League,
  chain: TradeChainProposal,
): { valid: boolean; errors: string[]; scores: number[] } {
  const errors: string[] = [];
  const scores: number[] = [];

  const partner = getTeamById(league, chain.userToPartner.partnerTeamId);
  const facilitator = getTeamById(league, chain.facilitatorTeamId);
  if (!partner) errors.push('Select a primary trade partner.');
  if (!facilitator) errors.push('Select a facilitator team.');
  if (partner && facilitator && partner.id === facilitator.id) {
    errors.push('Facilitator must be a different team.');
  }

  if (partner) {
    const userOffer = buildTradeOfferFromProposal(franchise, league, chain.userToPartner);
    scores.push(userOffer?.analysis.partnerAcceptScore ?? 0);
    if ((userOffer?.analysis.partnerAcceptScore ?? 0) < 45) {
      errors.push(`${partner.fullName} rejects the primary leg.`);
    }
  }

  if (facilitator && partner) {
    const partnerGets = chain.userToPartner.outgoingPlayerIds
      .map((id) => franchise.roster.find((p) => p.id === id))
      .filter(Boolean) as typeof franchise.roster;
    const partnerGetsPicks = chain.userToPartner.outgoingPickKeys
      .map((k) => franchise.draftPicks.find((p) => pickKey(p) === k))
      .filter(Boolean) as typeof franchise.draftPicks;
    const ev = evaluateTradeForTeam(
      facilitator,
      chain.partnerToFacilitator.incomingPlayers,
      chain.partnerToFacilitator.incomingPicks,
      partnerGets,
      partnerGetsPicks,
    );
    scores.push(ev.score);
    if (ev.score < 45) errors.push(`${facilitator.fullName} will not absorb the middle leg.`);
  }

  return { valid: errors.length === 0, errors, scores };
}

export function executeTradeChain(
  franchise: Franchise,
  league: League,
  chain: TradeChainProposal,
): { franchise: Franchise; offer: TradeOffer; ghosts: ReturnType<typeof recordTradeGhosts> } | null {
  const check = validateTradeChain(franchise, league, chain);
  if (!check.valid) return null;

  const offer = buildTradeOfferFromProposal(franchise, league, chain.userToPartner);
  if (!offer) return null;

  const facilitator = getTeamById(league, chain.facilitatorTeamId);
  const partner = getTeamById(league, chain.userToPartner.partnerTeamId);
  const chainNote = facilitator && partner
    ? ` Three-team chain through ${facilitator.fullName}: ${partner.fullName} sends assets downstream.`
    : '';

  const enhanced: TradeOffer = {
    ...offer,
    analysis: {
      ...offer.analysis,
      longTerm: `${offer.analysis.longTerm}${chainNote}`,
      mediaRisk: 'National media will dissect a three-team block buster.',
      titleOddsDelta: offer.analysis.titleOddsDelta + 2,
    },
  };

  const ghosts = recordTradeGhosts(franchise, enhanced);
  return { franchise, offer: enhanced, ghosts };
}

export function chainSummary(chain: TradeChainProposal, franchise: Franchise): string {
  const outgoing = chain.userToPartner.outgoingPlayerIds
    .map((id) => franchise.roster.find((p) => p.id === id))
    .filter(Boolean)
    .map((p) => playerName(p!))
    .join(', ');
  const incoming = chain.userToPartner.incomingPlayers.map((p) => playerName(p)).join(', ');
  return `You send ${outgoing || 'picks'} → receive ${incoming || 'picks'} via facilitator routing.`;
}
