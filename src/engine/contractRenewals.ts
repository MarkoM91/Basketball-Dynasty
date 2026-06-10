import type { Coach, Franchise, Player } from '../types/game';
import { uid } from '../data/scenarios';
import { fireCoach } from './coaches';
import { canRenewWithBirdRights } from './cap';
import { renewalSalary, roundSalary } from './salaries';

export function expiringPlayers(franchise: Franchise): Player[] {
  return franchise.roster.filter((p) => p.contract.yearsRemaining === 0 || p.contract.isExpiring);
}

export function coachNeedsRenewal(franchise: Franchise): boolean {
  if (franchise.coach.name.includes('Interim')) return false;
  return (franchise.coach.contractYearsRemaining ?? 0) === 0;
}

export function pendingRenewalCount(franchise: Franchise): number {
  return expiringPlayers(franchise).length + (coachNeedsRenewal(franchise) ? 1 : 0);
}

export function playerRenewalTerms(player: Player): { years: number; salary: number } {
  return {
    years: player.isStar || player.role === 'Franchise Player' || player.role === 'Star' ? 3 : 2,
    salary: renewalSalary(player.contract.annualSalary, player.overall, player.age),
  };
}

export function coachRenewalTerms(coach: Coach): { years: number; salary: number } {
  return {
    years: 3,
    salary: roundSalary(2_500_000 + coach.devRating * 45_000 + coach.playoffRating * 35_000),
  };
}

export function renewPlayerContract(franchise: Franchise, playerId: string): Franchise {
  const player = franchise.roster.find((p) => p.id === playerId);
  if (!player || player.contract.yearsRemaining > 0) return franchise;

  const { years, salary } = playerRenewalTerms(player);
  const birdCheck = canRenewWithBirdRights(franchise, player, salary);
  if (!birdCheck.ok) return franchise;

  const name = `${player.firstName} ${player.lastName}`;

  return {
    ...franchise,
    roster: franchise.roster.map((p) =>
      p.id === playerId
        ? {
            ...p,
            contract: {
              ...p.contract,
              yearsRemaining: years,
              annualSalary: salary,
              isExpiring: false,
              birdYears: (p.contract.birdYears ?? 1) + 1,
            },
          }
        : p,
    ),
    memory: [
      {
        id: uid('mem'),
        season: franchise.season,
        week: franchise.week,
        text: `Re-signed ${name} — ${years} years at $${(salary / 1_000_000).toFixed(1)}M.`,
        type: 'contract',
      },
      ...franchise.memory,
    ],
  };
}

export function releaseExpiringPlayer(franchise: Franchise, playerId: string): Franchise {
  const player = franchise.roster.find((p) => p.id === playerId);
  if (!player) return franchise;

  const name = `${player.firstName} ${player.lastName}`;
  let next: Franchise = {
    ...franchise,
    roster: franchise.roster.filter((p) => p.id !== playerId),
    pendingFreeAgents: [...(franchise.pendingFreeAgents ?? []), player],
    memory: [
      {
        id: uid('mem'),
        season: franchise.season,
        week: franchise.week,
        text: `Did not renew ${name} — they hit unrestricted free agency.`,
        type: 'contract',
      },
      ...franchise.memory,
    ],
  };

  if (player.isStar || player.role === 'Star' || player.role === 'Franchise Player') {
    next = {
      ...next,
      starHappiness: 'Angry',
      lockerRoom: 'Concerned',
      jobSecurity: Math.max(5, next.jobSecurity - 6),
    };
  }

  return next;
}

export function renewCoachContract(franchise: Franchise): Franchise {
  if (!coachNeedsRenewal(franchise)) return franchise;

  const { years, salary } = coachRenewalTerms(franchise.coach);

  return {
    ...franchise,
    coach: {
      ...franchise.coach,
      contractYearsRemaining: years,
      annualSalary: salary,
    },
    jobSecurity: Math.min(99, franchise.jobSecurity + 2),
    memory: [
      {
        id: uid('mem'),
        season: franchise.season,
        week: franchise.week,
        text: `Extended ${franchise.coach.name} — ${years} years, $${(salary / 1_000_000).toFixed(1)}M per season.`,
        type: 'contract',
      },
      ...franchise.memory,
    ],
  };
}

export function declineCoachRenewal(franchise: Franchise): Franchise {
  if (!coachNeedsRenewal(franchise)) return franchise;
  return fireCoach(franchise);
}
