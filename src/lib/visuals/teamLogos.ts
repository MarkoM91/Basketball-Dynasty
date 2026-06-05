import { resolveTeamIdentity } from '../../data/teamNames';
import { hashString, pickInt } from './hash';

export interface TeamVisual {
  abbrev: string;
  primary: string;
  secondary: string;
  accent: string;
}

/** Brand colors + abbrev for all 30 league teams (fictional nicknames). */
export const TEAM_VISUALS: Record<string, TeamVisual> = {
  'Boston Harbor': { abbrev: 'BOS', primary: '#007A33', secondary: '#BA9653', accent: '#ffffff' },
  'Brooklyn Union': { abbrev: 'BKN', primary: '#1D1D1B', secondary: '#FFFFFF', accent: '#808080' },
  'New York Skyline': { abbrev: 'NYS', primary: '#006BB6', secondary: '#F58426', accent: '#ffffff' },
  'Philadelphia Colonials': { abbrev: 'PHI', primary: '#006BB6', secondary: '#ED174C', accent: '#ffffff' },
  'Toronto Sentinel': { abbrev: 'TOR', primary: '#CE1141', secondary: '#000000', accent: '#A1A1A4' },
  'Chicago Gale': { abbrev: 'CHI', primary: '#CE1141', secondary: '#000000', accent: '#ffffff' },
  'Cleveland Rust': { abbrev: 'CLE', primary: '#860038', secondary: '#FDBB30', accent: '#041E42' },
  'Detroit Assembly': { abbrev: 'DET', primary: '#C8102E', secondary: '#1D42BA', accent: '#ffffff' },
  'Indiana Velocity': { abbrev: 'IND', primary: '#002D62', secondary: '#FDBB30', accent: '#BEC0C2' },
  'Milwaukee Hops': { abbrev: 'MIL', primary: '#00471B', secondary: '#EEE1C6', accent: '#0077C0' },
  'Atlanta Peachtree': { abbrev: 'ATL', primary: '#E03A3E', secondary: '#C1D32F', accent: '#26282A' },
  'Charlotte Mint': { abbrev: 'CHA', primary: '#1D1160', secondary: '#00788C', accent: '#A1A1A4' },
  'Miami Surge': { abbrev: 'MIA', primary: '#98002E', secondary: '#F9A01B', accent: '#000000' },
  'Orlando Aurora': { abbrev: 'ORL', primary: '#0077C0', secondary: '#C4CED4', accent: '#000000' },
  'Washington Monument': { abbrev: 'WAS', primary: '#002B5C', secondary: '#E31837', accent: '#C4CED4' },
  'Denver Altitude': { abbrev: 'DEN', primary: '#0E2240', secondary: '#FEC524', accent: '#8B2131' },
  'Minnesota Northstar': { abbrev: 'MIN', primary: '#0C2340', secondary: '#236192', accent: '#78BE20' },
  'Oklahoma City Voltage': { abbrev: 'OKC', primary: '#007AC1', secondary: '#EF3B24', accent: '#002D62' },
  'Portland Rose': { abbrev: 'POR', primary: '#E03A3E', secondary: '#000000', accent: '#ffffff' },
  'Utah Mesa': { abbrev: 'UTA', primary: '#002B5C', secondary: '#F9A01B', accent: '#ffffff' },
  'Golden State Spectrum': { abbrev: 'GSS', primary: '#1D428A', secondary: '#FFC72C', accent: '#ffffff' },
  'LA Current': { abbrev: 'LAC', primary: '#C8102E', secondary: '#1D428A', accent: '#BEC0C2' },
  'LA Cosmos': { abbrev: 'LAX', primary: '#552583', secondary: '#FDB927', accent: '#000000' },
  'Phoenix Sol': { abbrev: 'PHX', primary: '#1D1160', secondary: '#E56020', accent: '#63727A' },
  'Sacramento Republic': { abbrev: 'SAC', primary: '#5A2D81', secondary: '#63727A', accent: '#ffffff' },
  'Dallas Lasso': { abbrev: 'DAL', primary: '#00538C', secondary: '#002B5E', accent: '#B8C4CA' },
  'Houston Comets': { abbrev: 'HOU', primary: '#CE1141', secondary: '#000000', accent: '#C4CED4' },
  'Memphis Sound': { abbrev: 'MEM', primary: '#5D76A9', secondary: '#12173F', accent: '#F5B112' },
  'New Orleans Bayou': { abbrev: 'NOB', primary: '#0C2340', secondary: '#C8102E', accent: '#85714D' },
  'San Antonio Mission': { abbrev: 'SAM', primary: '#C4CED4', secondary: '#000000', accent: '#ffffff' },
};

export function teamVisualKey(city: string, name: string): string {
  return `${city} ${name}`;
}

export function getTeamVisual(city: string, name: string): TeamVisual {
  const { city: c, name: n } = resolveTeamIdentity(city, name);
  const key = teamVisualKey(c, n);
  if (TEAM_VISUALS[key]) return TEAM_VISUALS[key];

  const seed = hashString(key);
  const hue = pickInt(seed, 0, 360, 1);
  return {
    abbrev: (n.slice(0, 2) + c.slice(0, 1)).toUpperCase().slice(0, 3),
    primary: `hsl(${hue}, 55%, 38%)`,
    secondary: `hsl(${(hue + 40) % 360}, 45%, 55%)`,
    accent: '#ffffff',
  };
}

export function getTeamVisualByFullName(fullName: string): TeamVisual {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) {
    return { abbrev: fullName.slice(0, 3).toUpperCase(), primary: '#2a3040', secondary: '#a67c3d', accent: '#fff' };
  }
  const name = parts.pop()!;
  const city = parts.join(' ');
  return getTeamVisual(city, name);
}

export function buildTeamLogoSvg(city: string, name: string): string {
  const { city: c, name: n } = resolveTeamIdentity(city, name);
  const v = getTeamVisual(c, n);
  const seed = hashString(teamVisualKey(c, n));
  const variant = pickInt(seed, 0, 2, 2);

  const shield =
    variant === 0
      ? 'M 8 4 H 56 L 52 58 Q 32 68 12 58 Z'
      : variant === 1
        ? 'M 32 4 L 58 16 V 44 Q 32 62 6 44 V 16 Z'
        : 'M 10 10 H 54 V 54 Q 32 62 10 54 Z';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${c} ${n}">
  <path d="${shield}" fill="${v.primary}" stroke="${v.secondary}" stroke-width="2"/>
  <text x="32" y="38" text-anchor="middle" fill="${v.accent}" font-family="DM Sans, Arial, sans-serif" font-size="18" font-weight="800">${v.abbrev}</text>
</svg>`;
}

export function teamLogoDataUri(city: string, name: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildTeamLogoSvg(city, name))}`;
}

export function teamLogoDataUriFromFullName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return teamLogoDataUri('League', fullName);
  const name = parts.pop()!;
  const city = parts.join(' ');
  return teamLogoDataUri(city, name);
}
