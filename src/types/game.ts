export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export type PlayerRole =
  | 'Franchise Player'
  | 'Star'
  | 'Starter'
  | 'Sixth Man'
  | 'Rotation'
  | 'Bench'
  | 'Prospect'
  | 'Veteran Mentor'
  | 'Injured';

export type MoraleLevel = 'Happy' | 'Stable' | 'Concerned' | 'Frustrated' | 'Angry';
export type DevTrend = 'Up' | 'Stable' | 'Down' | 'Stalled';
export type WindowStatus =
  | 'Deep Rebuild'
  | 'Early Rebuild'
  | 'Developing Core'
  | 'Play-In Team'
  | 'Rising Contender'
  | 'Title Contender'
  | 'Aging Contender'
  | 'Expensive Mediocrity'
  | 'Post-Dynasty Decline';

export type SeasonPhase =
  | 'offseason'
  | 'draft_scouting'
  | 'draft_night'
  | 'contract_renewals'
  | 'free_agency'
  | 'training_camp'
  | 'regular_season'
  | 'trade_deadline'
  | 'playoffs'
  | 'season_review';

export type DevFocus =
  | 'Primary Ball Handler'
  | 'Catch-and-Shoot Wing'
  | 'Defensive Stopper'
  | 'Rim Protector'
  | 'Stretch Big'
  | 'Sixth Man Scorer'
  | 'Playmaking Big'
  | 'Off-Ball Movement'
  | 'Strength & Conditioning'
  | 'Injury Recovery';

export interface Contract {
  yearsRemaining: number;
  annualSalary: number;
  isMax: boolean;
  isExpiring: boolean;
  birdYears?: number;
  isRestricted?: boolean;
  signedVia?: 'standard' | 'mle' | 'room' | 'minimum' | 'rookie';
  hasPlayerOption?: boolean;
  hasTeamOption?: boolean;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  overall: number;
  potential: number;
  contract: Contract;
  morale: MoraleLevel;
  role: PlayerRole;
  tradeValue: 'Low' | 'Medium' | 'High' | 'Premium';
  devTrend: DevTrend;
  injuryRisk: 'Low' | 'Medium' | 'High';
  systemFit: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  gmNote: string;
  workEthic: 'Low' | 'Average' | 'High' | 'Elite';
  minutesPerGame: number;
  devFocus?: DevFocus;
  injured?: boolean;
  injuryWeeks?: number;
  isStar?: boolean;
  hiddenOverall?: number;
  /** Season this player was drafted (rookie year). */
  draftSeason?: number;
  draftPick?: number;
  seasonStats?: PlayerSeasonStats;
  priorSeasonStats?: PlayerSeasonStats;
}

export interface PlayerSeasonStats {
  games: number;
  ppg: number;
  rpg: number;
  apg: number;
  mpg: number;
}

export interface Prospect {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  scoutedOverall: [number, number];
  potential: [number, number];
  floor: number;
  ceiling: number;
  bustRisk: 'Low' | 'Medium' | 'High';
  workEthic: 'Low' | 'Average' | 'High' | 'Elite';
  personality: string;
  medicalFlag?: string;
  interviewGrade: string;
  workoutGrade: string;
  archetype: string;
  scoutNote: string;
  hiddenTraits?: string[];
  trueOverall?: number;
  truePotential?: number;
}

export interface DraftPick {
  year: number;
  round: 1 | 2;
  originalTeam: string;
  protections?: string;
}

export type GhostType = 'passed_pick' | 'traded_pick' | 'traded_player' | 'lost_star' | 'bad_contract';

export interface FranchiseGhost {
  id: string;
  season: number;
  week: number;
  type: GhostType;
  title: string;
  story: string;
  severity: 'minor' | 'major' | 'haunting';
  subjectName: string;
  watchNote?: string;
}

export interface DraftNightLogEntry {
  pick: number;
  round: 1 | 2;
  teamName: string;
  prospectName: string;
  isUser: boolean;
  note?: string;
}

export interface DraftRecapPick {
  pick: number;
  round: 1 | 2;
  playerName: string;
  position?: Position;
  overall?: number;
  archetype?: string;
  note?: string;
}

export interface DraftNightState {
  active: boolean;
  currentPick: number;
  /** @deprecated use userPickNumbers */
  userPickNumber?: number;
  userPickNumbers: number[];
  totalPicks: number;
  userPicksMade: number[];
  userDraftedNames?: string[];
  board: Prospect[];
  takenIds: string[];
  log: DraftNightLogEntry[];
  stakeholderNote: string;
  onClock: boolean;
}

export interface TradeProposal {
  partnerTeamId: string;
  incomingPlayers: Player[];
  outgoingPlayerIds: string[];
  incomingPicks: DraftPick[];
  outgoingPickKeys: string[];
}

export interface TradeBlockState {
  playerIds: string[];
  pickKeys: string[];
}

export type TradeProposalStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'countered'
  | 'withdrawn'
  | 'expired';

export interface SubmittedTradeProposal {
  id: string;
  submittedWeek: number;
  season: number;
  partnerTeamId: string;
  partnerTeamName: string;
  proposal: TradeProposal;
  status: TradeProposalStatus;
  partnerAcceptScore: number;
  partnerVerdict: string;
  responseNote?: string;
  expiresWeek: number;
}

export interface LeagueTradeBlockListing {
  id: string;
  teamId: string;
  teamName: string;
  assetType: 'player' | 'pick';
  label: string;
  position?: Position;
  overall?: number;
  age?: number;
  salary?: number;
  askingNote: string;
  interestForUser: 'High' | 'Medium' | 'Low';
  shoppingFor: TradeShoppingTag[];
}

export type TradeShoppingTag =
  | 'draft_picks'
  | 'young_talent'
  | 'veteran_help'
  | 'salary_relief'
  | 'star_power';

export interface TradeNegotiation {
  partnerTeamId: string;
  partnerTeamName: string;
  round: number;
}

export interface TradeMatch {
  id: string;
  partnerTeamId: string;
  partnerTeamName: string;
  incomingPlayer: Player;
  outgoingPlayerId: string;
  outgoingPlayerName: string;
  acceptScore: number;
  verdict: string;
  salaryMatch: boolean;
  valid: boolean;
}

export interface TradeValidation {
  valid: boolean;
  salaryMatch: boolean;
  salaryDelta: number;
  partnerAcceptScore: number;
  partnerVerdict: string;
  capImpact: string;
  capWarnings: string[];
  partnerCapNote: string;
  userProjectedPayroll: number;
  partnerProjectedPayroll: number;
  partnerSalaryMatch: boolean;
  allowedIncoming: number;
  errors: string[];
}

export interface TradeOffer {
  id: string;
  partnerTeam: string;
  partnerTeamId?: string;
  incoming: { description: string; players: Player[]; picks: DraftPick[] };
  outgoing: { description: string; players: Player[]; picks: DraftPick[] };
  analysis: {
    shortTerm: string;
    longTerm: string;
    lockerRoom: string;
    fanReaction: string;
    mediaRisk: string;
    titleOddsDelta: number;
    partnerAcceptScore?: number;
  };
  expiresWeek: number;
  isCounter?: boolean;
  /** Inbound offer generated when you list a player or pick on your block. */
  blockInquiry?: boolean;
  listedAssetKey?: string;
}

export interface Coach {
  id: string;
  name: string;
  offensiveSystem: string;
  defensiveSystem: string;
  strengths: string[];
  weaknesses: string[];
  lockerRoom: MoraleLevel;
  starRelationship: MoraleLevel;
  devRating: number;
  playoffRating: number;
  contractYearsRemaining?: number;
  annualSalary?: number;
}

export interface Ownership {
  goal: string;
  evaluation: string;
  risk: string;
  confidence: number;
  patience: number;
}

export interface MediaItem {
  id: string;
  headline: string;
  week: number;
  season: number;
  tone: 'positive' | 'neutral' | 'negative';
}

export interface GameResult {
  opponent: string;
  home: boolean;
  teamScore: number;
  oppScore: number;
  won: boolean;
  note: string;
  gameInWeek?: number;
}

export interface GameLogEntry extends GameResult {
  id: string;
  season: number;
  week: number;
  topScorer?: { name: string; pts: number };
  topRebounder?: { name: string; reb: number };
  topAssister?: { name: string; ast: number };
}

export interface LeagueStatLeader {
  rank: number;
  playerName: string;
  teamName: string;
  position: Position;
  value: number;
  isUser: boolean;
}

export interface LeagueStatSnapshot {
  ppg: LeagueStatLeader[];
  rpg: LeagueStatLeader[];
  apg: LeagueStatLeader[];
}

export interface CoachCandidate extends Coach {
  askingYears: number;
  reputation: 'Elite' | 'Solid' | 'Risky';
  blurb: string;
}

export interface RFAOffer {
  id: string;
  playerId: string;
  playerName: string;
  offeringTeam: string;
  salary: number;
  years: number;
  status: 'pending' | 'matched' | 'lost';
}

export interface TradeChainLeg {
  teamId: string;
  incomingPlayers: Player[];
  outgoingPlayerIds: string[];
  incomingPicks: DraftPick[];
  outgoingPickKeys: string[];
}

export interface TradeChainProposal {
  facilitatorTeamId: string;
  userToPartner: TradeProposal;
  partnerToFacilitator: TradeProposal;
}

export interface PendingEvent {
  id: string;
  type: 'locker_room' | 'trade_deadline' | 'star_unhappy' | 'ownership' | 'injury';
  title: string;
  body: string;
  options: EventOption[];
}

export interface EventOption {
  id: string;
  label: string;
  effects: string;
}

export interface FranchiseMemory {
  id: string;
  season: number;
  week: number;
  text: string;
  type: 'trade' | 'draft' | 'playoff' | 'contract' | 'firing' | 'injury' | 'milestone';
}

export interface CapOutlook {
  payroll: number;
  capLimit: number;
  luxuryTaxLine: number;
  secondApron: number;
  inLuxuryTax: boolean;
  inSecondApron: boolean;
  projectedRoom: number;
  deadMoney: number;
  taxBill: number;
  mleAvailable: number;
  roomAvailable: number;
  baeAvailable: number;
  hardCapped: boolean;
  warnings: string[];
}

export type TeamStrategy =
  | 'rebuild'
  | 'tank'
  | 'developing'
  | 'playin'
  | 'contend'
  | 'all_in'
  | 'retool';

export type PlayoffRound = 'First Round' | 'Quarterfinals' | 'Semifinals' | 'Finals' | 'Complete';

export interface LeagueTeam {
  id: string;
  city: string;
  name: string;
  fullName: string;
  market: 'Small' | 'Mid' | 'Large';
  strategy: TeamStrategy;
  wins: number;
  losses: number;
  /** Frozen at end of regular season — used for standings (excludes playoffs). */
  regularWins?: number;
  regularLosses?: number;
  strength: number;
  payroll: number;
  taxAverse: boolean;
  starOverall: number;
  isUser: boolean;
  abbrev: string;
  primaryColor: string;
  /** Season average points scored per game. */
  ppgFor: number;
  /** Season average points allowed per game. */
  ppgAgainst: number;
  /** Games included in ppgFor / ppgAgainst averages. */
  scoreGames: number;
}

export interface PlayoffGameResult {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  winnerId: string;
  note: string;
  playByPlay: string[];
  starLine?: string;
}

export interface PlayoffSeries {
  id: string;
  round: PlayoffRound;
  higherSeed: { teamId: string; seed: number };
  lowerSeed: { teamId: string; seed: number };
  higherWins: number;
  lowerWins: number;
  games: PlayoffGameResult[];
  complete: boolean;
  winnerId?: string;
  userInvolved: boolean;
}

export interface PlayoffState {
  active: boolean;
  round: PlayoffRound;
  series: PlayoffSeries[];
  /** Completed series from prior rounds — powers the full bracket view. */
  bracketHistory?: PlayoffSeries[];
  userEliminated: boolean;
  userResult?: string;
  championTeamId?: string;
  championName?: string;
}

export interface DraftOrderEntry {
  pick: number;
  city: string;
  name: string;
  teamName: string;
  source: 'lottery' | 'playoff_record';
  /** Pre-lottery slot among non-playoff teams (1 = worst record). */
  expectedPick?: number;
}

export interface LeagueMatchup {
  id: string;
  week: number;
  gameInWeek: number;
  homeTeamId: string;
  awayTeamId: string;
}

export interface League {
  teams: LeagueTeam[];
  season: number;
  draftOrder?: DraftOrderEntry[];
  draftLotteryLog?: string[];
  schedule?: LeagueMatchup[];
}

export type FreeAgentPriority = 'winning' | 'money' | 'role' | 'market';

export interface FreeAgent {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  overall: number;
  potential: number;
  askingSalary: number;
  askingYears: number;
  priorities: FreeAgentPriority[];
  interest: number;
  topOfferTeam?: string;
  /** Competing team's annual offer when the market has a leader. */
  rivalOfferSalary?: number;
  /** Approximate number of teams in the bidding (drives difficulty). */
  suitorCount?: number;
  /** Failed pitches by your front office — each one hardens the rival's position. */
  userPitchAttempts?: number;
  scoutNote: string;
  archetype: string;
  signed: boolean;
}

export type PitchType = 'max_offer' | 'team_friendly' | 'win_now' | 'featured_role';

export interface SeasonReview {
  grade: string;
  ownershipVerdict: string;
  primaryIssue?: string;
  offseasonPriority: string;
}

export interface Franchise {
  id: string;
  leagueTeamId: string;
  city: string;
  name: string;
  market: 'Small' | 'Mid' | 'Large';
  record: { wins: number; losses: number };
  /** Snapshot when the regular season ends — standings and UI use this during playoffs. */
  regularSeasonRecord?: { wins: number; losses: number };
  season: number;
  week: number;
  phase: SeasonPhase;
  roster: Player[];
  draftPicks: DraftPick[];
  coach: Coach;
  ownership: Ownership;
  fanMood: MoraleLevel;
  lockerRoom: MoraleLevel;
  window: WindowStatus;
  coreAge: number;
  cap: CapOutlook;
  jobSecurity: number;
  starHappiness: MoraleLevel;
  starHappinessReason?: string;
  playoffOdds: number;
  titleOdds: number;
  media: MediaItem[];
  memory: FranchiseMemory[];
  pendingEvents: PendingEvent[];
  tradeOffers: TradeOffer[];
  tradeBlock: TradeBlockState;
  submittedProposals: SubmittedTradeProposal[];
  tradeNegotiation?: TradeNegotiation | null;
  draftBoard: Prospect[];
  draftPickNumber?: number;
  gmName: string;
  strategyIdentity: string;
  playoffs?: PlayoffState;
  freeAgents: FreeAgent[];
  seasonReview?: SeasonReview;
  madePlayoffs: boolean;
  ghosts: FranchiseGhost[];
  draftNight?: DraftNightState;
  draftRecap?: DraftRecapPick[];
  lastPlayoffPbp?: string[];
  pendingCounter?: TradeOffer | null;
  gameLog: GameLogEntry[];
  coachMarket: CoachCandidate[];
  rfaOffers: RFAOffer[];
  leagueStats?: LeagueStatSnapshot;
  startingFive: string[];
  gamesThisWeek: number;
  /** -20 to +20 — ticket price vs league default. */
  ticketPriceBias?: number;
  /** 1–10 scouting / player development spend. */
  scoutingBudget?: number;
  /** User team scoring averages from games you actually sim. */
  teamScoring?: { ppgFor: number; ppgAgainst: number; games: number };
}

export type ScenarioId =
  | 'aging_contender'
  | 'lottery_rebuild'
  | 'stuck_middle'
  | 'small_market_star';

export interface Scenario {
  id: ScenarioId;
  title: string;
  hook: string;
  briefing: string;
  firstDecision: string;
  franchise: Omit<Franchise, 'id'>;
}

export type ScreenId =
  | 'home'
  | 'roster'
  | 'trade'
  | 'draft'
  | 'cap'
  | 'development'
  | 'coach'
  | 'media'
  | 'history'
  | 'ghosts'
  | 'playoffs'
  | 'free_agency'
  | 'contract_renewals'
  | 'league'
  | 'results'
  | 'play_game'
  | 'schedule'
  | 'finances';
