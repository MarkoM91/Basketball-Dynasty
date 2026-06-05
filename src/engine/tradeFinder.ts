import type { Franchise, League, Player, Position, TradeMatch, TradeProposal } from '../types/game';
import { strategyLabel } from '../data/league';
import { uid, playerName } from '../data/scenarios';
import { generatePartnerTradeAssets, validateProposal } from './tradeBuilder';

export interface TradeFinderOptions {
  mode: 'acquire' | 'move';
  outgoingPlayerId?: string;
  targetPosition?: Position;
  minOverall?: number;
  limit?: number;
}

function salaryClose(a: Player, b: Player): number {
  return Math.abs(a.contract.annualSalary - b.contract.annualSalary);
}

function pickOutgoingForIncoming(franchise: Franchise, incoming: Player): Player | undefined {
  const pool = franchise.roster.filter((p) => !p.injured);
  const byPos = pool.find((p) => p.position === incoming.position);
  if (byPos) return byPos;
  return [...pool].sort((a, b) => salaryClose(a, incoming) - salaryClose(b, incoming))[0];
}

export function findTradeMatches(
  franchise: Franchise,
  league: League,
  options: TradeFinderOptions,
): TradeMatch[] {
  const limit = options.limit ?? 12;
  const minOvr = options.minOverall ?? 70;
  const partners = league.teams.filter((t) => !t.isUser);
  const matches: TradeMatch[] = [];

  const outgoingPool = options.outgoingPlayerId
    ? franchise.roster.filter((p) => p.id === options.outgoingPlayerId)
    : franchise.roster.filter((p) => !p.injured && !p.isStar);

  if (!outgoingPool.length) return [];

  for (const partner of partners) {
    const assets = generatePartnerTradeAssets(partner).filter((p) => {
      if (p.overall < minOvr) return false;
      if (options.targetPosition && p.position !== options.targetPosition) return false;
      return true;
    });

    for (const incoming of assets) {
      const outgoing =
        options.mode === 'move' && options.outgoingPlayerId
          ? franchise.roster.find((p) => p.id === options.outgoingPlayerId)
          : pickOutgoingForIncoming(franchise, incoming);

      if (!outgoing || outgoing.id === incoming.id) continue;

      const proposal: TradeProposal = {
        partnerTeamId: partner.id,
        incomingPlayers: [incoming],
        outgoingPlayerIds: [outgoing.id],
        incomingPicks: [],
        outgoingPickKeys: [],
      };

      const validation = validateProposal(franchise, league, proposal);
      matches.push({
        id: uid('tm'),
        partnerTeamId: partner.id,
        partnerTeamName: partner.fullName,
        incomingPlayer: incoming,
        outgoingPlayerId: outgoing.id,
        outgoingPlayerName: playerName(outgoing),
        acceptScore: validation.partnerAcceptScore,
        verdict: `${strategyLabel(partner.strategy)} — ${validation.partnerVerdict}`,
        salaryMatch: validation.salaryMatch,
        valid: validation.valid,
      });
    }
  }

  return matches
    .sort((a, b) => b.acceptScore - a.acceptScore || Number(b.valid) - Number(a.valid))
    .slice(0, limit);
}

export function loadProposalFromMatch(_franchise: Franchise, match: TradeMatch): TradeProposal {
  const partner = match.incomingPlayer;
  return {
    partnerTeamId: match.partnerTeamId,
    incomingPlayers: [partner],
    outgoingPlayerIds: [match.outgoingPlayerId],
    incomingPicks: [],
    outgoingPickKeys: [],
  };
}

export function describeMatch(match: TradeMatch): string {
  return `${match.outgoingPlayerName} → ${playerName(match.incomingPlayer)} (${match.incomingPlayer.overall} OVR)`;
}
