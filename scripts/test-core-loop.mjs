import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const requiredSources = [
  'scripts/static-content/01-games-like-basketball-gm.md',
  'scripts/static-content/02-first-season-guide.md',
  'scripts/static-content/03-trade-strategy-guide.md',
  'scripts/static-content/04-draft-scouting-guide.md',
  'scripts/static-content/05-salary-cap-guide.md',
];

for (const file of requiredSources) {
  assert.ok(existsSync(file), `Missing static content source: ${file}`);
}

console.log('core loop source tests passed');
