import { useEffect, useMemo, useState } from 'react';
import { formatMoney, playerName } from '../data/scenarios';
import { getTeamById } from '../data/league';
import { pickKey } from '../engine/cap';
import { pickDescription } from '../engine/tradeBuilder';
import {
  type BlockListFilter,
  filterLeagueTradeBlockListings,
  generateLeagueTradeBlockListings,
  isPickOnBlock,
  isPlayerOnBlock,
  shoppingTagLabel,
  tradeBlockAssetCount,
  listingOffersForFranchise,
  userTradeBlockListings,
} from '../engine/tradeBlock';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TeamLogo } from '../components/TeamLogo';
import { TradeNegotiateModal } from '../components/TradeNegotiateModal';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';
import type {
  DraftPick,
  Player,
  SubmittedTradeProposal,
  TradeOffer,
  TradeProposal,
} from '../types/game';

type TradeTab = 'shop' | 'listings';

const ADVANCED_FILTERS: { id: BlockListFilter; label: string }[] = [
  { id: 'draft_picks', label: 'Want picks' },
  { id: 'young_talent', label: 'Want youth' },
  { id: 'veteran_help', label: 'Want vets' },
  { id: 'salary_relief', label: 'Cap relief' },
  { id: 'star_power', label: 'Want stars' },
];

function proposalStatusClass(status: SubmittedTradeProposal['status']): string {
  switch (status) {
    case 'accepted':
      return 'chip chip-success';
    case 'rejected':
    case 'expired':
      return 'chip chip-danger';
    case 'countered':
      return 'chip chip-warning';
    case 'withdrawn':
      return 'chip';
    default:
      return 'chip chip-gold';
  }
}

function describeSubmittedProposal(
  franchise: {
    roster: { id: string; firstName: string; lastName: string }[];
    draftPicks: import('../types/game').DraftPick[];
  },
  p: SubmittedTradeProposal,
): {
  send: string;
  receive: string;
} {
  const sendParts = [
    ...(p.outgoingSnapshot
      ? p.outgoingSnapshot.map((s) => s.name)
      : franchise.roster
          .filter((pl) => p.proposal.outgoingPlayerIds.includes(pl.id))
          .map((pl) => playerName(pl))),
    ...p.proposal.outgoingPickKeys.map((key) => {
      const pick = franchise.draftPicks.find((dp) => pickKey(dp) === key);
      return pick ? pickDescription(pick) : key;
    }),
  ];
  const receiveParts = [
    ...p.proposal.incomingPlayers.map((pl) => playerName(pl)),
    ...p.proposal.incomingPicks.map((pick) => pickDescription(pick)),
  ];
  return {
    send: sendParts.join(', ') || '—',
    receive: receiveParts.join(', ') || '—',
  };
}

function TradePackageSummary({ send, receive }: { send: string; receive: string }) {
  return (
    <div className="trade-split">
      <div>
        <p className="stat-label">You send</p>
        <p style={{ margin: '4px 0 0', fontSize: 14 }}>{send}</p>
      </div>
      <div>
        <p className="stat-label">You get</p>
        <p style={{ margin: '4px 0 0', fontSize: 14 }}>{receive}</p>
      </div>
    </div>
  );
}

function contractYearsLabel(years: number): string {
  return `${years} yr${years === 1 ? '' : 's'}`;
}

function TradeOfferAssetSide({
  label,
  players,
  picks,
}: {
  label: string;
  players: Player[];
  picks: DraftPick[];
}) {
  if (!players.length && !picks.length) {
    return (
      <div className="trade-offer-side">
        <p className="stat-label">{label}</p>
        <p className="body" style={{ fontSize: 12, margin: '6px 0 0' }}>—</p>
      </div>
    );
  }

  return (
    <div className="trade-offer-side">
      <p className="stat-label">{label}</p>
      <ul className="trade-offer-asset-list">
        {players.map((player) => (
          <li key={player.id} className="trade-offer-asset">
            <div className="trade-offer-asset-head">
              <PlayerAvatar player={player} size={36} showOverall={false} />
              <div className="trade-offer-asset-copy">
                <strong>{playerName(player)}</strong>
                <span>
                  {player.overall} OVR · {formatMoney(player.contract.annualSalary)} · {contractYearsLabel(player.contract.yearsRemaining)}
                </span>
              </div>
            </div>
          </li>
        ))}
        {picks.map((pick, index) => (
          <li key={`${pickKey(pick)}-${index}`} className="trade-offer-asset trade-offer-asset-pick">
            <div className="trade-offer-asset-head">
              <span className="trade-pick-icon trade-pick-icon-sm">P</span>
              <div className="trade-offer-asset-copy">
                <strong>{pickDescription(pick)}</strong>
                <span>Draft pick</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TradeOfferPackageDetail({ offer }: { offer: TradeOffer }) {
  return (
    <div className="trade-offer-package">
      <TradeOfferAssetSide label="You send" players={offer.outgoing.players} picks={offer.outgoing.picks} />
      <TradeOfferAssetSide label="You get" players={offer.incoming.players} picks={offer.incoming.picks} />
    </div>
  );
}

function tradeOfferToPrefill(offer: TradeOffer): Partial<TradeProposal> {
  return {
    partnerTeamId: offer.partnerTeamId,
    incomingPlayers: offer.incoming.players,
    incomingPicks: offer.incoming.picks,
    outgoingPlayerIds: offer.outgoing.players.map((player) => player.id),
    outgoingPickKeys: offer.outgoing.picks.map((pick) => pickKey(pick)),
  };
}

export function TradeScreen() {
  const {
    franchise,
    league,
    acceptTrade,
    submitTradeProposal,
    requestTradeCounter,
    submitTradeChain,
    acceptPendingCounter,
    declinePendingCounter,
    toggleTradeBlockPlayer,
    toggleTradeBlockPick,
    syncBlockListingOffers,
    clearTradeBlock,
    withdrawProposal,
    setScreen,
    openTradeShopDrawer,
  } = useGameStore();

  const [tab, setTab] = useState<TradeTab>('shop');
  const [blockFilter, setBlockFilter] = useState<BlockListFilter>('high_interest');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showRosterDrawer, setShowRosterDrawer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [negotiatePartnerId, setNegotiatePartnerId] = useState<string | undefined>();
  const [negotiatePrefill, setNegotiatePrefill] = useState<Partial<TradeProposal> | undefined>();
  const [negotiateKey, setNegotiateKey] = useState(0);

  const leagueBlockRaw = useMemo(
    () => (franchise && league ? generateLeagueTradeBlockListings(league, franchise) : []),
    [franchise, league],
  );
  const leagueBlock = useMemo(
    () => filterLeagueTradeBlockListings(leagueBlockRaw, blockFilter),
    [leagueBlockRaw, blockFilter],
  );

  const incomingOffers = useMemo(
    () => (franchise ? listingOffersForFranchise(franchise) : []),
    [franchise],
  );

  const shopBadgeCount = useMemo(() => {
    if (!franchise) return 0;
    const block = tradeBlockAssetCount(franchise);
    const listingOffers = listingOffersForFranchise(franchise);
    const pendingProposals = (franchise.submittedProposals ?? []).filter((p) => p.season === franchise.season);
    const active = pendingProposals.filter((p) => p.status === 'pending' || p.status === 'countered').length;
    return block + listingOffers.length + (franchise.pendingCounter ? 1 : 0) + active;
  }, [franchise]);
  useEffect(() => {
    syncBlockListingOffers();
  }, [syncBlockListingOffers, franchise?.tradeBlock?.playerIds, franchise?.tradeBlock?.pickKeys]);

  useEffect(() => {
    if (openTradeShopDrawer) {
      setShowRosterDrawer(true);
      useGameStore.setState({ openTradeShopDrawer: false });
    }
  }, [openTradeShopDrawer]);

  if (!franchise || !league) return null;

  const blockCount = tradeBlockAssetCount(franchise);
  const userBlock = userTradeBlockListings(franchise);
  const pendingProposals = (franchise.submittedProposals ?? []).filter((p) => p.season === franchise.season);
  const activeProposals = pendingProposals.filter((p) => p.status === 'pending' || p.status === 'countered');
  const historyProposals = pendingProposals.filter((p) => p.status !== 'pending' && p.status !== 'countered');
  const negotiation = franchise.tradeNegotiation;

  const pendingOutbound = activeProposals.filter((p) => p.status === 'pending').length;
  // Hide countered proposals that already have an active pendingCounter from the same team
  const counteredProposals = activeProposals.filter(
    (p) => p.status === 'countered' &&
      !(franchise.pendingCounter && (
        p.partnerTeamId === franchise.pendingCounter.partnerTeamId ||
        p.partnerTeamName === franchise.pendingCounter.partnerTeam
      )),
  );
  const hasNegotiations =
    franchise.pendingCounter !== null ||
    counteredProposals.length > 0 ||
    pendingOutbound > 0 ||
    historyProposals.length > 0;

  const openNegotiate = (teamId?: string, prefill?: Partial<TradeProposal>) => {
    setNegotiatePartnerId(teamId);
    setNegotiatePrefill(prefill);
    setNegotiateKey((k) => k + 1);
    setNegotiateOpen(true);
  };

  const openReviseCounter = () => {
    if (negotiation) {
      openNegotiate(negotiation.partnerTeamId);
    } else {
      setNegotiateOpen(true);
    }
  };

  const openNegotiateFromOffer = (offer: TradeOffer) => {
    openNegotiate(offer.partnerTeamId, tradeOfferToPrefill(offer));
  };

  const blockedPlayers = franchise.roster.filter((p) => isPlayerOnBlock(franchise, p.id));
  const blockedPickKeys = franchise.tradeBlock.pickKeys ?? [];
  const blockedPicks = franchise.draftPicks.filter((pick) => isPickOnBlock(franchise, pickKey(pick)));

  return (
    <div className="page trade-shell">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Trade market</p>
          <h1 className="title-lg">Trades</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>
          Back
        </button>
      </div>

      <div className="trade-nav">
        <button
          type="button"
          className={`trade-tab ${tab === 'shop' ? 'trade-tab-active' : ''}`}
          onClick={() => setTab('shop')}
        >
          Shop
          {shopBadgeCount > 0 && <span className="trade-tab-badge">{shopBadgeCount}</span>}
        </button>
        <button
          type="button"
          className={`trade-tab ${tab === 'listings' ? 'trade-tab-active' : ''}`}
          onClick={() => setTab('listings')}
        >
          League listings
          {leagueBlockRaw.length > 0 && <span className="trade-tab-badge">{leagueBlockRaw.length}</span>}
        </button>
        <button type="button" className="trade-fab" onClick={() => openNegotiate()}>
          + Trade
        </button>
      </div>

      {tab === 'shop' && (
        <>
          <Panel accent>
            <div className="header-bar" style={{ marginBottom: 8 }}>
              <p className="eyebrow" style={{ margin: 0 }}>Your shopping list</p>
              {blockCount > 0 && (
                <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={clearTradeBlock}>
                  Clear all
                </button>
              )}
            </div>
            <p className="body" style={{ fontSize: 12, marginBottom: 12 }}>
              List a player or pick — teams respond instantly with player and pick packages.
            </p>

            {blockCount === 0 ? (
              <p className="body" style={{ fontSize: 13 }}>Nothing listed yet — add players you are willing to move.</p>
            ) : (
              <div className="trade-asset-list trade-asset-list-compact">
                {blockedPlayers.map((p) => (
                  <div key={p.id} className="trade-asset-chip trade-asset-chip-static">
                    <PlayerAvatar player={p} size={36} />
                    <div>
                      <strong>{playerName(p)}</strong>
                      <span>{p.overall} OVR · on your block</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 10 }}
                      onClick={() => toggleTradeBlockPlayer(p.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {blockedPicks.map((pick) => (
                  <div key={pickKey(pick)} className="trade-asset-chip trade-asset-chip-static trade-asset-chip-pick">
                    <span className="trade-pick-icon">P</span>
                    <div>
                      <strong>{pickDescription(pick)}</strong>
                      <span>On your block</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '4px 8px', fontSize: 10 }}
                      onClick={() => toggleTradeBlockPick(pickKey(pick))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => setShowRosterDrawer(true)}
            >
              + List player or pick
            </button>
          </Panel>

          {incomingOffers.length > 0 && (
            <Panel accent>
              <p className="eyebrow">Incoming offers</p>
              <p className="body" style={{ fontSize: 12, marginBottom: 10 }}>
                Packages from teams interested in your listings.
              </p>
              {incomingOffers.map((offer: TradeOffer) => (
                <div key={offer.id} className="trade-suggestion-row trade-offer-row">
                  <div className="trade-offer-row-main">
                    <strong style={{ fontSize: 13 }}>{offer.partnerTeam}</strong>
                    {offer.blockInquiry && (
                      <p className="body" style={{ fontSize: 11, margin: '2px 0 0', opacity: 0.75 }}>
                        {offer.listedAssetKeys ? 'For your package' : 'For your listing'}
                      </p>
                    )}
                    <TradeOfferPackageDetail offer={offer} />
                    <p className="body" style={{ fontSize: 12, margin: '8px 0 0' }}>{offer.analysis.longTerm}</p>
                  </div>
                  <div className="trade-suggestion-meta">
                    {offer.analysis.partnerAcceptScore !== undefined && (
                      <span className={offer.analysis.partnerAcceptScore >= 70 ? 'chip chip-success' : 'chip chip-gold'}>
                        {offer.analysis.partnerAcceptScore}% interest
                      </span>
                    )}
                    <button type="button" className="btn btn-primary" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => acceptTrade(offer)}>
                      Accept
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => openNegotiateFromOffer(offer)}>
                      Negotiate
                    </button>
                  </div>
                </div>
              ))}
            </Panel>
          )}

          {hasNegotiations && (
            <>
              <p className="eyebrow trade-inbox-label">Your negotiations</p>

              {franchise.pendingCounter && (
                <Panel warning accent>
                  <p className="eyebrow">
                    Counter — {franchise.pendingCounter.partnerTeam}
                    {negotiation ? ` · Round ${negotiation.round}/3` : ''}
                  </p>
                  <TradePackageSummary
                    send={franchise.pendingCounter.outgoing.description}
                    receive={franchise.pendingCounter.incoming.description}
                  />
                  <p className="body" style={{ marginTop: 8, fontSize: 12 }}>
                    {franchise.pendingCounter.analysis.longTerm}
                  </p>
                  <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                    <button type="button" className="btn btn-primary" onClick={acceptPendingCounter}>
                      Accept
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={openReviseCounter}>
                      Revise & resubmit
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={declinePendingCounter}>
                      Walk away
                    </button>
                  </div>
                </Panel>
              )}

              {counteredProposals.map((p) => {
                const pkg = describeSubmittedProposal(franchise, p);
                return (
                  <Panel key={p.id} warning accent>
                    <div className="header-bar" style={{ marginBottom: 6 }}>
                      <p className="eyebrow" style={{ margin: 0 }}>Countered — {p.partnerTeamName}</p>
                      <span className={proposalStatusClass(p.status)}>{p.status}</span>
                    </div>
                    <TradePackageSummary send={pkg.send} receive={pkg.receive} />
                    <p className="body" style={{ marginTop: 8, fontSize: 12 }}>{p.responseNote ?? p.partnerVerdict}</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ marginTop: 10, width: '100%' }}
                      onClick={() => openNegotiate(p.partnerTeamId, p.proposal)}
                    >
                      Revise offer
                    </button>
                  </Panel>
                );
              })}

              {pendingOutbound > 0 &&
                activeProposals
                  .filter((p) => p.status === 'pending')
                  .map((p) => {
                    const pkg = describeSubmittedProposal(franchise, p);
                    return (
                      <Panel key={p.id} accent>
                        <div className="header-bar" style={{ marginBottom: 6 }}>
                          <p className="eyebrow" style={{ margin: 0 }}>Sent — {p.partnerTeamName}</p>
                          <span className={proposalStatusClass(p.status)}>{p.status}</span>
                        </div>
                        <TradePackageSummary send={pkg.send} receive={pkg.receive} />
                        <div className="analysis-row" style={{ marginTop: 8 }}>
                          <span>Accept score</span>
                          <strong>{p.partnerAcceptScore}%</strong>
                        </div>
                        <p className="body" style={{ marginTop: 6, fontSize: 12 }}>{p.responseNote ?? p.partnerVerdict}</p>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ marginTop: 10, width: '100%' }}
                          onClick={() => withdrawProposal(p.id)}
                        >
                          Withdraw offer
                        </button>
                      </Panel>
                    );
                  })}

              {historyProposals.length > 0 && (
                <Panel>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ width: '100%', marginBottom: showHistory ? 10 : 0 }}
                    onClick={() => setShowHistory((v) => !v)}
                  >
                    {showHistory ? 'Hide history' : `Show history (${historyProposals.length})`}
                  </button>
                  {showHistory &&
                    historyProposals.slice(0, 10).map((p) => {
                      const pkg = describeSubmittedProposal(franchise, p);
                      return (
                        <div key={p.id} className="trade-history-row">
                          <div className="trade-history-row-main">
                            <div className="trade-history-row-header">
                              <span className="trade-history-team">{p.partnerTeamName} · Wk {p.submittedWeek}</span>
                              <span className={proposalStatusClass(p.status)}>{p.status}</span>
                            </div>
                            <div className="trade-history-recap">
                              <span><span className="stat-label">Sent</span> {pkg.send}</span>
                              <span><span className="stat-label">Got</span> {pkg.receive}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </Panel>
              )}
            </>
          )}
        </>
      )}

      {tab === 'listings' && (
        <Panel>
          <div className="header-bar" style={{ marginBottom: 8 }}>
            <p className="eyebrow" style={{ margin: 0 }}>League listings</p>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '6px 10px', fontSize: 11 }}
              onClick={() => setShowAdvancedFilters((v) => !v)}
            >
              {showAdvancedFilters ? 'Fewer filters' : 'More filters'}
            </button>
          </div>
          <p className="body" style={{ fontSize: 12, marginBottom: 12 }}>
            Browse what other teams are shopping — tap Make offer to open the trade builder.
          </p>
          <div className="trade-filter-row">
            <button
              type="button"
              className={`trade-filter-chip ${blockFilter === 'high_interest' ? 'trade-filter-chip-active' : ''}`}
              onClick={() => setBlockFilter('high_interest')}
            >
              Best fits
            </button>
            <button
              type="button"
              className={`trade-filter-chip ${blockFilter === 'all' ? 'trade-filter-chip-active' : ''}`}
              onClick={() => setBlockFilter('all')}
            >
              All listings
            </button>
            {showAdvancedFilters &&
              ADVANCED_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`trade-filter-chip ${blockFilter === f.id ? 'trade-filter-chip-active' : ''}`}
                  onClick={() => setBlockFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
          </div>
          <p className="body" style={{ fontSize: 12, margin: '8px 0 12px' }}>
            {leagueBlock.length} listing{leagueBlock.length === 1 ? '' : 's'}
          </p>

          {leagueBlock.length === 0 ? (
            <p className="body">No listings match this filter.</p>
          ) : (
            leagueBlock.slice(0, 20).map((row) => {
              const team = getTeamById(league, row.teamId);
              return (
                <div key={row.id} className="trade-listing-card">
                  <div className="trade-listing-head">
                    {team ? (
                      <TeamLogo city={team.city} name={team.name} size={36} />
                    ) : (
                      <span className="trade-pick-icon">T</span>
                    )}
                    <div className="trade-listing-copy">
                      <p className="eyebrow" style={{ marginBottom: 2 }}>{row.teamName}</p>
                      <strong>{row.label}</strong>
                      <span>
                        {row.assetType === 'player'
                          ? `${row.position ?? '—'} · ${row.overall ?? '—'} OVR`
                          : row.label}
                        {row.askingNote ? ` · ${row.askingNote}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="player-traits player-traits-compact" style={{ marginTop: 8 }}>
                    {row.shoppingFor.map((tag) => (
                      <span key={tag} className="trait-chip trait-chip-sm">
                        {shoppingTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: 10, width: '100%' }}
                    onClick={() => openNegotiate(row.teamId)}
                  >
                    Make offer
                  </button>
                </div>
              );
            })
          )}
        </Panel>
      )}

      {showRosterDrawer && (
        <div className="trade-negotiate-overlay" role="dialog" aria-modal="true" aria-label="List assets">
          <div className="trade-negotiate-modal">
            <div className="trade-negotiate-head">
              <div>
                <p className="eyebrow">Shopping list</p>
                <p className="title-md" style={{ margin: 0 }}>List players or picks</p>
              </div>
              <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setShowRosterDrawer(false)}>
                Done
              </button>
            </div>
            <div className="trade-asset-list">
              {[...franchise.roster].sort((a, b) => b.overall - a.overall).map((p) => {
                const onBlock = isPlayerOnBlock(franchise, p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`trade-asset-chip ${onBlock ? 'trade-asset-chip-active' : ''}`}
                    onClick={() => toggleTradeBlockPlayer(p.id)}
                  >
                    <PlayerAvatar player={p} size={36} />
                    <div>
                      <strong>{playerName(p)}</strong>
                      <span>{p.overall} OVR · {formatMoney(p.contract.annualSalary)}</span>
                    </div>
                  </button>
                );
              })}
              {[...franchise.draftPicks].sort((a, b) => a.year - b.year || a.round - b.round).map((pick) => {
                const key = pickKey(pick);
                const onBlock = blockedPickKeys.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`trade-asset-chip trade-asset-chip-pick ${onBlock ? 'trade-asset-chip-active' : ''}`}
                    onClick={() => toggleTradeBlockPick(key)}
                  >
                    <span className="trade-pick-icon">P</span>
                    <div>
                      <strong>{pickDescription(pick)}</strong>
                      <span>Draft pick</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {blockCount > 0 && (
              <p className="body" style={{ fontSize: 12, marginTop: 12 }}>
                Listed: {userBlock.players.map((p) => playerName(p)).join(', ')}
                {userBlock.picks.length ? ` · ${userBlock.picks.map(pickDescription).join(', ')}` : ''}
              </p>
            )}
          </div>
        </div>
      )}

      <TradeNegotiateModal
        key={negotiateKey}
        open={negotiateOpen}
        onClose={() => setNegotiateOpen(false)}
        franchise={franchise}
        league={league}
        initialPartnerId={negotiatePartnerId}
        initialPrefill={negotiatePrefill}
        negotiation={negotiation ?? undefined}
        onSubmit={submitTradeProposal}
        onRequestCounter={requestTradeCounter}
        onSubmitChain={submitTradeChain}
      />
    </div>
  );
}
