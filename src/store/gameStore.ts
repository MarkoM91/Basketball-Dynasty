import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  DevFocus,
  DraftNightState,
  DraftPick,
  Franchise,
  GameResult,
  League,
  PitchType,
  Player,
  ScenarioId,
  ScreenId,
  TradeOffer,
  TradeProposal,
  TradeChainProposal,
} from '../types/game';
import { createLeague, getTeamById, normalizeLeague, syncUserTeam } from '../data/league';
import { resolveTeamFullName, resolveTeamIdentity } from '../data/teamNames';
import { applyRosterSize, fillRosterTo18, normalizeLoadedRoster } from '../data/rosterBuilder';
import { applyScenarioProfile, strategyForFranchise, teamRatingStrength, ensureScenarioRosterShape } from '../engine/scenarioDifficulty';
import {
  generateCareerBeat,
  markCareerBeatSeen,
  refreshOwnershipEvaluation,
} from '../engine/careerMode';
import { normalizeContractSalary } from '../engine/salaries';
import { CAP_LIMIT, MIN_SALARY, pickKey, validateTradeSalaryMatch } from '../engine/cap';
import { buildTeamCoach } from '../engine/coaches';
import { SCENARIOS, buildCustomFranchise, resetIdCounter, uid, playerName } from '../data/scenarios';
import {
  pitchFreeAgent,
  refreshFreeAgentInterest,
  simAISignings,
} from '../engine/freeAgency';
import {
  advanceLeagueSeason,
  applyUserTradeToLeague,
  addDraftPickToLeague,
  ensureLeagueRosters,
  syncUserRosterToLeague,
  tickLeagueInjuries,
  executeLeagueTrades,
} from '../engine/leagueWorld';
import {
  generateLeagueTradeOffers,
  getUserSeed,
  simulateLeagueTrades,
  simulateLeagueWeek,
  SCHEDULE_WEEKS,
  TRADE_DEADLINE_WEEK,
} from '../engine/league';
import {
  availableProspects,
  initDraftNight,
  isUserDraftComplete,
  normalizeDraftNight,
  runDraftToUserPick,
  simDraftToEnd,
  simOneDraftPick,
  userSelectProspect,
} from '../engine/draftNight';
import {
  freezeFranchiseRegularSeasonRecord,
  freezeRegularSeasonRecords,
  franchiseRegularSeasonRecord,
  leagueRecordsNeedReconcile,
  syncFranchiseRecordFromSchedule,
} from '../engine/regularSeasonRecord';
import { withDraftRecap } from '../engine/draftRecap';
import {
  applyGameResults,
  advanceDevelopment,
  autoStartingFive,
  GAMES_PER_WEEK,
  processWeekResults,
  refreshCap,
  rollInjuries,
  simulateSingleGame,
  simulateWeekGames,
  tickInjuries,
  updateJobSecurity,
  moraleAfterWinStreak,
  validateStartingFive,
} from '../engine/simulation';
import { currentScheduledGame, buildSeasonSchedule } from '../engine/schedule';
import {
  applyUserGameToLeague,
  catchUpLeagueThroughWeek,
  reconcileLeagueRegularSeason,
  userWeekResultsFromGames,
} from '../engine/leagueSimulation';
import { buildLeagueStatSnapshot } from '../engine/stats';
import { fireCoach, generateCoachMarket, hireCoach } from '../engine/coaches';
import { clearPartnerTradeAssetCache } from '../engine/tradeBuilder';
import { declineRFAOffer, matchRFAOffer, seedRFAOffers } from '../engine/rfa';
import {
  formatRenewalHeadline,
  openFreeAgencyAfterRenewals,
  prepareDraftScouting,
  processContractRenewals,
  rememberRenewals,
} from '../engine/offseason';
import {
  clearTradeBlock,
  expireSubmittedProposals,
  generateInstantBlockOffers,
  generateTradeBlockOffers,
  isPickOnBlock,
  isPlayerOnBlock,
  mergeTradeOffers,
  needsBlockOfferReconcile,
  reconcileBlockListingOffers,
  resolveProposalSubmission,
  togglePickOnBlock,
  togglePlayerOnBlock,
  withdrawSubmittedProposal,
} from '../engine/tradeBlock';
import {
  enterPostseason,
  postseasonToast,
  repairMissingPostseason,
  shouldBeginPostseason,
} from '../engine/postseason';
import {
  buildSeasonReview,
  normalizePlayoffState,
  roundLabel,
  simCurrentPlayoffRound,
  simNextPlayoffGame,
  userPlayoffGamePending,
} from '../engine/playoffs';
import { getAllBracketSeries } from '../engine/playoffBracket';
import {
  declineCoachRenewal,
  releaseExpiringPlayer,
  renewCoachContract as applyCoachRenewal,
  renewPlayerContract as applyPlayerRenewal,
} from '../engine/contractRenewals';
import { canOpenFreeAgency, waiveOffseasonPlayer } from '../engine/rosterCuts';
import { applyDraftPickTrade, ensurePickOnBooks, pickForDraftSlot, remainingUserDraftSlots } from '../engine/draftPickTrade';
import { executeTradeChain } from '../engine/tradeChain';
import {
  generateCounterOffer,
  pickDescription,
  recordPassedProspectGhost,
  recordTradeGhosts,
  resolveGhostWatch,
  validateProposal,
} from '../engine/tradeBuilder';
import {
  draftProspect,
  executeTrade,
  generateDeadlineEvent,
  generateLockerRoomEvent,
  resolveEvent,
  setDevFocus,
} from '../engine/trades';
import { buildSavePayload, downloadSaveFile, parseSaveFile } from '../lib/saveFile';

export interface WeekSummary {
  results: GameResult[];
  headline: string;
  injuryNote?: string;
}

interface GameStore {
  started: boolean;
  onboardingStep: number;
  selectedScenario: ScenarioId | null;
  franchise: Franchise | null;
  league: League | null;
  screen: ScreenId;
  lastWeekSummary: WeekSummary | null;
  toast: string | null;
  openTradeShopDrawer: boolean;
  stagedDraftSlotKey: string | null;
  leagueHeadlines: string[];
  lastSavedAt: string | null;

  selectScenario: (id: ScenarioId) => void;
  advanceOnboarding: () => void;
  startGame: () => void;
  startCustomGame: (city: string, name: string, market: 'Small' | 'Mid' | 'Large') => void;
  bootstrapFranchise: (source: Omit<Franchise, 'id'>, toast: string, scenarioId: ScenarioId | null) => void;
  setScreen: (screen: ScreenId) => void;
  advanceWeek: () => void;
  playGame: () => void;
  playPlayoffGame: () => void;
  setStartingFive: (playerIds: string[]) => void;
  advanceToPlayoffs: () => void;
  watchPlayoffs: () => void;
  advancePlayoffGame: () => void;
  simPlayoffSeries: () => void;
  acceptTrade: (offer: TradeOffer) => void;
  submitTradeProposal: (proposal: TradeProposal) => void;
  requestTradeCounter: (proposal: TradeProposal) => void;
  acceptPendingCounter: () => void;
  declinePendingCounter: () => void;
  startDraftNight: () => void;
  runToUserPick: () => void;
  advanceDraftPick: () => void;
  finishDraft: () => void;
  pickOnDraftClock: (prospectId: string) => void;
  stashOnDraftClock: (prospectId: string) => void;
  callUpStashedPlayer: (prospectId: string) => void;
  selectDraftProspect: (prospectId: string) => void;
  assignDevFocus: (playerId: string, focus: DevFocus) => void;
  resolvePendingEvent: (eventId: string, optionId: string) => void;
  pitchAgent: (agentId: string, pitch: PitchType, offeredSalary?: number, offeredYears?: number) => void;
  advanceFreeAgency: () => void;
  startFreeAgency: () => void;
  dismissToast: () => void;
  resetGame: () => void;
  resetOnboarding: () => void;
  exportSave: () => void;
  importSave: (raw: string) => boolean;
  fireHeadCoach: () => void;
  hireHeadCoach: (candidateId: string) => void;
  refreshCoachMarket: () => void;
  matchRFA: (offerId: string) => void;
  declineRFA: (offerId: string) => void;
  submitTradeChain: (chain: TradeChainProposal) => void;
  setFinancesPolicy: (patch: { ticketPriceBias?: number; scoutingBudget?: number }) => void;
  toggleTradeBlockPlayer: (playerId: string) => void;
  toggleTradeBlockPick: (pickKey: string) => void;
  addDraftSlotToShoppingList: (pickNumber: number) => void;
  syncBlockListingOffers: () => void;
  clearTradeBlock: () => void;
  withdrawProposal: (proposalId: string) => void;
  renewPlayerContract: (playerId: string) => void;
  releasePlayerContract: (playerId: string) => void;
  renewCoachContract: () => void;
  declineCoachContract: () => void;
  openFreeAgency: () => void;
  acceptDraftPickTrade: (offer: TradeOffer, pickNumber: number) => void;
  submitDraftPickTrade: (proposal: TradeProposal, pickNumber: number) => void;
}

function withStartingFive(f: Franchise): Franchise {
  const rosterIds = new Set((f.roster ?? []).map((p) => p.id));
  const kept = (f.startingFive ?? []).filter((id) => rosterIds.has(id));
  const startingFive = kept.length === 5 ? kept : autoStartingFive(f);
  return { ...f, startingFive, gamesThisWeek: f.gamesThisWeek ?? 0 };
}

function normalizeSavedPlayer(p: Player): Player {
  const overall = p.overall ?? 70;
  const age = p.age ?? 25;
  const contract = p.contract ?? {
    yearsRemaining: 1,
    annualSalary: MIN_SALARY,
    isMax: false,
    isExpiring: false,
  };
  return {
    ...p,
    overall,
    age,
    position: p.position ?? 'SF',
    firstName: p.firstName ?? 'Unknown',
    lastName: p.lastName ?? 'Player',
    seasonStats: p.seasonStats ?? { games: 0, ppg: 0, rpg: 0, apg: 0, mpg: 0 },
    contract: {
      ...contract,
      yearsRemaining: contract.yearsRemaining ?? 1,
      annualSalary: normalizeContractSalary(overall, age, contract.annualSalary ?? MIN_SALARY),
      isMax: contract.isMax ?? false,
      isExpiring: contract.isExpiring ?? false,
    },
  };
}

/**
 * Collapse exact-duplicate draft picks that can accumulate from repeated
 * incoming-pick adds or speculative draft-slot staging. Keys on full identity
 * (year + round + originalTeam + protections) so legitimately distinct picks —
 * e.g. two different teams' 2027 first-rounders — are always preserved.
 */
function dedupeDraftPicks(picks: DraftPick[]): DraftPick[] {
  const seen = new Set<string>();
  const out: DraftPick[] = [];
  for (const p of picks) {
    const id = `${p.year}-R${p.round}-${p.originalTeam ?? ''}-${p.protections ?? ''}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

export function normalizeFranchise(f: Franchise): Franchise {
  const { city, name } = resolveTeamIdentity(f.city ?? '', f.name ?? '');
  const coach = f.coach ?? buildTeamCoach(city, name);
  const cap = f.cap ?? {
    payroll: 0,
    rosterSalary: 0,
    capSheetPayroll: 0,
    incompleteRosterCharge: 0,
    capLimit: CAP_LIMIT,
    luxuryTaxLine: 170_000_000,
    secondApron: 189_000_000,
    inLuxuryTax: false,
    inSecondApron: false,
    projectedRoom: CAP_LIMIT,
    effectiveRoom: CAP_LIMIT,
    capHoldsTotal: 0,
    capHolds: [],
    deadMoney: 0,
    taxBill: 0,
    mleAvailable: 12_800_000,
    mleUsed: false,
    roomAvailable: CAP_LIMIT,
    baeAvailable: 4_700_000,
    baeUsed: false,
    hardCapped: false,
    warnings: [],
  };
  const base = {
    ...f,
    city,
    name,
    cap,
    ghosts: f.ghosts ?? [],
    gameLog: (f.gameLog ?? []).map((g) => ({ ...g, opponent: resolveTeamFullName(g.opponent) })),
    coachMarket: f.coachMarket ?? [],
    rfaOffers: (f.rfaOffers ?? []).map((o) => ({
      ...o,
      offeringTeam: resolveTeamFullName(o.offeringTeam),
    })),
    gamesThisWeek: f.gamesThisWeek ?? 0,
    ticketPriceBias: f.ticketPriceBias ?? 0,
    careerBeatsSeen: f.careerBeatsSeen ?? [],
    scenarioStartSeason: f.scenarioStartSeason,
    scenarioLastWindowSeason: f.scenarioLastWindowSeason,
    tradeBlock: f.tradeBlock ?? { playerIds: [], pickKeys: [] },
    submittedProposals: (f.submittedProposals ?? []).map((p) => ({
      ...p,
      partnerTeamName: resolveTeamFullName(p.partnerTeamName),
    })),
    tradeNegotiation: f.tradeNegotiation
      ? {
          ...f.tradeNegotiation,
          partnerTeamName: resolveTeamFullName(f.tradeNegotiation.partnerTeamName),
        }
      : null,
    tradeOffers: (f.tradeOffers ?? []).map((o) => ({
      ...o,
      partnerTeam: resolveTeamFullName(o.partnerTeam),
    })),
    pendingEvents: f.pendingEvents ?? [],
    pendingCounter: f.pendingCounter
      ? { ...f.pendingCounter, partnerTeam: resolveTeamFullName(f.pendingCounter.partnerTeam) }
      : undefined,
    draftPicks: dedupeDraftPicks(
      (f.draftPicks ?? []).map((pick) => ({
        ...pick,
        originalTeam: resolveTeamFullName(pick.originalTeam),
      })),
    ),
    draftNight: f.draftNight
      ? normalizeDraftNight(f.draftNight, f.draftPickNumber)
      : undefined,
    draftRecap:
      f.phase === 'draft_scouting' && !f.draftNight?.active ? undefined : f.draftRecap,
    playoffs: f.playoffs ? normalizePlayoffState(f.playoffs) : undefined,
    draftBoard: f.draftBoard ?? [],
    roster: normalizeLoadedRoster(
      { ...f, city, name },
      (f.roster ?? []).map(normalizeSavedPlayer),
    ),
    coach: {
      ...coach,
      contractYearsRemaining: coach.contractYearsRemaining ?? 2,
      annualSalary: coach.annualSalary ?? 4_200_000,
    },
    freeAgents: (f.freeAgents ?? []).map((fa) => ({
      ...fa,
      askingSalary: normalizeContractSalary(fa.overall ?? 70, fa.age ?? 25, fa.askingSalary ?? MIN_SALARY),
    })),
    record: f.record ?? { wins: 0, losses: 0 },
  };
  let shaped = withStartingFive(applyRosterSize(base));
  if (f.scenarioId) {
    try {
      shaped = ensureScenarioRosterShape(shaped);
    } catch {
      // Unknown or corrupt scenario id — keep normalized roster as-is.
    }
  }
  return shaped;
}

function cloneFranchise(data: Omit<Franchise, 'id'>): Franchise {
  return normalizeFranchise(JSON.parse(JSON.stringify({ ...data, id: uid('fr') })) as Franchise);
}

function rosterStrength(franchise: Franchise): number {
  if (franchise.scenarioId) return teamRatingStrength(franchise);
  const active = franchise.roster.filter((p) => !p.injured);
  if (!active.length) return 70;
  return active.reduce((s, p) => s + p.overall, 0) / active.length;
}

function franchiseRegularSeasonPhase(franchise: Franchise): boolean {
  return franchise.phase === 'regular_season' || franchise.phase === 'trade_deadline';
}

function syncFranchiseAndLeague(franchise: Franchise, league: League): { franchise: Franchise; league: League } {
  const reg = franchiseRegularSeasonRecord(franchise, league);
  let nextFranchise = franchise.regularSeasonRecord
    ? franchise
    : syncFranchiseRecordFromSchedule(franchise, league);
  if (!nextFranchise.regularSeasonRecord) {
    nextFranchise = { ...nextFranchise, record: reg };
  }
  const nextLeague = syncUserTeam(league, nextFranchise, reg);
  return { franchise: nextFranchise, league: nextLeague };
}

function refreshTradeMarket(franchise: Franchise, league: League): TradeOffer[] {
  return mergeTradeOffers(
    generateLeagueTradeOffers(franchise, league),
    generateTradeBlockOffers(franchise, league),
  );
}

function linkLeagueToFranchise(franchise: Franchise, league: League): { franchise: Franchise; league: League } {
  const userTeam = league.teams.find((t) => t.city === franchise.city && t.name === franchise.name);
  if (!userTeam) return { franchise, league };
  const linkedLeague: League = {
    ...league,
    teams: league.teams.map((t) =>
      t.city === franchise.city && t.name === franchise.name
        ? { ...t, isUser: true, id: t.id }
        : { ...t, isUser: false },
    ),
  };
  const team = linkedLeague.teams.find((t) => t.isUser)!;
  return {
    franchise: { ...franchise, leagueTeamId: team.id },
    league: syncUserTeam(linkedLeague, franchise, franchiseRegularSeasonRecord(franchise, linkedLeague)),
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
  started: false,
  onboardingStep: 1,
  selectedScenario: null,
  franchise: null,
  league: null,
  screen: 'home',
  lastWeekSummary: null,
  toast: null,
  openTradeShopDrawer: false,
  stagedDraftSlotKey: null,
  leagueHeadlines: [],
  lastSavedAt: null,

  selectScenario: (id) => set({ selectedScenario: id }),

  advanceOnboarding: () => set((s) => ({ onboardingStep: Math.max(1, s.onboardingStep) + 1 })),

  bootstrapFranchise: (source: Omit<Franchise, 'id'>, toast: string, scenarioId: ScenarioId | null) => {
    resetIdCounter();
    clearPartnerTradeAssetCache();
    let next = cloneFranchise({ ...source, scenarioId: scenarioId ?? source.scenarioId ?? null });
    next = applyScenarioProfile(next, scenarioId);
    let league = createLeague(
      next.season,
      next.city,
      next.name,
      rosterStrength(next),
      next.record,
      strategyForFranchise(next),
    );
    const linked = linkLeagueToFranchise(next, league);
    next = withStartingFive(linked.franchise);
    league = linked.league;

    if (next.phase === 'draft_scouting' || next.phase === 'draft_night') {
      const pinnedPick = source.draftPickNumber;
      const prepared = prepareDraftScouting(
        next,
        league,
        undefined,
        undefined,
        pinnedPick != null ? { pinnedPick } : undefined,
      );
      next = prepared.franchise;
      league = prepared.league;
    }

    next.tradeOffers = refreshTradeMarket(next, league);
    next.leagueStats = buildLeagueStatSnapshot(league, next);
    next.rfaOffers = seedRFAOffers(next, league);
    league = ensureLeagueRosters(league, next);
    league = syncUserRosterToLeague(league, next);
    const deadlineEvent = generateDeadlineEvent(next);
    const lockerEvent = generateLockerRoomEvent(next);
    next.pendingEvents = [deadlineEvent, lockerEvent].filter(Boolean) as Franchise['pendingEvents'];

    set({
      started: true,
      franchise: next,
      league,
      selectedScenario: scenarioId,
      screen: 'home',
      onboardingStep: 99,
      toast: toast.trim() ? toast : null,
      leagueHeadlines: simulateLeagueTrades(league, next),
      lastSavedAt: new Date().toISOString(),
    });
  },

  startGame: () => {
    const { selectedScenario } = get();
    if (!selectedScenario) return;
    const scenario = SCENARIOS[selectedScenario];
    get().bootstrapFranchise(scenario.franchise, '', selectedScenario);
  },

  startCustomGame: (city, name, market) => {
    get().bootstrapFranchise(
      buildCustomFranchise(city, name, market),
      '',
      null,
    );
  },

  setScreen: (screen) => {
    const { stagedDraftSlotKey, franchise, screen: prevScreen } = get();
    // If leaving the trade screen with a staged-but-unlisted draft slot, prune it
    if (stagedDraftSlotKey && prevScreen === 'trade' && screen !== 'trade' && franchise) {
      const blocked = (franchise.tradeBlock?.pickKeys ?? []).includes(stagedDraftSlotKey);
      if (!blocked) {
        const pruned = franchise.draftPicks.filter((p) => pickKey(p) !== stagedDraftSlotKey);
        set({
          franchise: { ...franchise, draftPicks: pruned },
          screen,
          stagedDraftSlotKey: null,
          lastSavedAt: new Date().toISOString(),
        });
        return;
      }
    }
    set({ screen, stagedDraftSlotKey: null, lastSavedAt: new Date().toISOString() });
  },

  advanceWeek: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;

    if (franchise.phase === 'playoffs' && franchise.playoffs?.active) {
      if (userPlayoffGamePending(franchise.playoffs, league)) {
        set({
          screen: 'play_game',
          toast: 'Set your starting five before this playoff game.',
        });
        return;
      }
      get().advancePlayoffGame();
      return;
    }

    if (franchise.phase === 'training_camp') {
      set({
        franchise: {
          ...franchise,
          phase: 'regular_season',
          week: franchise.week + 1,
          record: { wins: 0, losses: 0 },
          regularSeasonRecord: undefined,
          gameLog: (franchise.gameLog ?? []).filter((g) => g.season !== franchise.season),
        },
        toast: 'Training camp complete. Regular season opens — every week matters.',
      });
      return;
    }

    if (franchise.phase === 'contract_renewals') {
      set({
        screen: 'contract_renewals',
        toast: 'Review player and coach renewals before free agency opens.',
      });
      return;
    }

    if (franchise.phase === 'free_agency') {
      get().advanceFreeAgency();
      return;
    }

    if (franchise.phase === 'season_review') {
      const priorLeague = league;
      const priorPlayoffs = franchise.playoffs;
      const nextSeason = franchise.season + 1;
      let next: Franchise = {
        ...franchise,
        season: nextSeason,
        week: 1,
        record: { wins: 0, losses: 0 },
        regularSeasonRecord: undefined,
        seasonReview: undefined,
        playoffs: undefined,
        madePlayoffs: false,
        draftRecap: undefined,
        gameLog: [],
        gamesThisWeek: 0,
        roster: fillRosterTo18(
          franchise.roster.map((p) => ({
            ...p,
            priorSeasonStats:
              p.seasonStats && p.seasonStats.games > 0 ? { ...p.seasonStats } : p.priorSeasonStats,
            seasonStats: { games: 0, ppg: 0, rpg: 0, apg: 0, mpg: 0 },
          })),
          { city: franchise.city, name: franchise.name },
        ),
        teamScoring: undefined,
        // Tick international stash — develop each player and count down years
        draftStash: (franchise.draftStash ?? []).map((s) => ({
          ...s,
          yearsRemaining: Math.max(0, s.yearsRemaining - 1),
          prospect: {
            ...s.prospect,
            trueOverall: Math.min(
              (s.prospect.truePotential ?? s.prospect.potential[1]) - 2,
              (s.prospect.trueOverall ?? s.prospect.scoutedOverall[0]) + 1 + (s.prospect.workEthic === 'Elite' || s.prospect.workEthic === 'High' ? 1 : 0),
            ),
          },
        })),
      };
      let nextLeague = advanceLeagueSeason(priorLeague, next, nextSeason);
      const linked = linkLeagueToFranchise(next, nextLeague);
      next = refreshCap(linked.franchise);
      nextLeague = linked.league;
      const prepared = prepareDraftScouting(next, nextLeague, priorLeague ?? undefined, priorPlayoffs);
      next = prepared.franchise;
      nextLeague = prepared.league;
      next.leagueStats = buildLeagueStatSnapshot(nextLeague, next);
      const improved = next.roster.filter((p) => p.devTrend === 'Up').length;
      const declined = next.roster.filter((p) => p.devTrend === 'Down').length;
      const stalled  = next.roster.filter((p) => p.devTrend === 'Stalled').length;
      const devNote = improved > 0 || declined > 0
        ? ` ${improved} player${improved !== 1 ? 's' : ''} improved${stalled > 0 ? `, ${stalled} stalled` : ''}${declined > 0 ? `, ${declined} declined` : ''}.`
        : '';
      set({
        franchise: next,
        league: nextLeague,
        screen: 'draft',
        toast: `Draft order set — you pick #${next.draftPickNumber}.${devNote}`,
      });
      return;
    }

    if (franchise.phase === 'draft_scouting' || franchise.phase === 'draft_night') {
      // No picks remaining (all drafted or traded away) — finish the draft instead of navigating.
      if (franchise.draftNight?.active && remainingUserDraftSlots(franchise).length === 0) {
        get().finishDraft();
        return;
      }
      if (!franchise.draftNight?.active) {
        get().startDraftNight();
      } else if (!franchise.draftNight.onClock) {
        get().runToUserPick();
        set({ screen: 'draft' });
      } else {
        set({ screen: 'draft', toast: 'On the clock — make your pick.' });
      }
      return;
    }

    let next = tickInjuries(franchise);
    next = advanceDevelopment(next);

    let nextLeague = syncUserTeam(tickLeagueInjuries(league, next), next);

    const starters =
      next.startingFive?.length === 5 ? next.startingFive : autoStartingFive(next);
    const remaining = Math.max(0, GAMES_PER_WEEK - (next.gamesThisWeek ?? 0));
    let weekResults: GameResult[] = [];

    if (remaining > 0) {
      weekResults = simulateWeekGames(next, nextLeague, remaining, starters);
      const processed = processWeekResults(next, weekResults, starters);
      next = applyGameResults(processed.franchise, weekResults);
      next.gameLog = processed.franchise.gameLog;
    }

    const scheduleThisWeek = buildSeasonSchedule(next, nextLeague).filter((g) => g.week === franchise.week);
    const batchStart = franchise.gamesThisWeek ?? 0;
    const batchOpponentIds = scheduleThisWeek
      .slice(batchStart, batchStart + weekResults.length)
      .map((g) => g.opponentId);
    const batchUserGames = userWeekResultsFromGames(weekResults, batchOpponentIds);

    nextLeague = simulateLeagueWeek(
      nextLeague,
      next.leagueTeamId,
      franchise.week,
      batchUserGames,
      next,
    );
    nextLeague = catchUpLeagueThroughWeek(nextLeague, next.leagueTeamId, next, franchise.week);
    const tradeResult = executeLeagueTrades(nextLeague, next);
    nextLeague = tradeResult.league;
    const tradeNews = tradeResult.headlines;

    next = { ...next, week: next.week + 1, gamesThisWeek: 0, leagueStats: buildLeagueStatSnapshot(nextLeague, next) };
    next.submittedProposals = expireSubmittedProposals(next);
    next.tradeOffers = refreshTradeMarket(next, nextLeague);

    const weekWins =
      weekResults.length > 0
        ? weekResults.filter((r) => r.won).length
        : (next.gameLog ?? [])
            .filter((g) => g.season === franchise.season && g.week === franchise.week)
            .filter((g) => g.won).length;
    next.lockerRoom = moraleAfterWinStreak(next, weekWins);
    next.jobSecurity = updateJobSecurity(next);
    next = refreshCap(next);
    next = { ...next, ownership: refreshOwnershipEvaluation(next) };
    ({ franchise: next, league: nextLeague } = syncFranchiseAndLeague(next, nextLeague));

    const injury = rollInjuries(next);
    next = injury.franchise;
    next = { ...next, ghosts: resolveGhostWatch(next) };

    if (next.week === TRADE_DEADLINE_WEEK && next.phase === 'regular_season') {
      next.phase = 'trade_deadline';
      const ev = generateDeadlineEvent(next);
      if (ev) next.pendingEvents = [...next.pendingEvents, ev];
      next.tradeOffers = refreshTradeMarket(next, nextLeague);
    }

    if (shouldBeginPostseason(next, nextLeague)) {
      const entered = enterPostseason(next, nextLeague);
      next = entered.franchise;
      nextLeague = entered.league;
      set({
        franchise: next,
        league: nextLeague,
        screen: 'playoffs',
        toast: postseasonToast(entered.madePlayoffs, next, nextLeague),
        leagueHeadlines: tradeNews,
      });
      return;
    }

    const locker = generateLockerRoomEvent(next);
    if (locker) next.pendingEvents = [...next.pendingEvents, locker];

    const careerBeat = generateCareerBeat(next);
    if (careerBeat) {
      next.pendingEvents = [...next.pendingEvents, careerBeat.event];
      next = markCareerBeatSeen(next, careerBeat.beatId);
    }

    const last =
      weekResults[weekResults.length - 1] ??
      (next.gameLog ?? []).find((g) => g.season === franchise.season && g.week === franchise.week);
    const headline = last
      ? last.won
        ? `Final: ${last.teamScore}–${last.oppScore} Win. ${last.note}`
        : `Final: ${last.teamScore}–${last.oppScore} Loss. ${last.note}`
      : `Week ${franchise.week} complete.`;

    set({
      franchise: next,
      league: nextLeague,
      lastWeekSummary: {
        results: weekResults.length ? weekResults : (next.gameLog ?? []).filter((g) => g.week === franchise.week && g.season === franchise.season),
        headline,
        injuryNote: injury.injuryNote,
      },
      leagueHeadlines: tradeNews,
      screen: weekResults.length ? 'results' : 'home',
      toast: remaining > 0 ? `${headline} Week advanced.` : `Week ${franchise.week} closed — calendar advanced.`,
    });
  },

  setStartingFive: (playerIds) => {
    const { franchise } = get();
    if (!franchise) return;
    const check = validateStartingFive(franchise, playerIds);
    if (!check.ok) {
      set({ toast: check.error ?? 'Invalid lineup.' });
      return;
    }
    set({ franchise: { ...franchise, startingFive: playerIds } });
  },

  playGame: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    if (franchise.phase !== 'regular_season' && franchise.phase !== 'trade_deadline') {
      set({ toast: 'Games can only be played during the regular season.' });
      return;
    }
    if ((franchise.gamesThisWeek ?? 0) >= GAMES_PER_WEEK) {
      set({ toast: `${GAMES_PER_WEEK} games played this week — advance to continue.` });
      return;
    }

    const starters =
      franchise.startingFive?.length === 5 ? franchise.startingFive : autoStartingFive(franchise);
    const check = validateStartingFive(franchise, starters);
    if (!check.ok) {
      set({ toast: check.error, screen: 'play_game' });
      return;
    }

    const result = simulateSingleGame(
      franchise,
      league,
      starters,
      currentScheduledGame(franchise, league),
    );
    const scheduled = currentScheduledGame(franchise, league);
    const processed = processWeekResults(franchise, [result], starters);
    let next = applyGameResults(processed.franchise, [result]);
    next = {
      ...next,
      gameLog: processed.franchise.gameLog,
      startingFive: starters,
      gamesThisWeek: (franchise.gamesThisWeek ?? 0) + 1,
      leagueStats: buildLeagueStatSnapshot(league, next),
    };
    next.lockerRoom = moraleAfterWinStreak(next, result.won ? 1 : 0);
    next = refreshCap(next);
    let nextLeague = syncUserTeam(league, next);
    nextLeague = applyUserGameToLeague(nextLeague, result, scheduled?.opponentId);

    const headline = result.won
      ? `Final: ${result.teamScore}–${result.oppScore} Win vs ${result.opponent}. ${result.note}`
      : `Final: ${result.teamScore}–${result.oppScore} Loss vs ${result.opponent}. ${result.note}`;

    set({
      franchise: next,
      league: nextLeague,
      lastWeekSummary: { results: [result], headline },
      screen: 'results',
      toast: headline,
    });

    if (shouldBeginPostseason(next, nextLeague)) {
      const entered = enterPostseason(next, nextLeague);
      set({
        franchise: entered.franchise,
        league: entered.league,
        screen: 'playoffs',
        toast: postseasonToast(entered.madePlayoffs, entered.franchise, entered.league),
      });
    }
  },

  advanceToPlayoffs: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    if (franchise.phase !== 'regular_season' && franchise.phase !== 'trade_deadline') {
      set({ toast: 'Skip ahead is only available during the regular season.' });
      return;
    }

    let next = tickInjuries(franchise);
    next = advanceDevelopment(next);
    let nextLeague = league;

    while (next.week <= SCHEDULE_WEEKS) {
      const synced = syncUserTeam(nextLeague, next);
      const starters = next.startingFive?.length === 5 ? next.startingFive : autoStartingFive(next);
      const weekResults = simulateWeekGames(next, synced, GAMES_PER_WEEK, starters);
      const processed = processWeekResults(next, weekResults, starters);
      next = applyGameResults(processed.franchise, weekResults);
      next = { ...next, gameLog: processed.franchise.gameLog, gamesThisWeek: 0 };
      const scheduleThisWeek = buildSeasonSchedule(next, synced).filter((g) => g.week === next.week);
      const batchUserGames = userWeekResultsFromGames(
        weekResults,
        scheduleThisWeek.map((g) => g.opponentId),
      );
      nextLeague = simulateLeagueWeek(
        synced,
        next.leagueTeamId,
        next.week,
        batchUserGames,
      );
      nextLeague = catchUpLeagueThroughWeek(nextLeague, next.leagueTeamId, next, next.week);
      next = { ...next, week: next.week + 1 };
    }

    nextLeague = syncUserTeam(nextLeague, next, franchiseRegularSeasonRecord(next, nextLeague));
    ({ league: nextLeague, franchise: next } = reconcileLeagueRegularSeason(
      nextLeague,
      next,
      next.leagueTeamId,
    ));
    nextLeague = freezeRegularSeasonRecords(nextLeague);
    next = freezeFranchiseRegularSeasonRecord(next, nextLeague);

    next = refreshCap(next);
    const entered = enterPostseason(next, nextLeague);
    set({
      franchise: entered.franchise,
      league: entered.league,
      screen: 'playoffs',
      toast: entered.madePlayoffs
        ? `Season fast-forwarded. You enter the playoffs as the #${getUserSeed(entered.league)} seed.`
        : postseasonToast(false, entered.franchise, entered.league),
    });
  },

  watchPlayoffs: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;

    if (franchise.playoffs) {
      set({ screen: 'playoffs' });
      return;
    }

    const repaired = repairMissingPostseason(franchise, league);
    if (repaired.repaired) {
      set({
        franchise: repaired.franchise,
        league: repaired.league,
        screen: 'playoffs',
        toast: postseasonToast(repaired.franchise.madePlayoffs, repaired.franchise, repaired.league),
      });
      return;
    }

    if (shouldBeginPostseason(franchise, league)) {
      const entered = enterPostseason(franchise, league);
      set({
        franchise: entered.franchise,
        league: entered.league,
        screen: 'playoffs',
        toast: postseasonToast(entered.madePlayoffs, entered.franchise, entered.league),
      });
      return;
    }

    set({ toast: 'Regular season still in progress — finish the schedule first.' });
  },

  advancePlayoffGame: () => {
    const { franchise, league } = get();
    if (!franchise?.playoffs || !league) return;

    if (userPlayoffGamePending(franchise.playoffs, league)) {
      set({
        screen: 'play_game',
        toast: 'Choose your starting five, then play this playoff game.',
      });
      return;
    }

    const { state, headline, playByPlay } = simNextPlayoffGame(franchise.playoffs, league, franchise);
    let next = { ...franchise, playoffs: state, lastPlayoffPbp: playByPlay ?? franchise.lastPlayoffPbp };

    if (state.round === 'Complete') {
      next.phase = 'season_review';
      next.seasonReview = buildSeasonReview(next, state);
      next.jobSecurity = state.userResult === 'Champions' ? 95 : Math.max(8, next.jobSecurity - 8);
      next.memory = [
        {
          id: uid('mem'),
          season: next.season,
          week: next.week,
          text: state.userResult === 'Champions'
            ? `Won the championship. ${state.championName} banner raised.`
            : `Season ended: ${state.userResult ?? 'Eliminated'}. Primary issue: late-game execution.`,
          type: 'playoff',
        },
        ...next.memory,
      ];
      set({
        franchise: next,
        toast: headline ?? `Playoffs complete. ${next.seasonReview.ownershipVerdict}`,
        screen: 'home',
      });
      return;
    }

    set({ franchise: next, toast: headline ?? 'Playoff game simulated.', screen: 'playoffs' });
  },

  playPlayoffGame: () => {
    const { franchise, league } = get();
    if (!franchise?.playoffs || !league) return;
    if (franchise.phase !== 'playoffs' || !franchise.playoffs.active) {
      set({ toast: 'Playoff games can only be played during the postseason.' });
      return;
    }
    if (!userPlayoffGamePending(franchise.playoffs, league)) {
      set({ toast: 'No active series — sim league games from the playoff center.' });
      return;
    }

    const starters =
      franchise.startingFive?.length === 5 ? franchise.startingFive : autoStartingFive(franchise);
    const check = validateStartingFive(franchise, starters);
    if (!check.ok) {
      set({ toast: check.error ?? 'Invalid lineup.' });
      return;
    }

    const franchiseWithLineup = { ...franchise, startingFive: starters };
    const { state, headline, playByPlay } = simNextPlayoffGame(
      franchise.playoffs,
      league,
      franchiseWithLineup,
    );
    let next = {
      ...franchiseWithLineup,
      playoffs: state,
      lastPlayoffPbp: playByPlay ?? franchise.lastPlayoffPbp,
    };

    if (state.round === 'Complete') {
      next.phase = 'season_review';
      next.seasonReview = buildSeasonReview(next, state);
      next.jobSecurity = state.userResult === 'Champions' ? 95 : Math.max(8, next.jobSecurity - 8);
      next.memory = [
        {
          id: uid('mem'),
          season: next.season,
          week: next.week,
          text: state.userResult === 'Champions'
            ? `Won the championship. ${state.championName} banner raised.`
            : `Season ended: ${state.userResult ?? 'Eliminated'}. Primary issue: late-game execution.`,
          type: 'playoff',
        },
        ...next.memory,
      ];
      set({
        franchise: next,
        toast: headline ?? `Playoffs complete. ${next.seasonReview.ownershipVerdict}`,
        screen: 'home',
      });
      return;
    }

    set({
      franchise: next,
      toast: headline ?? 'Playoff game complete.',
      screen: 'playoffs',
    });
  },

  simPlayoffSeries: () => {
    const { franchise, league } = get();
    if (!franchise?.playoffs || !league) return;

    const { state, headlines } = simCurrentPlayoffRound(franchise.playoffs, league, franchise);
    const lastGame = getAllBracketSeries(state).flatMap((s) => s.games).at(-1);
    let next = {
      ...franchise,
      playoffs: state,
      lastPlayoffPbp: lastGame?.playByPlay ?? franchise.lastPlayoffPbp,
    };

    if (state.round === 'Complete') {
      next.phase = 'season_review';
      next.seasonReview = buildSeasonReview(next, state);
      next.jobSecurity = state.userResult === 'Champions' ? 95 : Math.max(8, next.jobSecurity - 8);
      next.memory = [
        {
          id: uid('mem'),
          season: next.season,
          week: next.week,
          text: state.userResult === 'Champions'
            ? 'Dynasty moment: franchise wins the title.'
            : `Eliminated — ${state.userResult}. The window may be closing.`,
          type: 'playoff',
        },
        ...next.memory,
      ];
    }

    set({
      franchise: next,
      toast: headlines[headlines.length - 1] ?? `${roundLabel(state.round)} round simulated.`,
      screen: 'playoffs',
    });
  },

  acceptTrade: (offer) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;

    const incomingSalary = offer.incoming.players.reduce((s, p) => s + p.contract.annualSalary, 0);
    const outgoingSalary = offer.outgoing.players.reduce((s, p) => s + p.contract.annualSalary, 0);
    const capCheck = validateTradeSalaryMatch(franchise, incomingSalary, outgoingSalary);
    if (!capCheck.ok) {
      set({ toast: `Cap office blocked the trade: ${capCheck.message}` });
      return;
    }

    const ghosts = recordTradeGhosts(franchise, offer);
    let next = executeTrade(franchise, offer);
    next = {
      ...next,
      ghosts: [...ghosts, ...next.ghosts],
      pendingCounter: null,
      tradeNegotiation: null,
    };
    next = refreshCap(next);
    next.jobSecurity = updateJobSecurity(next);
    const partner =
      league.teams.find((t) => t.id === offer.partnerTeamId) ??
      league.teams.find((t) => t.fullName === offer.partnerTeam);
    let nextLeague = syncUserTeam(league, next);
    if (partner) {
      nextLeague = applyUserTradeToLeague(
        nextLeague,
        next,
        partner.id,
        offer.outgoing.players,
        offer.incoming.players,
        offer.outgoing.picks,
        offer.incoming.picks,
      );
    }
    // If draft is live and user received picks, add those slots to draftNight
    if (next.draftNight?.active && offer.incoming.picks.length > 0 && partner) {
      const updatedOrder = nextLeague.draftOrder ?? [];
      const userKey = `${next.city}|${next.name}`;
      const newSlots = updatedOrder
        .filter((e) => `${e.city}|${e.name}` === userKey)
        .map((e) => e.pick);
      const current = next.draftNight.userPickNumbers;
      const merged = [...new Set([...current, ...newSlots])].sort((a, b) => a - b);
      if (merged.length !== current.length) {
        const onClock = merged.includes(next.draftNight.currentPick);
        next = {
          ...next,
          draftNight: { ...next.draftNight, userPickNumbers: merged, onClock },
        };
      }
    }
    next.tradeOffers = refreshTradeMarket(next, nextLeague);
    set({
      franchise: next,
      league: nextLeague,
      toast: `Trade completed. ${offer.analysis.longTerm}`,
      screen: 'home',
    });
  },

  submitTradeProposal: (proposal) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const check = validateProposal(franchise, league, proposal);
    if (!check.valid) {
      set({ toast: check.errors[0] ?? 'Trade office rejected the package.' });
      return;
    }
    const negotiation = franchise.tradeNegotiation;
    const samePartner = negotiation?.partnerTeamId === proposal.partnerTeamId;
    const round = samePartner ? negotiation.round + 1 : 0;
    const result = resolveProposalSubmission(franchise, league, proposal, round);
    if (!result.offer && result.submitted.status === 'rejected') {
      set({
        franchise: {
          ...franchise,
          submittedProposals: [result.submitted, ...(franchise.submittedProposals ?? [])].slice(0, 12),
        },
        toast: result.submitted.responseNote ?? 'Partner rejected the package.',
        screen: 'trade',
      });
      return;
    }
    if (result.autoAccept && result.offer) {
      const submitted = result.submitted;
      get().acceptTrade(result.offer);
      const current = get().franchise;
      if (current) {
        set({
          franchise: {
            ...current,
            submittedProposals: [submitted, ...(current.submittedProposals ?? [])].slice(0, 12),
          },
        });
      }
      return;
    }
    const partner = getTeamById(league, proposal.partnerTeamId);
    const nextNegotiation =
      result.autoAccept || result.submitted.status === 'rejected'
        ? null
        : {
            partnerTeamId: proposal.partnerTeamId,
            partnerTeamName: partner?.fullName ?? result.submitted.partnerTeamName,
            round: samePartner ? round : 1,
          };

    set({
      franchise: {
        ...franchise,
        pendingCounter: result.counter,
        tradeNegotiation: nextNegotiation,
        submittedProposals: [result.submitted, ...(franchise.submittedProposals ?? [])].slice(0, 12),
      },
      toast:
        round > 0
          ? `Negotiation round ${round + 1}: ${result.submitted.responseNote ?? result.submitted.partnerVerdict}`
          : result.submitted.responseNote ?? `${result.submitted.partnerTeamName} responded to your proposal.`,
      screen: 'trade',
    });
  },

  requestTradeCounter: (proposal) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const counter = generateCounterOffer(franchise, league, proposal);
    if (!counter) {
      set({ toast: 'No counter available — partner hung up.' });
      return;
    }
    set({
      franchise: { ...franchise, pendingCounter: counter, tradeNegotiation: {
        partnerTeamId: proposal.partnerTeamId,
        partnerTeamName: getTeamById(league, proposal.partnerTeamId)?.fullName ?? 'Partner',
        round: 1,
      } },
      toast: counter.analysis.longTerm,
      screen: 'trade',
    });
  },

  acceptPendingCounter: () => {
    const franchise = get().franchise;
    if (!franchise?.pendingCounter) return;
    get().acceptTrade(franchise.pendingCounter);
  },

  declinePendingCounter: () => {
    const { franchise } = get();
    if (!franchise) return;
    set({
      franchise: { ...franchise, pendingCounter: null, tradeNegotiation: null },
      toast: 'Counter declined. Assets stay put — for now.',
    });
  },

  startDraftNight: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const base = franchise.draftNight?.active
      ? normalizeDraftNight(franchise.draftNight, franchise.draftPickNumber)
      : initDraftNight(franchise, league);
    const draftNight = runDraftToUserPick(base, league, franchise);
    set({
      franchise: {
        ...franchise,
        phase: 'draft_night',
        draftNight,
      },
      screen: 'draft',
      toast: draftNight.onClock
        ? `Round ${draftNight.log.length ? '' : '1 — '}on the clock at pick #${draftNight.currentPick}.`
        : `Two-round draft live. Your picks: ${draftNight.userPickNumbers.map((p) => `#${p}`).join(' & ')}.`,
    });
  },

  runToUserPick: () => {
    const { franchise, league } = get();
    if (!franchise?.draftNight || !league) return;
    const draftNight = runDraftToUserPick(
      normalizeDraftNight(franchise.draftNight, franchise.draftPickNumber),
      league,
      franchise,
    );
    const nextPick = draftNight.userPickNumbers.find((p) => !draftNight.userPicksMade.includes(p));
    set({
      franchise: { ...franchise, draftNight },
      toast: draftNight.onClock
        ? `Round ${draftNight.currentPick <= 30 ? 1 : 2} — pick #${draftNight.currentPick}. Make your selection.`
        : nextPick
          ? `Simming toward your next pick (#${nextPick}).`
          : 'Draft board moving…',
    });
  },

  advanceDraftPick: () => {
    const { franchise, league } = get();
    if (!franchise?.draftNight || !league || franchise.draftNight.onClock) return;
    const before = franchise.draftNight.log.length;
    const draftNight = simOneDraftPick(franchise.draftNight, league, franchise);
    const last = draftNight.log[draftNight.log.length - 1];
    let nextLeague = league;
    if (draftNight.log.length > before && last && !last.isUser) {
      const prospect = draftNight.board.find((p) => playerName(p) === last.prospectName);
      if (prospect) {
        nextLeague = addDraftPickToLeague(league, last.pick, prospect, franchise);
      }
    }
    set({
      franchise: { ...franchise, draftNight },
      league: nextLeague,
      toast: last ? `Pick ${last.pick}: ${last.teamName} takes ${last.prospectName}.` : undefined,
    });
  },

  finishDraft: () => {
    const { franchise, league } = get();
    if (!franchise?.draftNight || !league) return;
    const draftNight = simDraftToEnd(franchise.draftNight, league, franchise);
    const draftedNames = franchise.draftNight.userDraftedNames ?? [];
    let next: typeof franchise = { ...franchise, draftNight };
    const { franchise: withContracts, summary } = processContractRenewals(next, draftedNames);
    next = rememberRenewals(withContracts, summary);
    next = withDraftRecap({ ...next, draftNight });
    set({
      franchise: refreshCap(next),
      screen: 'contract_renewals',
      toast: `Draft complete. ${formatRenewalHeadline(summary)} Set your renewals, then open free agency.`,
    });
  },

  pickOnDraftClock: (prospectId) => {
    const { franchise, league } = get();
    if (!franchise?.draftNight || !league) return;
    const result = userSelectProspect(franchise.draftNight, franchise, prospectId);
    if (!result) return;

    const available = availableProspects(franchise.draftNight);
    const passed = available
      .filter((p) => p.id !== prospectId)
      .sort((a, b) => (b.truePotential ?? b.potential[1]) - (a.truePotential ?? a.potential[1]))[0];
    const ghost =
      passed && passed.id !== prospectId
        ? recordPassedProspectGhost(franchise, passed, result.prospect)
        : null;

    const draftedNames = [...(franchise.draftNight.userDraftedNames ?? []), playerName(result.prospect)];

    let next = draftProspect(
      { ...franchise, draftNight: result.state, draftBoard: franchise.draftNight.board },
      prospectId,
      result.pickNumber,
    );
    next = refreshCap(next);
    if (ghost) next = { ...next, ghosts: [ghost, ...next.ghosts] };

    let draftNight: typeof result.state = { ...result.state, userDraftedNames: draftedNames };

    if (!isUserDraftComplete(draftNight)) {
      draftNight = runDraftToUserPick(draftNight, league, next);
      set({
        franchise: { ...next, draftNight },
        screen: 'draft',
        toast: draftNight.onClock
          ? `Round 1 pick secured. On the clock for Round 2 — pick #${draftNight.currentPick}.`
          : 'Round 1 pick in. Simming toward your Round 2 pick.',
      });
      return;
    }

    draftNight = simDraftToEnd(draftNight, league, next);

    const { franchise: withContracts, summary } = processContractRenewals(next, draftedNames);
    next = rememberRenewals(withContracts, summary);
    next = withDraftRecap({ ...next, draftNight });

    set({
      franchise: refreshCap(next),
      screen: 'contract_renewals',
      toast: `Draft complete. ${formatRenewalHeadline(summary)} Set your renewals, then open free agency.`,
    });
  },

  stashOnDraftClock: (prospectId) => {
    const { franchise, league } = get();
    if (!franchise?.draftNight || !league) return;
    const result = userSelectProspect(franchise.draftNight, franchise, prospectId);
    if (!result) return;

    const prospect = result.prospect;
    if (!prospect.isInternational) return;

    const stashedPlayer = {
      prospect,
      draftSeason: franchise.season,
      yearsRemaining: prospect.stashYears ?? 1,
    };

    const draftedNames = [...(franchise.draftNight.userDraftedNames ?? []), playerName(prospect)];
    let draftNight: DraftNightState = { ...result.state, userDraftedNames: draftedNames };

    let next: typeof franchise = {
      ...franchise,
      draftNight: draftNight,
      draftBoard: franchise.draftNight.board,
      draftStash: [...(franchise.draftStash ?? []), stashedPlayer],
    };

    if (!isUserDraftComplete(draftNight)) {
      draftNight = runDraftToUserPick(draftNight, league, next);
      set({
        franchise: { ...next, draftNight },
        screen: 'draft',
        toast: `${playerName(prospect)} stashed overseas for ${stashedPlayer.yearsRemaining} year${stashedPlayer.yearsRemaining > 1 ? 's' : ''}. On the clock for Round 2.`,
      });
      return;
    }

    draftNight = simDraftToEnd(draftNight, league, next);
    const { franchise: withContracts, summary } = processContractRenewals(next, draftedNames);
    next = rememberRenewals(withContracts, summary);
    next = withDraftRecap({ ...next, draftNight });
    set({
      franchise: refreshCap(next),
      screen: 'contract_renewals',
      toast: `Draft complete. ${playerName(prospect)} stashed overseas. ${formatRenewalHeadline(summary)}`,
    });
  },

  callUpStashedPlayer: (prospectId) => {
    const { franchise } = get();
    if (!franchise) return;
    const stash = franchise.draftStash ?? [];
    const entry = stash.find((s) => s.prospect.id === prospectId);
    if (!entry) return;

    const next = draftProspect(
      { ...franchise, draftStash: stash.filter((s) => s.prospect.id !== prospectId) },
      prospectId,
    );
    set({
      franchise: refreshCap({ ...next, roster: next.roster }),
      toast: `${playerName(entry.prospect)} called up from overseas. Signed to a rookie deal.`,
    });
  },

  selectDraftProspect: (prospectId) => {
    const { franchise } = get();
    if (!franchise) return;
    if (!franchise.draftNight?.active) {
      get().startDraftNight();
    }
    get().pickOnDraftClock(prospectId);
  },

  assignDevFocus: (playerId, focus) => {
    const { franchise } = get();
    if (!franchise) return;
    const player = franchise.roster.find((p) => p.id === playerId);
    set({
      franchise: setDevFocus(franchise, playerId, focus),
      toast: player
        ? `Development plan set for ${player.firstName} ${player.lastName}: ${focus}`
        : null,
    });
  },

  resolvePendingEvent: (eventId, optionId) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    let next = resolveEvent(franchise, eventId, optionId);
    if (optionId === 'trade' || optionId === 'review' || optionId === 'listen' || optionId === 'add' || optionId === 'shakeup') {
      next.tradeOffers = refreshTradeMarket(next, league);
    }
    set({ franchise: next });
  },

  pitchAgent: (agentId, pitch, offeredSalary, offeredYears) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const result = pitchFreeAgent(franchise, league, agentId, pitch, offeredSalary, offeredYears);
    let next = refreshCap(result.franchise);
    next.jobSecurity = updateJobSecurity(next);
    let nextLeague = syncUserRosterToLeague(syncUserTeam(league, next), next);
    set({
      franchise: next,
      league: nextLeague,
      toast: result.message,
    });
  },

  advanceFreeAgency: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const ai = simAISignings(franchise, league);
    let next = refreshCap(ai.franchise);
    next = { ...next, phase: 'training_camp', week: next.week + 1, cap: { ...next.cap, mleUsed: false, baeUsed: false } };
    const nextLeague = syncUserTeam(syncUserRosterToLeague(ai.league, next), next);
    set({
      franchise: next,
      league: nextLeague,
      toast: ai.headlines[0] ?? 'Free agency winding down. Training camp next.',
      screen: 'home',
    });
  },

  startFreeAgency: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    get().openFreeAgency();
  },

  dismissToast: () => set({ toast: null }),

  fireHeadCoach: () => {
    const { franchise } = get();
    if (!franchise) return;
    const next = fireCoach(franchise);
    set({
      franchise: next,
      toast: 'Head coach fired. The market is open — hire carefully.',
      screen: 'coach',
    });
  },

  hireHeadCoach: (candidateId) => {
    const { franchise } = get();
    if (!franchise) return;
    const result = hireCoach(franchise, candidateId);
    set({
      franchise: refreshCap(result.franchise),
      toast: result.message,
      screen: 'coach',
    });
  },

  refreshCoachMarket: () => {
    const { franchise } = get();
    if (!franchise) return;
    set({
      franchise: { ...franchise, coachMarket: generateCoachMarket(5, franchise.coach.name) },
      toast: 'Coaching market refreshed.',
    });
  },

  matchRFA: (offerId) => {
    const { franchise } = get();
    if (!franchise) return;
    const result = matchRFAOffer(franchise, offerId);
    set({
      franchise: refreshCap(result.franchise),
      toast: result.message,
    });
  },

  declineRFA: (offerId) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const result = declineRFAOffer(franchise, offerId);
    set({
      franchise: refreshCap(result.franchise),
      league: syncUserTeam(league, result.franchise),
      toast: result.message,
    });
  },

  submitTradeChain: (chain) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const result = executeTradeChain(franchise, league, chain);
    if (!result) {
      set({ toast: 'Three-team chain rejected — one leg failed CBA or team interest.' });
      return;
    }
    let next = executeTrade(franchise, result.offer);
    next = {
      ...next,
      ghosts: [...result.ghosts, ...next.ghosts],
      pendingCounter: null,
    };
    next = refreshCap(next);
    next.jobSecurity = updateJobSecurity(next);
    const nextLeague = syncUserTeam(league, next);
    next.tradeOffers = generateLeagueTradeOffers(next, nextLeague);
    set({
      franchise: next,
      league: nextLeague,
      toast: `Three-team block buster complete. ${result.offer.analysis.longTerm}`,
      screen: 'home',
    });
  },

  resetOnboarding: () => {
    set({ onboardingStep: 1, selectedScenario: null });
  },

  resetGame: () => {
    useGameStore.persist.clearStorage();
    set({
      started: false,
      onboardingStep: 1,
      selectedScenario: null,
      franchise: null,
      league: null,
      screen: 'home',
      lastWeekSummary: null,
      toast: null,
      leagueHeadlines: [],
      lastSavedAt: null,
    });
  },

  setFinancesPolicy: (patch) => {
    const { franchise } = get();
    if (!franchise) return;
    set({
      franchise: {
        ...franchise,
        ticketPriceBias:
          patch.ticketPriceBias !== undefined
            ? Math.max(-20, Math.min(20, patch.ticketPriceBias))
            : franchise.ticketPriceBias ?? 0,
        scoutingBudget:
          patch.scoutingBudget !== undefined
            ? Math.max(1, Math.min(10, patch.scoutingBudget))
            : franchise.scoutingBudget ?? 5,
      },
    });
  },

  toggleTradeBlockPlayer: (playerId) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const wasListed = isPlayerOnBlock(franchise, playerId);
    let next = togglePlayerOnBlock(franchise, playerId);
    const nowListed = isPlayerOnBlock(next, playerId);

    if (!wasListed && nowListed) {
      const withoutListing = {
        ...next,
        tradeOffers: (next.tradeOffers ?? []).filter(
          (offer) => !(offer.blockInquiry && offer.listedAssetKey === playerId),
        ),
      };
      const newOffers = generateInstantBlockOffers(withoutListing, league, { type: 'player', key: playerId });
      next = {
        ...withoutListing,
        tradeOffers: mergeTradeOffers(withoutListing.tradeOffers ?? [], newOffers),
      };
      const player = next.roster.find((p) => p.id === playerId);
      set({
        franchise: next,
        toast: newOffers.length
          ? `${newOffers.length} offer${newOffers.length === 1 ? '' : 's'} on ${player ? playerName(player) : 'your listing'}.`
          : 'Listed — no takers yet.',
      });
      return;
    }

    set({ franchise: next });
  },

  toggleTradeBlockPick: (key) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const wasListed = isPickOnBlock(franchise, key);
    let next = togglePickOnBlock(franchise, key);
    const nowListed = isPickOnBlock(next, key);

    if (!wasListed && nowListed) {
      const withoutListing = {
        ...next,
        tradeOffers: (next.tradeOffers ?? []).filter(
          (offer) => !(offer.blockInquiry && offer.listedAssetKey === key),
        ),
      };
      const newOffers = generateInstantBlockOffers(withoutListing, league, { type: 'pick', key });
      next = {
        ...withoutListing,
        tradeOffers: mergeTradeOffers(withoutListing.tradeOffers ?? [], newOffers),
      };
      const pick = next.draftPicks.find((p) => pickKey(p) === key);
      set({
        franchise: next,
        toast: newOffers.length
          ? `${newOffers.length} offer${newOffers.length === 1 ? '' : 's'} on ${pick ? pickDescription(pick) : 'your pick'}.`
          : 'Listed — no takers yet.',
      });
      return;
    }

    set({ franchise: next });
  },

  addDraftSlotToShoppingList: (pickNumber) => {
    const { franchise } = get();
    if (!franchise) return;
    // Stage the current-year pick AND mark it ephemerally; pruneStagedDraftPicks
    // removes it on screen-change if the user backs out without completing a trade.
    const pick = pickForDraftSlot(franchise, pickNumber);
    const next = ensurePickOnBooks(franchise, pick);
    set({
      franchise: next,
      screen: 'trade',
      openTradeShopDrawer: true,
      stagedDraftSlotKey: pickKey(pick),
    });
  },

  syncBlockListingOffers: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    if (!needsBlockOfferReconcile(franchise)) return;

    const { franchise: next, added } = reconcileBlockListingOffers(franchise, league);
    set({
      franchise: next,
      toast:
        added > 0
          ? `${added} offer${added === 1 ? '' : 's'} on your listings.`
          : 'Offers refreshed for your listings.',
    });
  },

  clearTradeBlock: () => {
    const { franchise } = get();
    if (!franchise) return;
    const next = clearTradeBlock(franchise);
    set({
      franchise: {
        ...next,
        tradeOffers: (next.tradeOffers ?? []).filter((offer) => !offer.blockInquiry),
      },
      toast: 'Trade block cleared.',
    });
  },

  withdrawProposal: (proposalId) => {
    const { franchise } = get();
    if (!franchise) return;
    set({
      franchise: {
        ...franchise,
        submittedProposals: withdrawSubmittedProposal(franchise, proposalId),
      },
      toast: 'Proposal withdrawn.',
    });
  },

  renewPlayerContract: (playerId) => {
    const { franchise } = get();
    if (!franchise) return;
    const player = franchise.roster.find((p) => p.id === playerId);
    let next = applyPlayerRenewal(franchise, playerId);
    if (next === franchise) {
      set({
        toast: player
          ? `Could not re-sign ${playerName(player)} — need cap room or Bird rights. Release or trade first.`
          : 'Contract renewal failed.',
      });
      return;
    }
    next = refreshCap(next);
    set({
      franchise: next,
      toast: player ? `${playerName(player)} re-signed.` : 'Contract renewed.',
    });
  },

  releasePlayerContract: (playerId) => {
    const { franchise } = get();
    if (!franchise) return;
    const player = franchise.roster.find((p) => p.id === playerId);
    if (!player) {
      set({ toast: 'Player not found on roster.' });
      return;
    }
    if (player?.isStar || player?.role === 'Franchise Player' || player?.role === 'Star') {
      set({ toast: 'Franchise stars must be traded — cannot waive.' });
      return;
    }
    let next =
      waiveOffseasonPlayer(franchise, playerId) ??
      releaseExpiringPlayer(franchise, playerId);
    if (next === franchise) {
      set({
        toast: `${playerName(player)} could not be waived — only available during offseason cuts or on expiring deals.`,
      });
      return;
    }
    next = refreshCap(next);
    set({
      franchise: next,
      toast: player ? `${playerName(player)} waived.` : 'Player waived.',
    });
  },

  renewCoachContract: () => {
    const { franchise } = get();
    if (!franchise) return;
    set({
      franchise: applyCoachRenewal(franchise),
      toast: `${franchise.coach.name} extended.`,
    });
  },

  declineCoachContract: () => {
    const { franchise } = get();
    if (!franchise) return;
    const name = franchise.coach.name;
    set({
      franchise: declineCoachRenewal(franchise),
      toast: `${name} not renewed — coaching market is open.`,
    });
  },

  openFreeAgency: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const gate = canOpenFreeAgency(franchise);
    if (!gate.ok) {
      set({ toast: gate.reason ?? 'Complete offseason roster moves first.' });
      return;
    }
    const opened = openFreeAgencyAfterRenewals(franchise, league);
    const freeAgents = refreshFreeAgentInterest(opened.franchise, opened.league);
    set({
      franchise: refreshCap({
        ...opened.franchise,
        freeAgents,
        cap: { ...opened.franchise.cap, mleUsed: false, baeUsed: false },
      }),
      league: ensureLeagueRosters(opened.league, opened.franchise),
      screen: 'free_agency',
      toast: `${freeAgents.length} free agents available — real league talent plus unsigned vets.`,
    });
  },

  acceptDraftPickTrade: (offer, pickNumber) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;

    const incomingSalary = offer.incoming.players.reduce((s, p) => s + p.contract.annualSalary, 0);
    const outgoingSalary = offer.outgoing.players.reduce((s, p) => s + p.contract.annualSalary, 0);
    const capCheck = validateTradeSalaryMatch(franchise, incomingSalary, outgoingSalary);
    if (!capCheck.ok) {
      set({ toast: `Cap office blocked the trade: ${capCheck.message}` });
      return;
    }

    const ghosts = recordTradeGhosts(franchise, offer);
    const traded = applyDraftPickTrade(franchise, league, pickNumber, offer);
    let next = traded.franchise;
    next = {
      ...next,
      ghosts: [...ghosts, ...next.ghosts],
      pendingCounter: null,
      tradeNegotiation: null,
    };
    next = refreshCap(next);
    next.jobSecurity = updateJobSecurity(next);
    next.tradeOffers = refreshTradeMarket(next, traded.league);

    set({
      franchise: next,
      league: traded.league,
      screen: 'draft',
      toast: `Pick traded. ${offer.analysis.longTerm}`,
    });
  },

  submitDraftPickTrade: (proposal, pickNumber) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    let next = ensurePickOnBooks(franchise, pickForDraftSlot(franchise, pickNumber));
    const check = validateProposal(next, league, proposal);
    if (!check.valid) {
      set({ toast: check.errors[0] ?? 'Trade office rejected the package.' });
      return;
    }
    const result = resolveProposalSubmission(next, league, proposal, 0);
    if (!result.offer) {
      set({ toast: result.submitted.responseNote ?? 'Partner rejected the pick offer.' });
      return;
    }
    get().acceptDraftPickTrade(result.offer, pickNumber);
  },

  exportSave: () => {
    const state = get();
    if (!state.started || !state.franchise) return;
    downloadSaveFile(JSON.stringify(buildSavePayload(state), null, 2));
  },

  importSave: (raw) => {
    const data = parseSaveFile(raw);
    if (!data) return false;
    set({
      started: data.started,
      franchise: data.franchise ? normalizeFranchise(data.franchise) : null,
      league: data.league ? normalizeLeague(data.league) : null,
      screen: data.screen,
      selectedScenario: data.selectedScenario,
      leagueHeadlines: data.leagueHeadlines,
      lastWeekSummary: data.lastWeekSummary,
      onboardingStep: 99,
      toast: 'Dynasty file imported. Your franchise timeline continues.',
      lastSavedAt: data.savedAt,
    });
    return true;
  },
    }),
    {
      name: 'dynasty-front-office-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        started: state.started,
        franchise: state.franchise,
        league: state.league,
        screen: state.screen,
        selectedScenario: state.started ? state.selectedScenario : null,
        leagueHeadlines: state.leagueHeadlines,
        lastWeekSummary: state.lastWeekSummary,
        lastSavedAt: state.lastSavedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.franchise) {
          try {
            let franchise = normalizeFranchise(state.franchise);
            if (!franchise.scenarioId && state.selectedScenario) {
              franchise = applyScenarioProfile(franchise, state.selectedScenario);
            }
            state.franchise = franchise;
          } catch (err) {
            console.error('Failed to normalize franchise on rehydrate:', err);
          }
        }
        if (state?.league) {
          let league = normalizeLeague(state.league, state.franchise ?? undefined);
          if (state.franchise?.leagueTeamId) {
            if (franchiseRegularSeasonPhase(state.franchise)) {
              league = catchUpLeagueThroughWeek(
                league,
                state.franchise.leagueTeamId,
                state.franchise,
                Math.max(0, state.franchise.week - 1),
              );
            }
            if (leagueRecordsNeedReconcile(league)) {
              const reconciled = reconcileLeagueRegularSeason(
                league,
                state.franchise,
                state.franchise.leagueTeamId,
              );
              league = freezeRegularSeasonRecords(reconciled.league);
              state.franchise = freezeFranchiseRegularSeasonRecord(reconciled.franchise, league);
            } else {
              const synced = syncFranchiseAndLeague(state.franchise, league);
              state.franchise = synced.franchise;
              league = synced.league;
            }
          }
          state.league = ensureLeagueRosters(league, state.franchise ?? undefined);
        }
        if (state?.franchise) {
          try {
            state.franchise = refreshCap(state.franchise);
          } catch (err) {
            console.error('Failed to refresh cap on rehydrate:', err);
          }
        }
        if (state?.franchise && state?.league) {
          const repaired = repairMissingPostseason(state.franchise, state.league);
          if (repaired.repaired) {
            state.franchise = refreshCap(repaired.franchise);
            state.league = repaired.league;
            if (state.franchise.phase === 'playoffs') {
              state.screen = 'playoffs';
            }
          }
        }
      },
    },
  ),
);
