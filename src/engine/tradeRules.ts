import type { DraftPick, Franchise } from '../types/game';
import { CAP_LIMIT, formatCap, pickKey } from './cap';

/** NBA Stepien — cannot trade first-round picks in consecutive future years in one deal. */
export function stepienViolation(outgoingFirsts: DraftPick[]): string | null {
  const years = outgoingFirsts
    .filter((p) => p.round === 1)
    .map((p) => p.year)
    .sort((a, b) => a - b);

  for (let i = 0; i < years.length - 1; i += 1) {
    if (years[i + 1] - years[i] === 1) {
      return `Stepien rule: cannot trade the ${years[i]} and ${years[i + 1]} first-round picks — consecutive future firsts are frozen.`;
    }
  }

  return null;
}

export function minimumOutgoingForIncoming(
  payroll: number,
  hardCapped: boolean,
  targetIncomingSalary: number,
): number {
  if (targetIncomingSalary <= 0) return 0;
  const room = Math.max(0, CAP_LIMIT - payroll);

  if (hardCapped || payroll > CAP_LIMIT) {
    return targetIncomingSalary;
  }

  const needAfterRoom = Math.max(0, targetIncomingSalary - room);
  if (needAfterRoom <= 100_000) return 0;
  return Math.ceil((needAfterRoom - 100_000) / 1.25);
}

export function salaryMatchSummary(
  payroll: number,
  hardCapped: boolean,
  incomingSalary: number,
  outgoingSalary: number,
  maxIncoming: number,
  ok: boolean,
): string {
  if (incomingSalary === 0 && outgoingSalary === 0) {
    return 'Pick-only deal — no salary matching required.';
  }

  if (ok) {
    const delta = incomingSalary - outgoingSalary;
    if (delta > 0) {
      return `Legal match — you absorb ${formatCap(delta)} more payroll.`;
    }
    if (delta < 0) {
      return `Legal match — you shed ${formatCap(-delta)} for flexibility.`;
    }
    return 'Salary-neutral trade — books stay flat.';
  }

  const gap = incomingSalary - maxIncoming;
  const minOut = minimumOutgoingForIncoming(payroll, hardCapped, incomingSalary);
  const addOut = Math.max(0, minOut - outgoingSalary);

  if (hardCapped) {
    return `Second apron: send at least ${formatCap(incomingSalary)} out to receive ${formatCap(incomingSalary)} back (1-for-1).`;
  }

  if (addOut > 0) {
    return `Need ~${formatCap(addOut)} more outgoing salary (or a matching contract) to unlock this package. Max you can take back: ${formatCap(maxIncoming)}.`;
  }

  return `Over the matching limit by ${formatCap(gap)}. Max incoming allowed: ${formatCap(maxIncoming)}.`;
}

export function outgoingPickKeysToPicks(
  franchise: Franchise,
  keys: string[],
): DraftPick[] {
  return keys
    .map((k) => franchise.draftPicks.find((p) => pickKey(p) === k))
    .filter(Boolean) as DraftPick[];
}
