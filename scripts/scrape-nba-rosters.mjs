/**
 * Scrapes NBA team rosters from proballers.com
 * Usage:
 *   npx playwright install chromium   (first time only)
 *   node scripts/scrape-nba-rosters.mjs
 *
 * Output: scripts/nba-rosters.json
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'https://www.proballers.com';
const OUTPUT_FILE = join(__dirname, 'nba-rosters.json');
const DELAY_MS = 1500;

// Hardcoded team list — avoids the JS-rendered teams page entirely.
// URL pattern: /basketball/team/{id}/{slug}
const NBA_TEAMS = [
  { name: 'Atlanta Hawks',          url: `${BASE_URL}/basketball/team/100/atlanta-hawks` },
  { name: 'Boston Celtics',         url: `${BASE_URL}/basketball/team/101/boston-celtics` },
  { name: 'Brooklyn Nets',          url: `${BASE_URL}/basketball/team/102/brooklyn-nets` },
  { name: 'Charlotte Hornets',      url: `${BASE_URL}/basketball/team/103/charlotte-hornets` },
  { name: 'Chicago Bulls',          url: `${BASE_URL}/basketball/team/104/chicago-bulls` },
  { name: 'Cleveland Cavaliers',    url: `${BASE_URL}/basketball/team/105/cleveland-cavaliers` },
  { name: 'Dallas Mavericks',       url: `${BASE_URL}/basketball/team/106/dallas-mavericks` },
  { name: 'Denver Nuggets',         url: `${BASE_URL}/basketball/team/107/denver-nuggets` },
  { name: 'Detroit Pistons',        url: `${BASE_URL}/basketball/team/108/detroit-pistons` },
  { name: 'Golden State Warriors',  url: `${BASE_URL}/basketball/team/109/golden-state-warriors` },
  { name: 'Houston Rockets',        url: `${BASE_URL}/basketball/team/110/houston-rockets` },
  { name: 'Indiana Pacers',         url: `${BASE_URL}/basketball/team/111/indiana-pacers` },
  { name: 'LA Clippers',            url: `${BASE_URL}/basketball/team/112/la-clippers` },
  { name: 'Los Angeles Lakers',     url: `${BASE_URL}/basketball/team/113/los-angeles-lakers` },
  { name: 'Memphis Grizzlies',      url: `${BASE_URL}/basketball/team/114/memphis-grizzlies` },
  { name: 'Miami Heat',             url: `${BASE_URL}/basketball/team/115/miami-heat` },
  { name: 'Milwaukee Bucks',        url: `${BASE_URL}/basketball/team/116/milwaukee-bucks` },
  { name: 'Minnesota Timberwolves', url: `${BASE_URL}/basketball/team/117/minnesota-timberwolves` },
  { name: 'New Orleans Pelicans',   url: `${BASE_URL}/basketball/team/118/new-orleans-pelicans` },
  { name: 'New York Knicks',        url: `${BASE_URL}/basketball/team/119/new-york-knicks` },
  { name: 'Oklahoma City Thunder',  url: `${BASE_URL}/basketball/team/120/oklahoma-city-thunder` },
  { name: 'Orlando Magic',          url: `${BASE_URL}/basketball/team/121/orlando-magic` },
  { name: 'Philadelphia 76ers',     url: `${BASE_URL}/basketball/team/122/philadelphia-76ers` },
  { name: 'Phoenix Suns',           url: `${BASE_URL}/basketball/team/123/phoenix-suns` },
  { name: 'Portland Trail Blazers', url: `${BASE_URL}/basketball/team/124/portland-trail-blazers` },
  { name: 'Sacramento Kings',       url: `${BASE_URL}/basketball/team/125/sacramento-kings` },
  { name: 'San Antonio Spurs',      url: `${BASE_URL}/basketball/team/126/san-antonio-spurs` },
  { name: 'Toronto Raptors',        url: `${BASE_URL}/basketball/team/127/toronto-raptors` },
  { name: 'Utah Jazz',              url: `${BASE_URL}/basketball/team/128/utah-jazz` },
  { name: 'Washington Wizards',     url: `${BASE_URL}/basketball/team/129/washington-wizards` },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrapeRoster(page, team) {
  console.log(`  Scraping: ${team.name}`);
  await page.goto(team.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for the stats table to appear (up to 10s)
  try {
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
  } catch {
    // table may not exist — fall through and return empty
  }

  const players = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const getText = (el) => el?.textContent?.trim() ?? '';
    return rows.map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      const link = row.querySelector('a[href*="/basketball/player/"]');
      return {
        name: link ? link.textContent.trim() : getText(cells[0]),
        playerUrl: link ? link.href : null,
        height: getText(cells[1]),
        age: getText(cells[2]),
        pts: getText(cells[3]),
        reb: getText(cells[4]),
        ast: getText(cells[5]),
        gp: getText(cells[6]),
        wl: getText(cells[7]),
        min: getText(cells[8]),
        fg3_pct: getText(cells[9]),
        fg_pct: getText(cells[10]),
        ft_pct: getText(cells[11]),
        or: getText(cells[12]),
        reb_total: getText(cells[13]),
        ast_total: getText(cells[14]),
        stl: getText(cells[15]),
        to: getText(cells[16]),
        blk: getText(cells[17]),
        fo: getText(cells[18]),
        pts_total: getText(cells[19]),
        eff: getText(cells[20]),
      };
    }).filter((p) => p.name);
  });

  return players;
}

async function main() {
  // headless: false bypasses anti-bot detection on proballers.com
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const result = {};
  let done = 0;
  let failed = 0;

  for (const team of NBA_TEAMS) {
    try {
      const players = await scrapeRoster(page, team);
      result[team.name] = { url: team.url, players };
      done++;
      console.log(`  ✓ ${done}/${NBA_TEAMS.length} ${team.name} — ${players.length} players`);
    } catch (err) {
      failed++;
      console.error(`  ✗ Failed: ${team.name} — ${err.message}`);
      result[team.name] = { url: team.url, players: [], error: err.message };
    }
    await sleep(DELAY_MS);
  }

  await browser.close();

  writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\nDone! ${done} teams scraped, ${failed} failed.`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
