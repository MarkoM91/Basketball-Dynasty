import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  DevFocus,
  Franchise,
  GameResult,
  League,
  PitchType,
  ScenarioId,
  ScreenId,
  TradeOffer,
  TradeProposal,
  TradeChainProposal,
} from '../types/game';
import { createLeague, getTeamById, normalizeLeague, syncUserTeam } from '../data/league';
import { resolveTeamFullName, resolveTeamIdentity } from '../data/teamNames';
import { applyRosterSize, fillRosterTo18 } from '../data/rosterBuilder';
import { normalizeContractSalary } from '../engine/salaries';
import { pickKey, validateTradeSalaryMatch } from '../engine/cap';
import { SCENARIOS, buildCustomFranchise, resetIdCounter, uid, playerName } from '../data/scenarios';
import {
  generateFreeAgentPool,
  pitchFreeAgent,
  refreshFreeAgentInterest,
  simAISignings,
} from '../engine/freeAgency';
import {
  ensureUserPlayoffSeed,
  generateLeagueTradeOffers,
  getUserSeed,
  simulateLeagueTrades,
  simulateLeagueWeek,
  userMadePlayoffs,
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
  buildSeasonReview,
  initPlayoffs,
  normalizePlayoffState,
  roundLabel,
  simCurrentPlayoffRound,
  simNextPlayoffGame,
  userPlayoffGamePending,
} from '../engine/playoffs';
import { getAllBracketSeries } from '../engine/playoffBracket';
import {
  declineCoachRenewal,
  pendingRenewalCount,
  releaseExpiringPlayer,
  renewCoachContract as applyCoachRenewal,
  renewPlayerContract as applyPlayerRenewal,
} from '../engine/contractRenewals';
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
  pickOnDraftClock: (prospectId: string) => void;
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
  syncBlockListingOffers: () => void;
  clearTradeBlock: () => void;
  withdrawProposal: (proposalId: string) => void;
  renewPlayerContract: (playerId: string) => void;
  releasePlayerContract: (playerId: string) => void;
  renewCoachContract: () => void;
  declineCoachContract: () => void;
  openFreeAgency: () => void;
}

function withStartingFive(f: Franchise): Franchise {
  const startingFive =
    f.startingFive?.length === 5 ? f.startingFive : autoStartingFive(f);
  return { ...f, startingFive, gamesThisWeek: f.gamesThisWeek ?? 0 };
}

export function normalizeFranchise(f: Franchise): Franchise {
  const { city, name } = resolveTeamIdentity(f.city, f.name);
  const base = {
    ...f,
    city,
    name,
    ghosts: f.ghosts ?? [],
    gameLog: (f.gameLog ?? []).map((g) => ({ ...g, opponent: resolveTeamFullName(g.opponent) })),
    coachMarket: f.coachMarket ?? [],
    rfaOffers: (f.rfaOffers ?? []).map((o) => ({
      ...o,
      offeringTeam: resolveTeamFullName(o.offeringTeam),
    })),
    gamesThisWeek: f.gamesThisWeek ?? 0,
    ticketPriceBias: f.ticketPriceBias ?? 0,
    scoutingBudget: f.scoutingBudget ?? 5,
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
    draftPicks: (f.draftPicks ?? []).map((pick) => ({
      ...pick,
      originalTeam: resolveTeamFullName(pick.originalTeam),
    })),
    draftNight: f.draftNight
      ? normalizeDraftNight(f.draftNight, f.draftPickNumber)
      : undefined,
    draftRecap:
      f.phase === 'draft_scouting' && !f.draftNight?.active ? undefined : f.draftRecap,
    playoffs: f.playoffs ? normalizePlayoffState(f.playoffs) : undefined,
    roster: fillRosterTo18(
      f.roster.map((p) => ({
        ...p,
        seasonStats: p.seasonStats ?? { games: 0, ppg: 0, rpg: 0, apg: 0, mpg: 0 },
        contract: {
          ...p.contract,
          annualSalary: normalizeContractSalary(p.overall, p.age, p.contract.annualSalary),
        },
      })),
      { city: f.city, name: f.name },
    ),
    coach: {
      ...f.coach,
      contractYearsRemaining: f.coach.contractYearsRemaining ?? 2,
      annualSalary: f.coach.annualSalary ?? 4_200_000,
    },
    freeAgents: (f.freeAgents ?? []).map((fa) => ({
      ...fa,
      askingSalary: normalizeContractSalary(fa.overall, fa.age, fa.askingSalary),
    })),
  };
  return withStartingFive(applyRosterSize(base));
}

function cloneFranchise(data: Omit<Franchise, 'id'>): Franchise {
  return normalizeFranchise(JSON.parse(JSON.stringify({ ...data, id: uid('fr') })) as Franchise);
}

function rosterStrength(franchise: Franchise): number {
  const active = franchise.roster.filter((p) => !p.injured);
  if (!active.length) return 70;
  return active.reduce((s, p) => s + p.overall, 0) / active.length;
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
    league: syncUserTeam(linkedLeague, franchise),
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
  leagueHeadlines: [],
  lastSavedAt: null,

  selectScenario: (id) => set({ selectedScenario: id }),

  advanceOnboarding: () => set((s) => ({ onboardingStep: Math.max(1, s.onboardingStep) + 1 })),

  bootstrapFranchise: (source: Omit<Franchise, 'id'>, toast: string, scenarioId: ScenarioId | null) => {
    resetIdCounter();
    clearPartnerTradeAssetCache();
    let next = cloneFranchise(source);
    let league = createLeague(next.season, next.city, next.name, rosterStrength(next), next.record);
    const linked = linkLeagueToFranchise(next, league);
    next = withStartingFive(linked.franchise);
    league = linked.league;

    if (next.phase === 'draft_scouting' || next.phase === 'draft_night') {
      const prepared = prepareDraftScouting(next, league);
      next = prepared.franchise;
      league = prepared.league;
    }

    next.tradeOffers = refreshTradeMarket(next, league);
    next.leagueStats = buildLeagueStatSnapshot(league, next);
    next.rfaOffers = seedRFAOffers(next, league);
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
      leagueHeadlines: simulateLeagueTrades(league),
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

  setScreen: (screen) => set({ screen, lastSavedAt: new Date().toISOString() }),

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
        franchise: { ...franchise, phase: 'regular_season', week: franchise.week + 1 },
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
      };
      let nextLeague = createLeague(nextSeason, next.city, next.name, rosterStrength(next));
      const linked = linkLeagueToFranchise(next, nextLeague);
      next = refreshCap(linked.franchise);
      nextLeague = linked.league;
      const prepared = prepareDraftScouting(next, nextLeague, priorLeague ?? undefined, priorPlayoffs);
      next = prepared.franchise;
      nextLeague = prepared.league;
      next.leagueStats = buildLeagueStatSnapshot(nextLeague, next);
      set({
        franchise: next,
        league: nextLeague,
        screen: 'draft',
        toast: `Draft order set — you pick #${next.draftPickNumber}. Lottery and standings decide the board.`,
      });
      return;
    }

    if (franchise.phase === 'draft_scouting' || franchise.phase === 'draft_night') {
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

    let nextLeague = syncUserTeam(league, next);

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
    );
    const tradeNews = simulateLeagueTrades(nextLeague);

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
    nextLeague = syncUserTeam(nextLeague, next);

    const injury = rollInjuries(next);
    next = injury.franchise;
    next = { ...next, ghosts: resolveGhostWatch(next) };

    if (next.week === 20 && next.phase === 'regular_season') {
      next.phase = 'trade_deadline';
      const ev = generateDeadlineEvent(next);
      if (ev) next.pendingEvents = [...next.pendingEvents, ev];
      next.tradeOffers = refreshTradeMarket(next, nextLeague);
    }

    if (next.week >= 26 && next.phase !== 'playoffs' && next.phase !== 'season_review') {
      nextLeague = freezeRegularSeasonRecords(nextLeague);
      next = freezeFranchiseRegularSeasonRecord(next, nextLeague);
      const madePlayoffs = userMadePlayoffs(nextLeague);
      next.madePlayoffs = madePlayoffs;
      if (madePlayoffs) {
        next.phase = 'playoffs';
        next.playoffs = initPlayoffs(nextLeague, next.leagueTeamId);
        set({
          franchise: next,
          league: nextLeague,
          screen: 'playoffs',
          toast: `Playoffs secured as the #${getUserSeed(nextLeague)} seed. Every game can end the season.`,
          leagueHeadlines: tradeNews,
        });
        return;
      }
      next.phase = 'season_review';
      next.seasonReview = buildSeasonReview(next);
      next.jobSecurity = Math.max(5, next.jobSecurity - 12);
      set({
        franchise: next,
        league: nextLeague,
        toast: `Season Ends: Missed Playoffs (${next.record.wins}–${next.record.losses}). ${next.seasonReview.offseasonPriority}`,
        leagueHeadlines: tradeNews,
      });
      return;
    }

    const locker = generateLockerRoomEvent(next);
    if (locker) next.pendingEvents = [...next.pendingEvents, locker];

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
      set({ toast: 'Three games played this week — advance to continue.' });
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

    while (next.week < 26) {
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
      next = { ...next, week: next.week + 1 };
    }

    nextLeague = ensureUserPlayoffSeed(syncUserTeam(nextLeague, next));
    nextLeague = freezeRegularSeasonRecords(nextLeague);
    next = freezeFranchiseRegularSeasonRecord(next, nextLeague);

    next = refreshCap(next);
    next.madePlayoffs = true;
    next.phase = 'playoffs';
    next.gamesThisWeek = 0;
    next.playoffs = initPlayoffs(nextLeague, next.leagueTeamId);

    set({
      franchise: next,
      league: nextLeague,
      screen: 'playoffs',
      toast: `Season fast-forwarded. You enter the playoffs as the #${getUserSeed(nextLeague)} seed.`,
    });
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
    const nextLeague = syncUserTeam(league, next);
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
    const draftNight = simOneDraftPick(franchise.draftNight, league, franchise);
    const last = draftNight.log[draftNight.log.length - 1];
    set({
      franchise: { ...franchise, draftNight },
      toast: last ? `Pick ${last.pick}: ${last.teamName} takes ${last.prospectName}.` : undefined,
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

  selectDraftProspect: (prospectId) => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    let next = draftProspect(franchise, prospectId);
    next = refreshCap(next);
    const drafted = franchise.draftBoard.find((p) => p.id === prospectId);
    const { franchise: withContracts, summary } = processContractRenewals(
      next,
      drafted ? [`${drafted.firstName} ${drafted.lastName}`] : [],
    );
    next = rememberRenewals(withContracts, summary);
    next = withDraftRecap(next);

    set({
      franchise: refreshCap(next),
      screen: 'contract_renewals',
      toast: `Draft pick signed. ${formatRenewalHeadline(summary)} Review renewals before free agency.`,
    });
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
    if (optionId === 'trade' || optionId === 'review') {
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
    const nextLeague = syncUserTeam(league, next);
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
    next = { ...next, phase: 'training_camp', week: next.week + 1 };
    set({
      franchise: next,
      league: syncUserTeam(league, next),
      toast: ai.headlines[0] ?? 'Free agency winding down. Training camp next.',
      screen: 'home',
    });
  },

  startFreeAgency: () => {
    const { franchise, league } = get();
    if (!franchise || !league) return;
    const agents = franchise.freeAgents.length ? franchise.freeAgents : generateFreeAgentPool(10);
    set({
      franchise: {
        ...franchise,
        phase: 'free_agency',
        freeAgents: refreshFreeAgentInterest({ ...franchise, freeAgents: agents }, league),
      },
      screen: 'free_agency',
    });
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
    let next = releaseExpiringPlayer(franchise, playerId);
    next = refreshCap(next);
    set({
      franchise: next,
      toast: player ? `${playerName(player)} released.` : 'Player released.',
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
    if (pendingRenewalCount(franchise) > 0) {
      set({ toast: 'Finish all renewals before opening free agency.' });
      return;
    }
    const next = openFreeAgencyAfterRenewals(franchise, league);
    const freeAgents = refreshFreeAgentInterest(next, league);
    set({
      franchise: refreshCap({ ...next, freeAgents }),
      screen: 'free_agency',
      toast: 'Free agency opens — outside talent hits the market.',
    });
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
          state.franchise = normalizeFranchise(state.franchise);
        }
        if (state?.league) {
          state.league = normalizeLeague(state.league);
        }
      },
    },
  ),
);
