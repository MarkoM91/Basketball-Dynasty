/**
 * Real NBA luxury tax and maximum-contract rules (2023 CBA, 2026-27 figures) for the public
 * calculator pages. Separate from the game's own simplified cap (engine/cap.ts).
 *
 * Tax brackets and rates: Hoops Rumors' luxury tax glossary (2026-27 brackets of $6,064,000).
 * Max contract tiers and raises: Hoops Rumors' maximum salary projections; cap: NBA release.
 */
import { NBA_CAP, NBA_TAX } from './nbaTradeRules';

export const TAX_BRACKET = 6_064_000;
const STANDARD_RATES = [1.0, 1.25, 3.5, 4.75];
const REPEATER_RATES = [3.0, 3.25, 5.5, 6.75];
/** Every bracket past the fourth costs $0.50 more per dollar than the one before. */
const STEP = 0.5;

export function taxRate(bracket: number, repeater: boolean): number {
  const rates = repeater ? REPEATER_RATES : STANDARD_RATES;
  if (bracket < rates.length) return rates[bracket];
  return rates[rates.length - 1] + (bracket - rates.length + 1) * STEP;
}

export interface TaxBracketLine {
  bracket: number;
  from: number;
  to: number;
  rate: number;
  taxed: number;
  tax: number;
}

export interface TaxBill {
  payroll: number;
  over: number;
  tax: number;
  lines: TaxBracketLine[];
  /** Rate on the next dollar of salary. */
  marginalRate: number;
}

export function luxuryTax(payroll: number, repeater: boolean): TaxBill {
  const over = Math.max(0, payroll - NBA_TAX);
  const lines: TaxBracketLine[] = [];
  let left = over;
  let bracket = 0;
  while (left > 0 && bracket < 40) {
    const taxed = Math.min(left, TAX_BRACKET);
    const rate = taxRate(bracket, repeater);
    lines.push({ bracket: bracket + 1, from: bracket * TAX_BRACKET, to: (bracket + 1) * TAX_BRACKET, rate, taxed, tax: taxed * rate });
    left -= taxed;
    bracket += 1;
  }
  const tax = lines.reduce((s, l) => s + l.tax, 0);
  // The next dollar lands in the bracket that contains `over` (a full bracket rolls to the next).
  return { payroll, over, tax, lines, marginalRate: over > 0 ? taxRate(Math.floor(over / TAX_BRACKET), repeater) : 0 };
}

/** What adding a contract really costs this season: salary plus the extra luxury tax. */
export function trueCostOfSalary(payroll: number, salary: number, repeater: boolean): { extraTax: number; total: number } {
  const extraTax = luxuryTax(payroll + salary, repeater).tax - luxuryTax(payroll, repeater).tax;
  return { extraTax, total: salary + extraTax };
}

// ── Maximum contracts ────────────────────────────────────────────────────────
export type ServiceTier = 'young' | 'mid' | 'veteran';

export const SERVICE_TIERS: Record<ServiceTier, { label: string; pct: number }> = {
  young: { label: '0–6 years in the NBA', pct: 0.25 },
  mid: { label: '7–9 years', pct: 0.3 },
  veteran: { label: '10+ years', pct: 0.35 },
};

export interface MaxContract {
  firstYear: number;
  /** Which rule set the starting salary: the tier max or 105% of his previous salary. */
  basis: 'tier' | 'previous_salary';
  raisePct: number;
  years: { season: string; salary: number }[];
  total: number;
}

const seasonLabel = (offset: number) => {
  const start = 2026 + offset;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

/**
 * Max starting salary is the tier share of the cap, or 105% of the player's previous salary if
 * that is higher. Raises are a percentage of the first-year salary: 8% a year (up to 5 years)
 * re-signing with his own team, 5% (up to 4 years) with a new team.
 */
export function maxContract(opts: {
  tier: ServiceTier;
  ownTeam: boolean;
  years: number;
  previousSalary?: number;
}): MaxContract {
  const tierMax = Math.round(NBA_CAP * SERVICE_TIERS[opts.tier].pct);
  const fromPrevious = Math.round((opts.previousSalary ?? 0) * 1.05);
  const firstYear = Math.max(tierMax, fromPrevious);
  const raisePct = opts.ownTeam ? 0.08 : 0.05;
  const maxYears = opts.ownTeam ? 5 : 4;
  const length = Math.max(1, Math.min(maxYears, opts.years));
  const years = Array.from({ length }, (_, i) => ({
    season: seasonLabel(i),
    salary: Math.round(firstYear + firstYear * raisePct * i),
  }));
  return {
    firstYear,
    basis: fromPrevious > tierMax ? 'previous_salary' : 'tier',
    raisePct,
    years,
    total: years.reduce((s, y) => s + y.salary, 0),
  };
}

export function fmtDollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
