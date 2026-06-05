import { readFileSync } from 'node:fs';

const core = readFileSync('src/data/parodyRoster.ts', 'utf8');
const depth = readFileSync('src/data/parodyRosterDepth.ts', 'utf8');

const keyRe = /'([^']+)': \[/g;
const keys = [...core.matchAll(keyRe)].map((m) => m[1]);

for (const key of keys) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cBlock = core.match(new RegExp(`'${esc}': \\[([\\s\\S]*?)\\],`))?.[1] ?? '';
  const dBlock = depth.match(new RegExp(`'${esc}': \\[([\\s\\S]*?)\\],`))?.[1] ?? '';
  const cn = (cBlock.match(/firstName/g) ?? []).length;
  const dn = (dBlock.match(/firstName/g) ?? []).length;
  const total = cn + dn;
  const flag = total < 18 ? ' *** INCOMPLETE' : '';
  console.log(`${key}: core=${cn} depth=${dn} total=${total}${flag}`);
}
