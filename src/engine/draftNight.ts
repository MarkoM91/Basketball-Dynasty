import type { DraftNightState, Franchise, League, Prospect } from '../types/game';
import { buildNameRegistry, personNameKey, takeUniqueName } from '../data/names';
import { makeProspect, playerName } from '../data/scenarios';
import { teamNameForDraftPick } from './draftOrder';

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
  const userPickNumbers = state.userPickNumbers?.length
    ? state.userPickNumbers
    : userPickSlots(slot);
  const normalized: DraftNightState = {
    ...state,
    userPickNumber: userPickNumbers[0],
    userPickNumbers,
    totalPicks: state.totalPicks ?? DRAFT_TOTAL_PICKS,
    userPicksMade: state.userPicksMade ?? [],
    userDraftedNames: state.userDraftedNames ?? [],
    log: state.log.map((entry) => ({
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

function ratingsForTier(tier: DraftTier, rank: number) {
  if (tier === 'first') {
    const ovrLo = Math.max(66, 74 - Math.floor(rank / 3));
    const ovrHi = Math.min(81, ovrLo + 5 + (rank % 3));
    const potLo = Math.max(74, 90 - Math.floor(rank / 2));
    const potHi = Math.min(94, potLo + 6 + (rank % 4));
    return {
      scoutedOverall: [ovrLo, ovrHi] as [number, number],
      potential: [potLo, potHi] as [number, number],
      floor: ovrLo - 5,
      ceiling: potHi,
      bustRisk: (rank % 5 === 0 ? 'High' : rank % 3 === 0 ? 'Medium' : 'Low') as Prospect['bustRisk'],
      scoutNote: 'First-round profile — rotation upside with starter potential.',
    };
  }

  const ovrLo = Math.max(48, 56 - Math.floor(rank / 4));
  const ovrHi = Math.min(65, ovrLo + 4 + (rank % 3));
  const potLo = Math.max(50, 64 - Math.floor(rank / 3));
  const potHi = Math.min(72, potLo + 5 + (rank % 3));
  return {
    scoutedOverall: [ovrLo, ovrHi] as [number, number],
    potential: [potLo, potHi] as [number, number],
    floor: ovrLo - 4,
    ceiling: potHi,
    bustRisk: (rank % 3 === 0 ? 'High' : rank % 2 === 0 ? 'Medium' : 'Low') as Prospect['bustRisk'],
    scoutNote: 'Second-round profile — depth piece, two-way contract candidate.',
  };
}

function makeBoardProspect(used: Set<string>, salt: number, tier: DraftTier, rank: number): Prospect {
  const { firstName, lastName } = takeUniqueName(used, salt);
  const ratings = ratingsForTier(tier, rank);
  return makeProspect({
    firstName,
    lastName,
    position: (['PG', 'SG', 'SF', 'PF', 'C'] as const)[salt % 5],
    archetype: ['Two-Way Wing', 'Stretch Big', 'Floor General', 'Rim Runner', '3-and-D Guard'][salt % 5],
    age: tier === 'first' ? 19 + (rank % 2) : 20 + (rank % 3),
    ...ratings,
  });
}

function buildTieredDraftBoard(scouted: Prospect[], used: Set<string>): Prospect[] {
  const board = [...scouted];
  let salt = board.length;

  for (let rank = 0; rank < FIRST_ROUND_POOL; rank += 1) {
    board.push(makeBoardProspect(used, salt, 'first', rank));
    salt += 1;
  }
  for (let rank = 0; rank < SECOND_ROUND_POOL; rank += 1) {
    board.push(makeBoardProspect(used, salt + 1000 + rank, 'second', rank));
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
  const userPickNumbers = userPickSlots(franchise.draftPickNumber ?? 14);
  const scouted = franchise.draftBoard.length >= 5 ? [...franchise.draftBoard] : [];
  const used = boardNameRegistry(scouted);
  const board = buildTieredDraftBoard(scouted, used);

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
