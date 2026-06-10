/** Shared name pools — every generated player gets a unique full name. */

import type { Position } from '../types/game';
import { pickDraftClassParodyName, pickTeamParodyName } from './parodyRoster';

export const FIRST_NAMES = [
  'Aaron', 'Adrian', 'Amir', 'Andre', 'Anthony', 'Ben', 'Brandon', 'Caleb', 'Cam', 'Chris',
  'Cole', 'Darius', 'Derek', 'Devin', 'Eli', 'Elijah', 'Ethan', 'Felix', 'Grant', 'Hugo',
  'Isaiah', 'Ivan', 'Jace', 'Jalen', 'Jordan', 'Kai', 'Kyle', 'Liam', 'Luis', 'Malik',
  'Marcus', 'Mateo', 'Miles', 'Nate', 'Noah', 'Oscar', 'Owen', 'Quinn', 'Ray', 'Roman',
  'Ryan', 'Sam', 'Terrence', 'Tre', 'Tyrese', 'Vince', 'Xavier', 'Zion', 'Jaylen', 'Jamal',
  'DeShawn', 'Marco', 'Luca', 'Nikolai', 'Pierre', 'Rafael', 'Santiago', 'Tariq', 'Victor', 'Wesley',
  'Blake', 'Carter', 'Dillon', 'Evan', 'Gavin', 'Hunter', 'Jonah', 'Keon', 'Landon', 'Micah',
  'Nolan', 'Preston', 'Reid', 'Spencer', 'Tyson', 'Wayne', 'Zach', 'Brooks', 'Corey', 'Damian',
];

export const LAST_NAMES = [
  'Adams', 'Allen', 'Barnes', 'Bell', 'Brooks', 'Brown', 'Carter', 'Clark', 'Cole', 'Collins',
  'Cross', 'Davis', 'Diaz', 'Donovan', 'Ellis', 'Evans', 'Foster', 'Fox', 'Grant', 'Green',
  'Hayes', 'Hill', 'Holland', 'Howard', 'Jackson', 'James', 'Johnson', 'Kelly', 'King', 'Lee',
  'Lewis', 'Mason', 'Miller', 'Moore', 'Morris', 'Murphy', 'Nash', 'Owens', 'Pierce', 'Porter',
  'Powell', 'Price', 'Reed', 'Rhodes', 'Richardson', 'Ross', 'Scott', 'Shaw', 'Singh', 'Smart',
  'Stone', 'Taylor', 'Thomas', 'Thompson', 'Turner', 'Vale', 'Walker', 'Walters', 'Ward', 'Washington',
  'Whitfield', 'Williams', 'Wilson', 'Wright', 'Young', 'Chen', 'Nguyen', 'Patel', 'Kim', 'Santos',
  'Rivera', 'Torres', 'Bennett', 'Campbell', 'Edwards', 'Fisher', 'Gordon', 'Harrison', 'Jenkins', 'Lawson',
  'Mitchell', 'Parker', 'Reyes', 'Stewart', 'Wallace', 'Wells', 'Bryant', 'Crawford', 'Douglas', 'Freeman',
];

export function personNameKey(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
}

export function buildNameRegistry(
  sources: Iterable<{ firstName: string; lastName: string }>[],
): Set<string> {
  const used = new Set<string>();
  for (const source of sources) {
    for (const person of source) {
      used.add(personNameKey(person.firstName, person.lastName));
    }
  }
  return used;
}

function takeGenericName(used: Set<string>, salt: number): { firstName: string; lastName: string } {
  const combos = FIRST_NAMES.length * LAST_NAMES.length;
  for (let offset = 0; offset < combos; offset += 1) {
    const mixed = (salt * 2654435761 + offset * 1597334677) % combos;
    const firstName = FIRST_NAMES[mixed % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor(mixed / FIRST_NAMES.length) % LAST_NAMES.length];
    const key = personNameKey(firstName, lastName);
    if (!used.has(key)) {
      used.add(key);
      return { firstName, lastName };
    }
  }

  for (let n = 2; n < 100; n += 1) {
    const firstName = FIRST_NAMES[(salt + n) % FIRST_NAMES.length];
    const lastName = `${LAST_NAMES[(salt * 3 + n) % LAST_NAMES.length]} ${['Jr.', 'II', 'III'][n % 3]}`;
    const key = personNameKey(firstName, lastName);
    if (!used.has(key)) {
      used.add(key);
      return { firstName, lastName };
    }
  }

  const firstName = FIRST_NAMES[salt % FIRST_NAMES.length];
  const lastName = `Prospect${salt}`;
  used.add(personNameKey(firstName, lastName));
  return { firstName, lastName };
}

/**
 * One subtle typo on a real surname — swaps an internal vowel (a→e, e→a, o→u, etc.)
 * so the name reads almost-right but is clearly fictional. Never doubles letters.
 * Examples: Mitchell → Mitchall, Brown → Brawn, Torres → Torras
 */
export function typoSurname(lastName: string): string {
  const match = lastName.match(/^(.+?)(\s+(Jr\.|II|III|IV))$/i);
  if (match) return `${typoSurname(match[1])}${match[2]}`;

  // Vowel swap map — cycle each vowel to the next
  const swapMap: Record<string, string> = { a: 'e', e: 'a', i: 'y', o: 'u', u: 'o', A: 'E', E: 'A', I: 'Y', O: 'U', U: 'O' };

  // Find the last vowel in the word (not the very first char, keep the start recognisable)
  for (let i = lastName.length - 1; i > 0; i--) {
    const c = lastName[i];
    if (swapMap[c]) {
      return lastName.slice(0, i) + swapMap[c] + lastName.slice(i + 1);
    }
  }
  // No vowel found (unlikely) — just return as-is
  return lastName;
}

/**
 * Franchise roster names — team parody stars first, then generic names with a surname typo.
 * Never uses draft-class parodies (those stay in the draft / FA pool).
 */
export function takeTeamRosterName(
  city: string,
  teamName: string,
  slot: number,
  used: Set<string>,
  salt = 0,
): { firstName: string; lastName: string; position?: Position } {
  const parody = pickTeamParodyName(city, teamName, slot, used);
  if (parody) {
    return { firstName: parody.firstName, lastName: parody.lastName, position: parody.position };
  }

  // Fallback only when a team pool is missing entries (should not happen for the 30 league teams).
  const generic = takeGenericName(used, slot * 17 + salt);
  return {
    firstName: generic.firstName,
    lastName: typoSurname(generic.lastName),
  };
}

/**
 * Draft / FA / depth filler names — unassigned draft-class parodies only.
 * Rule: fictional first name + real surname with one typo (see parodyRoster.ts).
 * Franchise stars (e.g. Leandro Jhames on LA Cosmos) use pickTeamParodyName().
 */
export function takeUniqueName(used: Set<string>, salt = 0): { firstName: string; lastName: string } {
  const leanParody = (salt * 1103515245 + 12345) % 100 < 62;
  if (leanParody) {
    const parody = pickDraftClassParodyName(used, salt);
    if (parody) return { firstName: parody.firstName, lastName: parody.lastName };
  }

  return takeGenericName(used, salt);
}
