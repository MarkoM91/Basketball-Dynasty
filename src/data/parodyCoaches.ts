import { teamParodyKey } from './parodyRoster';
import { personNameKey } from './names';

/**
 * BBGM-style coach parody rule (every entry):
 * 1. Fictional first name — same first letter as the real coach, but a different name.
 * 2. Surname with exactly one typo.
 */
export type ParodyCoachTemplate = {
  firstName: string;
  lastName: string;
  tier?: 'elite' | 'solid' | 'developing';
};

export const TEAM_PARODY_COACHES: Record<string, ParodyCoachTemplate> = {
  'Boston|Harbor': { firstName: 'Jonas', lastName: 'Mazzullaa', tier: 'solid' },
  'Brooklyn|Union': { firstName: 'Jared', lastName: 'Fernandezz', tier: 'developing' },
  'New York|Skyline': { firstName: 'Travis', lastName: 'Thibodeauu', tier: 'solid' },
  'Philadelphia|Colonials': { firstName: 'Nate', lastName: 'Nursse', tier: 'elite' },
  'Toronto|Sentinel': { firstName: 'Derek', lastName: 'Rajakovicc', tier: 'developing' },
  'Chicago|Gale': { firstName: 'Blake', lastName: 'Donovann', tier: 'solid' },
  'Cleveland|Rust': { firstName: 'Keith', lastName: 'Atkinsonn', tier: 'solid' },
  'Detroit|Assembly': { firstName: 'Jordan', lastName: 'Bickerstafff', tier: 'developing' },
  'Indiana|Velocity': { firstName: 'Ryan', lastName: 'Carlislee', tier: 'elite' },
  'Milwaukee|Hops': { firstName: 'Douglas', lastName: 'Riverss', tier: 'solid' },
  'Atlanta|Peachtree': { firstName: 'Quentin', lastName: 'Snyderr', tier: 'solid' },
  'Charlotte|Mint': { firstName: 'Colin', lastName: 'Leee', tier: 'developing' },
  'Miami|Surge': { firstName: 'Edgar', lastName: 'Spoelstraa', tier: 'elite' },
  'Orlando|Aurora': { firstName: 'Jordan', lastName: 'Mosleyy', tier: 'developing' },
  'Washington|Monument': { firstName: 'Walter', lastName: 'Unseldjr', tier: 'developing' },
  'Denver|Altitude': { firstName: 'Mitchell', lastName: 'Malonee', tier: 'elite' },
  'Minnesota|Northstar': { firstName: 'Colin', lastName: 'Finchn', tier: 'solid' },
  'Oklahoma City|Voltage': { firstName: 'Mitchell', lastName: 'Daigneaultt', tier: 'solid' },
  'Portland|Rose': { firstName: 'Charles', lastName: 'Billupss', tier: 'developing' },
  'Utah|Mesa': { firstName: 'Wesley', lastName: 'Hardyy', tier: 'developing' },
  'Golden State|Spectrum': { firstName: 'Stefan', lastName: 'Kerrr', tier: 'elite' },
  'LA|Current': { firstName: 'Travis', lastName: 'Luue', tier: 'elite' },
  'LA|Cosmos': { firstName: 'Justin', lastName: 'Redickk', tier: 'developing' },
  'Phoenix|Sol': { firstName: 'Miles', lastName: 'Budenholzerr', tier: 'solid' },
  'Sacramento|Republic': { firstName: 'Mitchell', lastName: 'Brownn', tier: 'solid' },
  'Dallas|Lasso': { firstName: 'Jordan', lastName: 'Kidd', tier: 'solid' },
  'Houston|Comets': { firstName: 'Isaac', lastName: 'Udokaa', tier: 'solid' },
  'Memphis|Sound': { firstName: 'Travis', lastName: 'Jenkinss', tier: 'solid' },
  'New Orleans|Bayou': { firstName: 'Walter', lastName: 'Greenn', tier: 'developing' },
  'San Antonio|Mission': { firstName: 'Gerald', lastName: 'Popovicch', tier: 'elite' },
};

/** Unemployed / market-only coaches (not tied to a franchise sideline). */
export const AVAILABLE_COACH_PARODIES: readonly ParodyCoachTemplate[] = [
  { firstName: 'Blake', lastName: 'Stevenss', tier: 'elite' },
  { firstName: 'Felix', lastName: 'Vogell', tier: 'solid' },
  { firstName: 'Nolan', lastName: 'McMillann', tier: 'solid' },
  { firstName: 'Landon', lastName: 'Waltonn', tier: 'developing' },
  { firstName: 'Derek', lastName: 'Fizdalee', tier: 'developing' },
  { firstName: 'Spencer', lastName: 'VanGundyy', tier: 'solid' },
  { firstName: 'Justin', lastName: 'VanGundyy', tier: 'solid' },
  { firstName: 'Sean', lastName: 'Nassh', tier: 'developing' },
  { firstName: 'Miles', lastName: 'Williamss', tier: 'solid' },
  { firstName: 'Peter', lastName: 'Rileyy', tier: 'elite' },
];

const TEAM_EXCLUSIVE_COACH_KEYS = new Set(
  Object.values(TEAM_PARODY_COACHES).map((c) => personNameKey(c.firstName, c.lastName)),
);

export function coachParodyName(template: ParodyCoachTemplate): string {
  return `${template.firstName} ${template.lastName}`;
}

export function getTeamParodyCoach(city: string, name: string): ParodyCoachTemplate | null {
  return TEAM_PARODY_COACHES[teamParodyKey(city, name)] ?? null;
}

export function isTeamExclusiveCoach(firstName: string, lastName: string): boolean {
  return TEAM_EXCLUSIVE_COACH_KEYS.has(personNameKey(firstName, lastName));
}

export function coachRatingsFromTemplate(template: ParodyCoachTemplate): { devRating: number; playoffRating: number } {
  const key = personNameKey(template.firstName, template.lastName);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }

  const tier = template.tier ?? 'solid';
  if (tier === 'elite') {
    return {
      devRating: 82 + (hash % 11),
      playoffRating: 80 + ((hash >> 6) % 13),
    };
  }
  if (tier === 'developing') {
    return {
      devRating: 62 + (hash % 11),
      playoffRating: 58 + ((hash >> 6) % 13),
    };
  }
  return {
    devRating: 72 + (hash % 11),
    playoffRating: 68 + ((hash >> 6) % 13),
  };
}

export function pickCoachMarketParodies(excludeName: string | undefined, count: number, salt = 0): ParodyCoachTemplate[] {
  const pool = [
    ...Object.values(TEAM_PARODY_COACHES),
    ...AVAILABLE_COACH_PARODIES,
  ];
  const excludeKey = excludeName?.trim().toLowerCase() ?? '';
  const picked: ParodyCoachTemplate[] = [];
  const used = new Set<string>();

  for (let offset = 0; offset < pool.length && picked.length < count; offset += 1) {
    const template = pool[(salt + offset) % pool.length];
    const key = personNameKey(template.firstName, template.lastName);
    const fullName = coachParodyName(template);
    if (used.has(key)) continue;
    if (excludeKey && fullName.toLowerCase() === excludeKey) continue;
    used.add(key);
    picked.push(template);
  }

  return picked;
}
