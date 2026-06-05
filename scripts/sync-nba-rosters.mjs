/**
 * Sync parody rosters from NBA 2025-26 rosters (nba.com / stats API).
 *
 * Fetch (browser — node fetch is blocked in sandbox):
 *   1. NBA stats API via nba.com session (commonteamroster)
 *   2. node scripts/merge-roster-sources.mjs  (fills teams under 18 from Basketball-Reference)
 *   3. node scripts/sync-nba-rosters.mjs --from-json=scripts/nba-rosters-2026.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CORE_SIZE = 7;
const ROSTER_SIZE = 18;

const TEAM_MAP = [
  ['Boston|Harbor', 'BOS'],
  ['Brooklyn|Union', 'BRK'],
  ['New York|Skyline', 'NYK'],
  ['Philadelphia|Colonials', 'PHI'],
  ['Toronto|Sentinel', 'TOR'],
  ['Chicago|Gale', 'CHI'],
  ['Cleveland|Rust', 'CLE'],
  ['Detroit|Assembly', 'DET'],
  ['Indiana|Velocity', 'IND'],
  ['Milwaukee|Hops', 'MIL'],
  ['Atlanta|Peachtree', 'ATL'],
  ['Charlotte|Mint', 'CHO'],
  ['Miami|Surge', 'MIA'],
  ['Orlando|Aurora', 'ORL'],
  ['Washington|Monument', 'WAS'],
  ['Denver|Altitude', 'DEN'],
  ['Minnesota|Northstar', 'MIN'],
  ['Oklahoma City|Voltage', 'OKC'],
  ['Portland|Rose', 'POR'],
  ['Utah|Mesa', 'UTA'],
  ['Golden State|Spectrum', 'GSW'],
  ['LA|Current', 'LAC'],
  ['LA|Cosmos', 'LAL'],
  ['Phoenix|Sol', 'PHO'],
  ['Sacramento|Republic', 'SAC'],
  ['Dallas|Lasso', 'DAL'],
  ['Houston|Comets', 'HOU'],
  ['Memphis|Sound', 'MEM'],
  ['New Orleans|Bayou', 'NOP'],
  ['San Antonio|Mission', 'SAS'],
];

const FIRST_BY_LETTER = {
  A: ['Aaron', 'Adrian', 'Andre', 'Adam', 'Austin', 'Albert', 'Alston'],
  B: ['Blake', 'Brandon', 'Ben', 'Bryce', 'Barry', 'Brooks'],
  C: ['Caleb', 'Colin', 'Cole', 'Connor', 'Charles', 'Chris'],
  D: ['Derek', 'Dante', 'Damian', 'Dennis', 'Darius', 'Devin'],
  E: ['Evan', 'Elias', 'Ethan', 'Edgar', 'Eric'],
  F: ['Felix', 'Frank', 'Finn', 'Francis'],
  G: ['Gideon', 'Garrett', 'Grant', 'Gavin', 'Gerald', 'George'],
  H: ['Hugo', 'Hunter', 'Harold', 'Hector'],
  I: ['Isaac', 'Ivan', 'Isaiah', 'Immanuel'],
  J: ['Jordan', 'Jared', 'Justin', 'Jonas', 'Jaxon', 'Jerome'],
  K: ['Keith', 'Kyle', 'Kevin', 'Kendrick', 'Klaus', 'Kane'],
  L: ['Landon', 'Lance', 'Lucas', 'Leandro', 'Liam', 'Lorenzo'],
  M: ['Mason', 'Mitchell', 'Marcus', 'Miles', 'Malik', 'Marco'],
  N: ['Nate', 'Nolan', 'Noah', 'Nelson', 'Norman', 'Nicolas'],
  O: ['Owen', 'Oscar', 'Orlando', 'Omar', 'Oliver'],
  P: ['Patrick', 'Peter', 'Preston', 'Pierre', 'Philip'],
  Q: ['Quentin', 'Quinn', 'Quincy'],
  R: ['Ryan', 'Roman', 'Roland', 'Ruben', 'Rafael', 'Reid'],
  S: ['Spencer', 'Sean', 'Stefan', 'Shane', 'Simon', 'Samuel'],
  T: ['Travis', 'Trevor', 'Tyler', 'Tyson', 'Terrence', 'Tristan'],
  U: ['Ulrich', 'Ulysses'],
  V: ['Vincent', 'Vince', 'Vernon'],
  W: ['Walter', 'Wesley', 'Wayne', 'Warren', 'Wilson'],
  X: ['Xavier', 'Xander'],
  Y: ['Yusuf', 'Yosef'],
  Z: ['Zane', 'Zion', 'Zach'],
};

const STAR_FIRST = {
  Luka: 'Landon',
  LeBron: 'Leandro',
  Stephen: 'Stefan',
  Giannis: 'Gideon',
  Kevin: 'Keith',
  Anthony: 'Andre',
  Jayson: 'Jordan',
  Joel: 'Jonas',
  Nikola: 'Nolan',
  Victor: 'Vincent',
  Shai: 'Shane',
  Devin: 'Derek',
  Damian: 'Dante',
  Kyrie: 'Kyle',
  Kawhi: 'Keith',
  Paul: 'Patrick',
  James: 'Jared',
  Jimmy: 'Jared',
  Bam: 'Brandon',
  Trae: 'Travis',
  Ja: 'Jared',
  Zion: 'Zane',
  Cade: 'Colin',
  Paolo: 'Patrick',
  Alperen: 'Albert',
  Deandre: 'Derek',
  Karl: 'Kendrick',
  Donovan: 'Darius',
  Jaylen: 'Javon',
  Kristaps: 'Klaus',
  Pascal: 'Patrick',
  Tyrese: 'Trevor',
  DeMar: 'Derek',
  Julius: 'Justin',
  Scottie: 'Spencer',
  LaMelo: 'Lance',
  Dejounte: 'Derek',
  Jrue: 'Justin',
  Draymond: 'Derek',
  Klay: 'Kyle',
  Bradley: 'Bryce',
  Jusuf: 'Justin',
  Cooper: 'Connor',
  LeBron: 'Leandro',
  Austin: 'Alston',
  Bronny: 'Brandon',
  Jarred: 'Jonas',
  Dalton: 'Derek',
  Jaxson: 'Jordan',
  Jake: 'Jordan',
  Maxi: 'Mitchell',
  Drew: 'Derek',
  Nick: 'Nate',
  Chris: 'Colin',
  Adou: 'Andre',
  Amen: 'Adam',
  Ausar: 'Andre',
  Austin: 'Alston',
  Marcus: 'Mason',
  Rui: 'Ruben',
  Max: 'Mitchell',
  Payton: 'Peter',
  Joe: 'Jordan',
  Nikola: 'Nolan',
  Jamal: 'Jared',
  Michael: 'Mitchell',
  Aaron: 'Adam',
  Chris: 'Colin',
  Brandon: 'Blake',
  Daniel: 'Dennis',
  'P.J.': 'Patrick',
  Dereck: 'Dennis',
  Naji: 'Nate',
  Khris: 'Keith',
  Dwight: 'Derek',
  Marvin: 'Mitchell',
  Caleb: 'Colin',
  Ryan: 'Roland',
  Tyler: 'Travis',
  Jaden: 'Jordan',
  AJ: 'Adam',
  Moussa: 'Mason',
  Adou: 'Andre',
  Nick: 'Nate',
  Drew: 'Derek',
  Jake: 'Jordan',
  Luke: 'Lance',
  Bronny: 'Brandon',
  Maxi: 'Mitchell',
  Jarred: 'Jonas',
  Dangelo: 'Damian',
  "D'Angelo": 'Damian',
};

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function normalizePos(pos) {
  const p = (pos ?? 'SF').split('-')[0].split(',')[0].trim();
  if (p === 'G') return 'SG';
  if (p === 'F') return 'SF';
  if (['PG', 'SG', 'SF', 'PF', 'C'].includes(p)) return p;
  return 'SF';
}

function parseName(full) {
  const clean = full.replace(/\s*\(TW\)\s*/gi, '').replace(/č/g, 'c').replace(/ć/g, 'c').replace(/í/g, 'i').replace(/ñ/g, 'n').trim();
  const parts = clean.split(' ');
  if (parts.length < 2) return { firstName: parts[0] ?? 'Unknown', lastName: parts[0] ?? 'Unknown' };
  const suffix = parts[parts.length - 1].match(/^(Jr\.|II|III|IV)$/i) ? parts.pop() : '';
  const lastName = `${parts.pop()}${suffix ? ` ${suffix}` : ''}`;
  const firstName = parts.join(' ');
  return { firstName, lastName };
}

const SURNAME_OVERRIDES = {
  Dončić: 'Donkcicc',
  Doncic: 'Donkcicc',
  Flagg: 'Flaggg',
  Vanderbilt: 'Vanderbildt',
  James: 'Jhames',
};

function typoSurname(lastName) {
  const m = lastName.match(/^(.+?)(\s+(Jr\.|II|III|IV))$/i);
  if (m) {
    const base = SURNAME_OVERRIDES[m[1]] ?? typoSurname(m[1]);
    return `${base}${m[2]}`;
  }
  if (SURNAME_OVERRIDES[lastName]) return SURNAME_OVERRIDES[lastName];
  if (lastName.length < 2) return `${lastName}${lastName}`;
  const last = lastName[lastName.length - 1];
  if (lastName.endsWith(last + last)) return lastName;
  return `${lastName}${last}`;
}

function parodyFirst(realFirst, salt) {
  const base = realFirst.split('-')[0].replace(/'/g, '').trim();
  if (STAR_FIRST[base]) return STAR_FIRST[base];
  const letter = base[0]?.toUpperCase() ?? 'A';
  const pool = FIRST_BY_LETTER[letter] ?? FIRST_BY_LETTER.A;
  const options = pool.filter((n) => n.toLowerCase() !== base.toLowerCase());
  return options[hash(`${base}-${salt}`) % options.length] ?? options[0];
}

function toParody(realFull, salt, position) {
  const { firstName, lastName } = parseName(realFull);
  return {
    firstName: parodyFirst(firstName, salt),
    lastName: typoSurname(lastName),
    position,
  };
}

function parseRosterHtml(html) {
  const players = [];
  const rowRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowRe) ?? [];
  for (const row of rows) {
    const playerMatch = row.match(/data-stat="player"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)
      ?? row.match(/\|\s*([^|]+)\s*\|\s*(?:PG|SG|SF|PF|C|G|F)/);
    const posMatch = row.match(/data-stat="pos"[^>]*>\s*([A-Z0-9-]+)/i);
    if (!playerMatch) continue;
    const name = playerMatch[1].trim();
    if (!name || name === 'Player' || name.includes('Team Totals')) continue;
    const pos = posMatch ? normalizePos(posMatch[1]) : 'SF';
    if (!players.some((p) => p.name === name)) players.push({ name, position: pos });
  }

  if (players.length < 8) {
    const mdRows = [...html.matchAll(/\|\s*([^|]+?)\s*\|\s*(PG|SG|SF|PF|C|G|F)[^|]*\|/g)];
    for (const m of mdRows) {
      const name = m[1].trim();
      if (name.length < 4 || name.includes('Roster') || name.includes('Player')) continue;
      if (!/^[A-Z]/.test(name)) continue;
      if (!players.some((p) => p.name === name)) {
        players.push({ name, position: normalizePos(m[2]) });
      }
    }
  }

  return players.slice(0, ROSTER_SIZE);
}

/** Put franchise stars first so core slots (0–6) match real top rotation. */
const TEAM_STAR_ORDER = {
  'LA|Cosmos': [
    'Luka Dončić', 'LeBron James', 'Austin Reaves', 'Deandre Ayton', 'Rui Hachimura',
    'Marcus Smart', 'Jarred Vanderbilt', 'Dalton Knecht', 'Jaxson Hayes', 'Bronny James',
  ],
  'Dallas|Lasso': [
    'Cooper Flagg', 'Kyrie Irving', 'P.J. Washington', 'Daniel Gafford', 'Dereck Lively II',
    'Klay Thompson', 'Naji Marshall', 'Max Christie', 'Khris Middleton',
  ],
};

function reorderByStars(key, players) {
  const priority = TEAM_STAR_ORDER[key];
  if (!priority?.length) return players;
  const ordered = [];
  const used = new Set();
  for (const target of priority) {
    const hit = players.find((p) => p.name === target || p.name.includes(target.split(' ')[0]));
    if (hit && !used.has(hit.name)) {
      ordered.push(hit);
      used.add(hit.name);
    }
  }
  for (const p of players) {
    if (!used.has(p.name)) ordered.push(p);
  }
  return ordered;
}

async function fetchRoster(abbr) {
  const url = `https://www.basketball-reference.com/teams/${abbr}/2026.html`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DynastyFrontOffice/1.0)', Accept: 'text/html' },
  });
  if (!res.ok) throw new Error(`${abbr}: HTTP ${res.status}`);
  return parseRosterHtml(await res.text());
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatEntry(p) {
  return `    { firstName: '${esc(p.firstName)}', lastName: '${esc(p.lastName)}', position: '${p.position}' },`;
}

function writeRosterFiles(allCore, allDepth) {
  const coreLines = Object.entries(allCore).map(([key, players]) => {
    return `  '${key}': [\n${players.map(formatEntry).join('\n')}\n  ],`;
  });
  const depthLines = Object.entries(allDepth).map(([key, players]) => {
    return `  '${key}': [\n${players.map(formatEntry).join('\n')}\n  ],`;
  });

  const coreContent = `import type { Position } from '../types/game';
import { personNameKey } from './names';
import { TEAM_PARODY_DEPTH } from './parodyRosterDepth';

/**
 * BBGM-style parody naming rule (every entry):
 * 1. Fictional first name — same first letter as the real player, but a different name.
 * 2. Surname with exactly one typo.
 * Synced from NBA 2025-26 rosters (nba.com / Basketball-Reference). Snapshot: 4 June 2026.
 */
export const ROSTER_PARODY_SIZE = 18;
export type ParodyPlayerTemplate = {
  firstName: string;
  lastName: string;
  position: Position;
};

export function teamParodyKey(city: string, name: string): string {
  return \`\${city}|\${name}\`;
}

export const TEAM_PARODY_ROSTERS: Record<string, ParodyPlayerTemplate[]> = {
${coreLines.join('\n')}
};

function getTeamParodyRosterByKey(key: string): ParodyPlayerTemplate[] {
  const core = TEAM_PARODY_ROSTERS[key] ?? [];
  const depth = TEAM_PARODY_DEPTH[key] ?? [];
  return [...core, ...depth].slice(0, ROSTER_PARODY_SIZE);
}

const TEAM_EXCLUSIVE_KEYS = new Set(
  Object.keys(TEAM_PARODY_ROSTERS).flatMap((key) => getTeamParodyRosterByKey(key).map((p) => personNameKey(p.firstName, p.lastName))),
);

export function getTeamParodyRoster(city: string, name: string): ParodyPlayerTemplate[] {
  return getTeamParodyRosterByKey(teamParodyKey(city, name));
}

export function pickTeamParodyName(
  city: string,
  name: string,
  slot: number,
  used: Set<string>,
): ParodyPlayerTemplate | null {
  const roster = getTeamParodyRoster(city, name);
  if (!roster.length) return null;

  if (slot < roster.length) {
    const direct = roster[slot];
    const directKey = personNameKey(direct.firstName, direct.lastName);
    if (!used.has(directKey)) {
      used.add(directKey);
      return direct;
    }
  }

  for (let offset = 0; offset < roster.length; offset += 1) {
    const template = roster[(slot + offset) % roster.length];
    const key = personNameKey(template.firstName, template.lastName);
    if (!used.has(key)) {
      used.add(key);
      return template;
    }
  }
  return null;
}

export const DRAFT_CLASS_PARODIES: readonly ParodyPlayerTemplate[] = [
  { firstName: 'Colin', lastName: 'Flaggg', position: 'SF' },
  { firstName: 'Derek', lastName: 'Harperr', position: 'SG' },
  { firstName: 'Vince', lastName: 'Edgecombee', position: 'SG' },
  { firstName: 'Kyle', lastName: 'Maluachh', position: 'C' },
  { firstName: 'Travis', lastName: 'Johnsohn', position: 'PG' },
  { firstName: 'Adam', lastName: 'Newkirkk', position: 'PG' },
  { firstName: 'Evan', lastName: 'Reedd', position: 'PF' },
  { firstName: 'Mason', lastName: 'Diabatee', position: 'C' },
  { firstName: 'Roland', lastName: 'Hollandd', position: 'SF' },
  { firstName: 'Mitchell', lastName: 'Buzeliss', position: 'PF' },
];

export function pickDraftClassParodyName(used: Set<string>, salt: number): ParodyPlayerTemplate | null {
  const count = DRAFT_CLASS_PARODIES.length;
  for (let offset = 0; offset < count; offset += 1) {
    const template = DRAFT_CLASS_PARODIES[(salt + offset) % count];
    const key = personNameKey(template.firstName, template.lastName);
    if (!used.has(key)) {
      used.add(key);
      return template;
    }
  }
  return null;
}

export function isTeamExclusiveParody(firstName: string, lastName: string): boolean {
  return TEAM_EXCLUSIVE_KEYS.has(personNameKey(firstName, lastName));
}
`;

  const depthContent = `import type { ParodyPlayerTemplate } from './parodyRoster';

/**
 * Depth chart parodies — NBA 2025-26 rosters (nba.com / Basketball-Reference). Snapshot: 4 June 2026.
 */
export const TEAM_PARODY_DEPTH: Record<string, ParodyPlayerTemplate[]> = {
${depthLines.join('\n')}
};
`;

  writeFileSync(join(ROOT, 'src/data/parodyRoster.ts'), coreContent);
  writeFileSync(join(ROOT, 'src/data/parodyRosterDepth.ts'), depthContent);
}

function loadFromJson(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const out = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (Array.isArray(value)) {
      out[key] = value.map((p) => ({ name: p.name, position: normalizePos(p.position) }));
    }
  }
  return out;
}

async function main() {
  const jsonArg = process.argv.find((a) => a.startsWith('--from-json='));
  const allCore = {};
  const allDepth = {};
  const usedGlobal = new Set();
  let prefetched = null;
  if (jsonArg) {
    prefetched = loadFromJson(jsonArg.split('=')[1]);
    console.log(`Loaded ${Object.keys(prefetched).length} teams from JSON`);
  }

  for (const [key, abbr] of TEAM_MAP) {
    process.stdout.write(`${prefetched ? 'Processing' : 'Fetching'} ${abbr} (${key})... `);
    let players;
    if (prefetched?.[key]) {
      players = reorderByStars(key, prefetched[key]);
      if (players.length < ROSTER_SIZE) {
        console.log(`WARN: only ${players.length} players — need ${ROSTER_SIZE}`);
      }
    } else {
      try {
        players = await fetchRoster(abbr);
        players = reorderByStars(key, players);
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
        continue;
      }
    }
    console.log(`${players.length} players`);

    const parodies = [];
    for (let i = 0; i < players.length; i += 1) {
      let attempt = 0;
      let entry;
      do {
        entry = toParody(players[i].name, `${key}-${i}-${attempt}`, players[i].position);
        const fullKey = `${entry.firstName} ${entry.lastName}`.toLowerCase();
        if (!usedGlobal.has(fullKey)) {
          usedGlobal.add(fullKey);
          break;
        }
        attempt += 1;
        entry.lastName = `${entry.lastName}x`;
      } while (attempt < 6);
      parodies.push(entry);
    }

    allCore[key] = parodies.slice(0, CORE_SIZE);
    allDepth[key] = parodies.slice(CORE_SIZE, ROSTER_SIZE);
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!Object.keys(allCore).length) {
    console.error('\nNo rosters synced — files not modified.');
    process.exit(1);
  }
  writeRosterFiles(allCore, allDepth);
  console.log(`\nUpdated src/data/parodyRoster.ts and parodyRosterDepth.ts (${Object.keys(allCore).length} teams)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
