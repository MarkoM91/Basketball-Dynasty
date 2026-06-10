import type { Contract, Franchise, LeagueTeam, Player } from '../types/game';
import { maxAnnualSalary } from './salaries';

export const CAP_LIMIT = 140_000_000;
export const LUXURY_TAX_LINE = 170_000_000;
export const SECOND_APRON = 189_000_000;
export const NON_TAXPAYER_MLE = 12_800_000;
export const TAXPAYER_MLE = 5_000_000;
export const BAE = 4_700_000;
export const MIN_SALARY = 1_100_000;
/** Standard roster spots counted on the offseason cap sheet (NBA ~14). */
export const MIN_CAP_ROSTER = 14;

export function computeRosterSalary(franchise: Franchise): number {
  return (franchise.roster ?? []).reduce((s, p) => s + (p.contract?.annualSalary ?? 0), 0);
}

/** True during the renewal / FA window when unsigned players sit on holds. */
export function isOffseasonCapWindow(phase: Franchise['phase']): boolean {
  return phase === 'contract_renewals' || phase === 'free_agency';
}

export function birdRightsLabel(years: number): string {
  if (years >= 4) return 'Full Bird — can re-sign to max without cap space';
  if (years === 3) return 'Early Bird — significant raise without using room';
  if (years >= 2) return 'Non-Bird — limited raise rights';
  return 'No Bird rights — needs cap room or exception';
}

export function maxExtensionEstimate(player: Player): number {
  if (player.contract.birdYears && player.contract.birdYears >= 3) {
    return Math.min(CAP_LIMIT * 0.35, player.contract.annualSalary * 1.4 + 8_000_000);
  }
  return player.contract.annualSalary * 1.15;
}

export function estimateTaxBill(payroll: number): number {
  if (payroll <= LUXURY_TAX_LINE) return 0;
  const over = payroll - LUXURY_TAX_LINE;
  let bill = 0;
  if (over <= 5_000_000) bill = over * 1.5;
  else if (over <= 10_000_000) bill = 5_000_000 * 1.5 + (over - 5_000_000) * 1.75;
  else bill = 5_000_000 * 1.5 + 5_000_000 * 1.75 + (over - 10_000_000) * 2.5;
  return Math.round(bill);
}

export function capHoldAmount(player: Player): number {
  if (player.contract.yearsRemaining > 0) return 0;
  const years = player.contract.birdYears ?? 0;
  const prior = player.contract.annualSalary;

  if (player.contract.isRestricted && years >= 2) {
    return Math.round(Math.max(prior * 1.09, MIN_SALARY * 2));
  }
  if (years >= 4) return Math.min(Math.max(prior * 1.2, CAP_LIMIT * 0.25), CAP_LIMIT * 0.35);
  if (years >= 3) return Math.round(prior * 1.3);
  if (years >= 2) return Math.round(prior * 0.9);
  return 0;
}

export function computeCapHolds(franchise: Franchise): Franchise['cap']['capHolds'] {
  if (!isOffseasonCapWindow(franchise.phase)) return [];
  return (franchise.roster ?? [])
    .filter((p) => (p.contract?.yearsRemaining ?? 0) === 0)
    .map((p) => ({
      playerId: p.id,
      name: `${p.firstName} ${p.lastName}`,
      amount: capHoldAmount(p),
    }))
    .filter((h) => h.amount > 0);
}

export function computeIncompleteRosterCharge(franchise: Franchise): number {
  if (!isOffseasonCapWindow(franchise.phase)) return 0;
  const signed = (franchise.roster ?? []).filter((p) => (p.contract?.yearsRemaining ?? 0) > 0).length;
  const gap = Math.max(0, MIN_CAP_ROSTER - signed);
  return gap * MIN_SALARY;
}

/** Payroll counted against the salary cap (NBA cap sheet). */
export function computeCapSheetPayroll(franchise: Franchise): number {
  const dead = franchise.cap?.deadMoney ?? 0;
  const offseason = isOffseasonCapWindow(franchise.phase);

  let salary = dead;
  for (const p of franchise.roster ?? []) {
    if (offseason && (p.contract?.yearsRemaining ?? 0) === 0) continue;
    salary += p.contract?.annualSalary ?? 0;
  }

  return salary + computeIncompleteRosterCharge(franchise);
}

export function computePayroll(franchise: Franchise): number {
  return computeCapSheetPayroll(franchise);
}

export function canRenewWithBirdRights(
  franchise: Franchise,
  player: Player,
  newSalary: number,
): { ok: boolean; reason: string } {
  const birds = player.contract.birdYears ?? 0;
  const prior = player.contract.annualSalary;
  if (birds >= 4 && newSalary <= maxAnnualSalary(player.overall)) {
    return { ok: true, reason: 'Full Bird — re-sign over the cap.' };
  }
  if (birds >= 3 && newSalary <= Math.round(prior * 1.75)) {
    return { ok: true, reason: 'Early Bird raise allowed.' };
  }
  if (birds >= 2 && newSalary <= Math.round(prior * 1.2)) {
    return { ok: true, reason: 'Non-Bird limited raise.' };
  }
  const room = franchise.cap.effectiveRoom ?? franchise.cap.projectedRoom;
  if (room >= newSalary) {
    return { ok: true, reason: 'Fits in usable cap room.' };
  }
  return { ok: false, reason: 'Need Bird rights or cap room for this deal.' };
}

export function applySigningToCap(
  cap: Franchise['cap'],
  salary: number,
  useException?: string,
): Franchise['cap'] {
  const payroll = cap.payroll + salary;
  const mleUsed = cap.mleUsed || useException === 'MLE';
  const baeUsed = cap.baeUsed || useException === 'BAE';
  return {
    ...cap,
    payroll,
    mleUsed,
    baeUsed,
  };
}

export function computeCapOutlook(franchise: Franchise): Franchise['cap'] {
  const rosterSalary = computeRosterSalary(franchise);
  const capSheetPayroll = computeCapSheetPayroll(franchise);
  const incompleteRosterCharge = computeIncompleteRosterCharge(franchise);
  const inLuxuryTax = capSheetPayroll > LUXURY_TAX_LINE;
  const inSecondApron = capSheetPayroll > SECOND_APRON;
  const projectedRoom = Math.max(0, CAP_LIMIT - capSheetPayroll);
  const capHolds = computeCapHolds(franchise);
  const capHoldsTotal = capHolds.reduce((s, h) => s + h.amount, 0);
  const effectiveRoom = inSecondApron || capSheetPayroll >= CAP_LIMIT
    ? 0
    : Math.max(0, projectedRoom - capHoldsTotal);
  const mleUsed = franchise.cap?.mleUsed ?? false;
  const baeUsed = franchise.cap?.baeUsed ?? false;
  const mleAvailable = mleUsed ? 0 : inLuxuryTax ? TAXPAYER_MLE : NON_TAXPAYER_MLE;
  const roomAvailable = effectiveRoom;
  const baeAvailable = inLuxuryTax || baeUsed ? 0 : BAE;
  const taxBill = estimateTaxBill(capSheetPayroll);
  const warnings: string[] = [];

  if (capHoldsTotal > 0 && isOffseasonCapWindow(franchise.phase)) {
    warnings.push(
      `${capHolds.length} unsigned player${capHolds.length === 1 ? '' : 's'} reserve ${formatCap(capHoldsTotal)} — re-sign or renounce to clear room.`,
    );
  }

  if (incompleteRosterCharge > 0) {
    warnings.push(
      `Incomplete roster charge: ${formatCap(incompleteRosterCharge)} (${MIN_CAP_ROSTER} spots required on the cap sheet).`,
    );
  }

  if (capSheetPayroll >= CAP_LIMIT && !inSecondApron) {
    warnings.push('Over the salary cap — signings require Bird rights or a trade exception (MLE / minimum).');
  }

  if (inSecondApron) {
    warnings.push('Second apron: hard-capped. Cannot use MLE, BAE, or take back more salary in trades.');
  } else if (inLuxuryTax) {
    warnings.push(`Luxury tax active — projected bill ${formatCap(taxBill)}. Ownership expects deep playoff run.`);
  } else if (capSheetPayroll > CAP_LIMIT * 0.95) {
    warnings.push('Approaching cap ceiling. Room exceptions shrink with every signing.');
  }

  const star = franchise.roster.find((p) => p.isStar);
  if (star && (star.contract?.yearsRemaining ?? 0) <= 1) {
    const maxEst = maxExtensionEstimate(star);
    warnings.push(
      `Extending ${star.firstName} ${star.lastName} (~${formatCap(maxEst)}/yr) uses ${birdRightsLabel(star.contract?.birdYears ?? 0)}.`,
    );
  }

  const badContracts = (franchise.roster ?? []).filter(
    (p) => (p.contract?.annualSalary ?? 0) > 18_000_000 && p.overall < 76,
  );
  if (badContracts.length) {
    warnings.push(`${badContracts[0].firstName} ${badContracts[0].lastName} on an albatross deal — limits trade flexibility.`);
  }

  return {
    payroll: capSheetPayroll,
    rosterSalary,
    capSheetPayroll,
    incompleteRosterCharge,
    capLimit: CAP_LIMIT,
    luxuryTaxLine: LUXURY_TAX_LINE,
    secondApron: SECOND_APRON,
    inLuxuryTax,
    inSecondApron,
    projectedRoom,
    effectiveRoom,
    capHoldsTotal,
    capHolds,
    deadMoney: franchise.cap?.deadMoney ?? 0,
    taxBill,
    mleAvailable,
    mleUsed,
    roomAvailable,
    baeAvailable,
    baeUsed,
    hardCapped: inSecondApron,
    warnings,
  };
}

/** AI team cap check — simplified payroll estimate. */
export function canSignFreeAgentAtPayroll(
  payroll: number,
  salary: number,
  taxAverse: boolean,
): { ok: boolean; reason: string; useException?: string } {
  const room = Math.max(0, CAP_LIMIT - payroll);
  if (room >= salary) return { ok: true, reason: 'Cap room', useException: 'Room' };
  if (taxAverse && payroll + salary > LUXURY_TAX_LINE) {
    return { ok: false, reason: 'Tax averse' };
  }
  if (payroll <= LUXURY_TAX_LINE && salary <= NON_TAXPAYER_MLE) {
    return { ok: true, reason: 'MLE', useException: 'MLE' };
  }
  if (salary <= TAXPAYER_MLE) return { ok: true, reason: 'Tax MLE', useException: 'MLE' };
  if (salary <= MIN_SALARY * 1.5) return { ok: true, reason: 'Minimum', useException: 'Minimum' };
  return { ok: false, reason: 'No room' };
}

export function canSignFreeAgent(
  franchise: Franchise,
  salary: number,
  via: Contract['signedVia'] = 'standard',
): { ok: boolean; reason: string; useException?: string } {
  const cap = franchise.cap;

  if (via === 'minimum') {
    return { ok: true, reason: 'Minimum contract fits under any exception.', useException: 'Minimum' };
  }

  if (salary <= MIN_SALARY * 1.2) {
    return { ok: true, reason: 'Two-way / minimum slot.', useException: 'Minimum' };
  }

  if (cap.effectiveRoom >= salary) {
    return { ok: true, reason: `Fits in ${formatCap(cap.effectiveRoom)} usable room.`, useException: 'Room' };
  }

  if (cap.mleUsed) {
    // MLE already consumed — skip MLE paths below
  } else if (!cap.inLuxuryTax && salary <= cap.mleAvailable) {
    return { ok: true, reason: `Non-taxpayer MLE (${formatCap(cap.mleAvailable)}).`, useException: 'MLE' };
  }

  if (cap.mleUsed) {
    // skip
  } else if (cap.inLuxuryTax && !cap.inSecondApron && salary <= TAXPAYER_MLE) {
    return { ok: true, reason: `Taxpayer MLE (${formatCap(TAXPAYER_MLE)}).`, useException: 'MLE' };
  }

  if (cap.inSecondApron) {
    return { ok: false, reason: 'Second apron team cannot exceed hard cap with new signings.' };
  }

  return {
    ok: false,
    reason: `Need ${formatCap(Math.max(0, salary - cap.effectiveRoom))} more usable room or an exception. MLE may not cover this ask.`,
  };
}

export function validateTradeSalaryMatchAtPayroll(
  payroll: number,
  hardCapped: boolean,
  incomingSalary: number,
  outgoingSalary: number,
): {
  ok: boolean;
  message: string;
  allowedIncoming: number;
  maxIncoming: number;
  projectedPayroll: number;
  inLuxuryTax: boolean;
  matchingBasis: 'under_cap' | 'over_cap' | 'second_apron';
} {
  const delta = incomingSalary - outgoingSalary;
  const projectedPayroll = payroll + delta;
  const inLuxuryTax = projectedPayroll > LUXURY_TAX_LINE;
  const atSecondApron = hardCapped || payroll >= SECOND_APRON;

  if (atSecondApron) {
    const maxIncoming = outgoingSalary;
    if (incomingSalary <= maxIncoming && projectedPayroll <= SECOND_APRON) {
      return {
        ok: true,
        message: 'Second apron — 1-for-1 salary match valid.',
        allowedIncoming: maxIncoming,
        maxIncoming,
        projectedPayroll,
        inLuxuryTax: true,
        matchingBasis: 'second_apron',
      };
    }
    if (incomingSalary > outgoingSalary) {
      return {
        ok: false,
        message: `Second apron teams cannot take back more than they send (max ${formatCap(outgoingSalary)}).`,
        allowedIncoming: maxIncoming,
        maxIncoming,
        projectedPayroll,
        inLuxuryTax: true,
        matchingBasis: 'second_apron',
      };
    }
    return {
      ok: false,
      message: 'Trade would exceed second apron hard cap.',
      allowedIncoming: maxIncoming,
      maxIncoming,
      projectedPayroll,
      inLuxuryTax: true,
      matchingBasis: 'second_apron',
    };
  }

  if (payroll < CAP_LIMIT) {
    const room = CAP_LIMIT - payroll;
    const matchAllowance = outgoingSalary * 1.25 + 100_000;
    const maxIncoming = matchAllowance + room;
    if (incomingSalary <= maxIncoming) {
      return {
        ok: true,
        message: room > 0
          ? `Under cap — ${formatCap(room)} room plus matching covers this deal.`
          : 'Salary matching valid — team under cap.',
        allowedIncoming: matchAllowance,
        maxIncoming,
        projectedPayroll,
        inLuxuryTax,
        matchingBasis: 'under_cap',
      };
    }
    return {
      ok: false,
      message: `Max incoming ${formatCap(maxIncoming)} (${formatCap(room)} cap room + ${formatCap(matchAllowance)} from matching). You're ${formatCap(incomingSalary - maxIncoming)} over.`,
      allowedIncoming: matchAllowance,
      maxIncoming,
      projectedPayroll,
      inLuxuryTax,
      matchingBasis: 'under_cap',
    };
  }

  const maxIncoming = outgoingSalary * 1.25 + 100_000;
  if (incomingSalary <= maxIncoming) {
    return {
      ok: true,
      message: 'Over-cap — 125% + $100K matching satisfied.',
      allowedIncoming: maxIncoming,
      maxIncoming,
      projectedPayroll,
      inLuxuryTax,
      matchingBasis: 'over_cap',
    };
  }

  return {
    ok: false,
    message: `125% + $100K rule — max incoming ${formatCap(maxIncoming)} with current outgoing salary.`,
    allowedIncoming: maxIncoming,
    maxIncoming,
    projectedPayroll,
    inLuxuryTax,
    matchingBasis: 'over_cap',
  };
}

/** Stable payroll estimate for AI teams without full rosters. */
export function estimateTeamPayroll(team: LeagueTeam): number {
  let hash = 0;
  for (let i = 0; i < team.id.length; i += 1) {
    hash = (hash * 31 + team.id.charCodeAt(i)) | 0;
  }
  const jitter = (Math.abs(hash) % 7_000_000) - 3_500_000;

  let payroll = 122_000_000 + (88 - team.strength) * 750_000 + jitter;
  if (team.strategy === 'all_in') payroll += 24_000_000;
  else if (team.strategy === 'rebuild') payroll -= 20_000_000;
  else if (team.strategy === 'retool') payroll -= 8_000_000;
  if (team.taxAverse) payroll -= 14_000_000;

  return Math.round(Math.max(98_000_000, Math.min(SECOND_APRON - 1_500_000, payroll)));
}

export function capTradeScoreAdjust(
  team: LeagueTeam,
  salaryIn: number,
  salaryOut: number,
): { scoreAdjust: number; note: string } {
  const payroll = estimateTeamPayroll(team);
  const delta = salaryIn - salaryOut;
  const after = payroll + delta;
  const match = validateTradeSalaryMatchAtPayroll(
    payroll,
    payroll > SECOND_APRON,
    salaryIn,
    salaryOut,
  );

  if (!match.ok) {
    return {
      scoreAdjust: -28,
      note: `Cap office would block this — ${match.message.toLowerCase()}`,
    };
  }

  let scoreAdjust = 0;
  const notes: string[] = [];

  if (team.taxAverse) {
    if (delta > 4_000_000) {
      scoreAdjust -= 14;
      notes.push('ownership avoids adding payroll');
    }
    if (after > LUXURY_TAX_LINE) {
      scoreAdjust -= 18;
      notes.push('would cross luxury tax');
    }
    if (delta < -3_000_000) {
      scoreAdjust += 10;
      notes.push('creates cap flexibility');
    }
  } else if (team.strategy === 'all_in' && delta > 0 && after <= LUXURY_TAX_LINE + 8_000_000) {
    scoreAdjust += 5;
    notes.push('win-now team willing to absorb salary');
  }

  if (after > SECOND_APRON - 3_000_000 && delta > 0) {
    scoreAdjust -= 12;
    notes.push('pushes toward second apron');
  }

  if (after > LUXURY_TAX_LINE && delta > 6_000_000 && !team.taxAverse) {
    scoreAdjust -= 8;
    notes.push('significant tax bill incoming');
  }

  const note =
    notes.length > 0
      ? `Cap angle: ${notes.join('; ')}.`
      : delta > 2_000_000
        ? `Adds ${formatCap(delta)} to their books.`
        : delta < -2_000_000
          ? `Sheds ${formatCap(-delta)} from their payroll.`
          : 'Neutral cap impact for partner.';

  return { scoreAdjust, note };
}

export function userTradeCapWarnings(
  franchise: Franchise,
  incomingSalary: number,
  outgoingSalary: number,
): { warnings: string[]; projectedPayroll: number; match: ReturnType<typeof validateTradeSalaryMatchAtPayroll> } {
  const match = validateTradeSalaryMatchAtPayroll(
    franchise.cap.payroll,
    franchise.cap.inSecondApron,
    incomingSalary,
    outgoingSalary,
  );
  const warnings: string[] = [];
  const delta = incomingSalary - outgoingSalary;

  if (!match.ok) {
    warnings.push(match.message);
  } else if (delta > 0) {
    warnings.push(`Your payroll rises by ${formatCap(delta)} (${formatCapBar(match.projectedPayroll, CAP_LIMIT)}).`);
  } else if (delta < 0) {
    warnings.push(`Creates ${formatCap(-delta)} cap flexibility (${formatCapBar(match.projectedPayroll, CAP_LIMIT)}).`);
  }

  if (match.inLuxuryTax && !franchise.cap.inLuxuryTax) {
    warnings.push('Trade pushes you into luxury tax territory.');
  }
  if (match.projectedPayroll > SECOND_APRON - 4_000_000 && franchise.cap.payroll <= SECOND_APRON - 4_000_000) {
    warnings.push('Approaching second apron — hard cap restrictions kick in.');
  }
  if (franchise.cap.inSecondApron && delta > 0) {
    warnings.push('Second apron team — every dollar in must be matched out.');
  }

  return { warnings, projectedPayroll: match.projectedPayroll, match };
}

export function validateTradeSalaryMatch(
  franchise: Franchise,
  incomingSalary: number,
  outgoingSalary: number,
): { ok: boolean; message: string; allowedIncoming: number } {
  const result = validateTradeSalaryMatchAtPayroll(
    franchise.cap.payroll,
    franchise.cap.inSecondApron,
    incomingSalary,
    outgoingSalary,
  );
  return { ok: result.ok, message: result.message, allowedIncoming: result.allowedIncoming };
}

export function formatCap(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount}`;
}

/** Compact payroll vs cap ceiling, e.g. "133.4M / 140M". */
export function formatCapBar(payroll: number, capLimit: number): string {
  const compact = (amount: number) => {
    const millions = amount / 1_000_000;
    const rounded = Math.round(millions * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}M` : `${rounded.toFixed(1)}M`;
  };
  return `${compact(payroll)} / ${compact(capLimit)}`;
}

/** Primary label for usable cap room in UI. */
export function formatUsableCapRoom(cap: Pick<Franchise['cap'], 'effectiveRoom' | 'payroll' | 'capLimit' | 'inSecondApron'>): string {
  if (cap.payroll >= cap.capLimit || cap.inSecondApron) {
    return cap.effectiveRoom > 0 ? formatCap(cap.effectiveRoom) : '$0 · over cap';
  }
  return formatCap(cap.effectiveRoom);
}

/** One-line cap sheet breakdown for renewals / FA screens. */
export function capRoomBreakdown(cap: Franchise['cap']): string {
  const parts = [`Cap sheet ${formatCapBar(cap.payroll, cap.capLimit)}`];
  if (cap.capHoldsTotal > 0) parts.push(`${formatCap(cap.capHoldsTotal)} in holds`);
  if ((cap.incompleteRosterCharge ?? 0) > 0) {
    parts.push(`${formatCap(cap.incompleteRosterCharge!)} roster charge`);
  }
  return parts.join(' · ');
}

export function pickKey(pick: { year: number; round: number; originalTeam?: string }): string {
  // originalTeam is part of identity so the user can own two same-year/round picks
  // from different teams (e.g. their own 2027 1st + an incoming 2027 1st from Boston).
  return `${pick.year}-R${pick.round}-${pick.originalTeam ?? ''}`;
}
