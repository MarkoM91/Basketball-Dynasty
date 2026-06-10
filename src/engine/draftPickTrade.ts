import type { DraftPick, Franchise, League, TradeOffer } from '../types/game';
import { getTeamById, teamWantsPicks } from '../data/league';
import { LEAGUE_CALENDAR_YEAR } from '../data/leagueWorld';
import { playerName, uid } from '../data/scenarios';
import { pickKey } from './cap';
import { draftRound, normalizeDraftNight, userPickSlots } from './draftNight';
import { evaluateTradeForTeam } from './league';
import { generatePartnerTradeAssets, pickDescription, validateProposal } from './tradeBuilder';
import { executeTrade } from './trades';
import { applyUserTradeToLeague } from './leagueWorld';
import { syncUserTeam } from '../data/league';

export interface DraftPickTradeOffer {
  id: string;
  partnerTeamId: string;
  partnerTeamName: string;
  pickNumber: number;
  pickLabel: string;
  title: string;
  detail: string;
  acceptScore: number;
  offer: TradeOffer;
}

export function pickForDraftSlot(franchise: Franchise, pickNumber: number): DraftPick {
  return {
    year: LEAGUE_CALENDAR_YEAR,
    round: draftRound(pickNumber),
    originalTeam: `${franchise.city} ${franchise.name}`,
  };
}

export function remainingUserDraftSlots(franchise: Franchise): number[] {
  if (Array.isArray(franchise.draftNight?.userPickNumbers)) {
    // Array.isArray distinguishes [] (all picks traded) from undefined (not yet initialized)
    const normalized = normalizeDraftNight(franchise.draftNight!, franchise.draftPickNumber);
    return normalized.userPickNumbers.filter((p) => !normalized.userPicksMade.includes(p));
  }
  return userPickSlots(franchise.draftPickNumber ?? 14);
}

export function ensurePickOnBooks(franchise: Franchise, pick: DraftPick): Franchise {
  const key = pickKey(pick);
  if (franchise.draftPicks.some((p) => pickKey(p) === key)) return franchise;
  return { ...franchise, draftPicks: [...franchise.draftPicks, pick] };
}

export function generateDraftPickTradeOffers(
  franchise: Franchise,
  league: League,
  pickNumber: number,
): DraftPickTradeOffer[] {
  const pick = pickForDraftSlot(franchise, pickNumber);
  const key = pickKey(pick);
  const partners = league.teams
    .filter((t) => !t.isUser)
    .sort((a, b) => {
      const aScore = teamWantsPicks(a.strategy) ? 2 : 1;
      const bScore = teamWantsPicks(b.strategy) ? 2 : 1;
      return bScore - aScore;
    });

  const offers: DraftPickTradeOffer[] = [];

  for (const partner of partners.slice(0, 6)) {
    const assets = generatePartnerTradeAssets(partner, league, franchise);
    const vet = assets.find((p) => p.overall >= 74 && p.contract.annualSalary <= 14_000_000)
      ?? assets.find((p) => p.overall >= 70);
    if (!vet) continue;

    const futurePick: DraftPick = {
      year: franchise.season + 1,
      round: pick.round === 1 ? 2 : 2,
      originalTeam: partner.fullName,
    };

    const proposal = {
      partnerTeamId: partner.id,
      incomingPlayers: [vet],
      outgoingPlayerIds: [] as string[],
      incomingPicks: teamWantsPicks(partner.strategy) ? [] : [futurePick],
      outgoingPickKeys: [key],
    };

    const validation = validateProposal(franchise, league, proposal);
    if (!validation.valid) continue;

    const evalResult = evaluateTradeForTeam(
      partner,
      [],
      [pick],
      [vet],
      proposal.incomingPicks,
    );

    if (evalResult.score < 42) continue;

    const offer: TradeOffer = {
      id: uid('tr'),
      partnerTeam: partner.fullName,
      partnerTeamId: partner.id,
      incoming: {
        description: [
          playerName(vet),
          ...proposal.incomingPicks.map(pickDescription),
        ].filter(Boolean).join(', '),
        players: [vet],
        picks: proposal.incomingPicks,
      },
      outgoing: {
        description: `${pickLabel(pickNumber)} (${pickDescription(pick)})`,
        players: [],
        picks: [pick],
      },
      analysis: {
        shortTerm: `Adds ${playerName(vet)} without using the pick.`,
        longTerm: `${partner.fullName} (${evalResult.verdict}) — accept score ${evalResult.score}%.`,
        lockerRoom: 'Minimal locker room impact.',
        fanReaction: evalResult.score >= 60 ? 'Fans like win-now move.' : 'Mixed — asset for pick debate.',
        mediaRisk: 'Draft-night trade leak risk.',
        titleOddsDelta: evalResult.score >= 65 ? 4 : 0,
        partnerAcceptScore: evalResult.score,
      },
      expiresWeek: franchise.week + 1,
    };

    offers.push({
      id: uid('dpt'),
      partnerTeamId: partner.id,
      partnerTeamName: partner.fullName,
      pickNumber,
      pickLabel: pickLabel(pickNumber),
      title: `${partner.fullName} offers ${playerName(vet)}`,
      detail: proposal.incomingPicks.length
        ? `${playerName(vet)} + ${pickDescription(proposal.incomingPicks[0])} for ${pickLabel(pickNumber)}`
        : `${playerName(vet)} (${vet.overall} OVR) for ${pickLabel(pickNumber)}`,
      acceptScore: evalResult.score,
      offer,
    });

    if (offers.length >= 3) break;
  }

  return offers.sort((a, b) => b.acceptScore - a.acceptScore);
}

export function pickLabel(pickNumber: number): string {
  return `#${pickNumber} (R${draftRound(pickNumber)})`;
}

export function applyDraftPickTrade(
  franchise: Franchise,
  league: League,
  pickNumber: number,
  offer: TradeOffer,
): { franchise: Franchise; league: League } {
  let next = ensurePickOnBooks(franchise, pickForDraftSlot(franchise, pickNumber));
  next = executeTrade(next, offer);

  if (next.draftNight) {
    const normalized = normalizeDraftNight(next.draftNight, next.draftPickNumber);
    const userPickNumbers = normalized.userPickNumbers.filter((p) => p !== pickNumber);
    const onClock =
      normalized.onClock && normalized.currentPick === pickNumber
        ? false
        : normalized.onClock;
    next = {
      ...next,
      draftNight: {
        ...normalized,
        userPickNumbers,
        onClock,
        stakeholderNote:
          userPickNumbers.length === 0
            ? 'Draft picks traded away — no selections remaining.'
            : normalized.stakeholderNote,
      },
    };
  }

  const partner = getTeamById(league, offer.partnerTeamId ?? '');
  let nextLeague = syncUserTeam(league, next);
  if (partner) {
    nextLeague = applyUserTradeToLeague(nextLeague, next, partner.id, [], offer.incoming.players, offer.outgoing.picks, offer.incoming.picks);
  }

  return { franchise: next, league: nextLeague };
}
