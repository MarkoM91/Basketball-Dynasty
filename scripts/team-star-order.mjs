/**
 * Teams whose scraped roster order doesn't match parodyRoster.ts slot order.
 * Stars listed first so slot 0 = franchise face in both parody names and proballers stats.
 */

export const TEAM_STAR_ORDER = {
  'LA|Cosmos': [
    'Luka Dončić',
    'Luka Doncic',
    'LeBron James',
    'Austin Reaves',
    'Deandre Ayton',
    'Rui Hachimura',
    'Marcus Smart',
    'Jarred Vanderbilt',
    'Dalton Knecht',
    'Jaxson Hayes',
    'Bronny James',
  ],
  'LA|Current': [
    'Kawhi Leonard',
    'Bradley Beal',
    'Bennedict Mathurin',
    'Darius Garland',
    'Brook Lopez',
    'Derrick Jones Jr.',
    'Bogdan Bogdanović',
    'Bogdan Bogdanovic',
    'Kris Dunn',
  ],
  'Dallas|Lasso': [
    'Cooper Flagg',
    'Kyrie Irving',
    'P.J. Washington',
    'Daniel Gafford',
    'Dereck Lively II',
    'Klay Thompson',
    'Naji Marshall',
    'Max Christie',
    'Khris Middleton',
  ],
  'Milwaukee|Hops': [
    'Giannis Antetokounmpo',
    'Myles Turner',
    'Bobby Portis',
    'Gary Trent Jr.',
    'Kevin Porter Jr.',
    'Kyle Kuzma',
    'Gary Harris',
    'Taurean Prince',
    'Ryan Rollins',
    'AJ Green',
    'Ousmane Dieng',
  ],
  'Chicago|Gale': [
    'Josh Giddey',
    'Nikola Vučević',
    'Nikola Vucevic',
    'Coby White',
    'Matas Buzelis',
    'Joshua Primo',
    'Ayo Dosunmu',
    'Jalen Smith',
  ],
  'Portland|Rose': [
    'Deni Avdija',
    'Jerami Grant',
    'Scoot Henderson',
    'Shaedon Sharpe',
    'Anfernee Simons',
    'Deandre Ayton',
    'Toumani Camara',
  ],
};

export function normPlayerName(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function lastToken(name) {
  const parts = name.trim().split(/\s+/);
  return normPlayerName(parts[parts.length - 1] ?? name);
}

function matchesTarget(playerName, target) {
  const pNorm = normPlayerName(playerName);
  const tNorm = normPlayerName(target);
  if (pNorm === tNorm) return true;

  const pFirst = normPlayerName(playerName.split(/\s+/)[0] ?? '');
  const tFirst = normPlayerName(target.split(/\s+/)[0] ?? '');
  const pLast = lastToken(playerName);
  const tLast = lastToken(target);

  if (pLast !== tLast) return false;
  if (pFirst === tFirst) return true;
  if (pFirst.startsWith(tFirst) || tFirst.startsWith(pFirst)) return true;

  return false;
}

export function reorderRosterByStars(key, players) {
  const priority = TEAM_STAR_ORDER[key];
  if (!priority?.length) return players;

  const ordered = [];
  const used = new Set();

  for (const target of priority) {
    const hit = players.find((p) => !used.has(p.name) && matchesTarget(p.name, target));
    if (hit) {
      ordered.push(hit);
      used.add(hit.name);
    }
  }

  for (const p of players) {
    if (!used.has(p.name)) ordered.push(p);
  }

  return ordered;
}
