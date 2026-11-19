/**
 * Real NBA trade salary-matching rules (2023 CBA) with official 2026-27 thresholds, for the
 * public Trade Checker page. Separate from the game's own simplified cap (engine/cap.ts).
 *
 * Thresholds: NBA release "NBA sets Salary Cap for 2026-27 season at $164.961 million".
 * Matching bands ($7.5M / $29M, +$250K): Hoops Rumors' CBA trade-rules summary.
 */

export const NBA_SEASON = '2026-27';
export const NBA_CAP = 164_961_000;
export const NBA_TAX = 200_428_000;
export const NBA_FIRST_APRON = 209_015_000;
export const NBA_SECOND_APRON = 221_686_000;
export const MATCH_LOW_BAND = 7_500_000;
export const MATCH_HIGH_BAND = 29_000_000;
export const MATCH_PADDING = 7_500_000;
export const MATCH_ALLOWANCE = 250_000;

export type CapStatus = 'under_cap' | 'over_cap' | 'taxpayer' | 'first_apron' | 'second_apron';

export function capStatus(payroll: number): CapStatus {
  if (payroll > NBA_SECOND_APRON) return 'second_apron';
  if (payroll > NBA_FIRST_APRON) return 'first_apron';
  if (payroll > NBA_TAX) return 'taxpayer';
  if (payroll > NBA_CAP) return 'over_cap';
  return 'under_cap';
}

export const CAP_STATUS_LABEL: Record<CapStatus, string> = {
  under_cap: 'Under the cap',
  over_cap: 'Over the cap',
  taxpayer: 'Over the tax line',
  first_apron: 'Over the first apron',
  second_apron: 'Over the second apron',
};

/** Most incoming salary allowed for a team that stays under the first apron. */
export function nonApronMatch(outgoing: number): number {
  if (outgoing <= 0) return 0;
  if (outgoing <= MATCH_LOW_BAND) return outgoing * 2 + MATCH_ALLOWANCE;
  if (outgoing <= MATCH_HIGH_BAND) return outgoing + MATCH_PADDING;
  return outgoing * 1.25 + MATCH_ALLOWANCE;
}

/** Least outgoing salary that lets a non-apron team take back `incoming` (inverse of the bands). */
export function minOutgoingFor(incoming: number): number {
  const low = (incoming - MATCH_ALLOWANCE) / 2;
  if (low <= MATCH_LOW_BAND) return Math.max(0, Math.ceil(low));
  const mid = incoming - MATCH_PADDING;
  if (mid <= MATCH_HIGH_BAND) return Math.ceil(mid);
  return Math.ceil((incoming - MATCH_ALLOWANCE) / 1.25);
}

export interface TradeSide {
  name: string;
  /** Team salary before the trade. */
  payroll: number;
  /** Salaries this team sends out. */
  outgoing: number[];
}

export interface SideVerdict {
  name: string;
  ok: boolean;
  outgoing: number;
  incoming: number;
  payrollAfter: number;
  statusBefore: CapStatus;
  statusAfter: CapStatus;
  /** Most incoming salary this team could legally take for what it sends. */
  maxIncoming: number;
  rule: string;
  reason: string;
  warnings: string[];
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + (Number.isFinite(x) && x > 0 ? x : 0), 0);

/** Exact to the thousand, for official thresholds ($209.015M, not a float-rounded $209.01M). */
export function fmtExact(n: number): string {
  return `$${(Math.round(n / 1_000) / 1_000).toString()}M`;
}

export function fmtMoney(n: number): string {
  return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 1 : 2).replace(/\.?0+$/, '')}M`;
}

/** One team's side: can it take back `incomingSalaries` for what it sends? */
export function checkSide(side: TradeSide, incomingSalaries: number[]): SideVerdict {
  const outgoing = sum(side.outgoing);
  const incoming = sum(incomingSalaries);
  const payrollAfter = side.payroll - outgoing + incoming;
  const statusBefore = capStatus(side.payroll);
  const statusAfter = capStatus(payrollAfter);
  const aggregating = side.outgoing.filter((x) => x > 0).length > 1;
  const warnings: string[] = [];
  const base = { name: side.name, outgoing, incoming, payrollAfter, statusBefore, statusAfter };

  // Taking back no more than you send is always fine on salary (outside the hard-cap case below).
  // Ending under the cap (plus the allowance) works through cap room.
  const roomMax = Math.max(0, NBA_CAP + MATCH_ALLOWANCE - (side.payroll - outgoing));

  // 1) Ends above the first apron: 100% matching; above the second apron, no aggregation.
  if (payrollAfter > NBA_FIRST_APRON) {
    const maxIncoming = outgoing;
    if (aggregating) {
      warnings.push(`Combining ${side.outgoing.filter((x) => x > 0).length} salaries hard-caps ${side.name} at the second apron (${fmtMoney(NBA_SECOND_APRON)}) for the rest of the season.`);
    }
    if (payrollAfter > NBA_SECOND_APRON && aggregating) {
      return { ...base, ok: false, maxIncoming, rule: 'Second apron', reason: `Teams over the second apron can't combine salaries to match. Send one contract, or end below ${fmtMoney(NBA_SECOND_APRON)}.`, warnings };
    }
    if (incoming <= maxIncoming) {
      return { ...base, ok: true, maxIncoming, rule: 'Apron team: 100% matching', reason: `${side.name} ends over the first apron, so it can take back up to 100% of what it sends (${fmtMoney(maxIncoming)}).`, warnings };
    }
    return { ...base, ok: false, maxIncoming, rule: 'Apron team: 100% matching', reason: `${side.name} would end at ${fmtMoney(payrollAfter)}, over the first apron. Apron teams can't take back more than they send: ${fmtMoney(incoming)} in vs ${fmtMoney(outgoing)} out.`, warnings };
  }

  // 2) Ends at or under the cap (+allowance): absorbed with room.
  if (incoming <= roomMax) {
    return { ...base, ok: true, maxIncoming: Math.max(roomMax, nonApronMatch(outgoing)), rule: 'Cap room', reason: `${side.name} ends at ${fmtMoney(payrollAfter)}, within the cap (plus the $250K allowance), so no matching is needed.`, warnings };
  }

  // 3) Over the cap, ends below the first apron: the three-band matching rule (or room, if bigger).
  const matchMax = nonApronMatch(outgoing);
  const band =
    outgoing <= MATCH_LOW_BAND ? `200% + $250K (sending ≤ ${fmtMoney(MATCH_LOW_BAND)})`
    : outgoing <= MATCH_HIGH_BAND ? `salary + ${fmtMoney(MATCH_PADDING)} (sending ${fmtMoney(MATCH_LOW_BAND)}–${fmtMoney(MATCH_HIGH_BAND)})`
    : `125% + $250K (sending over ${fmtMoney(MATCH_HIGH_BAND)})`;
  if (incoming <= matchMax) {
    return { ...base, ok: true, maxIncoming: matchMax, rule: `Matching: ${band}`, reason: `Sending ${fmtMoney(outgoing)} lets ${side.name} take back up to ${fmtMoney(matchMax)}.`, warnings };
  }
  return { ...base, ok: false, maxIncoming: matchMax, rule: `Matching: ${band}`, reason: `Sending ${fmtMoney(outgoing)} only allows ${fmtMoney(matchMax)} back; this trade brings in ${fmtMoney(incoming)}. To take it, send at least ${fmtMoney(minOutgoingFor(incoming))}, or take less back.`, warnings };
}

export function checkTrade(a: TradeSide, b: TradeSide): { ok: boolean; sides: [SideVerdict, SideVerdict] } {
  const va = checkSide(a, b.outgoing);
  const vb = checkSide(b, a.outgoing);
  return { ok: va.ok && vb.ok, sides: [va, vb] };
}
