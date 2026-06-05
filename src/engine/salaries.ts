import { CAP_LIMIT, MIN_SALARY } from './cap';

export function roundSalary(amount: number): number {
  return Math.round(amount / 100_000) * 100_000;
}

/** Approximate max annual salary for a player of this caliber (2025-26 scale). */
export function maxAnnualSalary(overall: number, yearsInLeague = 8): number {
  const pct = yearsInLeague >= 10 ? 0.35 : yearsInLeague >= 7 ? 0.3 : 0.25;
  const capMax = CAP_LIMIT * pct;
  if (overall >= 92) return roundSalary(Math.min(capMax, 52_000_000));
  if (overall >= 88) return roundSalary(Math.min(capMax, 42_000_000));
  if (overall >= 85) return roundSalary(Math.min(capMax, 35_000_000));
  return roundSalary(capMax * 0.85);
}

/** Free-agent / open-market value from overall and age. */
export function marketSalary(overall: number, age = 25): number {
  let base: number;
  if (overall >= 92) base = 46_000_000 + (overall - 92) * 1_500_000;
  else if (overall >= 88) base = 30_000_000 + (overall - 88) * 4_000_000;
  else if (overall >= 84) base = 20_000_000 + (overall - 84) * 2_500_000;
  else if (overall >= 80) base = 13_000_000 + (overall - 80) * 1_750_000;
  else if (overall >= 76) base = 7_500_000 + (overall - 76) * 1_375_000;
  else if (overall >= 72) base = 4_200_000 + (overall - 72) * 825_000;
  else if (overall >= 68) base = 2_100_000 + (overall - 68) * 525_000;
  else base = MIN_SALARY + Math.max(0, overall - 60) * 125_000;

  const ageFactor = age <= 22 ? 0.88 : age <= 25 ? 0.96 : age <= 29 ? 1 : age <= 32 ? 0.94 : 0.82;
  return roundSalary(Math.min(base * ageFactor, maxAnnualSalary(overall)));
}

/** NBA rookie scale — pick 1 ~ $10.5M, pick 30 ~ $2.4M in year one. */
export function rookieScaleSalary(pick: number, contractYear = 1): number {
  const slot = Math.max(1, Math.min(30, pick));
  const year1 = 10_500_000 * Math.pow(0.915, slot - 1);
  const multipliers = [1, 1.2, 1.4, 1.799];
  const year = Math.max(1, Math.min(4, contractYear));
  return roundSalary(year1 * multipliers[year - 1]);
}

export function freeAgentAskingSalary(overall: number, age: number): number {
  const ask = marketSalary(overall, age);
  if (overall >= 82) return roundSalary(ask * 1.04);
  if (overall >= 78) return roundSalary(ask * 1.02);
  return ask;
}

export function depthFillerSalary(overall: number, age = 24): number {
  return marketSalary(Math.min(overall, 76), age);
}

export function renewalSalary(current: number, overall: number, age = 26): number {
  const market = marketSalary(overall, age);
  const bump = overall >= 82 ? 1.08 : overall >= 75 ? 1.04 : 0.96;
  return roundSalary(Math.min(Math.max(current * bump, market * 0.92), market * 1.12));
}

/** Fix saves with broken ovr² salary formulas. */
export function normalizeContractSalary(overall: number, age: number, current: number): number {
  const market = marketSalary(overall, age);
  const ceiling = maxAnnualSalary(overall);
  if (current <= ceiling * 1.05 && current >= MIN_SALARY) return current;
  if (current > ceiling * 1.2 || current > market * 2) return market;
  return current;
}

export function isMaxContract(overall: number, salary: number): boolean {
  return overall >= 88 && salary >= maxAnnualSalary(overall) * 0.95;
}
