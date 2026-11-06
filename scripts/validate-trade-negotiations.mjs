/** Regression coverage for accepting counters, history cleanup, and legacy saves. */
import { build } from 'esbuild';
const result = await build({
  stdin: { resolveDir: process.cwd(), contents: `
    import { strict as assert } from 'node:assert';
    import { SCENARIOS } from './src/data/scenarios';
    import { createLeague, linkLeagueToFranchise } from './src/data/league';
    import { useGameStore as store } from './src/store/gameStore';
    import { createSubmittedProposal, generateInstantBlockOffers, reconcileSubmittedTradeHistory } from './src/engine/tradeBlock';
    import { validateProposal } from './src/engine/tradeBuilder';
    import { executeTrade } from './src/engine/trades';
    import { pickKey } from './src/engine/cap';
    const base = structuredClone(SCENARIOS.aging_contender.franchise);
    const linked = linkLeagueToFranchise(base, createLeague(base.season, base.city, base.name, 82, base.record, 'contend'));
    const franchise = { ...base, ...linked.franchise };
    const star = franchise.roster.reduce((a,b) => a.overall > b.overall ? a : b);
    franchise.tradeBlock = { playerIds: [star.id], pickKeys: [] };
    const offers = generateInstantBlockOffers(franchise, linked.league, { type: 'player', key: star.id });
    const proposalFor = o => ({ partnerTeamId: o.partnerTeamId, incomingPlayers: o.incoming.players, incomingPicks: o.incoming.picks,
      outgoingPlayerIds: o.outgoing.players.map(p => p.id), outgoingPickKeys: o.outgoing.picks.map(pickKey) });
    const offer = offers.find(o => !validateProposal(franchise, linked.league, proposalFor(o)).errors.length);
    assert.ok(offer, 'legal trade fixture');
    const proposal = proposalFor(offer);
    const active = createSubmittedProposal(franchise, linked.league, proposal, 50, 'Countered', 'countered');
    franchise.submittedProposals = [active];
    franchise.pendingCounter = offer;
    franchise.tradeNegotiation = { partnerTeamId: offer.partnerTeamId, partnerTeamName: offer.partnerTeam, round: 1 };
    const seed = () => store.setState({ franchise: structuredClone(franchise), league: structuredClone(linked.league) });
    seed();
    store.getState().acceptPendingCounter();
    const after = store.getState().franchise;
    assert.equal(after.pendingCounter, null);
    assert.equal(after.tradeNegotiation, null);
    assert.equal(after.submittedProposals.filter(p => p.status === 'accepted').length, 1);
    assert.equal(after.submittedProposals.filter(p => p.status === 'countered' || p.status === 'pending').length, 0);
    assert.deepEqual(after.submittedProposals[0].proposal, proposal, 'history records actual accepted assets');
    assert.ok(after.submittedProposals[0].outgoingSnapshot.length, 'outgoing names survive roster transfer');
    const legacy = executeTrade(structuredClone(franchise), offer);
    assert.equal(reconcileSubmittedTradeHistory(legacy)[0].status, 'accepted', 'repair completed trades in old saves');
    legacy.memory = [];
    assert.equal(reconcileSubmittedTradeHistory(legacy)[0].status, 'expired', 'do not invent acceptance without a completion record');
    assert.equal(reconcileSubmittedTradeHistory(franchise)[0].status, 'countered', 'keep genuine active talks');
    let acceptedProposal;
    for (const o of offers) {
      const p = proposalFor(o);
      for (const player of franchise.roster.filter(pl => !p.outgoingPlayerIds.includes(pl.id))) {
        const candidate = { ...p, outgoingPlayerIds: [...p.outgoingPlayerIds, player.id] };
        const v = validateProposal(franchise, linked.league, candidate);
        if (v.valid && v.partnerAcceptScore >= 62) { acceptedProposal = candidate; break; }
      }
      if (acceptedProposal) break;
    }
    assert.ok(acceptedProposal, 'auto-accept fixture');
    seed(); store.getState().submitTradeProposal(acceptedProposal);
    const history = store.getState().franchise.submittedProposals;
    assert.equal(history.filter(p => p.status === 'accepted').length, 1, 'auto acceptance is logged once');
    assert.ok(!history.some(p => p.status === 'pending' || p.status === 'countered'), 'accepted talks leave active negotiations');
    console.log('PASS: accepted counters, exact history, legacy repair, active cleanup, and auto-accept deduplication');
  ` },
  bundle: true, platform: 'node', format: 'esm', write: false,
  banner: { js: "Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, configurable: true });" },
});
await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
