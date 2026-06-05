import type { Franchise } from '../types/game';
import { formatMoney } from '../data/scenarios';
import { computePayroll, estimateTaxBill } from './cap';

export interface TeamFinances {
  ticketPrice: number;
  attendance: number;
  capacity: number;
  revenue: {
    tickets: number;
    media: number;
    merch: number;
    total: number;
  };
  expenses: {
    payroll: number;
    luxuryTax: number;
    facilities: number;
    scouting: number;
    total: number;
  };
  profit: number;
  cashOnHand: number;
}

const MARKET_CAPACITY: Record<Franchise['market'], number> = {
  Large: 19_500,
  Mid: 17_000,
  Small: 15_500,
};

export function computeTeamFinances(franchise: Franchise): TeamFinances {
  const payroll = computePayroll(franchise);
  const luxuryTax = estimateTaxBill(payroll);
  const capacity = MARKET_CAPACITY[franchise.market];
  const winPct = franchise.record.wins / Math.max(1, franchise.record.wins + franchise.record.losses);

  const ticketPrice = Math.round(
    ((franchise.market === 'Large' ? 78 : franchise.market === 'Mid' ? 62 : 48) +
      winPct * 35 +
      (franchise.playoffOdds / 100) * 18) *
      (1 + (franchise.ticketPriceBias ?? 0) / 100),
  );

  const fillRate = 0.55 + winPct * 0.35 + (franchise.fanMood === 'Happy' ? 0.08 : franchise.fanMood === 'Angry' ? -0.12 : 0) - (franchise.ticketPriceBias ?? 0) * 0.004;
  const homeGames = 39;
  const attendance = Math.round(capacity * Math.min(0.99, fillRate));
  const tickets = ticketPrice * attendance * homeGames;
  const media =
    (franchise.market === 'Large' ? 48_000_000 : franchise.market === 'Mid' ? 32_000_000 : 22_000_000) *
    (0.85 + winPct * 0.3);
  const merch = 8_000_000 + winPct * 14_000_000 + (franchise.starHappiness === 'Happy' ? 2_000_000 : 0);
  const facilities = franchise.market === 'Large' ? 9_500_000 : franchise.market === 'Mid' ? 7_000_000 : 5_500_000;
  const scoutingLevel = franchise.scoutingBudget ?? 5;
  const scouting = 2_500_000 + (scoutingLevel / 10) * 7_500_000 + (franchise.coach.devRating / 100) * 1_500_000;

  const revenueTotal = Math.round(tickets + media + merch);
  const expenseTotal = Math.round(payroll + luxuryTax + facilities + scouting);
  const profit = revenueTotal - expenseTotal;

  return {
    ticketPrice,
    attendance,
    capacity,
    revenue: {
      tickets: Math.round(tickets),
      media: Math.round(media),
      merch: Math.round(merch),
      total: revenueTotal,
    },
    expenses: {
      payroll,
      luxuryTax,
      facilities,
      scouting,
      total: expenseTotal,
    },
    profit,
    cashOnHand: Math.max(0, profit + franchise.jobSecurity * 250_000),
  };
}

export function formatFin(n: number): string {
  return formatMoney(n);
}
