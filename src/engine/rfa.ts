import type { Franchise, League, RFAOffer } from '../types/game';
import { playerName, uid } from '../data/scenarios';
import { applyRosterSize } from '../data/rosterBuilder';

export function seedRFAOffers(franchise: Franchise, league: League): RFAOffer[] {
  const rfas = franchise.roster.filter(
    (p) => p.contract.isRestricted && (p.contract.isExpiring || p.contract.yearsRemaining <= 1),
  );
  const offers: RFAOffer[] = [];

  for (const player of rfas.slice(0, 2)) {
    const team = league.teams.find((t) => !t.isUser && (t.strategy === 'contend' || t.strategy === 'all_in'));
    if (!team) continue;
    offers.push({
      id: uid('rfa'),
      playerId: player.id,
      playerName: playerName(player),
      offeringTeam: team.fullName,
      salary: Math.round(player.contract.annualSalary * (1.05 + Math.random() * 0.12)),
      years: 3 + Math.floor(Math.random() * 2),
      status: 'pending',
    });
  }

  return offers;
}

export function matchRFAOffer(franchise: Franchise, offerId: string): { franchise: Franchise; message: string } {
  const offer = franchise.rfaOffers.find((o) => o.id === offerId && o.status === 'pending');
  if (!offer) return { franchise, message: 'Offer not found.' };

  const player = franchise.roster.find((p) => p.id === offer.playerId);
  if (!player) return { franchise, message: 'Player no longer on roster.' };

  const roster = franchise.roster.map((p) =>
    p.id === player.id
      ? {
          ...p,
          contract: {
            ...p.contract,
            yearsRemaining: offer.years,
            annualSalary: offer.salary,
            isRestricted: false,
            isExpiring: false,
          },
        }
      : p,
  );

  return {
    franchise: {
      ...franchise,
      roster,
      rfaOffers: franchise.rfaOffers.map((o) =>
        o.id === offerId ? { ...o, status: 'matched' as const } : o,
      ),
      memory: [
        {
          id: uid('mem'),
          season: franchise.season,
          week: franchise.week,
          text: `Matched ${offer.offeringTeam}'s offer sheet for ${offer.playerName} — ${offer.years}yr / $${(offer.salary / 1_000_000).toFixed(1)}M.`,
          type: 'contract',
        },
        ...franchise.memory,
      ],
    },
    message: `Matched the offer sheet. ${offer.playerName} stays — payroll rises.`,
  };
}

export function declineRFAOffer(franchise: Franchise, offerId: string): { franchise: Franchise; message: string } {
  const offer = franchise.rfaOffers.find((o) => o.id === offerId && o.status === 'pending');
  if (!offer) return { franchise, message: 'Offer not found.' };

  const player = franchise.roster.find((p) => p.id === offer.playerId);
  const roster = franchise.roster.filter((p) => p.id !== offer.playerId);

  return {
    franchise: applyRosterSize({
      ...franchise,
      roster,
      rfaOffers: franchise.rfaOffers.map((o) =>
        o.id === offerId ? { ...o, status: 'lost' as const } : o,
      ),
      jobSecurity: Math.max(5, franchise.jobSecurity - (player?.isStar ? 10 : 4)),
      memory: [
        {
          id: uid('mem'),
          season: franchise.season,
          week: franchise.week,
          text: `Declined to match ${offer.offeringTeam} on ${offer.playerName}. He walks.`,
          type: 'contract',
        },
        ...franchise.memory,
      ],
    }),
    message: `${offer.playerName} signs with ${offer.offeringTeam}. You chose cap flexibility over retention.`,
  };
}
