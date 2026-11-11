/**
 * Regression: NBA-style transaction rules.
 *
 *  1. Players whose contracts have EXPIRED (0 years left) cannot be traded — not via proposals,
 *     accepted offers, the trade block, AI-generated offers or the trade finder.
 *  2. Free agency follows the CBA: teams over the cap can only offer within exceptions (MLE,
 *     taxpayer MLE, BAE, minimum); the Team-deal pitch is not a loophole; max contract by
 *     experience; contract length by how the deal is signed; AI rivals must afford their bids.
 *
 * Run: node scripts/validate-cba-rules.mjs
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const outdir = join(tmpdir(), 'dynasty-cba-rules-validation');
const outfile = join(outdir, 'run.mjs');
const entryfile = join(process.cwd(), 'scripts', '.cba-rules-entry.ts');

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
  const { validateProposal } = await import('../src/engine/tradeBuilder');
  const { generateLeagueTradeOffers } = await import('../src/engine/league');
  const { findTradeMatches } = await import('../src/engine/tradeFinder');
  const { contractExpired } = await import('../src/engine/tradeRules');
  const { maxFreeAgentOffer, signingVia, maxContractYears, maxContractSalary, CAP_LIMIT, MIN_SALARY } = await import('../src/engine/cap');
  const { offerSalaryBounds, previewOffer, pickRivalTeam, rivalOfferSalary } = await import('../src/engine/freeAgency');

  const failures = [];
  const check = (label, ok, detail = '') => { if (!ok) failures.push(label + (detail ? ' — ' + detail : '')); };
  const store = () => useGameStore.getState();

  // ── 1. Expired contracts can't be traded ───────────────────────────────────
  store().selectScenario('lottery_rebuild');
  store().startGame();
  {
    const { franchise, league } = store();
    const expired = franchise.roster.find((p) => contractExpired(p));
    check('setup: lottery rebuild has an expired contract at the draft', Boolean(expired));
    if (expired) {
      const partner = league.teams.find((t) => !t.isUser);
      const v = validateProposal(franchise, league, {
        partnerTeamId: partner.id, incomingPlayers: [], outgoingPlayerIds: [expired.id], incomingPicks: [], outgoingPickKeys: [],
      });
      check('proposal with expired player is invalid', !v.valid);
      check('proposal error explains the expired contract', v.errors.some((e) => /expired/i.test(e)), v.errors.join(' | '));

      const before = store().franchise.roster.length;
      store().acceptTrade({
        id: 'x', partnerTeam: partner.fullName, partnerTeamId: partner.id,
        incoming: { description: '', players: [], picks: [{ year: 2027, round: 2, originalTeam: partner.fullName }] },
        outgoing: { description: '', players: [expired], picks: [] },
        analysis: { shortTerm: '', longTerm: '', lockerRoom: '', fanReaction: '', mediaRisk: '', titleOddsDelta: 0 },
        expiresWeek: 99,
      });
      check('accepting an offer for an expired player is refused', store().franchise.roster.some((p) => p.id === expired.id) && store().franchise.roster.length === before);
      check('refusal tells the user why', /expired/i.test(store().toast ?? ''), store().toast ?? '');

      store().toggleTradeBlockPlayer(expired.id);
      check('expired player cannot be listed on the trade block', !(store().franchise.tradeBlock?.playerIds ?? []).includes(expired.id));

      const matches = findTradeMatches(store().franchise, store().league, { limit: 30, minOverall: 0 });
      check('trade finder never offers an expired player', !matches.some((m) => m.outgoingPlayerId === expired.id));
    }
    const seasonFr = { ...store().franchise, phase: 'regular_season', roster: store().franchise.roster.map((p, i) => i < 4 ? { ...p, contract: { ...p.contract, yearsRemaining: 0 } } : p) };
    const offers = generateLeagueTradeOffers(seasonFr, store().league);
    const expiredIds = new Set(seasonFr.roster.filter((p) => contractExpired(p)).map((p) => p.id));
    check('AI offers never ask for expired players', !offers.some((o) => o.outgoing.players.some((p) => expiredIds.has(p.id))));
    // A final-year ("expiring") deal during the season IS tradeable, as in the NBA.
    const lastYear = { ...store().franchise.roster[5], contract: { ...store().franchise.roster[5].contract, yearsRemaining: 1, isExpiring: true } };
    check('final-year contract stays tradeable', !contractExpired(lastYear));
  }

  // ── 2. Free agency follows the CBA ────────────────────────────────────────
  const base = store().franchise;
  const withCap = (cap) => ({ ...base, cap: { ...base.cap, ...cap } });
  const overCapMleUsed = withCap({ effectiveRoom: 0, mleUsed: true, baeUsed: true, inLuxuryTax: false, inSecondApron: false });
  const overCapMleOpen = withCap({ effectiveRoom: 0, mleUsed: false, baeUsed: true, inLuxuryTax: false, inSecondApron: false, mleAvailable: 12_800_000 });
  const taxTeam = withCap({ effectiveRoom: 0, mleUsed: false, baeUsed: false, inLuxuryTax: true, inSecondApron: false });
  const apronTeam = withCap({ effectiveRoom: 0, mleUsed: false, baeUsed: false, inLuxuryTax: true, inSecondApron: true });
  const roomTeam = withCap({ effectiveRoom: 30_000_000, mleUsed: false, baeUsed: false, inLuxuryTax: false, inSecondApron: false });

  check('over cap, MLE used → minimum only', maxFreeAgentOffer(overCapMleUsed).via === 'Minimum');
  check('over cap, MLE open → MLE', maxFreeAgentOffer(overCapMleOpen).via === 'MLE' && maxFreeAgentOffer(overCapMleOpen).max === 12_800_000);
  check('taxpayer → taxpayer MLE size', maxFreeAgentOffer(taxTeam).max === 5_000_000);
  check('second apron → minimum only', maxFreeAgentOffer(apronTeam).via === 'Minimum');
  check('under cap → room', maxFreeAgentOffer(roomTeam).via === 'Room' && maxFreeAgentOffer(roomTeam).max === 30_000_000);

  check('over cap: $10M fits nothing', signingVia(overCapMleUsed, 10_000_000) === null);
  check('over cap: minimum always fits', signingVia(overCapMleUsed, MIN_SALARY) === 'Minimum');
  check('room deal → 4 years max', maxContractYears(signingVia(roomTeam, 20_000_000)) === 4);
  check('taxpayer MLE → 2 years max', signingVia(taxTeam, 4_000_000) === 'Taxpayer MLE' && maxContractYears('Taxpayer MLE') === 2);
  check('minimum → 2 years max', maxContractYears('Minimum') === 2);
  check('max contract 25/30/35% of cap', maxContractSalary(24) === Math.round(CAP_LIMIT * 0.25) && maxContractSalary(28) === Math.round(CAP_LIMIT * 0.3) && maxContractSalary(33) === Math.round(CAP_LIMIT * 0.35));

  const fa = {
    id: 'fa-test', firstName: 'Test', lastName: 'Starter', age: 27, position: 'SF', overall: 78, potential: 80,
    askingSalary: 15_000_000, askingYears: 3, priorities: ['money'], interest: 60, scoutNote: '', archetype: 'Wing', signed: false,
  };
  const { league } = store();
  const bOver = offerSalaryBounds(overCapMleUsed, fa);
  check('over cap: $15M player is not affordable', bOver.affordable === false, JSON.stringify(bOver));
  check('over cap: explanation mentions the cap', /over the cap/i.test(bOver.limitNote), bOver.limitNote);
  const loophole = previewOffer(overCapMleUsed, league, fa, 'team_friendly', 15_000_000, 3);
  check('Team-deal pitch no longer bypasses the cap', loophole.capOk === false, JSON.stringify(loophole));
  const roomOk = previewOffer(roomTeam, league, fa, 'max_offer', 15_000_000, 3);
  check('room team can offer $15M × 3', roomOk.capOk === true, JSON.stringify(roomOk));
  const fiveYears = previewOffer(roomTeam, league, fa, 'max_offer', 15_000_000, 5);
  check('outside free agent cannot get 5 years', fiveYears.capOk === false);
  const overMax = previewOffer(withCap({ effectiveRoom: 80_000_000 }), league, { ...fa, age: 24 }, 'max_offer', 40_000_000, 4);
  check('cannot exceed the max contract', overMax.capOk === false);

  // AI rivals must be able to afford their bid.
  const broke = { ...league, teams: league.teams.map((t) => (t.isUser ? t : { ...t, payroll: 175_000_000, taxAverse: true })) };
  const pricey = { ...fa, askingSalary: 25_000_000, overall: 84 };
  check('over-cap AI teams make no big offers', pickRivalTeam(broke, pricey) === undefined);
  const rival = pickRivalTeam(league, pricey);
  if (rival) {
    const { canSignFreeAgentAtPayroll } = await import('../src/engine/cap');
    check('picked rival can afford its bid', canSignFreeAgentAtPayroll(rival.payroll, rivalOfferSalary(pricey, rival), rival.taxAverse).ok);
  }

  if (failures.length) {
    console.error('CBA rules validation FAILED:\\n  - ' + failures.join('\\n  - '));
    process.exit(1);
  }
  console.log('✅ CBA rules: expired contracts untradeable; free agency respects cap room, exceptions, max contracts and contract length');
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
