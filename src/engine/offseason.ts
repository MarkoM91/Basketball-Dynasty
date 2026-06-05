import type { Franchise, League } from '../types/game';
import { uid } from '../data/scenarios';
import {
  attachDraftOrder,
  buildDraftOrder,
  getUserDraftPickNumber,
} from './draftOrder';
import { seedRFAOffers } from './rfa';
import { generateFreeAgentPool } from './freeAgency';

export interface ContractRenewalSummary {
  reSigned: string[];
  expiring: string[];
  rookieDeals: string[];
}

/** Run once when the calendar year turns — all contracts lose a year. */
export function tickSeasonContracts(franchise: Franchise): Franchise {
  const coachYears = Math.max(0, (franchise.coach.contractYearsRemaining ?? 2) - 1);
  return {
    ...franchise,
    coach: {
      ...franchise.coach,
      contractYearsRemaining: coachYears,
    },
    roster: franchise.roster.map((p) => {
      const years = Math.max(0, p.contract.yearsRemaining - 1);
      return {
        ...p,
        contract: {
          ...p.contract,
          yearsRemaining: years,
          isExpiring: years === 0,
        },
      };
    }),
  };
}

/** After the draft: enter renewal window before free agency opens. */
export function processContractRenewals(
  franchise: Franchise,
  rookieNames: string[] = [],
): {
  franchise: Franchise;
  summary: ContractRenewalSummary;
} {
  const expiring = franchise.roster
    .filter((p) => p.contract.yearsRemaining === 0 || p.contract.isExpiring)
    .map((p) => `${p.firstName} ${p.lastName}`);

  return {
    franchise: {
      ...franchise,
      phase: 'contract_renewals',
    },
    summary: { reSigned: [], expiring, rookieDeals: rookieNames },
  };
}

export function openFreeAgencyAfterRenewals(franchise: Franchise, league: League): Franchise {
  return {
    ...franchise,
    phase: 'free_agency',
    freeAgents: generateFreeAgentPool(10),
    rfaOffers: seedRFAOffers(franchise, league),
  };
}

export function prepareDraftScouting(
  franchise: Franchise,
  league: League,
  priorLeague?: League,
  priorPlayoffs?: Franchise['playoffs'],
): { franchise: Franchise; league: League } {
  const orderSource = priorLeague ?? league;
  let nextLeague = league;

  if (!nextLeague.draftOrder?.length) {
    nextLeague = attachDraftOrder(
      nextLeague,
      buildDraftOrder(orderSource, franchise.city, franchise.name, priorPlayoffs ?? franchise.playoffs),
    );
  }

  const pick = getUserDraftPickNumber(nextLeague, franchise.city, franchise.name);
  const ticked = tickSeasonContracts(franchise);

  return {
    franchise: {
      ...ticked,
      phase: 'draft_scouting',
      draftPickNumber: pick,
      draftNight: undefined,
      draftRecap: undefined,
      freeAgents: [],
      rfaOffers: [],
    },
    league: nextLeague,
  };
}

export function formatRenewalHeadline(summary: ContractRenewalSummary): string {
  const parts: string[] = [];
  if (summary.rookieDeals.length) {
    parts.push(`${summary.rookieDeals.length} rookie deal${summary.rookieDeals.length === 1 ? '' : 's'} signed`);
  }
  if (summary.reSigned.length) {
    parts.push(`${summary.reSigned.length} player${summary.reSigned.length === 1 ? '' : 's'} re-signed`);
  }
  if (summary.expiring.length) {
    parts.push(`${summary.expiring.length} renewal${summary.expiring.length === 1 ? '' : 's'} pending`);
  }
  return parts.length ? parts.join(' · ') : 'Contract ledger updated.';
}

export function rememberRenewals(franchise: Franchise, summary: ContractRenewalSummary): Franchise {
  return {
    ...franchise,
    memory: [
      {
        id: uid('mem'),
        season: franchise.season,
        week: franchise.week,
        text: `Offseason contracts: ${formatRenewalHeadline(summary)}`,
        type: 'contract',
      },
      ...franchise.memory,
    ],
  };
}
