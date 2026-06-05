import type { ScreenId } from './types/game';

export const SCREEN_PATHS: Record<ScreenId, string> = {
  home: '/office',
  roster: '/roster',
  trade: '/trades',
  draft: '/draft',
  cap: '/cap',
  development: '/development',
  coach: '/coach',
  media: '/media',
  history: '/history',
  ghosts: '/ghosts',
  playoffs: '/playoffs',
  free_agency: '/free-agency',
  contract_renewals: '/renewals',
  league: '/league',
  results: '/results',
  play_game: '/play',
  schedule: '/schedule',
  finances: '/finances',
};

/** Marketing/help pages — never hijacked by in-game screen navigation. */
export const PUBLIC_PATHS = ['/', '/start', '/guide', '/compare'] as const;

const PATH_TO_SCREEN = Object.fromEntries(
  Object.entries(SCREEN_PATHS).map(([screen, path]) => [path, screen]),
) as Record<string, ScreenId>;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname as (typeof PUBLIC_PATHS)[number]);
}

export function isGamePath(pathname: string): boolean {
  return pathname in PATH_TO_SCREEN;
}

export function screenFromPath(pathname: string): ScreenId | null {
  return PATH_TO_SCREEN[pathname] ?? null;
}

export function pathFromScreen(screen: ScreenId): string {
  return SCREEN_PATHS[screen];
}

export const GAME_ROUTE_PATHS = Object.values(SCREEN_PATHS);
