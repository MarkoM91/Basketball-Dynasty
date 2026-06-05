/**
 * Merge NBA stats API rosters with Basketball-Reference depth.
 * Reads browser CDP JSON exports and writes scripts/nba-rosters-2026.json
 */
import { readFileSync, writeFileSync } from 'node:fs';

const statsFile =
  process.argv[2] ??
  'C:/Users/marco/.cursor/browser-logs/cdp-response-Runtime.evaluate-2026-06-05T10-19-06-251Z.json';
const bbrFile =
  process.argv[3] ??
  'C:/Users/marco/.cursor/browser-logs/cdp-response-Runtime.evaluate-2026-06-05T10-32-29-407Z.json';

const TARGET = 18;

function loadCdp(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return JSON.parse(raw.result.value);
}

function normPos(pos) {
  const p = (pos ?? 'SF').split('-')[0].split(',')[0].trim();
  if (p === 'G') return 'SG';
  if (p === 'F') return 'SF';
  if (['PG', 'SG', 'SF', 'PF', 'C'].includes(p)) return p;
  return 'SF';
}

const stats = loadCdp(statsFile);
const bbrPayload = loadCdp(bbrFile);
const bbr = bbrPayload.rosters ?? bbrPayload;

const merged = {};
const report = [];

for (const [key, primary] of Object.entries(stats)) {
  if (!Array.isArray(primary)) continue;
  const seen = new Set();
  const list = [];
  for (const p of primary) {
    if (!p?.name || seen.has(p.name)) continue;
    seen.add(p.name);
    list.push({ name: p.name, position: normPos(p.position) });
  }
  const extras = Array.isArray(bbr[key]) ? bbr[key] : [];
  for (const p of extras) {
    if (list.length >= TARGET) break;
    if (!p?.name || seen.has(p.name)) continue;
    seen.add(p.name);
    list.push({ name: p.name, position: normPos(p.position) });
  }
  merged[key] = list.slice(0, TARGET);
  report.push({ key, primary: primary.length, merged: merged[key].length });
}

writeFileSync('scripts/nba-rosters-2026.json', JSON.stringify(merged, null, 2));

console.log('Merged roster report:');
for (const row of report) {
  const flag = row.merged < TARGET ? ' *** SHORT' : '';
  console.log(`${row.key}: nba=${row.primary} merged=${row.merged}${flag}`);
}

const short = report.filter((r) => r.merged < TARGET);
if (short.length) {
  console.log(`\n${short.length} team(s) still under ${TARGET} — check sources.`);
  process.exit(1);
}

console.log('\nWrote scripts/nba-rosters-2026.json');
