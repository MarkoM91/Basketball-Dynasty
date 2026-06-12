import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const outdir = join(tmpdir(), 'dynasty-front-office-core-loop-validation');
const outfile = join(outdir, 'run.mjs');
const entryfile = join(process.cwd(), 'scripts', '.core-loop-validation-entry.ts');

const entry = `
  import { createLeague } from '../src/data/league';
  import { SCENARIOS } from '../src/data/scenarios';
  import { prepareDraftScouting } from '../src/engine/offseason';
  import { initDraftNight, runDraftToUserPick } from '../src/engine/draftNight';
  import { applyDraftPickTrade, pickForDraftSlot } from '../src/engine/draftPickTrade';
  import {
    validateDeterministicAdvanceDay,
    validateHeadlessSeasonSlice,
    validateSeasonBoundaryLoop,
    validateStaticPublishingLoop,
    validateCoreStatisticalSanity
  } from '../src/engine/core/validation';
  import { ensureLeagueRosters, syncUserRosterToLeague } from '../src/engine/leagueWorld';

  const franchise = { ...SCENARIOS.aging_contender.franchise, id: 'validation-franchise' };
  let league = createLeague(
    franchise.season,
    franchise.city,
    franchise.name,
    82,
    franchise.record,
    'contend'
  );
  league = ensureLeagueRosters(league, franchise);
  league = syncUserRosterToLeague(league, franchise);

  const validateDraftPickTradeOwnership = () => {
    let draftFranchise = { ...SCENARIOS.lottery_rebuild.franchise, id: 'draft-trade-regression' };
    let draftLeague = createLeague(
      draftFranchise.season,
      draftFranchise.city,
      draftFranchise.name,
      64,
      draftFranchise.record,
      'rebuild'
    );
    const prepared = prepareDraftScouting(draftFranchise, draftLeague, undefined, undefined, { pinnedPick: 2 });
    draftFranchise = prepared.franchise;
    draftLeague = prepared.league;
    const draftNight = runDraftToUserPick(initDraftNight(draftFranchise, draftLeague), draftLeague, draftFranchise);
    draftFranchise = { ...draftFranchise, phase: 'draft_night', draftNight };

    const partner = draftLeague.teams.find((team) => !team.isUser);
    const result = applyDraftPickTrade(draftFranchise, draftLeague, 2, {
      id: 'draft-pick-regression',
      partnerTeam: partner?.fullName ?? 'Partner',
      partnerTeamId: partner?.id,
      incoming: { description: 'cash considerations', players: [], picks: [] },
      outgoing: {
        description: '2026 1st + 2026 2nd',
        players: [],
        picks: [pickForDraftSlot(draftFranchise, 2), pickForDraftSlot(draftFranchise, 32)],
      },
      analysis: {
        shortTerm: 'Regression trade.',
        longTerm: 'Regression trade.',
        lockerRoom: 'Neutral.',
        fanReaction: 'Neutral.',
        mediaRisk: 'Low.',
        titleOddsDelta: 0,
        partnerAcceptScore: 100,
      },
      expiresWeek: draftFranchise.week + 1,
    });

    const remaining = result.franchise.draftNight?.userPickNumbers ?? [];
    return {
      ok:
        result.franchise.draftNight?.onClock === false &&
        !remaining.includes(2) &&
        !remaining.includes(32),
      remaining,
      onClock: result.franchise.draftNight?.onClock,
    };
  };

  const deterministic = validateDeterministicAdvanceDay(league, franchise);
  const seasonSlice = validateHeadlessSeasonSlice(league, franchise, 30);
  const staticPublishing = validateStaticPublishingLoop(league, franchise);
  const seasonBoundary = validateSeasonBoundaryLoop(league, franchise);
  const statistical = validateCoreStatisticalSanity(league, franchise);
  const draftPickTradeOwnership = validateDraftPickTradeOwnership();

  if (!deterministic.ok) {
    throw new Error('advanceDay is not deterministic for the same seed/input.');
  }
  if (!seasonSlice.ok) {
    throw new Error('30-day headless season slice failed.');
  }
  if (!staticPublishing.ok) {
    throw new Error('Static publishing loop failed.');
  }
  if (!seasonBoundary.ok) {
    throw new Error('Season boundary loop failed.');
  }
  if (!statistical.ok) {
    throw new Error('Core statistical sanity failed: ' + statistical.failures.join(' | '));
  }
  if (!draftPickTradeOwnership.ok) {
    throw new Error(
      'Draft pick trade ownership failed: remaining=' +
      draftPickTradeOwnership.remaining.join(',') +
      ' onClock=' +
      draftPickTradeOwnership.onClock
    );
  }

  console.log(JSON.stringify({
    deterministic: deterministic.ok,
    gamesPlayed: seasonSlice.gamesPlayed,
    newsCount: seasonSlice.newsCount,
    saveCount: seasonSlice.saveCount,
    staticGenerated: staticPublishing.generatedAfter,
    seasonAfterBoundary: seasonBoundary.seasonAfter,
    averagePpg: statistical.averagePpg,
    winLossBalanced: statistical.winLossBalanced,
    draftTradeGhostPickFixed: draftPickTradeOwnership.ok
  }, null, 2));
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
  await writeFile(join(outdir, 'last-run.txt'), `${new Date().toISOString()}\n`, 'utf8');
} finally {
  await rm(entryfile, { force: true });
}
