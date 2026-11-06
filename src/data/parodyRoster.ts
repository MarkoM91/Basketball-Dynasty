import type { Position } from '../types/game';
import { personNameKey } from './names';
import { TEAM_PARODY_DEPTH } from './parodyRosterDepth';

/**
 * BBGM-style parody naming rule (every entry):
 * 1. Fictional first name — same first letter as the real player, but a different name.
 * 2. Real surname from the official roster with exactly one typo (usually double the final letter).
 * Current 2026-27 rosters from ESPN; snapshot: 6 November 2026.
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
    {"firstName":"Jordan","lastName":"Tatumm","position":"PF"},
    {"firstName":"Darius","lastName":"Whitee","position":"SG"},
    {"firstName":"Peter","lastName":"Pritchardd","position":"PG"},
    {"firstName":"Patrick","lastName":"Georgee","position":"SF"},
    {"firstName":"Nate","lastName":"Quetaa","position":"C"},
    {"firstName":"Spencer","lastName":"Hauserr","position":"SF"},
    {"firstName":"Derek","lastName":"Carterr","position":"PG"},
  ],
  'Brooklyn|Union': [
    {"firstName":"Mitchell","lastName":"Porterr Jr.","position":"PF"},
    {"firstName":"Justin","lastName":"Randlee","position":"SF"},
    {"firstName":"Norman","lastName":"Clowneyy","position":"PF"},
    {"firstName":"Evan","lastName":"Deminn","position":"SG"},
    {"firstName":"Trevor","lastName":"Mannn","position":"SG"},
    {"firstName":"Damian","lastName":"Sharpee","position":"C"},
    {"firstName":"Nate","lastName":"Traoree","position":"PG"},
  ],
  'New York|Skyline': [
    {"firstName":"Jaxon","lastName":"Brunsonn","position":"PG"},
    {"firstName":"Kendrick","lastName":"Townss","position":"C"},
    {"firstName":"Omar","lastName":"Anunobyy","position":"SF"},
    {"firstName":"Miles","lastName":"Bridgess","position":"SG"},
    {"firstName":"Jerome","lastName":"Hartt","position":"SG"},
    {"firstName":"Mitchell","lastName":"McBridee","position":"PG"},
    {"firstName":"Landon","lastName":"Shamett","position":"SG"},
  ],
  'Philadelphia|Colonials': [
    {"firstName":"Javon","lastName":"Brownn","position":"SG"},
    {"firstName":"Trevor","lastName":"Maxeyy","position":"PG"},
    {"firstName":"Jonas","lastName":"Embiidd","position":"C"},
    {"firstName":"Leandro","lastName":"Jamess","position":"SF"},
    {"firstName":"Vernon","lastName":"Edgecombee","position":"SG"},
    {"firstName":"Adam","lastName":"Simonss","position":"SG"},
    {"firstName":"Darius","lastName":"Barloww","position":"SF"},
  ],
  'Toronto|Sentinel': [
    {"firstName":"Keith","lastName":"Leonardd","position":"SF"},
    {"firstName":"Spencer","lastName":"Barness","position":"SF"},
    {"firstName":"Isaiah","lastName":"Quickleyy","position":"PG"},
    {"firstName":"Roland","lastName":"Barrettt","position":"SF"},
    {"firstName":"Jaxon","lastName":"Poeltll","position":"C"},
    {"firstName":"Charles","lastName":"Murray-Boyless","position":"SF"},
    {"firstName":"Jared","lastName":"Sheadd","position":"PG"},
  ],
  'Chicago|Gale': [
    {"firstName":"Justin","lastName":"Giddeyy","position":"PG"},
    {"firstName":"Noah","lastName":"Powelll","position":"SG"},
    {"firstName":"Mitchell","lastName":"Buzeliss","position":"SF"},
    {"firstName":"Tyler","lastName":"Joness","position":"PG"},
    {"firstName":"Nate","lastName":"Claxtonn","position":"C"},
    {"firstName":"Isaiah","lastName":"Okoroo","position":"SF"},
    {"firstName":"Landon","lastName":"Millerr","position":"PF"},
  ],
  'Cleveland|Rust': [
    {"firstName":"Derek","lastName":"Mitchelll","position":"PG"},
    {"firstName":"Jared","lastName":"Hardenn","position":"PG"},
    {"firstName":"Edgar","lastName":"Mobleyy","position":"C"},
    {"firstName":"Jonas","lastName":"Allenn","position":"C"},
    {"firstName":"Pierre","lastName":"Watsonn","position":"SG"},
    {"firstName":"Jerome","lastName":"Tysonn","position":"SG"},
    {"firstName":"Spencer","lastName":"Merrilll","position":"SG"},
  ],
  'Detroit|Assembly': [
    {"firstName":"Colin","lastName":"Cunninghamm","position":"PG"},
    {"firstName":"Justin","lastName":"Durenn","position":"C"},
    {"firstName":"Jared","lastName":"Collinss","position":"SF"},
    {"firstName":"Damian","lastName":"Robinsonn","position":"SF"},
    {"firstName":"Andre","lastName":"Thompsonn","position":"SG"},
    {"firstName":"Keith","lastName":"Huerterr","position":"SG"},
    {"firstName":"Immanuel","lastName":"Joee","position":"SG"},
  ],
  'Indiana|Velocity': [
    {"firstName":"Patrick","lastName":"Siakamm","position":"SF"},
    {"firstName":"Trevor","lastName":"Haliburtonn","position":"PG"},
    {"firstName":"Adrian","lastName":"Nembhardd","position":"PG"},
    {"firstName":"Isaiah","lastName":"Zubacc","position":"C"},
    {"firstName":"Kevin","lastName":"Oubree Jr.","position":"SG"},
    {"firstName":"Adam","lastName":"Nesmithh","position":"SG"},
    {"firstName":"Jaxon","lastName":"Walkerr","position":"SF"},
  ],
  'Milwaukee|Hops': [
    {"firstName":"Roland","lastName":"Rollinss","position":"PG"},
    {"firstName":"Travis","lastName":"Herroo","position":"SG"},
    {"firstName":"Jerome","lastName":"Jaquezz Jr.","position":"SF"},
    {"firstName":"Marcus","lastName":"Turnerr","position":"C"},
    {"firstName":"Kane","lastName":"Kuzmaa","position":"SF"},
    {"firstName":"Adam","lastName":"Greenn","position":"SG"},
    {"firstName":"Keith","lastName":"Waree","position":"C"},
  ],
  'Atlanta|Peachtree': [
    {"firstName":"Jordan","lastName":"Johnsonn","position":"PF"},
    {"firstName":"Noah","lastName":"Alexander-Walkerr","position":"SG"},
    {"firstName":"Orlando","lastName":"Okongwuu","position":"PF"},
    {"firstName":"Dennis","lastName":"Danielss","position":"PG"},
    {"firstName":"Chris","lastName":"McCollumm","position":"PG"},
    {"firstName":"Jordan","lastName":"Landalee","position":"C"},
    {"firstName":"Landon","lastName":"Dortt","position":"SG"},
  ],
  'Charlotte|Mint': [
    {"firstName":"Blake","lastName":"Millerr","position":"SF"},
    {"firstName":"Klaus","lastName":"Knueppell","position":"SG"},
    {"firstName":"Colin","lastName":"Whitee","position":"SG"},
    {"firstName":"Gideon","lastName":"Allenn","position":"PG"},
    {"firstName":"Nelson","lastName":"Reidd","position":"C"},
    {"firstName":"Derek","lastName":"Schroderr","position":"PG"},
    {"firstName":"Ryan","lastName":"O'Nealee","position":"SF"},
  ],
  'Miami|Surge': [
    {"firstName":"Gideon","lastName":"Antetokounmpoo","position":"PF"},
    {"firstName":"Brandon","lastName":"Adebayoo","position":"C"},
    {"firstName":"Aaron","lastName":"Wigginss","position":"SF"},
    {"firstName":"Bryce","lastName":"Portiss","position":"PF"},
    {"firstName":"Tyler","lastName":"Hardawayy Jr.","position":"SG"},
    {"firstName":"Dante","lastName":"Mitchelll","position":"PG"},
    {"firstName":"Peter","lastName":"Larssonn","position":"SG"},
  ],
  'Orlando|Aurora': [
    {"firstName":"Patrick","lastName":"Bancheroo","position":"PF"},
    {"firstName":"Derek","lastName":"Banee","position":"SG"},
    {"firstName":"Finn","lastName":"Wagnerr","position":"PF"},
    {"firstName":"Nolan","lastName":"Vucevicc","position":"C"},
    {"firstName":"Andre","lastName":"Blackk","position":"SG"},
    {"firstName":"Jerome","lastName":"Suggss","position":"PG"},
    {"firstName":"Wesley","lastName":"Carterr Jr.","position":"C"},
  ],
  'Washington|Monument': [
    {"firstName":"Andre","lastName":"Daviss","position":"PF"},
    {"firstName":"Travis","lastName":"Youngg","position":"PG"},
    {"firstName":"Austin","lastName":"Sarrr","position":"C"},
    {"firstName":"Kevin","lastName":"Georgee","position":"SF"},
    {"firstName":"Derek","lastName":"Aytonn","position":"C"},
    {"firstName":"Ben","lastName":"Carringtonn","position":"SG"},
    {"firstName":"Bryce","lastName":"Coulibalyy","position":"SG"},
  ],
  'Denver|Altitude': [
    {"firstName":"Nolan","lastName":"Jokicc","position":"C"},
    {"firstName":"Jared","lastName":"Murrayy","position":"PG"},
    {"firstName":"Derek","lastName":"DeRozann","position":"SG"},
    {"firstName":"Adam","lastName":"Gordonn","position":"SF"},
    {"firstName":"Chris","lastName":"Johnsonn","position":"SF"},
    {"firstName":"Charles","lastName":"Braunn","position":"SG"},
    {"firstName":"Mitchell","lastName":"Bagleyy III","position":"PF"},
  ],
  'Minnesota|Northstar': [
    {"firstName":"Andre","lastName":"Edwardss","position":"SG"},
    {"firstName":"Lance","lastName":"Balll","position":"PG"},
    {"firstName":"Jordan","lastName":"McDanielss","position":"SF"},
    {"firstName":"Roland","lastName":"Gobertt","position":"C"},
    {"firstName":"Derek","lastName":"DiVincenzoo","position":"SG"},
    {"firstName":"Adam","lastName":"Dosunmuu","position":"SG"},
    {"firstName":"Jaxon","lastName":"Kumingaa","position":"SF"},
  ],
  'Oklahoma City|Voltage': [
    {"firstName":"Shane","lastName":"Gilgeous-Alexanderr","position":"PG"},
    {"firstName":"Charles","lastName":"Holmgrenn","position":"C"},
    {"firstName":"Jerome","lastName":"Williamss","position":"PG"},
    {"firstName":"Albert","lastName":"Mitchelll","position":"SG"},
    {"firstName":"Ivan","lastName":"Hartensteinn","position":"C"},
    {"firstName":"Colin","lastName":"Wallacee","position":"PG"},
    {"firstName":"Justin","lastName":"Williamss","position":"PF"},
  ],
  'Portland|Rose': [
    {"firstName":"Dante","lastName":"Lillardd","position":"PG"},
    {"firstName":"Derek","lastName":"Avdijaa","position":"SF"},
    {"firstName":"Sean","lastName":"Sharpee","position":"SG"},
    {"firstName":"Justin","lastName":"Holidayy","position":"PG"},
    {"firstName":"Jared","lastName":"Morantt","position":"PG"},
    {"firstName":"Tristan","lastName":"Camaraa","position":"SF"},
    {"firstName":"Darius","lastName":"Clingann","position":"C"},
  ],
  'Utah|Mesa': [
    {"firstName":"Liam","lastName":"Markkanenn","position":"PF"},
    {"firstName":"Keith","lastName":"Georgee","position":"PG"},
    {"firstName":"Jerome","lastName":"Jacksonn Jr.","position":"PF"},
    {"firstName":"Austin","lastName":"Baileyy","position":"SG"},
    {"firstName":"Ben","lastName":"Sensabaughh","position":"SF"},
    {"firstName":"Isaac","lastName":"Collierr","position":"PG"},
    {"firstName":"Justin","lastName":"Nurkicc","position":"C"},
  ],
  'Golden State|Spectrum': [
    {"firstName":"Stefan","lastName":"Curryy","position":"PG"},
    {"firstName":"Jared","lastName":"Butlerr III","position":"SF"},
    {"firstName":"Bryce","lastName":"Podziemskii","position":"SG"},
    {"firstName":"Klaus","lastName":"Porzingiss","position":"C"},
    {"firstName":"Derek","lastName":"Greenn","position":"SF"},
    {"firstName":"Marcus","lastName":"Moodyy","position":"SG"},
    {"firstName":"Dante","lastName":"Meltonn","position":"PG"},
  ],
  'LA|Current': [
    {"firstName":"Blake","lastName":"Ingramm","position":"SF"},
    {"firstName":"Dennis","lastName":"Garlandd","position":"PG"},
    {"firstName":"Ruben","lastName":"Hachimuraa","position":"SF"},
    {"firstName":"Damian","lastName":"Joness Jr.","position":"SF"},
    {"firstName":"Mitchell","lastName":"Struss","position":"SG"},
    {"firstName":"Kane","lastName":"Dunnn","position":"PG"},
    {"firstName":"Jared","lastName":"Millerr","position":"SG"},
  ],
  'LA|Cosmos': [
    {"firstName":"Landon","lastName":"Doncicc","position":"PG"},
    {"firstName":"Alston","lastName":"Reavess","position":"SG"},
    {"firstName":"Quinn","lastName":"Grimess","position":"SG"},
    {"firstName":"Warren","lastName":"Kesslerr","position":"C"},
    {"firstName":"Cole","lastName":"Sextonn","position":"PG"},
    {"firstName":"Spencer","lastName":"Mamukelashvilii","position":"SF"},
    {"firstName":"Zane","lastName":"Williamss","position":"SF"},
  ],
  'Phoenix|Sol': [
    {"firstName":"Derek","lastName":"Bookerr","position":"PG"},
    {"firstName":"Darius","lastName":"Brookss","position":"SF"},
    {"firstName":"Marcus","lastName":"Bridgess","position":"SF"},
    {"firstName":"Jonas","lastName":"Greenn","position":"SG"},
    {"firstName":"Charles","lastName":"Gillespiee","position":"PG"},
    {"firstName":"Marcus","lastName":"Williamss","position":"C"},
    {"firstName":"Jaxon","lastName":"Goodwinn","position":"PG"},
  ],
  'Sacramento|Republic': [
    {"firstName":"Zane","lastName":"LaVinee","position":"SG"},
    {"firstName":"Darius","lastName":"Saboniss","position":"PF"},
    {"firstName":"Kendrick","lastName":"Murrayy","position":"SF"},
    {"firstName":"Miles","lastName":"Raynaudd","position":"C"},
    {"firstName":"Derek","lastName":"Hunterr","position":"SF"},
    {"firstName":"Miles","lastName":"Monkk","position":"PG"},
    {"firstName":"Peter","lastName":"Achiuwaa","position":"PF"},
  ],
  'Dallas|Lasso': [
    {"firstName":"Kyle","lastName":"Irvingg","position":"PG"},
    {"firstName":"Connor","lastName":"Flaggg","position":"SF"},
    {"firstName":"Patrick","lastName":"Washingtonn","position":"SF"},
    {"firstName":"Nate","lastName":"Marshalll","position":"SF"},
    {"firstName":"Simon","lastName":"Aldamaa","position":"PF"},
    {"firstName":"Mitchell","lastName":"Christiee","position":"SG"},
    {"firstName":"Dennis","lastName":"Gaffordd","position":"PF"},
  ],
  'Houston|Comets': [
    {"firstName":"Keith","lastName":"Durantt","position":"PF"},
    {"firstName":"Albert","lastName":"Sengunn","position":"C"},
    {"firstName":"Adam","lastName":"Thompsonn","position":"SG"},
    {"firstName":"Justin","lastName":"Smithh Jr.","position":"PF"},
    {"firstName":"Frank","lastName":"VanVleett","position":"PG"},
    {"firstName":"Reid","lastName":"Sheppardd","position":"PG"},
    {"firstName":"Mason","lastName":"Smartt","position":"PG"},
  ],
  'Memphis|Sound': [
    {"firstName":"Jonas","lastName":"Grantt","position":"SF"},
    {"firstName":"Tristan","lastName":"Jeromee","position":"PG"},
    {"firstName":"Charles","lastName":"Cowardd","position":"SF"},
    {"firstName":"Zane","lastName":"Edeyy","position":"C"},
    {"firstName":"Javon","lastName":"Wellss","position":"SF"},
    {"firstName":"Cole","lastName":"Spencerr","position":"PG"},
    {"firstName":"Grant","lastName":"Jacksonn","position":"SF"},
  ],
  'New Orleans|Bayou': [
    {"firstName":"Tyson","lastName":"Murphyy III","position":"SF"},
    {"firstName":"Zane","lastName":"Williamsonn","position":"SF"},
    {"firstName":"Simon","lastName":"Beyy","position":"SF"},
    {"firstName":"Brandon","lastName":"Mathurinn","position":"SG"},
    {"firstName":"Derek","lastName":"Murrayy","position":"PG"},
    {"firstName":"Jerome","lastName":"Fearss","position":"PG"},
    {"firstName":"Dennis","lastName":"Queenn","position":"C"},
  ],
  'San Antonio|Mission': [
    {"firstName":"Vincent","lastName":"Wembanyamaa","position":"PF"},
    {"firstName":"Dennis","lastName":"Foxx","position":"PG"},
    {"firstName":"Sean","lastName":"Castlee","position":"PG"},
    {"firstName":"Derek","lastName":"Vasselll","position":"SG"},
    {"firstName":"Tyson","lastName":"Harriss","position":"SF"},
    {"firstName":"Kendrick","lastName":"Johnsonn","position":"SF"},
    {"firstName":"Justin","lastName":"Champagniee","position":"SF"},
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

const TEAM_EXCLUSIVE_SURNAMES = new Set(
  Object.keys(TEAM_PARODY_ROSTERS).flatMap((key) => getTeamParodyRosterByKey(key).map((p) => p.lastName.toLowerCase())),
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
    if (!used.has(key) && !TEAM_EXCLUSIVE_KEYS.has(key) && !TEAM_EXCLUSIVE_SURNAMES.has(template.lastName.toLowerCase())) {
      used.add(key);
      return template;
    }
  }
  return null;
}

export function isTeamExclusiveParody(firstName: string, lastName: string): boolean {
  return TEAM_EXCLUSIVE_KEYS.has(personNameKey(firstName, lastName));
}
