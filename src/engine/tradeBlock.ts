import type {
  DraftPick,
  Franchise,
  League,
  LeagueTeam,
  LeagueTradeBlockListing,
  Player,
  SubmittedTradeProposal,
  TradeBlockState,
  TradeOffer,
  TradeProposal,
  TradeProposalStatus,
  TradeShoppingTag,
} from '../types/game';
import { getTeamById, teamWantsPicks, teamWantsVeterans } from '../data/league';
import { LEAGUE_CALENDAR_YEAR } from '../data/leagueWorld';
import { takeTeamRosterName } from '../data/names';
import { marketSalary } from '../engine/salaries';
import { uid, playerName } from '../data/scenarios';
import { pickKey, validateTradeSalaryMatch } from './cap';
import { evaluateTradeForTeam } from './league';
import {
  buildTradeOfferFromProposal,
  generateCounterOffer,
  generatePartnerTradeAssets,
  pickDescription,
  validateProposal,
} from './tradeBuilder';
import { hashString, pickInt } from '../lib/visuals/hash';

export const EMPTY_TRADE_BLOCK: TradeBlockState = { playerIds: [], pickKeys: [] };

export function isPlayerOnBlock(franchise: Franchise, playerId: string): boolean {
  return (franchise.tradeBlock?.playerIds ?? []).includes(playerId);
}

export function isPickOnBlock(franchise: Franchise, key: string): boolean {
  return (franchise.tradeBlock?.pickKeys ?? []).includes(key);
}

export function togglePlayerOnBlock(franchise: Franchise, playerId: string): Franchise {
  const block = franchise.tradeBlock ?? EMPTY_TRADE_BLOCK;
  const playerIds = block.playerIds.includes(playerId)
    ? block.playerIds.filter((id) => id !== playerId)
    : [...block.playerIds, playerId];
  return { ...franchise, tradeBlock: { ...block, playerIds } };
}

export function togglePickOnBlock(franchise: Franchise, key: string): Franchise {
  const block = franchise.tradeBlock ?? EMPTY_TRADE_BLOCK;
  const pickKeys = block.pickKeys.includes(key)
    ? block.pickKeys.filter((k) => k !== key)
    : [...block.pickKeys, key];
  return { ...franchise, tradeBlock: { ...block, pickKeys } };
}

export function clearTradeBlock(franchise: Franchise): Franchise {
  return { ...franchise, tradeBlock: EMPTY_TRADE_BLOCK };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function syntheticBlockPlayer(
  team: LeagueTeam,
  slot: number,
  usedNames: Set<string>,
): LeagueTradeBlockListing {
  const seed = hashString(`${team.id}-block-${slot}`);
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
  const overall = clamp(team.strength + pickInt(seed, -8, 6, 2), 68, 90);
  const age = pickInt(seed, 22, 33, 3);
  const named = takeTeamRosterName(team.city, team.name, slot, usedNames, seed + slot * 31);
  const fn = named.firstName;
  const ln = named.lastName;
  const position = named.position ?? positions[pickInt(seed, 0, positions.length - 1, 1)];

  let askingNote = 'Available for the right return.';
  const shoppingFor: TradeShoppingTag[] = [];
  if (teamWantsPicks(team.strategy)) {
    askingNote = 'Shopping for draft capital — picks preferred.';
    shoppingFor.push('draft_picks', 'young_talent');
  } else if (teamWantsVeterans(team.strategy)) {
    askingNote = 'Listening on win-now pieces only.';
    shoppingFor.push('veteran_help', 'star_power');
  } else {
    shoppingFor.push('young_talent');
  }
  if (team.taxAverse) shoppingFor.push('salary_relief');

  return {
    id: uid('tbl'),
    teamId: team.id,
    teamName: team.fullName,
    assetType: 'player',
    label: `${fn} ${ln}`,
    position,
    overall,
    age,
    salary: marketSalary(overall, age),
    askingNote,
    interestForUser: overall >= 80 ? 'High' : overall >= 74 ? 'Medium' : 'Low',
    shoppingFor,
  };
}

function syntheticBlockPick(team: LeagueTeam, slot: number): LeagueTradeBlockListing {
  const seed = hashString(`${team.id}-pick-${slot}`);
  const year = LEAGUE_CALENDAR_YEAR + pickInt(seed, 1, 3, 1);
  const round = pickInt(seed, 1, 2, 2) as 1 | 2;
  const protectedPick = round === 1 && pickInt(seed, 0, 2, 3) === 0;
  const shoppingFor: TradeShoppingTag[] = teamWantsPicks(team.strategy)
    ? ['draft_picks', 'young_talent']
    : ['veteran_help'];

  return {
    id: uid('tbl'),
    teamId: team.id,
    teamName: team.fullName,
    assetType: 'pick',
    label: `${year} ${round === 1 ? '1st' : '2nd'}${protectedPick ? ' (Top-8 prot.)' : ''}`,
    askingNote: teamWantsVeterans(team.strategy)
      ? 'Pick may move for playoff rotation help.'
      : 'Pick is on the market — young talent or more picks.',
    interestForUser: round === 1 ? 'High' : 'Medium',
    shoppingFor,
  };
}

export function generateLeagueTradeBlockListings(league: League, franchise: Franchise): LeagueTradeBlockListing[] {
  const listings: LeagueTradeBlockListing[] = [];
  const partners = league.teams.filter((t) => !t.isUser);
  const usedNames = new Set<string>();
  for (const player of franchise.roster) {
    usedNames.add(`${player.firstName} ${player.lastName}`.toLowerCase());
  }

  for (const team of partners) {
    const seed = hashString(`${franchise.season}-${team.id}-block`);
    const count = pickInt(seed, 1, 3, 1);
    for (let i = 0; i < count; i += 1) {
      if (teamWantsPicks(team.strategy) && pickInt(seed, 0, 1, 2 + i) === 0) {
        listings.push(syntheticBlockPlayer(team, i, usedNames));
      } else if (pickInt(seed, 0, 2, 4 + i) === 0) {
        listings.push(syntheticBlockPick(team, i));
      } else {
        listings.push(syntheticBlockPlayer(team, i + 3, usedNames));
      }
    }
  }

  return listings.sort((a, b) => {
    const rank = { High: 0, Medium: 1, Low: 2 };
    return rank[a.interestForUser] - rank[b.interestForUser];
  });
}

export type BlockListFilter =
  | 'all'
  | 'high_interest'
  | 'draft_picks'
  | 'young_talent'
  | 'veteran_help'
  | 'salary_relief'
  | 'star_power';

export function filterLeagueTradeBlockListings(
  listings: LeagueTradeBlockListing[],
  filter: BlockListFilter,
): LeagueTradeBlockListing[] {
  if (filter === 'all') return listings;
  if (filter === 'high_interest') {
    return listings.filter((l) => l.interestForUser === 'High');
  }
  return listings.filter((l) => l.shoppingFor.includes(filter));
}

const SHOPPING_LABELS: Record<TradeShoppingTag, string> = {
  draft_picks: 'Picks',
  young_talent: 'Young',
  veteran_help: 'Vets',
  salary_relief: 'Cap relief',
  star_power: 'Stars',
};

export function shoppingTagLabel(tag: TradeShoppingTag): string {
  return SHOPPING_LABELS[tag];
}

export function createSubmittedProposal(
  franchise: Franchise,
  league: League,
  proposal: TradeProposal,
  partnerAcceptScore: number,
  partnerVerdict: string,
  status: TradeProposalStatus,
  responseNote?: string,
): SubmittedTradeProposal {
  const partner = getTeamById(league, proposal.partnerTeamId);
  return {
    id: uid('stp'),
    submittedWeek: franchise.week,
    season: franchise.season,
    partnerTeamId: proposal.partnerTeamId,
    partnerTeamName: partner?.fullName ?? 'Unknown',
    proposal,
    status,
    partnerAcceptScore,
    partnerVerdict,
    responseNote,
    expiresWeek: franchise.week + 2,
  };
}

export function expireSubmittedProposals(franchise: Franchise): SubmittedTradeProposal[] {
  return (franchise.submittedProposals ?? []).map((p) =>
    p.status === 'pending' && franchise.week > p.expiresWeek
      ? { ...p, status: 'expired' as const, responseNote: 'Offer expired — no response.' }
      : p,
  );
}

export function withdrawSubmittedProposal(
  franchise: Franchise,
  proposalId: string,
): SubmittedTradeProposal[] {
  return (franchise.submittedProposals ?? []).map((p) =>
    p.id === proposalId && p.status === 'pending'
      ? { ...p, status: 'withdrawn' as const, responseNote: 'Withdrawn by front office.' }
      : p,
  );
}

function scorePartnerInterest(partner: LeagueTeam, player: Player): number {
  let score = 40 + player.overall * 0.5;
  if (teamWantsVeterans(partner.strategy) && player.overall >= 78) score += 25;
  if (teamWantsVeterans(partner.strategy) && player.overall >= 82) score += 10;
  if (teamWantsPicks(partner.strategy) && player.age <= 25) score += 20;
  if (teamWantsPicks(partner.strategy) && player.age <= 22) score += 10;
  if (player.overall >= 84) score += 15;
  return score;
}

function scorePartnerInterestForPick(partner: LeagueTeam, pick: DraftPick): number {
  let score = 50;
  if (pick.round === 1) score += 25;
  if (teamWantsPicks(partner.strategy)) score += 20;
  if (teamWantsVeterans(partner.strategy)) score += 10;
  return score;
}

function maxIncomingSalary(franchise: Franchise, outgoingSalary: number): number {
  return validateTradeSalaryMatch(franchise, 0, outgoingSalary).allowedIncoming;
}

function pickBestSingleAsset(assets: Player[], outgoingSalary: number, franchise: Franchise): Player {
  const allowed = maxIncomingSalary(franchise, outgoingSalary);
  const eligible = assets.filter((p) => p.contract.annualSalary <= allowed);
  const pool = eligible.length ? eligible : assets;
  return pool.reduce((best, player) =>
    Math.abs(player.contract.annualSalary - outgoingSalary) <
    Math.abs(best.contract.annualSalary - outgoingSalary)
      ? player
      : best,
  );
}

function pickBestPair(assets: Player[], outgoingSalary: number, franchise: Franchise): Player[] {
  const allowed = maxIncomingSalary(franchise, outgoingSalary);
  let bestPair: Player[] | null = null;
  let bestDelta = Infinity;

  for (let i = 0; i < assets.length; i += 1) {
    for (let j = i + 1; j < assets.length; j += 1) {
      const sum = assets[i].contract.annualSalary + assets[j].contract.annualSalary;
      if (sum <= allowed) {
        const delta = Math.abs(sum - outgoingSalary);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestPair = [assets[i], assets[j]];
        }
      }
    }
  }

  return bestPair ?? [pickBestSingleAsset(assets, outgoingSalary, franchise)];
}

function buildBlockInquiryOffer(
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

  if (
    (!incomingPlayers.length && !incomingPicks.length) ||
    (!outgoingPlayers.length && !outgoingPicks.length)
  ) {
    return null;
  }

  const validation = validateProposal(franchise, league, proposal);
  const blockingErrors = validation.errors.filter((msg) => !msg.includes('cap office'));
  if (blockingErrors.length) return null;

  const evalResult = evaluateTradeForTeam(
    partner,
    outgoingPlayers,
    outgoingPicks,
    incomingPlayers,
    incomingPicks,
  );
  const blockBoost =
    outgoingPlayers.filter((p) => franchise.tradeBlock?.playerIds.includes(p.id)).length * 4 +
    outgoingPicks.filter((p) => franchise.tradeBlock?.pickKeys.includes(pickKey(p))).length * 3;
  const acceptScore = Math.min(88, evalResult.score + blockBoost);
  const titleOddsDelta = acceptScore >= 65 ? 8 : acceptScore >= 50 ? 3 : -4;

  return {
    id: uid('tr'),
    partnerTeam: partner.fullName,
    partnerTeamId: partner.id,
    incoming: {
      description:
        [
          ...incomingPlayers.map((p) => playerName(p)),
          ...incomingPicks.map(pickDescription),
        ].join(', ') || 'Assets incoming',
      players: incomingPlayers,
      picks: incomingPicks,
    },
    outgoing: {
      description:
        [
          ...outgoingPlayers.map((p) => playerName(p)),
          ...outgoingPicks.map(pickDescription),
        ].join(', ') || 'Assets outgoing',
      players: outgoingPlayers,
      picks: outgoingPicks,
    },
    analysis: {
      shortTerm: acceptScore >= 60 ? 'Roster talent shifts immediately.' : 'Marginal short-term impact.',
      longTerm: `${partner.fullName} (${evalResult.verdict}) — accept score ${acceptScore}%.`,
      lockerRoom: outgoingPlayers.some((p) => p.isStar)
        ? 'Stars may react to roster shake-up.'
        : 'Locker room manageable.',
      fanReaction:
        acceptScore >= 70 ? 'Fans excited.' : acceptScore <= 40 ? 'Fan backlash likely.' : 'Mixed reaction.',
      mediaRisk: acceptScore < 45 ? 'National media will call it a fleece if it fails.' : 'Moderate scrutiny.',
      titleOddsDelta,
      partnerAcceptScore: acceptScore,
    },
    expiresWeek: franchise.week + 2,
  };
}

function buildFallbackBlockProposal(
  franchise: Franchise,
  partner: LeagueTeam,
  targetPlayer: Player,
  variant: number,
): TradeProposal {
  const assets = generatePartnerTradeAssets(partner);
  const outgoingSalary = targetPlayer.contract.annualSalary;
  const primary = pickBestSingleAsset(assets, outgoingSalary, franchise);
  const secondary = assets.find((p) => p.id !== primary.id) ?? assets[0];

  if (variant % 2 === 1) {
    return {
      partnerTeamId: partner.id,
      incomingPlayers: [primary],
      outgoingPlayerIds: [targetPlayer.id],
      incomingPicks: [partnerReturnPick(franchise, partner, 2, variant % 3 === 0 ? 2 : 1)],
      outgoingPickKeys: [],
    };
  }

  return {
    partnerTeamId: partner.id,
    incomingPlayers: [primary, secondary].filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx),
    outgoingPlayerIds: [targetPlayer.id],
    incomingPicks: [],
    outgoingPickKeys: [],
  };
}

function buildFallbackPickProposal(
  franchise: Franchise,
  partner: LeagueTeam,
  targetPick: DraftPick,
  variant: number,
): TradeProposal {
  const assets = generatePartnerTradeAssets(partner);
  const primary = assets[variant % assets.length];
  const secondary = assets[(variant + 1) % assets.length];

  if (variant % 2 === 0) {
    return {
      partnerTeamId: partner.id,
      incomingPlayers: [primary],
      outgoingPlayerIds: [],
      incomingPicks: [partnerReturnPick(franchise, partner, 2)],
      outgoingPickKeys: [pickKey(targetPick)],
    };
  }

  return {
    partnerTeamId: partner.id,
    incomingPlayers: [primary, secondary].filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx),
    outgoingPlayerIds: [],
    incomingPicks: [],
    outgoingPickKeys: [pickKey(targetPick)],
  };
}

function partnerReturnPick(
  franchise: Franchise,
  partner: LeagueTeam,
  round: 1 | 2,
  yearOffset = 1,
  protections?: string,
): DraftPick {
  return {
    year: franchise.season + yearOffset,
    round,
    originalTeam: partner.fullName,
    ...(protections ? { protections } : {}),
  };
}

function buildBlockOfferProposal(
  franchise: Franchise,
  partner: LeagueTeam,
  targetPlayer: Player | undefined,
  targetPick: DraftPick | undefined,
  variant: number,
): TradeProposal | null {
  const assets = generatePartnerTradeAssets(partner);
  if (assets.length < 2) return null;

  const assetKey = targetPlayer?.id ?? (targetPick ? pickKey(targetPick) : 'unknown');
  const seed = hashString(`${partner.id}-${assetKey}-v${variant}`);
  const packageType = pickInt(seed, 0, 3, 1);

  const incomingPlayers: Player[] = [];
  const incomingPicks: DraftPick[] = [];
  const outgoingPlayerIds: string[] = [];
  const outgoingPickKeys: string[] = [];

  if (targetPlayer) {
    outgoingPlayerIds.push(targetPlayer.id);
    const outgoingSalary = targetPlayer.contract.annualSalary;
    switch (packageType) {
      case 0:
        incomingPlayers.push(pickBestSingleAsset(assets, outgoingSalary, franchise));
        incomingPicks.push(partnerReturnPick(franchise, partner, 2));
        break;
      case 1:
        incomingPlayers.push(...pickBestPair(assets, outgoingSalary, franchise));
        break;
      case 2:
        incomingPlayers.push(pickBestSingleAsset(assets.slice(1), outgoingSalary, franchise));
        incomingPicks.push(partnerReturnPick(franchise, partner, 1, 1, 'Top-10 protected'));
        break;
      default:
        incomingPlayers.push(pickBestSingleAsset(assets, outgoingSalary, franchise));
        incomingPicks.push(partnerReturnPick(franchise, partner, 2));
        incomingPicks.push(partnerReturnPick(franchise, partner, 2, 2));
        break;
    }
  } else if (targetPick) {
    outgoingPickKeys.push(pickKey(targetPick));
    switch (packageType) {
      case 0:
        incomingPlayers.push(assets[0]);
        incomingPicks.push(partnerReturnPick(franchise, partner, 2));
        break;
      case 1:
        incomingPlayers.push(assets[0], assets[2] ?? assets[1]);
        break;
      case 2:
        incomingPlayers.push(assets[1]);
        incomingPicks.push(partnerReturnPick(franchise, partner, 1, 1, 'Top-12 protected'));
        break;
      default:
        incomingPlayers.push(assets[0], assets[1]);
        break;
    }
  } else {
    return null;
  }

  return {
    partnerTeamId: partner.id,
    incomingPlayers,
    outgoingPlayerIds,
    incomingPicks,
    outgoingPickKeys,
  };
}

function finalizeBlockOffer(
  franchise: Franchise,
  league: League,
  partner: LeagueTeam,
  trigger: { type: 'player' | 'pick'; key: string },
  variant: number,
  targetPlayer: Player | undefined,
  targetPick: DraftPick | undefined,
): TradeOffer | null {
  const proposal = buildBlockOfferProposal(franchise, partner, targetPlayer, targetPick, variant);
  if (!proposal) return null;

  const offer = buildBlockInquiryOffer(franchise, league, proposal);
  if (!offer) return null;

  const listedLabel = targetPlayer
    ? playerName(targetPlayer)
    : targetPick
      ? pickDescription(targetPick)
      : 'your listing';

  const interestScore = Math.round(
    targetPlayer
      ? scorePartnerInterest(partner, targetPlayer)
      : targetPick
        ? scorePartnerInterestForPick(partner, targetPick)
        : 50,
  );

  return {
    ...offer,
    id: `block-${partner.id}-${trigger.key}-v${variant}`,
    blockInquiry: true,
    listedAssetKey: trigger.key,
    analysis: {
      ...offer.analysis,
      shortTerm: `Inbound offer for ${listedLabel}.`,
      longTerm: `${partner.fullName} wants ${listedLabel} and proposes this return.`,
      mediaRisk: 'Other teams may counter if word spreads.',
      partnerAcceptScore: interestScore,
    },
  };
}

/** True when an offer is tied to a current listing and sends the listed asset out. */
export function isValidBlockListingOffer(franchise: Franchise, offer: TradeOffer): boolean {
  if (!offer.blockInquiry || !offer.listedAssetKey) return false;
  const block = franchise.tradeBlock ?? EMPTY_TRADE_BLOCK;

  if (block.playerIds.includes(offer.listedAssetKey)) {
    const listedId = offer.listedAssetKey;
    const outgoingIds = offer.outgoing.players.map((p) => p.id);
    return outgoingIds.length === 1 && outgoingIds[0] === listedId && offer.outgoing.picks.length === 0;
  }

  if (block.pickKeys.includes(offer.listedAssetKey)) {
    const listedKey = offer.listedAssetKey;
    const outgoingKeys = offer.outgoing.picks.map((p) => pickKey(p));
    return (
      offer.outgoing.players.length === 0 &&
      outgoingKeys.length === 1 &&
      outgoingKeys[0] === listedKey
    );
  }

  return false;
}

export function listingOffersForFranchise(franchise: Franchise): TradeOffer[] {
  return (franchise.tradeOffers ?? []).filter((offer) => isValidBlockListingOffer(franchise, offer));
}

export function needsBlockOfferReconcile(franchise: Franchise): boolean {
  const block = franchise.tradeBlock ?? EMPTY_TRADE_BLOCK;
  const listingsCount = block.playerIds.length + block.pickKeys.length;

  if (!listingsCount) {
    return (franchise.tradeOffers ?? []).some((offer) => offer.blockInquiry);
  }

  if (
    (franchise.tradeOffers ?? []).some(
      (offer) => offer.blockInquiry && !isValidBlockListingOffer(franchise, offer),
    )
  ) {
    return true;
  }

  const valid = listingOffersForFranchise(franchise);
  for (const playerId of block.playerIds) {
    if (!valid.some((offer) => offer.listedAssetKey === playerId)) return true;
  }
  for (const key of block.pickKeys) {
    if (!valid.some((offer) => offer.listedAssetKey === key)) return true;
  }

  return false;
}

function stripBlockListingOffers(franchise: Franchise): Franchise {
  return {
    ...franchise,
    tradeOffers: (franchise.tradeOffers ?? []).filter((offer) => !offer.blockInquiry),
  };
}

/** Drop stale block offers and regenerate packages for every current listing. */
export function reconcileBlockListingOffers(
  franchise: Franchise,
  league: League,
): { franchise: Franchise; added: number } {
  const block = franchise.tradeBlock ?? EMPTY_TRADE_BLOCK;
  if (!block.playerIds.length && !block.pickKeys.length) {
    return { franchise: stripBlockListingOffers(franchise), added: 0 };
  }

  let next = stripBlockListingOffers(franchise);
  let added = 0;

  for (const playerId of block.playerIds) {
    const offers = generateInstantBlockOffers(next, league, { type: 'player', key: playerId });
    if (!offers.length) continue;
    next = { ...next, tradeOffers: mergeTradeOffers(next.tradeOffers ?? [], offers) };
    added += offers.length;
  }

  for (const key of block.pickKeys) {
    const offers = generateInstantBlockOffers(next, league, { type: 'pick', key });
    if (!offers.length) continue;
    next = { ...next, tradeOffers: mergeTradeOffers(next.tradeOffers ?? [], offers) };
    added += offers.length;
  }

  return { franchise: next, added };
}

/** Generate inbound packages when you list a player or pick on your block. */
export function generateInstantBlockOffers(
  franchise: Franchise,
  league: League,
  trigger: { type: 'player' | 'pick'; key: string },
): TradeOffer[] {
  let targetPlayer: Player | undefined;
  let targetPick: DraftPick | undefined;

  if (trigger.type === 'player') {
    targetPlayer = franchise.roster.find((p) => p.id === trigger.key);
    if (!targetPlayer) return [];
  } else {
    targetPick = franchise.draftPicks.find((p) => pickKey(p) === trigger.key);
    if (!targetPick) return [];
  }

  const partners = league.teams.filter((t) => !t.isUser);
  const ranked = partners
    .map((partner) => ({
      partner,
      score:
        trigger.type === 'player' && targetPlayer
          ? scorePartnerInterest(partner, targetPlayer)
          : targetPick
            ? scorePartnerInterestForPick(partner, targetPick)
            : 0,
    }))
    .sort((a, b) => b.score - a.score);

  const offers: TradeOffer[] = [];
  const usedPartners = new Set<string>();

  for (const { partner } of ranked) {
    if (offers.length >= 4) break;
    for (let variant = 0; variant < 4; variant += 1) {
      const offer = finalizeBlockOffer(franchise, league, partner, trigger, variant, targetPlayer, targetPick);
      if (!offer || usedPartners.has(partner.id)) continue;
      usedPartners.add(partner.id);
      offers.push(offer);
      break;
    }
  }

  if (offers.length < 4) {
    for (const { partner } of ranked) {
      if (offers.length >= 4 || usedPartners.has(partner.id)) continue;
      const fallbackProposal =
        targetPlayer !== undefined
          ? buildFallbackBlockProposal(franchise, partner, targetPlayer, offers.length)
          : targetPick
            ? buildFallbackPickProposal(franchise, partner, targetPick, offers.length)
            : null;
      if (!fallbackProposal) continue;

      const fallbackOffer = buildBlockInquiryOffer(franchise, league, fallbackProposal);
      if (!fallbackOffer) continue;

      const listedLabel = targetPlayer
        ? playerName(targetPlayer)
        : targetPick
          ? pickDescription(targetPick)
          : 'your listing';

      const interestScore = Math.round(
        targetPlayer
          ? scorePartnerInterest(partner, targetPlayer)
          : targetPick
            ? scorePartnerInterestForPick(partner, targetPick)
            : 50,
      );

      offers.push({
        ...fallbackOffer,
        id: `block-${partner.id}-${trigger.key}-fb${offers.length}`,
        blockInquiry: true,
        listedAssetKey: trigger.key,
        analysis: {
          ...fallbackOffer.analysis,
          shortTerm: `Inbound offer for ${listedLabel}.`,
          longTerm: `${partner.fullName} wants ${listedLabel} and proposes this return.`,
          mediaRisk: 'Other teams may counter if word spreads.',
          partnerAcceptScore: interestScore,
        },
      });
      usedPartners.add(partner.id);
    }
  }

  return offers;
}

/** Weekly refresh — one new inquiry per listed asset. */
export function generateTradeBlockOffers(franchise: Franchise, league: League): TradeOffer[] {
  const block = franchise.tradeBlock ?? EMPTY_TRADE_BLOCK;
  if (!block.playerIds.length && !block.pickKeys.length) return [];

  const offers: TradeOffer[] = [];
  const weekVariant = franchise.week;

  for (const playerId of block.playerIds) {
    const instant = generateInstantBlockOffers(franchise, league, { type: 'player', key: playerId });
    const offer = instant[weekVariant % Math.max(instant.length, 1)];
    if (offer) offers.push({ ...offer, id: `${offer.id}-wk${weekVariant}` });
  }

  for (const key of block.pickKeys) {
    const instant = generateInstantBlockOffers(franchise, league, { type: 'pick', key });
    const offer = instant[weekVariant % Math.max(instant.length, 1)];
    if (offer) offers.push({ ...offer, id: `${offer.id}-wk${weekVariant}` });
  }

  return offers;
}

export function mergeTradeOffers(existing: TradeOffer[], incoming: TradeOffer[]): TradeOffer[] {
  const merged = [...existing];
  for (const offer of incoming) {
    if (offer.blockInquiry && offer.listedAssetKey) {
      const duplicateIdx = merged.findIndex(
        (row) =>
          row.blockInquiry &&
          row.listedAssetKey === offer.listedAssetKey &&
          row.partnerTeamId === offer.partnerTeamId,
      );
      if (duplicateIdx >= 0) merged.splice(duplicateIdx, 1);
    }
    if (merged.some((row) => row.id === offer.id)) continue;
    merged.push(offer);
  }
  return merged.slice(0, 12);
}

export function resolveProposalSubmission(
  franchise: Franchise,
  league: League,
  proposal: TradeProposal,
  negotiationRound = 0,
): {
  offer: TradeOffer | null;
  counter: TradeOffer | null;
  submitted: SubmittedTradeProposal;
  autoAccept: boolean;
} {
  const offer = buildTradeOfferFromProposal(franchise, league, proposal);
  let score = offer?.analysis.partnerAcceptScore ?? 0;
  if (negotiationRound > 0) {
    score = Math.min(68, score + negotiationRound * 5);
  }
  const verdict = offer?.analysis.longTerm ?? 'No response.';
  const acceptThreshold = negotiationRound >= 2 ? 58 : 62;

  if (offer && score >= acceptThreshold) {
    return {
      offer,
      counter: null,
      submitted: createSubmittedProposal(
        franchise,
        league,
        proposal,
        score,
        'Accepted immediately.',
        'accepted',
        'Partner accepted your package.',
      ),
      autoAccept: true,
    };
  }

  if (negotiationRound >= 3) {
    return {
      offer,
      counter: null,
      submitted: createSubmittedProposal(
        franchise,
        league,
        proposal,
        score,
        'Partner walked away.',
        'rejected',
        `${proposal.partnerTeamId ? getTeamById(league, proposal.partnerTeamId)?.fullName : 'Partner'} ended talks after ${negotiationRound} rounds.`,
      ),
      autoAccept: false,
    };
  }

  const counter = generateCounterOffer(franchise, league, proposal);
  const status: TradeProposalStatus = counter && score < 45 ? 'rejected' : 'countered';

  return {
    offer,
    counter: counter ?? null,
    submitted: createSubmittedProposal(
      franchise,
      league,
      proposal,
      score,
      verdict,
      status,
      counter?.analysis.longTerm ?? 'Partner declined — revise your package.',
    ),
    autoAccept: false,
  };
}

export function tradeBlockAssetCount(franchise: Franchise): number {
  const block = franchise.tradeBlock ?? EMPTY_TRADE_BLOCK;
  return block.playerIds.length + block.pickKeys.length;
}

export function userTradeBlockListings(franchise: Franchise): { players: Player[]; picks: DraftPick[] } {
  const block = franchise.tradeBlock ?? EMPTY_TRADE_BLOCK;
  return {
    players: block.playerIds
      .map((id) => franchise.roster.find((p) => p.id === id))
      .filter(Boolean) as Player[],
    picks: block.pickKeys
      .map((k) => franchise.draftPicks.find((p) => pickKey(p) === k))
      .filter(Boolean) as DraftPick[],
  };
}
