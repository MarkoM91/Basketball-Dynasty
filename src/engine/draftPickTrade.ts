import type { DraftPick, Franchise, League, Player, TradeOffer } from '../types/game';
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
    slot: pickNumber,
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
  const existing = franchise.draftPicks.find((p) => pickKey(p) === key);
  if (existing) {
    // Stamp the known slot onto the booked pick so valuation and ownership use it.
    if (pick.slot == null || existing.slot === pick.slot) return franchise;
    return {
      ...franchise,
      draftPicks: franchise.draftPicks.map((p) => (p === existing ? { ...p, slot: pick.slot } : p)),
    };
  }
  return { ...franchise, draftPicks: [...franchise.draftPicks, pick] };
}

export function generateDraftPickTradeOffers(
  franchise: Franchise,
  league: League,
  pickNumber: number,
): DraftPickTradeOffer[] {
  const pick = pickForDraftSlot(franchise, pickNumber);
  const key = pickKey(pick);
  // The draft-night slot must be on the books, or validateProposal sees an empty outgoing package
  // and every partner scores the offer as "nothing for a starter" — so no offers ever appeared.
  const booked = ensurePickOnBooks(franchise, pick);
  const partners = league.teams
    .filter((t) => !t.isUser)
    .sort((a, b) => {
      const aScore = teamWantsPicks(a.strategy) ? 2 : 1;
      const bScore = teamWantsPicks(b.strategy) ? 2 : 1;
      return bScore - aScore;
    });

  const offers: DraftPickTradeOffer[] = [];

  for (const partner of partners.slice(0, pick.round === 1 ? 6 : 12)) {
    const assets = generatePartnerTradeAssets(partner, league, booked);
    // Future picks are dated on the league calendar (books use e.g. 2027), not the season counter.
    const futureSecond: DraftPick = {
      year: LEAGUE_CALENDAR_YEAR + 1,
      round: 2,
      originalTeam: partner.fullName,
    };

    // A 2nd-rounder never fetched a 70+ OVR veteran, so #31–60 used to get zero offers.
    // Round 1: rotation veteran (+ a future 2nd from teams that aren't hoarding picks).
    // Round 2: a future 2nd, or a fringe young player.
    const candidates: { players: Player[]; picks: DraftPick[] }[] = [];
    if (pick.round === 1) {
      const vet = assets.find((p) => p.overall >= 74 && p.contract.annualSalary <= 14_000_000)
        ?? assets.find((p) => p.overall >= 70);
      if (vet) candidates.push({ players: [vet], picks: teamWantsPicks(partner.strategy) ? [] : [futureSecond] });
    } else {
      candidates.push({ players: [], picks: [futureSecond] });
      const fringe = assets.find((p) => p.overall <= 66 && p.age <= 25 && p.contract.annualSalary <= 3_000_000);
      if (fringe) candidates.push({ players: [fringe], picks: [] });
    }

    const chosen = candidates
      .map((c) => {
        const proposal = {
          partnerTeamId: partner.id,
          incomingPlayers: c.players,
          outgoingPlayerIds: [] as string[],
          incomingPicks: c.picks,
          outgoingPickKeys: [key],
        };
        const validation = validateProposal(booked, league, proposal);
        const evalResult = evaluateTradeForTeam(partner, [], [pick], c.players, c.picks);
        return { proposal, validation, evalResult };
      })
      .find((c) => c.validation.valid && c.evalResult.score >= 42);
    if (!chosen) continue;
    const { proposal, evalResult } = chosen;
    const vet = proposal.incomingPlayers[0] as Player | undefined;

    const incomingParts = [
      ...(vet ? [playerName(vet)] : []),
      ...proposal.incomingPicks.map(pickDescription),
    ];
    const returnLabel = incomingParts.join(' + ');
    const offer: TradeOffer = {
      id: uid('tr'),
      partnerTeam: partner.fullName,
      partnerTeamId: partner.id,
      incoming: {
        description: incomingParts.join(', '),
        players: proposal.incomingPlayers,
        picks: proposal.incomingPicks,
      },
      outgoing: {
        description: `${pickLabel(pickNumber)} (${pickDescription(pick)})`,
        players: [],
        picks: [pick],
      },
      analysis: {
        shortTerm: vet
          ? `Adds ${playerName(vet)} without using the pick.`
          : `Moves ${pickLabel(pickNumber)} for ${returnLabel} — saves a roster spot this year.`,
        longTerm: `${partner.fullName} (${evalResult.verdict}) — accept score ${evalResult.score}%.`,
        lockerRoom: 'Minimal locker room impact.',
        fanReaction: evalResult.score >= 60 ? 'Fans like win-now move.' : 'Mixed — asset for pick debate.',
        mediaRisk: 'Draft-night trade leak risk.',
        titleOddsDelta: vet && evalResult.score >= 65 ? 4 : 0,
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
      title: `${partner.fullName} offers ${vet ? playerName(vet) : returnLabel}`,
      detail: vet && !proposal.incomingPicks.length
        ? `${playerName(vet)} (${vet.overall} OVR) for ${pickLabel(pickNumber)}`
        : `${returnLabel} for ${pickLabel(pickNumber)}`,
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
    const outgoingPicks = offer.outgoing.picks.map((p) =>
      p.slot == null && p.year === LEAGUE_CALENDAR_YEAR && p.round === draftRound(pickNumber) ? { ...p, slot: pickNumber } : p,
    );
    nextLeague = applyUserTradeToLeague(nextLeague, next, partner.id, [], offer.incoming.players, outgoingPicks, offer.incoming.picks);
  }

  return { franchise: next, league: nextLeague };
}
