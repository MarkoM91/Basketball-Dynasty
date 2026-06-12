import type { Franchise, GameLogEntry, League, LeagueMatchup, LeagueTeam, Player } from '../../types/game';
import type { RngState } from './rng';

export type CoreSeasonPhase =
  | 'preseason'
  | 'regular_season'
  | 'trade_deadline'
  | 'playoffs'
  | 'draft'
  | 'contract_renewals'
  | 'free_agency'
  | 'training_camp'
  | 'season_review';

export interface LeagueCalendar {
  dateISO: string;
  day: number;
  seasonDay: number;
  seasonLengthDays: number;
  phase: CoreSeasonPhase;
}

export interface TeamLoopState {
  teamId: string;
  fatigue: number;
  morale: number;
  lastGameDay?: number;
  transactionPressure: number;
}

export interface NewsEvent {
  id: string;
  dateISO: string;
  season: number;
  type: 'game' | 'injury' | 'transaction' | 'development' | 'morale' | 'season' | 'publishing';
  headline: string;
  teamId?: string;
  playerId?: string;
  severity: 'minor' | 'normal' | 'major';
}

export interface LeagueHistoryEntry {
  id: string;
  dateISO: string;
  season: number;
  summary: string;
}

export interface SaveCheckpoint {
  id: string;
  dateISO: string;
  season: number;
  checksum: string;
}

export interface StaticContentItem {
  slug: string;
  title: string;
  description: string;
  bundle: 'static';
  lastGeneratedISO?: string;
  dirty?: boolean;
}

export interface AiFreeAgencyBid {
  id: string;
  playerName: string;
  position: string;
  overall: number;
  askingSalary: number;
  leadingTeamId?: string;
  leadingAnnualSalary?: number;
  suitorTeamIds: string[];
  daysOpen: number;
  signedTeamId?: string;
}

export interface LeagueState {
  league: League;
  franchise?: Franchise;
  calendar: LeagueCalendar;
  rng: RngState;
  teams: Record<string, TeamLoopState>;
  news: NewsEvent[];
  history: LeagueHistoryEntry[];
  saves: SaveCheckpoint[];
  staticContent: StaticContentItem[];
  freeAgencyMarket: AiFreeAgencyBid[];
  lastResults: GameLogEntry[];
}

export interface AdvanceDayOptions {
  seed?: string;
  simUserGames?: boolean;
  autosave?: boolean;
  publishStaticContent?: boolean;
  maxNewsItems?: number;
}

export interface GameSimulationInput {
  matchup: LeagueMatchup;
  league: League;
  franchise?: Franchise;
  day: number;
}

export interface HeadlessGameResult {
  matchup: LeagueMatchup;
  homeScore: number;
  awayScore: number;
  winnerId: string;
  logEntries: GameLogEntry[];
  news: NewsEvent[];
  playerUpdates: Record<string, Player[]>;
  teamUpdates: LeagueTeam[];
}
