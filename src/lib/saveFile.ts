import type { Franchise, League, ScenarioId, ScreenId } from '../types/game';
import type { WeekSummary } from '../store/gameStore';

export const SAVE_VERSION = 1;

export interface DynastySaveFile {
  version: number;
  savedAt: string;
  started: boolean;
  franchise: Franchise | null;
  league: League | null;
  screen: ScreenId;
  selectedScenario: ScenarioId | null;
  leagueHeadlines: string[];
  lastWeekSummary: WeekSummary | null;
}

export function buildSavePayload(state: {
  started: boolean;
  franchise: Franchise | null;
  league: League | null;
  screen: ScreenId;
  selectedScenario: ScenarioId | null;
  leagueHeadlines: string[];
  lastWeekSummary: WeekSummary | null;
}): DynastySaveFile {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    started: state.started,
    franchise: state.franchise,
    league: state.league,
    screen: state.screen,
    selectedScenario: state.selectedScenario,
    leagueHeadlines: state.leagueHeadlines,
    lastWeekSummary: state.lastWeekSummary,
  };
}

export function parseSaveFile(raw: string): DynastySaveFile | null {
  try {
    const data = JSON.parse(raw) as DynastySaveFile;
    if (data.version !== SAVE_VERSION) return null;
    if (typeof data.started !== 'boolean') return null;
    return data;
  } catch {
    return null;
  }
}

export function downloadSaveFile(json: string, filename?: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename ?? `dynasty-save-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function formatSavedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
