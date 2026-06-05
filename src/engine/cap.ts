import type { Contract, Franchise, LeagueTeam, Player } from '../types/game';

export const CAP_LIMIT = 140_000_000;
export const LUXURY_TAX_LINE = 170_000_000;
export const SECOND_APRON = 189_000_000;
export const NON_TAXPAYER_MLE = 12_800_000;
export const TAXPAYER_MLE = 5_000_000;
export const BAE = 4_700_000;
export const MIN_SALARY = 1_100_000;

export function computePayroll(franchise: Franchise): number {
  const rosterSalary = franchise.roster.reduce((s, p) => s + p.contract.annualSalary, 0);
  return rosterSalary + franchise.cap.deadMoney;
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

export function computeCapOutlook(franchise: Franchise): Franchise['cap'] {
  const payroll = computePayroll(franchise);
  const inLuxuryTax = payroll > LUXURY_TAX_LINE;
  const inSecondApron = payroll > SECOND_APRON;
  const projectedRoom = Math.max(0, CAP_LIMIT - payroll);
  const mleAvailable = inLuxuryTax ? TAXPAYER_MLE : NON_TAXPAYER_MLE;
  const roomAvailable = projectedRoom;
  const baeAvailable = inLuxuryTax ? 0 : BAE;
  const taxBill = estimateTaxBill(payroll);
  const warnings: string[] = [];

  if (inSecondApron) {
    warnings.push('Second apron: hard-capped. Cannot use MLE, BAE, or take back more salary in trades.');
  } else if (inLuxuryTax) {
    warnings.push(`Luxury tax active — projected bill ${formatCap(taxBill)}. Ownership expects deep playoff run.`);
  } else if (payroll > CAP_LIMIT * 0.95) {
    warnings.push('Approaching cap ceiling. Room exceptions shrink with every signing.');
  }

  const star = franchise.roster.find((p) => p.isStar);
  if (star && star.contract.yearsRemaining <= 1) {
    const maxEst = maxExtensionEstimate(star);
    warnings.push(
      `Extending ${star.firstName} ${star.lastName} (~${formatCap(maxEst)}/yr) uses ${birdRightsLabel(star.contract.birdYears ?? 0)}.`,
    );
  }

  const badContracts = franchise.roster.filter((p) => p.contract.annualSalary > 18_000_000 && p.overall < 76);
  if (badContracts.length) {
    warnings.push(`${badContracts[0].firstName} ${badContracts[0].lastName} on an albatross deal — limits trade flexibility.`);
  }

  return {
    payroll,
    capLimit: CAP_LIMIT,
    luxuryTaxLine: LUXURY_TAX_LINE,
    secondApron: SECOND_APRON,
    inLuxuryTax,
    inSecondApron,
    projectedRoom,
    deadMoney: franchise.cap.deadMoney,
    taxBill,
    mleAvailable,
    roomAvailable,
    baeAvailable,
    hardCapped: inSecondApron,
    warnings,
  };
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

  if (cap.projectedRoom >= salary) {
    return { ok: true, reason: `Fits in ${formatCap(cap.projectedRoom)} cap room.`, useException: 'Room' };
  }

  if (!cap.inLuxuryTax && salary <= cap.mleAvailable) {
    return { ok: true, reason: `Non-taxpayer MLE (${formatCap(cap.mleAvailable)}).`, useException: 'MLE' };
  }

  if (cap.inLuxuryTax && !cap.inSecondApron && salary <= TAXPAYER_MLE) {
    return { ok: true, reason: `Taxpayer MLE (${formatCap(TAXPAYER_MLE)}).`, useException: 'MLE' };
  }

  if (cap.inSecondApron) {
    return { ok: false, reason: 'Second apron team cannot exceed hard cap with new signings.' };
  }

  return {
    ok: false,
    reason: `Need ${formatCap(salary - cap.projectedRoom)} more room or an exception. MLE may not cover this ask.`,
  };
}

export function validateTradeSalaryMatchAtPayroll(
  payroll: number,
  hardCapped: boolean,
  incomingSalary: number,
  outgoingSalary: number,
): { ok: boolean; message: string; allowedIncoming: number; projectedPayroll: number; inLuxuryTax: boolean } {
  const delta = incomingSalary - outgoingSalary;
  const projectedPayroll = payroll + delta;
  const inLuxuryTax = projectedPayroll > LUXURY_TAX_LINE;

  if (hardCapped && projectedPayroll > SECOND_APRON) {
    return {
      ok: false,
      message: 'Trade would exceed second apron hard cap.',
      allowedIncoming: outgoingSalary,
      projectedPayroll,
      inLuxuryTax,
    };
  }

  if (payroll < CAP_LIMIT) {
    const allowed = outgoingSalary * 1.25 + 100_000;
    if (incomingSalary <= allowed + CAP_LIMIT - payroll) {
      return {
        ok: true,
        message: 'Salary matching valid — team under cap.',
        allowedIncoming: allowed,
        projectedPayroll,
        inLuxuryTax,
      };
    }
    return {
      ok: false,
      message: `Incoming salary exceeds 125% + $100K matching (max ${formatCap(allowed)}).`,
      allowedIncoming: allowed,
      projectedPayroll,
      inLuxuryTax,
    };
  }

  const allowed = outgoingSalary * 1.25 + 100_000;
  if (incomingSalary <= allowed) {
    return {
      ok: true,
      message: 'Salary matching valid for over-cap team.',
      allowedIncoming: allowed,
      projectedPayroll,
      inLuxuryTax,
    };
  }

  return {
    ok: false,
    message: `Over-cap teams must match within 125% + $100K. Max incoming: ${formatCap(allowed)}.`,
    allowedIncoming: allowed,
    projectedPayroll,
    inLuxuryTax,
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

export function pickKey(pick: { year: number; round: number }): string {
  return `${pick.year}-R${pick.round}`;
}
