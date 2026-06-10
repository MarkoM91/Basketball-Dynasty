import type { Position } from '../types/game';
import { personNameKey } from './names';
import { TEAM_PARODY_DEPTH } from './parodyRosterDepth';

/**
 * BBGM-style parody naming rule (every entry):
 * 1. Fictional first name — same first letter as the real player, but a different name.
 * 2. Real surname from the official roster with exactly one typo (usually double the final letter).
 * Synced from NBA 2025-26 rosters (nba-rosters-2026.json). Snapshot: 4 June 2026.
 */
export const ROSTER_PARODY_SIZE = 18;
export type ParodyPlayerTemplate = {
  firstName: string;
  lastName: string;
  position: Position;
};

export function teamParodyKey(city: string, name: string): string {
  return `${city}|${name}`;
}

export const TEAM_PARODY_ROSTERS: Record<string, ParodyPlayerTemplate[]> = {
  'Boston|Harbor': [
    { firstName: 'Jordan', lastName: 'Tatumm', position: 'SF' },
    { firstName: 'Nolan', lastName: 'Vucevicc', position: 'C' },
    { firstName: 'Javon', lastName: 'Brownn', position: 'SG' },
    { firstName: 'Jordan', lastName: 'Tonjee', position: 'SG' },
    { firstName: 'Darius', lastName: 'Whitee', position: 'SG' },
    { firstName: 'Peter', lastName: 'Pritchardd', position: 'SG' },
    { firstName: 'Roman', lastName: 'Harperr Jr.', position: 'SG' },
  ],
  'Brooklyn|Union': [
    { firstName: 'Justin', lastName: 'Minottt', position: 'SF' },
    { firstName: 'Zane', lastName: 'Williamss', position: 'SF' },
    { firstName: 'Derek', lastName: 'Wolff', position: 'SF' },
    { firstName: 'Derek', lastName: 'Powelll', position: 'SG' },
    { firstName: 'Evan', lastName: 'Dëminn', position: 'SG' },
    { firstName: 'Elias', lastName: 'Liddelll', position: 'SF' },
    { firstName: 'Trevor', lastName: 'Etiennee', position: 'SG' },
  ],
  'New York|Skyline': [
    { firstName: 'Jared', lastName: 'Clarksonn', position: 'SG' },
    { firstName: 'Mitchell', lastName: 'McBridee', position: 'SG' },
    { firstName: 'Jerome', lastName: 'Hartt', position: 'SG' },
    { firstName: 'Philip', lastName: 'Dadiett', position: 'SF' },
    { firstName: 'Justin', lastName: 'Alvaradoo', position: 'SG' },
    { firstName: 'Omar', lastName: 'Anunobyy', position: 'SF' },
    { firstName: 'Keith', lastName: 'McCullarr Jr.', position: 'SG' },
  ],
  'Philadelphia|Colonials': [
    { firstName: 'Trevor', lastName: 'Maxeyy', position: 'SG' },
    { firstName: 'Adrian', lastName: 'Drummondd', position: 'C' },
    { firstName: 'Quinn', lastName: 'Grimess', position: 'SG' },
    { firstName: 'Keith', lastName: 'Lowryy', position: 'SG' },
    { firstName: 'Patrick', lastName: 'Georgee', position: 'SF' },
    { firstName: 'Kevin', lastName: 'Oubree Jr.', position: 'SF' },
    { firstName: 'Jonas', lastName: 'Edwardss', position: 'SF' },
  ],
  'Toronto|Sentinel': [
    { firstName: 'Austin', lastName: 'Lawsonn', position: 'SG' },
    { firstName: 'Gavin', lastName: 'Dickk', position: 'SG' },
    { firstName: 'Jared', lastName: 'Mogboo', position: 'SF' },
    { firstName: 'Blake', lastName: 'Ingramm', position: 'SF' },
    { firstName: 'Spencer', lastName: 'Barness', position: 'SF' },
    { firstName: 'Isaiah', lastName: 'Quickleyy', position: 'SG' },
    { firstName: 'Roland', lastName: 'Barrettt', position: 'SF' },
  ],
  'Chicago|Gale': [
    { firstName: 'Justin', lastName: 'Giddeyy', position: 'SG' },
    { firstName: 'Mitchell', lastName: 'Buzeliss', position: 'SF' },
    { firstName: 'Justin', lastName: 'Smithh', position: 'SF' },
    { firstName: 'Cole', lastName: 'Sextonn', position: 'SG' },
    { firstName: 'Marco', lastName: 'McClungg', position: 'SG' },
    { firstName: 'Rafael', lastName: 'Dillinghamm', position: 'SG' },
    { firstName: 'Yusuf', lastName: 'Kawamuraa', position: 'SG' },
  ],
  'Cleveland|Rust': [
    { firstName: 'Jared', lastName: 'Hardenn', position: 'SG' },
    { firstName: 'Mitchell', lastName: 'Struss', position: 'SG' },
    { firstName: 'Tristan', lastName: 'Bryantt', position: 'C' },
    { firstName: 'Edgar', lastName: 'Mobleyy', position: 'C' },
    { firstName: 'Spencer', lastName: 'Merrilll', position: 'SG' },
    { firstName: 'Derek', lastName: 'Schröderr', position: 'SG' },
    { firstName: 'Chris', lastName: 'Porterr Jr.', position: 'SG' },
  ],
  'Detroit|Assembly': [
    { firstName: 'Justin', lastName: 'Durenn', position: 'C' },
    { firstName: 'Colin', lastName: 'Cunninghamm', position: 'SG' },
    { firstName: 'Immanuel', lastName: 'Joness', position: 'SF' },
    { firstName: 'Reid', lastName: 'Hollandd II', position: 'SF' },
    { firstName: 'Patrick', lastName: 'Reedd', position: 'SF' },
    { firstName: 'Connor', lastName: 'LeVertt', position: 'SG' },
    { firstName: 'Andre', lastName: 'Thompsonn', position: 'SG' },
  ],
  'Indiana|Velocity': [
    { firstName: 'Trevor', lastName: 'Haliburtonn', position: 'SG' },
    { firstName: 'Oscar', lastName: 'Toppinn', position: 'SF' },
    { firstName: 'Adrian', lastName: 'Nembhardd', position: 'SG' },
    { firstName: 'Travis', lastName: 'Peterr', position: 'SG' },
    { firstName: 'Jaxon', lastName: 'Walkerr', position: 'SF' },
    { firstName: 'Kevin', lastName: 'Joness', position: 'SG' },
    { firstName: 'Travis', lastName: 'McConnelll', position: 'SG' },
  ],
  'Milwaukee|Hops': [
    { firstName: 'Gideon', lastName: 'Antetokounmpoo', position: 'SF' },
    { firstName: 'Marcus', lastName: 'Turnerr', position: 'C' },
    { firstName: 'Bryce', lastName: 'Portiss', position: 'SF' },
    { firstName: 'Garrett', lastName: 'Trentt Jr.', position: 'SG' },
    { firstName: 'Keith', lastName: 'Porterr Jr.', position: 'SG' },
    { firstName: 'Kane', lastName: 'Kuzmaa', position: 'SF' },
    { firstName: 'Gerald', lastName: 'Harriss', position: 'SG' },
  ],
  'Atlanta|Peachtree': [
    { firstName: 'Kane', lastName: 'Gilbertt', position: 'SG' },
    { firstName: 'Rafael', lastName: 'Denniss', position: 'SG' },
    { firstName: 'Jaxon', lastName: 'Kumingaa', position: 'SF' },
    { firstName: 'Jordan', lastName: 'Johnsonn', position: 'SF' },
    { firstName: 'Kendrick', lastName: 'Wallacee', position: 'SG' },
    { firstName: 'Chris', lastName: 'McCollumm', position: 'SG' },
    { firstName: 'Grant', lastName: 'Vincentt', position: 'SG' },
  ],
  'Charlotte|Mint': [
    { firstName: 'Marcus', lastName: 'Bridgess', position: 'SF' },
    { firstName: 'Lance', lastName: 'Balll', position: 'SG' },
    { firstName: 'George', lastName: 'Williamss', position: 'SF' },
    { firstName: 'Colin', lastName: 'Whitee', position: 'SG' },
    { firstName: 'Spencer', lastName: 'Jamess', position: 'SG' },
    { firstName: 'Klaus', lastName: 'Knueppell', position: 'SG' },
    { firstName: 'Jerome', lastName: 'Greenn', position: 'SG' },
  ],
  'Miami|Surge': [
    { firstName: 'Shane', lastName: 'Fontecchioo', position: 'SF' },
    { firstName: 'Terrence', lastName: 'Keelss', position: 'SG' },
    { firstName: 'Nolan', lastName: 'Jovicc', position: 'SF' },
    { firstName: 'Keith', lastName: 'Waree', position: 'C' },
    { firstName: 'Peter', lastName: 'Larssonn', position: 'SG' },
    { firstName: 'Jerome', lastName: 'Jaquezz Jr.', position: 'SG' },
    { firstName: 'Dante', lastName: 'Smithh', position: 'SG' },
  ],
  'Orlando|Aurora': [
    { firstName: 'Albert', lastName: 'Moraless', position: 'SG' },
    { firstName: 'Andre', lastName: 'Blackk', position: 'SG' },
    { firstName: 'Jonas', lastName: 'Isaacc', position: 'SF' },
    { firstName: 'Jerome', lastName: 'Carterr', position: 'SG' },
    { firstName: 'Derek', lastName: 'Banee', position: 'SG' },
    { firstName: 'Jerome', lastName: 'Suggss', position: 'SG' },
    { firstName: 'Patrick', lastName: 'Bancheroo', position: 'SF' },
  ],
  'Washington|Monument': [
    { firstName: 'Jared', lastName: 'Reesee', position: 'SF' },
    { firstName: 'Bryce', lastName: 'Coulibalyy', position: 'SG' },
    { firstName: 'Tyler', lastName: 'Vukcevicc', position: 'SF' },
    { firstName: 'Cole', lastName: 'Whitmoree', position: 'SF' },
    { firstName: 'Travis', lastName: 'Youngg', position: 'SG' },
    { firstName: 'Dante', lastName: 'Russelll', position: 'SG' },
    { firstName: 'Jared', lastName: 'Watkinss', position: 'SF' },
  ],
  'Denver|Altitude': [
    { firstName: 'Charles', lastName: 'Braunn', position: 'SG' },
    { firstName: 'Cole', lastName: 'Joness', position: 'SG' },
    { firstName: 'Jordan', lastName: 'Strawtherr', position: 'SG' },
    { firstName: 'Trevor', lastName: 'Joness', position: 'SG' },
    { firstName: 'Pierre', lastName: 'Watsonn', position: 'SG' },
    { firstName: 'Tyler', lastName: 'Hardawayy Jr.', position: 'SG' },
    { firstName: 'Ben', lastName: 'Brownn', position: 'SG' },
  ],
  'Minnesota|Northstar': [
    { firstName: 'Derek', lastName: 'DiVincenzoo', position: 'SG' },
    { firstName: 'Trevor', lastName: 'Shannonn Jr.', position: 'SG' },
    { firstName: 'Jordan', lastName: 'McDanielss', position: 'SF' },
    { firstName: 'Justin', lastName: 'Phillipss', position: 'SF' },
    { firstName: 'Andre', lastName: 'Edwardss', position: 'SG' },
    { firstName: 'Jordan', lastName: 'Ingless', position: 'SF' },
    { firstName: 'Brooks', lastName: 'Hylandd', position: 'SG' },
  ],
  'Oklahoma City|Voltage': [
    { firstName: 'Shane', lastName: 'Gilgeous-Alexanderr', position: 'SG' },
    { firstName: 'Jerome', lastName: 'McCainn', position: 'SG' },
    { firstName: 'Landon', lastName: 'Dortt', position: 'SG' },
    { firstName: 'Justin', lastName: 'Williamss', position: 'SF' },
    { firstName: 'Charles', lastName: 'Holmgrenn', position: 'C' },
    { firstName: 'Jerome', lastName: 'Williamss', position: 'SG' },
    { firstName: 'Aaron', lastName: 'Carusoo', position: 'SG' },
  ],
  'Portland|Rose': [
    { firstName: 'Derek', lastName: 'Avdijaa', position: 'SF' },
    { firstName: 'Jonas', lastName: 'Grantt', position: 'SF' },
    { firstName: 'Stefan', lastName: 'Hendersonn', position: 'SG' },
    { firstName: 'Sean', lastName: 'Sharpee', position: 'SG' },
    { firstName: 'Tristan', lastName: 'Camaraa', position: 'SF' },
    { firstName: 'Jordan', lastName: 'Kentt', position: 'SF' },
    { firstName: 'Dante', lastName: 'Lillardd', position: 'SG' },
  ],
  'Utah|Mesa': [
    { firstName: 'Harold', lastName: 'Grayy', position: 'SG' },
    { firstName: 'Brandon', lastName: 'Hinsonn', position: 'SF' },
    { firstName: 'Keith', lastName: 'Georgee', position: 'SG' },
    { firstName: 'Chris', lastName: 'Williamss', position: 'SF' },
    { firstName: 'Isaac', lastName: 'Collierr', position: 'SG' },
    { firstName: 'Stefan', lastName: 'Mykhailiukk', position: 'SG' },
    { firstName: 'Ethan', lastName: 'Harklesss', position: 'SG' },
  ],
  'Golden State|Spectrum': [
    { firstName: 'Gavin', lastName: 'Paytonn II', position: 'SG' },
    { firstName: 'Bryce', lastName: 'Podziemskii', position: 'SG' },
    { firstName: 'Walter', lastName: 'Richardd', position: 'SG' },
    { firstName: 'Marcus', lastName: 'Moodyy', position: 'SG' },
    { firstName: 'Klaus', lastName: 'Porziņģiss', position: 'SF' },
    { firstName: 'Dante', lastName: 'Meltonn', position: 'SG' },
    { firstName: 'Jared', lastName: 'Butlerr III', position: 'SF' },
  ],
  'LA|Current': [
    { firstName: 'Keith', lastName: 'Leonardd', position: 'SF' },
    { firstName: 'Bryce', lastName: 'Beall', position: 'SG' },
    { firstName: 'Brandon', lastName: 'Mathurinn', position: 'SG' },
    { firstName: 'Dennis', lastName: 'Garlandd', position: 'SG' },
    { firstName: 'Blake', lastName: 'Lopezz', position: 'C' },
    { firstName: 'Damian', lastName: 'Joness Jr.', position: 'SF' },
    { firstName: 'Ben', lastName: 'Bogdanovicc', position: 'SG' },
  ],
  'LA|Cosmos': [
    { firstName: 'Landon', lastName: 'Doncicc', position: 'SF' },
    { firstName: 'Leandro', lastName: 'Jamess', position: 'SF' },
    { firstName: 'Alston', lastName: 'Reavess', position: 'SG' },
    { firstName: 'Derek', lastName: 'Aytonn', position: 'C' },
    { firstName: 'Ruben', lastName: 'Hachimuraa', position: 'SF' },
    { firstName: 'Mason', lastName: 'Smartt', position: 'SG' },
    { firstName: 'Jonas', lastName: 'Vanderbiltt', position: 'SF' },
  ],
  'Phoenix|Sol': [
    { firstName: 'Ryan', lastName: 'O\'Nealee', position: 'SF' },
    { firstName: 'Roland', lastName: 'Dunnn', position: 'SF' },
    { firstName: 'Derek', lastName: 'Bookerr', position: 'SG' },
    { firstName: 'Adrian', lastName: 'Coffeyy', position: 'SG' },
    { firstName: 'Darius', lastName: 'Brookss', position: 'SG' },
    { firstName: 'Jonas', lastName: 'Greenn', position: 'SG' },
    { firstName: 'Hector', lastName: 'Highsmithh', position: 'SF' },
  ],
  'Sacramento|Republic': [
    { firstName: 'Miles', lastName: 'Monkk', position: 'SG' },
    { firstName: 'Nelson', lastName: 'Cliffordd', position: 'SG' },
    { firstName: 'Klaus', lastName: 'Hayess', position: 'SG' },
    { firstName: 'Darius', lastName: 'McDermottt', position: 'SF' },
    { firstName: 'Zane', lastName: 'LaVinee', position: 'SG' },
    { firstName: 'Peter', lastName: 'Achiuwaa', position: 'SF' },
    { firstName: 'Derek', lastName: 'DeRozann', position: 'SG' },
  ],
  'Dallas|Lasso': [
    { firstName: 'Connor', lastName: 'Flaggg', position: 'SF' },
    { firstName: 'Kyle', lastName: 'Irvingg', position: 'SG' },
    { firstName: 'Patrick', lastName: 'Washingtonn', position: 'SF' },
    { firstName: 'Dennis', lastName: 'Gaffordd', position: 'SF' },
    { firstName: 'Dennis', lastName: 'Livelyy II', position: 'C' },
    { firstName: 'Kyle', lastName: 'Thompsonn', position: 'SG' },
    { firstName: 'Nate', lastName: 'Marshalll', position: 'SF' },
  ],
  'Houston|Comets': [
    { firstName: 'Adam', lastName: 'Holidayy', position: 'SG' },
    { firstName: 'Adam', lastName: 'Thompsonn', position: 'SG' },
    { firstName: 'Dante', lastName: 'Finney-Smithh', position: 'SF' },
    { firstName: 'Jordan', lastName: 'Davisonn', position: 'SG' },
    { firstName: 'Frank', lastName: 'VanVleett', position: 'SG' },
    { firstName: 'Keith', lastName: 'Durantt', position: 'SF' },
    { firstName: 'Jared', lastName: 'Tatee', position: 'SF' },
  ],
  'Memphis|Sound': [
    { firstName: 'Jared', lastName: 'Mashackk', position: 'SG' },
    { firstName: 'Javon', lastName: 'Wellss', position: 'SF' },
    { firstName: 'Samuel', lastName: 'Pippenn Jr.', position: 'SG' },
    { firstName: 'Tristan', lastName: 'Jeromee', position: 'SG' },
    { firstName: 'Klaus', lastName: 'Caldwell-Popee', position: 'SG' },
    { firstName: 'Wilson', lastName: 'Claytonn Jr.', position: 'SG' },
    { firstName: 'Simon', lastName: 'Aldamaa', position: 'SF' },
  ],
  'New Orleans|Bayou': [
    { firstName: 'Jonas', lastName: 'Oduroo', position: 'C' },
    { firstName: 'Jerome', lastName: 'Fearss', position: 'SG' },
    { firstName: 'Zane', lastName: 'Williamsonn', position: 'SF' },
    { firstName: 'Hugo', lastName: 'Joness', position: 'SF' },
    { firstName: 'Jared', lastName: 'Poolee', position: 'SG' },
    { firstName: 'Hector', lastName: 'Dickinsonn', position: 'C' },
    { firstName: 'Derek', lastName: 'Murrayy', position: 'SG' },
  ],
  'San Antonio|Mission': [
    { firstName: 'Jared', lastName: 'McLaughlinn', position: 'SG' },
    { firstName: 'Vincent', lastName: 'Wembanyamaa', position: 'SF' },
    { firstName: 'Dante', lastName: 'Harperr', position: 'SG' },
    { firstName: 'Kendrick', lastName: 'Johnsonn', position: 'SF' },
    { firstName: 'Dennis', lastName: 'Foxx', position: 'SG' },
    { firstName: 'Sean', lastName: 'Castlee', position: 'SG' },
    { firstName: 'Lance', lastName: 'Kornett', position: 'C' },
  ],
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
