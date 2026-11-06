/**
 * Regression: trading draft picks on draft night.
 *
 * Drives the real store actions the UI uses (Chicago lottery-rebuild scenario):
 *   1. open draft night, trade #2 to one team, trade #32 to another (two separate trades)
 *   2. assert the user no longer owns / sees / is put on the clock for either slot
 *   3. assert each receiving team owns the slot in the draft order and lists it as an asset
 *   4. run the draft to completion and assert the receiving teams actually drafted with those picks
 *
 * Also covers trading a single pick, trading a pick before draft night (draft scouting), and
 * trading through the Trades screen (generic acceptTrade) instead of the draft-night offers.
 *
 * Run: node scripts/validate-draft-pick-trades.mjs
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const outdir = join(tmpdir(), 'dynasty-draft-pick-trade-validation');
const outfile = join(outdir, 'run.mjs');
const entryfile = join(process.cwd(), 'scripts', '.draft-pick-trade-entry.ts');

const entry = `
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
    key: (i) => [...mem.keys()][i] ?? null,
    get length() { return mem.size; },
  };

  const { useGameStore } = await import('../src/store/gameStore');
  const { generateDraftPickTradeOffers, remainingUserDraftSlots, pickForDraftSlot } = await import('../src/engine/draftPickTrade');
  const { generateLeagueTradeBlockListings } = await import('../src/engine/tradeBlock');
  const { getTeamRoster } = await import('../src/engine/leagueWorld');
  const { pickKey } = await import('../src/engine/cap');

  const failures = [];
  const check = (label, ok, detail = '') => { if (!ok) failures.push(label + (detail ? ' — ' + detail : '')); };
  const store = () => useGameStore.getState();

  function startChicago() {
    store().selectScenario('lottery_rebuild');
    store().startGame();
  }

  function openDraftNight() {
    // From draft scouting, the primary action opens draft night and runs to the user's first pick.
    store().advanceWeek();
    if (store().franchise.phase !== 'draft_night' && !store().franchise.draftNight?.active) store().advanceWeek();
  }

  function cheapOffer(pickNumber) {
    const { franchise, league } = store();
    const offers = generateDraftPickTradeOffers(franchise, league, pickNumber);
    if (!offers.length) throw new Error('No generated offers for pick #' + pickNumber);
    return offers[0];
  }

  function ownerOf(pickNumber) {
    const entry = (store().league.draftOrder ?? []).find((e) => e.pick === pickNumber);
    return entry ? entry.city + ' ' + entry.name : undefined;
  }

  function runDraftToEnd() {
    for (let i = 0; i < 12 && store().franchise.draftNight?.active; i += 1) store().advanceWeek();
  }

  function assertTraded(pickNumber, partnerName, label) {
    const { franchise, league } = store();
    const userName = franchise.city + ' ' + franchise.name;
    const slots = remainingUserDraftSlots(franchise);
    check(label + ': slot removed from user picks', !slots.includes(pickNumber), 'remaining=' + slots.join(','));
    const key = pickKey(pickForDraftSlot(franchise, pickNumber));
    check(label + ': pick removed from user books', !franchise.draftPicks.some((p) => pickKey(p) === key));
    check(label + ': draft order owner is partner', ownerOf(pickNumber) === partnerName, 'owner=' + ownerOf(pickNumber));
    check(label + ': user does not own slot in order', ownerOf(pickNumber) !== userName);
    const listings = generateLeagueTradeBlockListings(league, franchise);
    const listed = listings.some((l) => l.teamName === partnerName && l.assetType === 'pick' && l.label.includes('#' + pickNumber));
    check(label + ': partner lists #' + pickNumber + ' on its trade block', listed);
  }

  // ── Case 1: trade BOTH picks on draft night, one trade each ─────────────────
  startChicago();
  openDraftNight();
  check('case1: draft night active', Boolean(store().franchise.draftNight?.active));
  const startSlots = remainingUserDraftSlots(store().franchise);
  check('case1: user starts with #2 and #32', startSlots.includes(2) && startSlots.includes(32), startSlots.join(','));

  const offer2 = cheapOffer(2);
  store().acceptDraftPickTrade(offer2.offer, 2);
  assertTraded(2, offer2.partnerTeamName, 'case1 #2');

  const offer32 = cheapOffer(32);
  store().acceptDraftPickTrade(offer32.offer, 32);
  assertTraded(32, offer32.partnerTeamName, 'case1 #32');
  assertTraded(2, offer2.partnerTeamName, 'case1 #2 after second trade');

  const userName = store().franchise.city + ' ' + store().franchise.name;
  const userSlotsInOrder = (store().league.draftOrder ?? []).filter((e) => e.city + ' ' + e.name === userName).map((e) => e.pick);
  check('case1: user owns no slots in draft order', userSlotsInOrder.length === 0, 'owns=' + userSlotsInOrder.join(','));
  check('case1: user not on the clock', store().franchise.draftNight?.onClock === false);

  const rosterBefore = store().franchise.roster.length;
  runDraftToEnd();
  check('case1: draft completes without user picks', !store().franchise.draftNight?.active, 'phase=' + store().franchise.phase);
  check('case1: no rookies added to user', !store().franchise.roster.some((p) => p.draftPick === 2 || p.draftPick === 32),
    'roster ' + rosterBefore + ' -> ' + store().franchise.roster.length);

  const leagueAfter = store().league;
  for (const [pick, partnerName] of [[2, offer2.partnerTeamName], [32, offer32.partnerTeamName]]) {
    const team = leagueAfter.teams.find((t) => t.fullName === partnerName);
    const roster = team ? getTeamRoster(leagueAfter, team, store().franchise) : [];
    check('case1: ' + partnerName + ' drafted with #' + pick, roster.some((p) => p.draftPick === pick));
  }
  const recap = store().franchise.draftRecap ?? [];
  check('case1: draft recap has no user selections', recap.length === 0, 'recap=' + recap.map((r) => r.pick).join(','));

  // ── Case 2: trade only #2 on draft night — user still drafts at #32 ────────
  startChicago();
  openDraftNight();
  const single = cheapOffer(2);
  store().acceptDraftPickTrade(single.offer, 2);
  assertTraded(2, single.partnerTeamName, 'case2 #2');
  check('case2: user keeps #32', remainingUserDraftSlots(store().franchise).includes(32));
  store().advanceWeek(); // run to the user's next pick
  check('case2: on the clock at #32', store().franchise.draftNight?.onClock === true && store().franchise.draftNight?.currentPick === 32,
    'current=' + store().franchise.draftNight?.currentPick + ' onClock=' + store().franchise.draftNight?.onClock);

  // ── Case 3: trade #2 during draft scouting (before draft night) ────────────
  startChicago();
  check('case3: in draft scouting', store().franchise.phase === 'draft_scouting');
  const early = cheapOffer(2);
  store().acceptDraftPickTrade(early.offer, 2);
  check('case3: draft order owner is partner', ownerOf(2) === early.partnerTeamName, 'owner=' + ownerOf(2));
  openDraftNight();
  const slots3 = remainingUserDraftSlots(store().franchise);
  check('case3: #2 not restored on draft night', !slots3.includes(2), 'slots=' + slots3.join(','));
  check('case3: first user pick is #32', store().franchise.draftNight?.currentPick === 32, 'current=' + store().franchise.draftNight?.currentPick);

  // ── Case 4: trade both picks through the Trades screen (generic acceptTrade path) ──
  // The Draft screen's "Trade #2" button lists the pick on the market; offers are accepted with
  // acceptTrade, which used to only ADD incoming slots — the traded pick stayed yours on the clock.
  startChicago();
  openDraftNight();
  const market2 = cheapOffer(2);
  store().acceptTrade(market2.offer);
  assertTraded(2, market2.partnerTeamName, 'case4 #2 via Trades screen');
  check('case4: not on the clock after trading #2', store().franchise.draftNight?.onClock === false);
  const market32 = cheapOffer(32);
  store().acceptTrade(market32.offer);
  assertTraded(32, market32.partnerTeamName, 'case4 #32 via Trades screen');
  runDraftToEnd();
  check('case4: draft completes with no user picks', !store().franchise.draftNight?.active, 'phase=' + store().franchise.phase);
  check('case4: no rookies added to user', !store().franchise.roster.some((p) => p.draftPick === 2 || p.draftPick === 32));

  if (failures.length) {
    console.error('Draft pick trade validation FAILED:\\n  - ' + failures.join('\\n  - '));
    process.exit(1);
  }
  console.log('✅ Draft pick trades: both-picks, single-pick, pre-draft and Trades-screen trades all transfer ownership correctly');
`;

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
try {
  await writeFile(entryfile, entry, 'utf8');
  await build({
    entryPoints: [entryfile.replaceAll('\\', '/')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  await import(pathToFileURL(outfile).href);
} finally {
  await rm(entryfile, { force: true });
}
