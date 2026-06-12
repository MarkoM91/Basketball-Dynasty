/**
 * Loop test: for every team in the league, start a custom franchise,
 * accept a real generated trade offer, and assert post-trade invariants
 * on the USER's side (the only side `executeTrade` mutates).
 *
 * Tests the engine logic the way the UI does — same generator, same
 * executeTrade, same applyUserTradeToLeague.
 */
import { buildCustomFranchise } from '../src/data/scenarios.ts';
import { createLeague, syncUserTeam, LEAGUE_TEAM_TEMPLATES } from '../src/data/league.ts';
import { generateLeagueTradeOffers } from '../src/engine/league.ts';
import { executeTrade } from '../src/engine/trades.ts';
import { applyUserTradeToLeague, ensureLeagueRosters, syncUserRosterToLeague } from '../src/engine/leagueWorld.ts';
import { pickKey } from '../src/engine/cap.ts';
import { buildTradeOfferFromProposal, validateProposal } from '../src/engine/tradeBuilder.ts';
import { generatePartnerTradeAssets } from '../src/engine/tradeBuilder.ts';
import type { Franchise, League, TradeOffer, TradeProposal, DraftPick } from '../src/types/game.ts';

type Failure = { team: string; phase: string; reason: string };
const failures: Failure[] = [];

function runForTeam(template: { city: string; name: string; market: 'Small' | 'Mid' | 'Large' }): void {
  const teamLabel = `${template.city} ${template.name}`;
  try {
    const source = buildCustomFranchise(template.city, template.name, template.market);
    // Force regular_season phase (mirrors what user sees on custom-team start)
    const franchise = { ...source, id: 'user', phase: 'regular_season' as const } as Franchise;
    let league = createLeague(franchise.season, franchise.city, franchise.name, 75, franchise.record, 'rebuild');
    league = ensureLeagueRosters(league, franchise);
    league = syncUserRosterToLeague(league, franchise);
    league = syncUserTeam(league, franchise);

    const offers = generateLeagueTradeOffers(franchise, league);
    if (offers.length === 0) {
      failures.push({ team: teamLabel, phase: 'setup', reason: `no offers generated for ${franchise.phase}` });
      return;
    }
    const offer = offers[0];

    // Pre-trade snapshot
    const userPicksBefore = franchise.draftPicks.map(pickKey);
    const userRosterBefore = franchise.roster.map((p) => p.id);

    // Engine path: same as gameStore.acceptTrade
    const next = executeTrade(franchise, offer);
    const nextLeague = applyUserTradeToLeague(
      league, next, offer.partnerTeamId ?? '',
      offer.outgoing.players,
      offer.incoming.players,
      offer.outgoing.picks,
      offer.incoming.picks,
    );

    // ===== USER-SIDE ASSERTIONS =====
    // 1. Outgoing picks removed
    for (const op of offer.outgoing.picks) {
      const k = pickKey(op);
      const before = userPicksBefore.filter((x) => x === k).length;
      const after = next.draftPicks.map(pickKey).filter((x) => x === k).length;
      if (after !== before - 1) {
        failures.push({ team: teamLabel, phase: 'asset', reason: `outgoing pick ${k}: ${before} -> ${after} (expected -1)` });
      }
    }
    // 2. Incoming picks added
    for (const ip of offer.incoming.picks) {
      const k = pickKey(ip);
      const before = userPicksBefore.filter((x) => x === k).length;
      const after = next.draftPicks.map(pickKey).filter((x) => x === k).length;
      if (after !== before + 1) {
        failures.push({ team: teamLabel, phase: 'asset', reason: `incoming pick ${k}: ${before} -> ${after} (expected +1)` });
      }
    }
    // 3. Outgoing players removed
    for (const op of offer.outgoing.players) {
      if (next.roster.some((p) => p.id === op.id)) {
        failures.push({ team: teamLabel, phase: 'asset', reason: `outgoing player ${op.id} still on roster` });
      }
    }
    // 4. Incoming player added
    for (const ip of offer.incoming.players) {
      if (!next.roster.some((p) => p.id === ip.id)) {
        failures.push({ team: teamLabel, phase: 'asset', reason: `incoming player ${ip.id} not on roster` });
      }
    }
    // 5. No duplicate pick keys on user
    const keys = next.draftPicks.map(pickKey);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length > 0) {
      failures.push({ team: teamLabel, phase: 'duplicate', reason: `duplicate pick keys: ${[...new Set(dupes)].join(', ')}` });
    }
    // 6. Partner team's roster reflects player movement (engine does sync players, not picks)
    const partnerAfter = nextLeague.teams.find((t) => t.id === offer.partnerTeamId);
    if (partnerAfter) {
      for (const ip of offer.incoming.players) {
        if ((partnerAfter.roster ?? []).some((p) => p.id === ip.id)) {
          failures.push({ team: teamLabel, phase: 'league', reason: `incoming player ${ip.id} still on partner ${partnerAfter.fullName}` });
        }
      }
      for (const op of offer.outgoing.players) {
        if (!(partnerAfter.roster ?? []).some((p) => p.id === op.id)) {
          failures.push({ team: teamLabel, phase: 'league', reason: `outgoing player ${op.id} not on partner ${partnerAfter.fullName}` });
        }
      }
    } else if (offer.partnerTeamId) {
      failures.push({ team: teamLabel, phase: 'league', reason: `partner team ${offer.partnerTeamId} not found post-trade` });
    }
  } catch (err) {
    failures.push({ team: teamLabel, phase: 'crash', reason: String((err as Error).message ?? err) });
  }
}

function runUserProposalForTeam(template: { city: string; name: string; market: 'Small' | 'Mid' | 'Large' }): void {
  const teamLabel = `${template.city} ${template.name} (proposal)`;
  try {
    const source = buildCustomFranchise(template.city, template.name, template.market);
    const franchise = { ...source, id: 'user', phase: 'regular_season' as const } as Franchise;
    let league = createLeague(franchise.season, franchise.city, franchise.name, 75, franchise.record, 'rebuild');
    league = ensureLeagueRosters(league, franchise);
    league = syncUserRosterToLeague(league, franchise);
    league = syncUserTeam(league, franchise);

    const partner = league.teams.find((t) => !t.isUser);
    if (!partner) { failures.push({ team: teamLabel, phase: 'setup', reason: 'no partner' }); return; }
    const partnerAssets = generatePartnerTradeAssets(partner, league, franchise);
    // Pick an incoming player whose salary fits in user's cap room
    const cap = franchise.cap;
    const room = Math.max(0, (cap?.effectiveRoom ?? cap?.projectedRoom ?? 0));
    const incomingPlayer = partnerAssets
      .filter((p) => p.contract.annualSalary <= room + 100_000)
      .sort((a, b) => b.overall - a.overall)[0];
    if (!incomingPlayer) { failures.push({ team: teamLabel, phase: 'setup', reason: `no partner player fits cap room ${room}` }); return; }
    // Pick one R1 + one R2 to avoid Stepien rule (consecutive 1sts)
    const r1 = franchise.draftPicks.find((p) => p.round === 1);
    const r2 = franchise.draftPicks.find((p) => p.round === 2);
    if (!r1 || !r2) { failures.push({ team: teamLabel, phase: 'setup', reason: 'missing R1 or R2 on user books' }); return; }
    const incomingPick: DraftPick = { year: franchise.season + 2, round: 1, originalTeam: partner.fullName };

    // User's exact reported scenario: 2 picks out, 1 player + 1 pick in
    const proposal: TradeProposal = {
      partnerTeamId: partner.id,
      incomingPlayers: [incomingPlayer],
      outgoingPlayerIds: [],
      incomingPicks: [incomingPick],
      outgoingPickKeys: [pickKey(r1), pickKey(r2)],
    };

    const validation = validateProposal(franchise, league, proposal);
    const offer = buildTradeOfferFromProposal(franchise, league, proposal);
    if (!offer) { failures.push({ team: teamLabel, phase: 'build', reason: `null offer; validation errors: ${validation.errors.join(' | ')}` }); return; }

    if (offer.outgoing.picks.length !== 2) {
      failures.push({ team: teamLabel, phase: 'build', reason: `built offer has ${offer.outgoing.picks.length} outgoing picks (expected 2)` });
      return;
    }
    if (offer.incoming.picks.length !== 1 || offer.incoming.players.length !== 1) {
      failures.push({ team: teamLabel, phase: 'build', reason: `built offer incoming wrong shape: ${offer.incoming.picks.length} picks, ${offer.incoming.players.length} players` });
      return;
    }

    const before = franchise.draftPicks.map(pickKey);
    const next = executeTrade(franchise, offer);
    const after = next.draftPicks.map(pickKey);

    // Outgoing picks gone
    for (const op of offer.outgoing.picks) {
      const k = pickKey(op);
      if (before.filter((x) => x === k).length - after.filter((x) => x === k).length !== 1) {
        failures.push({ team: teamLabel, phase: 'asset', reason: `outgoing pick ${k} not removed (before=${before.filter((x) => x === k).length}, after=${after.filter((x) => x === k).length})` });
      }
    }
    // Incoming pick added
    for (const ip of offer.incoming.picks) {
      const k = pickKey(ip);
      if (after.filter((x) => x === k).length - before.filter((x) => x === k).length !== 1) {
        failures.push({ team: teamLabel, phase: 'asset', reason: `incoming pick ${k} not added (before=${before.filter((x) => x === k).length}, after=${after.filter((x) => x === k).length})` });
      }
    }
    // Player added
    if (!next.roster.some((p) => p.id === incomingPlayer.id)) {
      failures.push({ team: teamLabel, phase: 'asset', reason: `incoming player ${incomingPlayer.id} not on roster` });
    }
    // Roster size +1
    if (next.roster.length !== franchise.roster.length + 1) {
      failures.push({ team: teamLabel, phase: 'asset', reason: `roster size ${franchise.roster.length} -> ${next.roster.length} (expected +1)` });
    }
    // No duplicates
    const dupes = after.filter((k, i) => after.indexOf(k) !== i);
    if (dupes.length > 0) {
      failures.push({ team: teamLabel, phase: 'duplicate', reason: `duplicate pick keys: ${[...new Set(dupes)].join(', ')}` });
    }
  } catch (err) {
    failures.push({ team: teamLabel, phase: 'crash', reason: String((err as Error).message ?? err) });
  }
}

console.log(`Testing ${LEAGUE_TEAM_TEMPLATES.length} teams (generated offer + user proposal)...`);
for (const tmpl of LEAGUE_TEAM_TEMPLATES) {
  runForTeam(tmpl);
  runUserProposalForTeam(tmpl);
}

if (failures.length === 0) {
  console.log(`\n✅ All ${LEAGUE_TEAM_TEMPLATES.length} teams passed trade-loop checks`);
  process.exit(0);
} else {
  console.log(`\n❌ ${failures.length} failures across ${new Set(failures.map((f) => f.team)).size} teams:`);
  const byTeam = new Map<string, Failure[]>();
  for (const f of failures) {
    if (!byTeam.has(f.team)) byTeam.set(f.team, []);
    byTeam.get(f.team)!.push(f);
  }
  for (const [team, fs] of byTeam) {
    console.log(`\n  ${team}:`);
    for (const f of fs) console.log(`    [${f.phase}] ${f.reason}`);
  }
  process.exit(1);
}
