/** Canonical fictional franchise nicknames — cities and colors may evoke real markets; names do not. */
export const LEGACY_TEAM_ALIASES: Record<string, { city: string; name: string }> = {
  'Boston|Harbor': { city: 'Boston', name: 'Harbor' },
  'Brooklyn|Bridge': { city: 'Brooklyn', name: 'Union' },
  'New York|Metro': { city: 'New York', name: 'Skyline' },
  'Philadelphia|Liberty': { city: 'Philadelphia', name: 'Colonials' },
  'Toronto|North': { city: 'Toronto', name: 'Sentinel' },
  'Chicago|Monarchs': { city: 'Chicago', name: 'Gale' },
  'Cleveland|Forge': { city: 'Cleveland', name: 'Rust' },
  'Detroit|Motors': { city: 'Detroit', name: 'Assembly' },
  'Indiana|Crossroads': { city: 'Indiana', name: 'Velocity' },
  'Milwaukee|Lake': { city: 'Milwaukee', name: 'Hops' },
  'Milwaukee|Forge': { city: 'Milwaukee', name: 'Hops' },
  'Atlanta|Crown': { city: 'Atlanta', name: 'Peachtree' },
  'Charlotte|Royals': { city: 'Charlotte', name: 'Mint' },
  'Miami|Heatwave': { city: 'Miami', name: 'Surge' },
  'Orlando|Coast': { city: 'Orlando', name: 'Aurora' },
  'Washington|Capital': { city: 'Washington', name: 'Monument' },
  'Denver|Summit': { city: 'Denver', name: 'Altitude' },
  'Minnesota|Timber': { city: 'Minnesota', name: 'Northstar' },
  'Oklahoma City|Thunder': { city: 'Oklahoma City', name: 'Voltage' },
  'Portland|Trail': { city: 'Portland', name: 'Rose' },
  'Utah|Range': { city: 'Utah', name: 'Mesa' },
  'Golden State|Bay': { city: 'Golden State', name: 'Spectrum' },
  'LA|Pacific': { city: 'LA', name: 'Current' },
  'LA|Stars': { city: 'LA', name: 'Cosmos' },
  'Phoenix|Sunline': { city: 'Phoenix', name: 'Sol' },
  'Sacramento|Crown': { city: 'Sacramento', name: 'Republic' },
  'Dallas|Stampede': { city: 'Dallas', name: 'Lasso' },
  'Houston|Rockets': { city: 'Houston', name: 'Comets' },
  'Memphis|Bluff': { city: 'Memphis', name: 'Sound' },
  'New Orleans|Crescent': { city: 'New Orleans', name: 'Bayou' },
  'San Antonio|Alamo': { city: 'San Antonio', name: 'Mission' },
};

export function resolveTeamIdentity(city: string, name: string): { city: string; name: string } {
  return LEGACY_TEAM_ALIASES[`${city}|${name}`] ?? { city, name };
}

/**
 * Reverse-lookup table: nickname → "City Nickname".
 * Built once from the canonical team list so we can normalize draft-pick
 * originalTeam fields that were seeded with just the nickname (e.g. "Harbor"
 * from scenarios.ts) to the full canonical form (e.g. "Boston Harbor").
 *
 * Without this, two picks for the same logical team end up with different
 * pickKey identities depending on which code path created them.
 */
const NICKNAME_TO_FULLNAME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const v of Object.values(LEGACY_TEAM_ALIASES)) {
    map[v.name] = `${v.city} ${v.name}`;
  }
  return map;
})();

export function resolveTeamFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return fullName;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    // Single token — likely a seeded nickname like "Harbor". Expand to "Boston Harbor".
    return NICKNAME_TO_FULLNAME[parts[0]] ?? trimmed;
  }
  const oldName = parts.pop()!;
  const city = parts.join(' ');
  const { city: c, name: n } = resolveTeamIdentity(city, oldName);
  return `${c} ${n}`;
}
