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
    const slots = remainingUserDraftSlots(franchise, league);
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
  check('case3: traded pick disappears immediately before draft night', !remainingUserDraftSlots(store().franchise, store().league).includes(2));
  const receivedBeforeRetry = JSON.stringify(store().franchise.draftPicks);
  store().acceptDraftPickTrade(early.offer, 2);
  check('case3: repeating acceptance cannot duplicate incoming assets', JSON.stringify(store().franchise.draftPicks) === receivedBeforeRetry);
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

  // Case 5: late second-round quick offer before draft night, matching #59 in the UI.
  startChicago();
  const lateOrder = store().league.draftOrder;
  const swap = new Map([[2,29],[29,2],[32,59],[59,32]]);
  const reordered = lateOrder.map(entry => ({ ...(lateOrder.find(e => e.pick === (swap.get(entry.pick) ?? entry.pick))), pick: entry.pick }));
  useGameStore.setState({ franchise: { ...store().franchise, draftPickNumber: 29, draftNight: undefined }, league: { ...store().league, draftOrder: reordered } });
  const late = cheapOffer(59);
  store().acceptDraftPickTrade(late.offer, 59);
  assertTraded(59, late.partnerTeamName, 'case5 #59 before draft night');
  check('case5: #59 immediately disappears from available slots', !remainingUserDraftSlots(store().franchise, store().league).includes(59));
  check('case5: no offers are regenerated for traded #59', generateDraftPickTradeOffers(store().franchise, store().league, 59).length === 0);
  check('case5: #29 is still available', remainingUserDraftSlots(store().franchise, store().league).includes(29));
  const afterLate = JSON.stringify({ picks: store().franchise.draftPicks, order: store().league.draftOrder });
  store().acceptDraftPickTrade(late.offer, 59);
  check('case5: repeated acceptance changes nothing', JSON.stringify({ picks: store().franchise.draftPicks, order: store().league.draftOrder }) === afterLate);
  check('case5: repeat click explains unavailable slot', store().toast.includes('no longer available'));

  // Case 6: opening R2 trading must expose every owned current/future first and preserve them on exit.
  startChicago();
  const shoppingOrder = store().league.draftOrder;
  const shoppingSwap = new Map([[2,29],[29,2],[32,59],[59,32]]);
  const shoppingDraftOrder = shoppingOrder.map(entry => ({ ...shoppingOrder.find(e => e.pick === (shoppingSwap.get(entry.pick) ?? entry.pick)), pick: entry.pick }));
  const missingFirst = store().franchise.draftPicks.filter(p => !(p.year === pickForDraftSlot(store().franchise, 29).year && p.round === 1));
  useGameStore.setState({ franchise: { ...store().franchise, draftPickNumber: 29, draftNight: undefined, draftPicks: missingFirst }, league: { ...store().league, draftOrder: shoppingDraftOrder } });
  const futureFirst = store().franchise.draftPicks.find(p => p.round === 1);
  check('case6: future first fixture exists', Boolean(futureFirst));
  store().addDraftSlotToShoppingList(59);
  const firstBook = store().franchise.draftPicks.find(p => p.slot === 29);
  const secondBook = store().franchise.draftPicks.find(p => p.slot === 59);
  check('case6: owned R1 is booked when opening R2', Boolean(firstBook));
  check('case6: selected R2 is booked', Boolean(secondBook));
  if (firstBook) { store().toggleTradeBlockPick(pickKey(firstBook)); check('case6: current R1 can be selected', store().franchise.tradeBlock.pickKeys.includes(pickKey(firstBook))); }
  if (futureFirst) { store().toggleTradeBlockPick(pickKey(futureFirst)); check('case6: future R1 can be selected', store().franchise.tradeBlock.pickKeys.includes(pickKey(futureFirst))); }
  store().clearTradeBlock();
  store().setScreen('draft');
  check('case6: leaving shopping list does not delete owned R1', store().franchise.draftPicks.some(p => p.slot === 29));
  check('case6: leaving shopping list does not delete owned R2', store().franchise.draftPicks.some(p => p.slot === 59));
  store().setScreen('trade');
  check('case6: general trade entry also retains both slots', store().franchise.draftPicks.some(p => p.slot === 29) && store().franchise.draftPicks.some(p => p.slot === 59));

  // Case 7: end the draft directly from scouting after selling every pick.
  startChicago();
  const endFirst = cheapOffer(2); store().acceptDraftPickTrade(endFirst.offer, 2);
  const endSecond = cheapOffer(32); store().acceptDraftPickTrade(endSecond.offer, 32);
  check('case7: no draft-night state before ending', !store().franchise.draftNight);
  store().finishDraft();
  check('case7: directly opens renewals', store().screen === 'contract_renewals' && store().franchise.phase === 'contract_renewals');
  check('case7: entire draft simulated', store().franchise.draftNight.log.length === 60 && !store().franchise.draftNight.active);
  check('case7: no user selections invented', store().franchise.draftNight.userPicksMade.length === 0);
  for (const row of [endFirst, endSecond]) {
    const buyer = store().league.teams.find(t => t.id === row.partnerTeamId);
    check('case7: buyer drafts with traded slot '+row.pickNumber, getTeamRoster(store().league, buyer, store().franchise).some(p => p.draftPick === row.pickNumber));
  }

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
