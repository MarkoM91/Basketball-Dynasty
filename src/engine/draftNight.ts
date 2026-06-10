import type { DraftClassStrength, DraftNightState, Franchise, League, Prospect } from '../types/game';
import { buildNameRegistry, personNameKey, takeUniqueName } from '../data/names';
import { makeProspect, playerName } from '../data/scenarios';
import { teamNameForDraftPick } from './draftOrder';
import { draftClassQualityBias } from './careerMode';

export const DRAFT_TEAM_COUNT = 30;
export const DRAFT_ROUNDS = 2;
export const DRAFT_TOTAL_PICKS = DRAFT_TEAM_COUNT * DRAFT_ROUNDS;

export function draftRound(pick: number): 1 | 2 {
  return pick <= DRAFT_TEAM_COUNT ? 1 : 2;
}

export function pickInRound(pick: number): number {
  return pick <= DRAFT_TEAM_COUNT ? pick : pick - DRAFT_TEAM_COUNT;
}

export function userPickSlots(draftSlot: number): number[] {
  const slot = Math.max(1, Math.min(DRAFT_TEAM_COUNT, draftSlot));
  return [slot, slot + DRAFT_TEAM_COUNT].filter((p) => p <= DRAFT_TOTAL_PICKS);
}

export function normalizeDraftNight(
  state: DraftNightState,
  draftPickNumber?: number,
): DraftNightState {
  const slot = draftPickNumber ?? state.userPickNumber ?? 14;
  // Use Array.isArray so an empty array (all picks traded away) is preserved,
  // while undefined/null (uninitialized legacy save) falls back to default slots.
  const userPickNumbers = Array.isArray(state.userPickNumbers)
    ? state.userPickNumbers
    : userPickSlots(slot);
  const normalized: DraftNightState = {
    ...state,
    userPickNumber: userPickNumbers[0] ?? state.userPickNumber,
    userPickNumbers,
    totalPicks: state.totalPicks ?? DRAFT_TOTAL_PICKS,
    userPicksMade: state.userPicksMade ?? [],
    userDraftedNames: state.userDraftedNames ?? [],
    log: (state.log ?? []).map((entry) => ({
      ...entry,
      round: entry.round ?? draftRound(entry.pick),
    })),
  };
  return migrateDraftBoard(normalized);
}

function boardNameRegistry(board: Prospect[], logNames: string[] = []): Set<string> {
  const fromLog = logNames.map((name) => {
    const parts = name.trim().split(/\s+/);
    return { firstName: parts[0] ?? name, lastName: parts.slice(1).join(' ') || 'Unknown' };
  });
  return buildNameRegistry([board, fromLog]);
}

function hasLegacyNumberedName(lastName: string): boolean {
  return /\d+$/.test(lastName.trim());
}

function legacyLogName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return false;
  return hasLegacyNumberedName(parts.slice(1).join(' '));
}

/** Rewrites old draft boards that used numeric last-name suffixes (e.g. Blake3). */
function sanitizeLegacyDraftNames(state: DraftNightState): DraftNightState {
  const boardLegacy = state.board.some((p) => hasLegacyNumberedName(p.lastName));
  const logLegacy = state.log.some((entry) => legacyLogName(entry.prospectName));
  if (!boardLegacy && !logLegacy) return state;

  const used = boardNameRegistry(
    state.board.filter((p) => !hasLegacyNumberedName(p.lastName)),
    state.log.filter((entry) => !legacyLogName(entry.prospectName)).map((entry) => entry.prospectName),
  );

  const board = state.board.map((prospect, index) => {
    if (!hasLegacyNumberedName(prospect.lastName)) return prospect;
    const { firstName, lastName } = takeUniqueName(used, prospect.id.length + index + state.currentPick);
    return { ...prospect, firstName, lastName };
  });

  const log = state.log.map((entry) => {
    if (!legacyLogName(entry.prospectName)) return entry;
    const { firstName, lastName } = takeUniqueName(used, entry.pick * 17);
    return { ...entry, prospectName: `${firstName} ${lastName}` };
  });

  return { ...state, board, log };
}

type DraftTier = 'first' | 'second';

const FIRST_ROUND_POOL = 38;
const SECOND_ROUND_POOL = 32;

/** Deterministically pick draft class strength from the season number. */
export function generateClassStrength(season: number): DraftClassStrength {
  const roll = ((season * 137 + 31) % 100);
  if (roll < 20) return 'Weak';
  if (roll < 70) return 'Average';
  if (roll < 88) return 'Loaded';
  return 'Deep';
}

export function classStrengthLabel(strength: DraftClassStrength): string {
  switch (strength) {
    case 'Loaded': return '🔥 Loaded class';
    case 'Deep':   return '📦 Deep class';
    case 'Weak':   return '⚠️ Weak class';
    default:       return 'Average class';
  }
}

function classShift(strength: DraftClassStrength): { ovr: number; pot: number; bustMod: number } {
  switch (strength) {
    case 'Loaded': return { ovr: 2, pot: 3, bustMod: -1 };
    case 'Deep':   return { ovr: 1, pot: 1, bustMod: 0 };
    case 'Weak':   return { ovr: -3, pot: -4, bustMod: 1 };
    default:       return { ovr: 0, pot: 0, bustMod: 0 };
  }
}

/**
 * BBGM-style: scoutedOverall = current raw ability (low for rookies).
 * potential = development ceiling (what they can become in 3-5 seasons).
 * The gap between them drives our development engine.
 *
 * First round sub-tiers:
 *   Top 5  (rank 0-4):  OVR 54-66, POT 83-96  — elite upside, raw now
 *   Lottery (5-14):     OVR 50-62, POT 75-90
 *   Late 1st (15-29):   OVR 46-58, POT 68-83
 *
 * Second round:
 *   Early 2nd (0-14):   OVR 40-52, POT 62-76
 *   Late 2nd (15-31):   OVR 36-48, POT 55-70
 */
const FIRST_ROUND_SCOUT_NOTES = [
  'Elite athleticism and upside. Raw skill-set needs 2–3 years of NBA reps before he contributes.',
  'High-upside prospect. Scouts love the tools — the translation to the next level is the question.',
  "Can't-miss potential if the skills develop. Will be a project year one.",
  'Strong two-way tools. Decision-making under NBA speed is the major concern.',
  'Boom-or-bust. Either a franchise player or a bust — scouts are split.',
  'Late bloomer type. Should contribute in year 2-3 as a rotation piece with star potential.',
  'High floor, high ceiling. NBA-ready defender; offense needs significant work.',
  'Stretch-four upside. Shooting mechanics are there — needs strength and positioning.',
];

const SECOND_ROUND_SCOUT_NOTES = [
  'Two-way contract candidate. Athletic, raw — needs G-League time before stick.',
  'Specialist upside. If the shooting translates, carves out a rotation role.',
  "High-effort guy. Won't wow you on film but earns minutes through grit.",
  'Hidden gem possibility. Played in a poor system — tools are undervalued.',
  'Developmental big. Physical profile is intriguing but needs 2 years minimum.',
];

function ratingsForTier(tier: DraftTier, rank: number, qualityBias = 0, strength: DraftClassStrength = 'Average') {
  const shift = classShift(strength);

  if (tier === 'first') {
    const boost = rank < qualityBias ? Math.min(4, Math.ceil((qualityBias - rank) / 3)) : 0;

    // Current ability — raw, low. Decreases with rank (later picks are worse NOW).
    const ovrLo = Math.max(44, 58 - Math.floor(rank / 2) + boost + shift.ovr);
    const ovrHi = Math.min(70, ovrLo + 6 + (rank % 3 === 0 ? 2 : 0));

    // Potential — their ceiling after development. Stays higher, narrows later.
    const potLo = Math.max(66, 88 - Math.floor(rank * 0.7) + boost + shift.pot);
    const potHi = Math.min(98, potLo + 8 + (rank % 4 === 0 ? 3 : 0));

    const rawBust = rank % 5 === 0 ? 2 : rank % 3 === 0 ? 1 : 0;
    const bustLevel = Math.max(0, Math.min(2, rawBust + shift.bustMod));
    const note = FIRST_ROUND_SCOUT_NOTES[rank % FIRST_ROUND_SCOUT_NOTES.length];

    return {
      scoutedOverall: [ovrLo, ovrHi] as [number, number],
      potential: [potLo, potHi] as [number, number],
      floor: ovrLo - 4,
      ceiling: potHi,
      bustRisk: (['Low', 'Medium', 'High'] as const)[bustLevel],
      scoutNote: note,
    };
  }

  // Second round — more raw, lower ceiling, higher bust rate
  const ovrLo = Math.max(34, 48 - Math.floor(rank / 3) + shift.ovr);
  const ovrHi = Math.min(58, ovrLo + 5 + (rank % 3));
  const potLo = Math.max(52, 70 - Math.floor(rank / 2) + shift.pot);
  const potHi = Math.min(80, potLo + 6 + (rank % 3));
  const rawBust = rank % 3 === 0 ? 2 : rank % 2 === 0 ? 1 : 0;
  const bustLevel = Math.max(0, Math.min(2, rawBust + shift.bustMod));
  const note = SECOND_ROUND_SCOUT_NOTES[rank % SECOND_ROUND_SCOUT_NOTES.length];

  return {
    scoutedOverall: [ovrLo, ovrHi] as [number, number],
    potential: [potLo, potHi] as [number, number],
    floor: ovrLo - 4,
    ceiling: potHi,
    bustRisk: (['Low', 'Medium', 'High'] as const)[bustLevel],
    scoutNote: note,
  };
}

const INTL_ARCHETYPES = ['Euro Playmaker', 'Stretch Operator', 'Athletic Big', 'International Wing'];
const INTL_NOTES = [
  'Playing in a top European league — scouts project 1-year development window before NBA-readiness.',
  'Explosive athlete overseas. Needs a season to adjust to the speed of the pro game.',
  'High-upside international — teams are split on whether he needs 1 or 2 years to develop.',
  'Coached by a former NBA player overseas. Technical skill is there; athleticism needs NBA reps.',
];

function makeInternationalProspect(used: Set<string>, salt: number, rank: number, strength: DraftClassStrength): Prospect {
  const { firstName, lastName } = takeUniqueName(used, salt);
  const ratings = ratingsForTier('second', rank, 0, strength);
  // International prospects: wider scouting range, higher upside than typical 2nd round
  const potBoost = 4 + (salt % 5);
  const prospect = makeProspect({
    firstName,
    lastName,
    position: (['PG', 'SG', 'SF', 'PF', 'C'] as const)[salt % 5],
    archetype: INTL_ARCHETYPES[salt % INTL_ARCHETYPES.length],
    age: 20 + (salt % 3),
    ...ratings,
    potential: [ratings.potential[0], Math.min(82, ratings.potential[1] + potBoost)] as [number, number],
    ceiling: Math.min(82, ratings.ceiling + potBoost),
    scoutNote: INTL_NOTES[salt % INTL_NOTES.length],
  });
  return {
    ...prospect,
    isInternational: true,
    stashYears: (salt % 3 === 0 ? 2 : 1) as 1 | 2,
  };
}

function prospectAge(tier: DraftTier, rank: number, salt: number): number {
  // Top picks tend to be younger (one-and-done), mid/late more developed
  if (tier === 'first') {
    if (rank < 5) return 19 + (salt % 2 === 0 ? 0 : 1);      // 19–20
    if (rank < 18) return 19 + (salt % 3 === 0 ? 2 : rank % 2); // 19–21
    return 20 + (rank % 3);                                      // 20–22
  }
  return 20 + (salt % 4 === 0 ? 3 : rank % 3);                 // 20–23
}

/** Younger = wider scouting range + higher potential ceiling; older = tighter but floor-safe. */
function agePotentialShift(age: number): { potBoost: number; rangeWiden: number } {
  if (age <= 19) return { potBoost: 4, rangeWiden: 3 };
  if (age <= 20) return { potBoost: 2, rangeWiden: 2 };
  if (age <= 21) return { potBoost: 0, rangeWiden: 1 };
  if (age === 22) return { potBoost: -2, rangeWiden: 0 };
  return { potBoost: -4, rangeWiden: -1 };
}

function makeBoardProspect(used: Set<string>, salt: number, tier: DraftTier, rank: number, qualityBias = 0, strength: DraftClassStrength = 'Average'): Prospect {
  const { firstName, lastName } = takeUniqueName(used, salt);
  const ratings = ratingsForTier(tier, rank, qualityBias, strength);
  const age = prospectAge(tier, rank, salt);
  const { potBoost, rangeWiden } = agePotentialShift(age);

  const potHiBoosted = Math.min(98, ratings.potential[1] + potBoost);
  const potLoBoosted = Math.min(potHiBoosted - 2, ratings.potential[0] + Math.floor(potBoost / 2));
  const ovrHiWidened = Math.min(88, ratings.scoutedOverall[1] + rangeWiden);
  const ovrLoWidened = Math.max(44, ratings.scoutedOverall[0] - rangeWiden);

  return makeProspect({
    firstName,
    lastName,
    position: (['PG', 'SG', 'SF', 'PF', 'C'] as const)[salt % 5],
    archetype: ['Two-Way Wing', 'Stretch Big', 'Floor General', 'Rim Runner', '3-and-D Guard'][salt % 5],
    age,
    ...ratings,
    scoutedOverall: [ovrLoWidened, ovrHiWidened] as [number, number],
    potential: [potLoBoosted, potHiBoosted] as [number, number],
    ceiling: potHiBoosted,
  });
}

function buildTieredDraftBoard(scouted: Prospect[], used: Set<string>, qualityBias = 0, strength: DraftClassStrength = 'Average'): Prospect[] {
  const board = [...scouted];
  let salt = board.length;

  for (let rank = 0; rank < FIRST_ROUND_POOL; rank += 1) {
    board.push(makeBoardProspect(used, salt, 'first', rank, qualityBias, strength));
    salt += 1;
  }

  // Scatter 4–5 international prospects among the 2nd round slots
  const intlSlots = new Set([3, 8, 14, 21, 28].slice(0, strength === 'Loaded' ? 5 : 4));
  for (let rank = 0; rank < SECOND_ROUND_POOL; rank += 1) {
    if (intlSlots.has(rank)) {
      board.push(makeInternationalProspect(used, salt + 1000 + rank, rank, strength));
    } else {
      board.push(makeBoardProspect(used, salt + 1000 + rank, 'second', rank, 0, strength));
    }
  }

  return board;
}

function appendProspects(
  board: Prospect[],
  used: Set<string>,
  targetSize: number,
  currentPick: number,
): Prospect[] {
  const next = [...board];
  let salt = next.length;
  const tier: DraftTier = currentPick <= DRAFT_TEAM_COUNT ? 'first' : 'second';
  let rank = next.filter((p) =>
    tier === 'first'
      ? (p.truePotential ?? p.potential[1]) >= 74
      : (p.truePotential ?? p.potential[1]) < 74,
  ).length;

  while (next.length < targetSize && salt < targetSize + 200) {
    next.push(makeBoardProspect(used, salt, tier, rank));
    salt += 1;
    rank += 1;
  }

  return next;
}

function downgradeProspectToSecondRound(prospect: Prospect, rank: number): Prospect {
  const ratings = ratingsForTier('second', rank);
  return {
    ...prospect,
    ...ratings,
    trueOverall: Math.round((ratings.scoutedOverall[0] + ratings.scoutedOverall[1]) / 2),
    truePotential: Math.round((ratings.potential[0] + ratings.potential[1]) / 2),
  };
}

/** Fixes in-progress drafts where Round 2 still shows first-round talent levels. */
function fixSecondRoundBoard(state: DraftNightState): DraftNightState {
  if (state.currentPick <= DRAFT_TEAM_COUNT) return state;

  const available = state.board.filter((p) => !state.takenIds.includes(p.id));
  if (!available.length) return state;

  const highTierCount = available.filter((p) => (p.truePotential ?? p.potential[1]) >= 74).length;
  if (highTierCount < available.length * 0.4) return state;

  let rank = 0;
  const board = state.board.map((prospect) => {
    if (state.takenIds.includes(prospect.id)) return prospect;
    if ((prospect.truePotential ?? prospect.potential[1]) < 74) return prospect;
    const next = downgradeProspectToSecondRound(prospect, rank);
    rank += 1;
    return next;
  });

  return { ...state, board };
}

function refreshDuplicateBoardNames(state: DraftNightState): DraftNightState {
  const available = state.board.filter((p) => !state.takenIds.includes(p.id));
  if (available.length < 3) return state;

  const lastNameCounts = new Map<string, number>();
  for (const prospect of available) {
    lastNameCounts.set(prospect.lastName, (lastNameCounts.get(prospect.lastName) ?? 0) + 1);
  }
  const repeated = [...lastNameCounts.values()].some((count) => count >= 3);
  if (!repeated) return state;

  const used = boardNameRegistry(
    state.board.filter((p) => state.takenIds.includes(p.id)),
    state.log.map((entry) => entry.prospectName),
  );

  let salt = state.board.length;
  const board = state.board.map((prospect) => {
    if (state.takenIds.includes(prospect.id)) return prospect;
    const { firstName, lastName } = takeUniqueName(used, salt);
    salt += 1;
    return { ...prospect, firstName, lastName };
  });

  const logLastNames = new Map<string, number>();
  for (const entry of state.log) {
    const last = entry.prospectName.trim().split(/\s+/).slice(1).join(' ');
    logLastNames.set(last, (logLastNames.get(last) ?? 0) + 1);
  }
  const logRepeated = [...logLastNames.values()].some((count) => count >= 3);
  const log = logRepeated
    ? state.log.map((entry, index) => {
        const last = entry.prospectName.trim().split(/\s+/).slice(1).join(' ');
        if ((logLastNames.get(last) ?? 0) < 3) return entry;
        const { firstName, lastName } = takeUniqueName(used, entry.pick * 31 + index);
        return { ...entry, prospectName: `${firstName} ${lastName}` };
      })
    : state.log;

  return { ...state, board, log };
}

function migrateDraftBoard(state: DraftNightState): DraftNightState {
  return refreshDuplicateBoardNames(fixSecondRoundBoard(sanitizeLegacyDraftNames(state)));
}

export function initDraftNight(franchise: Franchise, _league: League): DraftNightState {
  // Use both rounds as baseline; reconcileDraftNightWithPicks (called on load) will
  // remove any slots whose picks were traded away before draft night started.
  const userPickNumbers = userPickSlots(franchise.draftPickNumber ?? 14);
  const scouted = franchise.draftBoard.length >= 5 ? [...franchise.draftBoard] : [];
  const used = boardNameRegistry(scouted);
  const qualityBias = draftClassQualityBias(franchise);
  const classStrength = generateClassStrength(franchise.season);
  const board = buildTieredDraftBoard(scouted, used, qualityBias, classStrength);

  return {
    active: true,
    currentPick: 1,
    userPickNumber: userPickNumbers[0],
    userPickNumbers,
    totalPicks: DRAFT_TOTAL_PICKS,
    userPicksMade: [],
    userDraftedNames: [],
    board,
    takenIds: [],
    log: [],
    stakeholderNote: buildStakeholderNote(franchise, pickBestAvailable(board, [])),
    onClock: userPickNumbers.includes(1),
    classStrength,
  };
}

function buildStakeholderNote(franchise: Franchise, top?: Prospect): string {
  if (!top) return 'Draft board set. Your pick approaches.';
  const owner = franchise.ownership.goal.toLowerCase().includes('playoff')
    ? 'Ownership wants a player who helps immediately.'
    : 'Ownership prefers upside over safe floor.';
  const coach = 'Coach wants defense and role clarity day one.';
  const scout = `Scouting director: "${top.scoutNote}"`;
  return `${owner} ${coach} ${scout}`;
}

function pickBestAvailable(board: Prospect[], takenIds: string[]): Prospect | undefined {
  return board
    .filter((p) => !takenIds.includes(p.id))
    .sort((a, b) => (b.truePotential ?? b.potential[1]) - (a.truePotential ?? a.potential[1]))[0];
}

function isUserOnClock(state: DraftNightState, pick: number): boolean {
  return state.userPickNumbers.includes(pick) && !state.userPicksMade.includes(pick);
}

export function nextUserPick(state: DraftNightState): number | undefined {
  return state.userPickNumbers.find(
    (pick) => !state.userPicksMade.includes(pick) && pick >= state.currentPick,
  );
}

export function isUserDraftComplete(state: DraftNightState): boolean {
  return state.userPickNumbers.every((pick) => state.userPicksMade.includes(pick));
}

function teamForPick(league: League, pick: number): string {
  return teamNameForDraftPick(league, pick);
}

export function simOneDraftPick(
  state: DraftNightState,
  league: League,
  franchise: Franchise,
): DraftNightState {
  if (!state.active || state.onClock) return state;
  if (state.currentPick > state.totalPicks) {
    return { ...state, active: false, onClock: false };
  }

  let board = state.board;
  let prospect = pickBestAvailable(board, state.takenIds);
  if (!prospect) {
    const used = boardNameRegistry(
      board,
      state.log.map((entry) => entry.prospectName),
    );
    board = appendProspects(board, used, board.length + 12, state.currentPick);
    prospect = pickBestAvailable(board, state.takenIds);
  }
  if (!prospect) return { ...state, active: false, onClock: false };

  const pick = state.currentPick;
  const logEntry = {
    pick,
    round: draftRound(pick),
    teamName: teamForPick(league, pick),
    prospectName: playerName(prospect),
    isUser: false,
    note: prospect.bustRisk === 'High' ? 'High-risk swing pick.' : undefined,
  };

  const nextPick = pick + 1;
  const takenIds = [...state.takenIds, prospect.id];
  const onClock = nextPick <= state.totalPicks && isUserOnClock(state, nextPick);

  return {
    ...state,
    board,
    currentPick: nextPick,
    takenIds,
    log: [...state.log, logEntry],
    onClock,
    active: nextPick <= state.totalPicks,
    stakeholderNote: onClock
      ? buildStakeholderNote(franchise, pickBestAvailable(board, takenIds))
      : state.stakeholderNote,
  };
}

export function runDraftToUserPick(
  state: DraftNightState,
  league: League,
  franchise: Franchise,
): DraftNightState {
  const normalized = normalizeDraftNight(state, franchise.draftPickNumber);
  if (!normalized.active || normalized.onClock) return normalized;

  const target = nextUserPick(normalized);
  if (!target) return normalized;

  let current = normalized;
  let safety = 0;
  while (
    current.active &&
    !current.onClock &&
    current.currentPick < target &&
    safety < DRAFT_TOTAL_PICKS
  ) {
    const next = simOneDraftPick(current, league, franchise);
    if (next.log.length === current.log.length) break;
    current = next;
    safety += 1;
  }

  if (current.active && isUserOnClock(current, current.currentPick)) {
    return {
      ...current,
      onClock: true,
      stakeholderNote: buildStakeholderNote(
        franchise,
        pickBestAvailable(current.board, current.takenIds),
      ),
    };
  }
  return current;
}

export function simDraftToEnd(
  state: DraftNightState,
  league: League,
  franchise: Franchise,
): DraftNightState {
  let current = { ...state, onClock: false };
  let safety = 0;
  while (current.active && current.currentPick <= current.totalPicks && safety < DRAFT_TOTAL_PICKS) {
    const next = simOneDraftPick(current, league, franchise);
    if (next.log.length === current.log.length) break;
    current = next;
    safety += 1;
  }
  return { ...current, active: false, onClock: false };
}

export function availableProspects(state: DraftNightState): Prospect[] {
  return state.board.filter((p) => !state.takenIds.includes(p.id));
}

export function draftNightHeadline(state: DraftNightState): string {
  const last = state.log[state.log.length - 1];
  if (!last) return 'Draft night opens. Round 1 is underway.';
  return `Round ${last.round}, pick ${pickInRound(last.pick)}: ${last.teamName} selects ${last.prospectName}.`;
}

export function formatUserPickLabel(state: DraftNightState): string {
  const remaining = state.userPickNumbers.filter((pick) => !state.userPicksMade.includes(pick));
  if (!remaining.length) return 'Draft complete';
  return remaining.map((pick) => `#${pick} (R${draftRound(pick)})`).join(' · ');
}

/** @deprecated use personNameKey from data/names */
export function draftNameKey(firstName: string, lastName: string): string {
  return personNameKey(firstName, lastName);
}

export function userSelectProspect(
  state: DraftNightState,
  franchise: Franchise,
  prospectId: string,
): { state: DraftNightState; prospect: Prospect; pickNumber: number } | null {
  const normalized = normalizeDraftNight(state, franchise.draftPickNumber);
  if (!normalized.active || !normalized.onClock) return null;
  if (!isUserOnClock(normalized, normalized.currentPick)) return null;

  const prospect = normalized.board.find(
    (p) => p.id === prospectId && !normalized.takenIds.includes(p.id),
  );
  if (!prospect) return null;

  const pickNumber = normalized.currentPick;
  const logEntry = {
    pick: pickNumber,
    round: draftRound(pickNumber),
    teamName: `${franchise.city} ${franchise.name}`,
    prospectName: playerName(prospect),
    isUser: true,
    note:
      pickNumber <= DRAFT_TEAM_COUNT
        ? 'Round 1 — your selection is in.'
        : 'Round 2 — your selection is in.',
  };

  const userPicksMade = [...normalized.userPicksMade, pickNumber];
  const nextPick = pickNumber + 1;

  return {
    prospect,
    pickNumber,
    state: {
      ...normalized,
      currentPick: nextPick,
      userPicksMade,
      onClock: false,
      takenIds: [...normalized.takenIds, prospect.id],
      log: [...normalized.log, logEntry],
      active: nextPick <= normalized.totalPicks,
    },
  };
}
