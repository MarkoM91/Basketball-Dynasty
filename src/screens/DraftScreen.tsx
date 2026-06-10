import { useMemo, useState } from 'react';
import { playerName } from '../data/scenarios';
import { draftPickSummary } from '../engine/draftOrder';
import {
  generateDraftPickTradeOffers,
  pickLabel,
  remainingUserDraftSlots,
} from '../engine/draftPickTrade';
import { getUserDraftRecap } from '../engine/draftRecap';
import {
  availableProspects,
  classStrengthLabel,
  draftRound,
  formatUserPickLabel,
  isUserDraftComplete,
  pickInRound,
} from '../engine/draftNight';
import { useGameStore } from '../store/gameStore';
import type { DraftRecapPick, TradeProposal } from '../types/game';
import { Panel } from '../components/UI';
import { TradeNegotiateModal } from '../components/TradeNegotiateModal';

function DraftRecapPanel({ recap }: { recap: DraftRecapPick[] }) {
  const round1 = recap.filter((p) => p.round === 1);
  const round2 = recap.filter((p) => p.round === 2);

  const renderRound = (label: string, picks: DraftRecapPick[]) => (
    <div className="draft-recap-round">
      <p className="eyebrow">{label}</p>
      {picks.length === 0 ? (
        <p className="body" style={{ fontSize: 12, margin: 0 }}>No pick this round.</p>
      ) : (
        picks.map((pick) => (
          <div key={pick.pick} className="draft-recap-pick">
            <div className="draft-recap-pick-head">
              <span className="draft-recap-slot">
                #{pickInRound(pick.pick)} · Pick {pick.pick}
              </span>
              {pick.overall !== undefined && (
                <span className="chip chip-gold">OVR {pick.overall}</span>
              )}
            </div>
            <p className="title-md" style={{ fontSize: 15, margin: '6px 0 4px' }}>
              {pick.playerName}
              {pick.position ? ` — ${pick.position}` : ''}
            </p>
            {pick.archetype && <span className="chip">{pick.archetype}</span>}
            {pick.note && (
              <p className="body" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                {pick.note}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <Panel accent>
      <p className="eyebrow">Draft recap</p>
      <p className="body" style={{ marginBottom: 12 }}>
        Your two-round haul — how the board shook out for {recap.length} pick{recap.length === 1 ? '' : 's'}.
      </p>
      {renderRound('Round 1', round1)}
      {renderRound('Round 2', round2)}
    </Panel>
  );
}

export function DraftScreen() {
  const {
    franchise,
    league,
    startDraftNight,
    runToUserPick,
    advanceDraftPick,
    finishDraft,
    pickOnDraftClock,
    stashOnDraftClock,
    callUpStashedPlayer,
    selectDraftProspect,
    setScreen,
    acceptDraftPickTrade,
    submitDraftPickTrade,
    submitTradeProposal,
    requestTradeCounter,
    submitTradeChain,
    addDraftSlotToShoppingList,
  } = useGameStore();

  const [tradePickNumber, setTradePickNumber] = useState<number | null>(null);
  const [tradePrefill, setTradePrefill] = useState<Partial<TradeProposal> | undefined>();

  const tradableSlots = useMemo(
    () => (franchise ? remainingUserDraftSlots(franchise) : []),
    [franchise],
  );
  const showPickTradePanel =
    Boolean(franchise && league) &&
    tradableSlots.length > 0 &&
    (franchise?.phase === 'draft_scouting' ||
      franchise?.phase === 'draft_night' ||
      franchise?.phase === 'contract_renewals');

  const pickTradeOffers = useMemo(() => {
    if (!showPickTradePanel || !franchise || !league) return [];
    return tradableSlots.flatMap((slot) => generateDraftPickTradeOffers(franchise, league, slot));
  }, [franchise, league, tradableSlots, showPickTradePanel]);

  if (!franchise || !league) return null;

  const night = franchise.draftNight;
  const pick = franchise.draftPickNumber;
  const pickSummary = draftPickSummary(league, franchise.city, franchise.name);
  const draftRecap = getUserDraftRecap(franchise);
  const draftComplete =
    franchise.phase === 'contract_renewals' ||
    Boolean(night && !night.active && isUserDraftComplete(night));
  const showProspectBoard = !draftComplete;
  const prospects =
    night?.active
      ? availableProspects(night)
      : showProspectBoard && (franchise.draftBoard?.length ?? 0) > 0
        ? franchise.draftBoard ?? []
        : [];
  const userPickLabel = night ? formatUserPickLabel(night) : pick ? `#${pick} & #${pick + 30}` : '';


  const closePickTrade = () => {
    setTradePickNumber(null);
    setTradePrefill(undefined);
  };

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Draft board · 2 rounds</p>
          <h1 className="title-lg">
            {draftComplete
              ? 'Draft complete'
              : night?.active
                ? night.onClock
                  ? `ON THE CLOCK — R${draftRound(night.currentPick)} · #${pickInRound(night.currentPick)}`
                  : `Pick ${night.currentPick} / 60 · yours: ${userPickLabel}`
                : pick
                  ? `Your picks: ${userPickLabel}`
                  : 'Scouting board'}
          </h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
      </div>

      {showPickTradePanel && (
        <Panel>
          <p className="eyebrow">Your picks · trade away</p>
          <p className="body" style={{ fontSize: 12, marginTop: 4 }}>
            Move a pick for win-now help instead of adding roster spots.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {tradableSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                className="btn btn-secondary"
                style={{ padding: '8px 12px' }}
                onClick={() => addDraftSlotToShoppingList(slot)}
              >
                Trade {pickLabel(slot)}
              </button>
            ))}
          </div>
          {pickTradeOffers.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p className="stat-label">Quick offers</p>
              {pickTradeOffers.slice(0, 4).map((row) => (
                <div key={row.id} className="deal-suggestion-card" style={{ marginTop: 8 }}>
                  <div className="header-bar" style={{ marginBottom: 4 }}>
                    <strong style={{ fontSize: 13 }}>{row.title}</strong>
                    <span className="chip chip-gold">{row.acceptScore}%</span>
                  </div>
                  <p className="body" style={{ fontSize: 12, margin: '0 0 8px' }}>
                    {row.detail}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '6px 10px', fontSize: 11 }}
                    onClick={() => acceptDraftPickTrade(row.offer, row.pickNumber)}
                  >
                    Accept for {row.pickLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {draftComplete && <DraftRecapPanel recap={draftRecap} />}

      {draftComplete && (
        <Panel accent>
          <p className="eyebrow">Next step</p>
          <p className="body" style={{ marginTop: 6 }}>
            Rookie deals are signed. Trim to 18 if needed, then review expiring contracts before free agency.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 12, width: '100%' }}
            onClick={() => setScreen('contract_renewals')}
          >
            Open contract renewals
          </button>
        </Panel>
      )}

      {/* Draft class strength badge */}
      {(franchise.phase === 'draft_scouting' || franchise.phase === 'draft_night') && !draftComplete && night?.classStrength && (
        <Panel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`chip ${night.classStrength === 'Loaded' ? 'chip-gold' : night.classStrength === 'Weak' ? 'chip-danger' : night.classStrength === 'Deep' ? 'chip-success' : ''}`}>
              {classStrengthLabel(night.classStrength)}
            </span>
            <p className="body" style={{ margin: 0, fontSize: 12 }}>
              {night.classStrength === 'Loaded' && 'Multiple potential stars in this class. Competition for top picks will be fierce.'}
              {night.classStrength === 'Deep' && 'No transcendent talent, but solid depth through Round 2. Value picks available late.'}
              {night.classStrength === 'Weak' && 'Thin class — fewer impact players, higher bust rates. Trades and FA may be smarter.'}
              {night.classStrength === 'Average' && 'Balanced class. A few standouts at the top, depth thins in Round 2.'}
            </p>
          </div>
        </Panel>
      )}

      {/* International stash panel */}
      {(franchise.draftStash ?? []).length > 0 && (
        <Panel>
          <p className="eyebrow">International stash</p>
          {(franchise.draftStash ?? []).map((s) => (
            <div key={s.prospect.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div>
                <p className="body" style={{ margin: 0, fontWeight: 600 }}>{s.prospect.firstName} {s.prospect.lastName}</p>
                <p className="body" style={{ margin: 0, fontSize: 11, color: 'var(--silver)' }}>
                  {s.prospect.position} · {s.prospect.archetype} · OVR {s.prospect.trueOverall ?? s.prospect.scoutedOverall[0]}–{s.prospect.scoutedOverall[1]}
                  {s.yearsRemaining > 0 ? ` · ${s.yearsRemaining}yr overseas` : ' · Ready to call up'}
                </p>
              </div>
              {s.yearsRemaining === 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '6px 10px', fontSize: 11 }}
                  onClick={() => callUpStashedPlayer(s.prospect.id)}
                >
                  Call up
                </button>
              )}
            </div>
          ))}
        </Panel>
      )}

      {!night?.active && (franchise.phase === 'draft_scouting' || franchise.phase === 'draft_night') && !draftComplete && (
        <Panel accent>
          <p className="body">
            Two-round draft (60 picks). {pickSummary || `Your picks: ${userPickLabel || 'your slot'}.`}
          </p>
          {league?.draftLotteryLog && league.draftLotteryLog.length > 0 && (
            <div className="analysis-block" style={{ marginTop: 10 }}>
              <p className="eyebrow">Draft order</p>
              {league.draftLotteryLog.slice(0, 4).map((line) => (
                <p key={line} className="body" style={{ fontSize: 12, margin: '4px 0' }}>{line}</p>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={startDraftNight}>
            Run to my pick
          </button>
        </Panel>
      )}

      {night?.active && (
        <>
          <Panel accent={night.onClock}>
            <p className="eyebrow">{night.onClock ? 'Your pick' : 'Live feed'}</p>
            <p className="body">{night.stakeholderNote}</p>
            {!night.onClock && (
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {userPickLabel === 'Draft complete' ? (
                  <>
                    <p className="body" style={{ fontSize: 12, margin: 0 }}>
                      You have no picks remaining. Finish the draft to continue to contract renewals.
                    </p>
                    <button type="button" className="btn btn-primary" onClick={finishDraft}>
                      Finish draft
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={advanceDraftPick}>
                      Sim next pick
                    </button>
                  </>
                ) : (
                  <>
                    <p className="body" style={{ fontSize: 12, margin: 0 }}>
                      Tap <strong>Run to my pick</strong> to reach your next selection ({userPickLabel}).
                    </p>
                    <button type="button" className="btn btn-primary" onClick={runToUserPick}>
                      Run to my pick
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={advanceDraftPick}>
                      Sim next pick
                    </button>
                  </>
                )}
              </div>
            )}
            {night.onClock && (
              <p className="body" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                Scroll down and tap <strong>Draft [name]</strong> on the player you want — or trade the pick above.
              </p>
            )}
          </Panel>
        </>
      )}


      {prospects.length === 0 && !draftComplete ? (
        <Panel>
          <p className="body">
            {night?.active
              ? 'No prospects left on the board.'
              : 'Board empty. Scouting department is building reports.'}
          </p>
        </Panel>
      ) : prospects.length > 0 ? (
        <>
          {night?.active && !night.onClock && (
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Up next on the board ({prospects.length} remaining)
            </p>
          )}
          {night?.active && night.onClock && (
            <p className="eyebrow" style={{ marginBottom: 8 }}>
              Choose your pick ({prospects.length} available)
            </p>
          )}
          {prospects.map((pr) => (
            <Panel key={pr.id} accent={night?.onClock}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p className="title-md">{playerName(pr)} — {pr.age} — {pr.position}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className="chip chip-gold">{pr.archetype}</span>
                    {pr.isInternational && (
                      <span className="chip" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                        🌍 Intl · {pr.stashYears}yr stash
                      </span>
                    )}
                  </div>
                </div>
                <span className={`chip ${pr.bustRisk === 'High' ? 'chip-danger' : pr.bustRisk === 'Low' ? 'chip-success' : 'chip-warning'}`}>
                  Bust risk: {pr.bustRisk}
                </span>
              </div>

              <div className="stat-grid" style={{ marginTop: 12 }}>
                <div className="stat-cell">
                  <div className="stat-label">Scouted OVR</div>
                  <div className="stat-value">{pr.scoutedOverall[0]}–{pr.scoutedOverall[1]}</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-label">Potential</div>
                  <div className="stat-value">{pr.potential[0]}–{pr.potential[1]}</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-label">Floor / Ceiling</div>
                  <div className="stat-value">{pr.floor} / {pr.ceiling}</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-label">Work ethic</div>
                  <div className="stat-value">{pr.workEthic}</div>
                </div>
              </div>

              <p className="body" style={{ marginTop: 10, fontSize: 12 }}>
                <strong style={{ color: 'var(--off-white)' }}>Scout note:</strong> {pr.scoutNote}
              </p>

              {night?.onClock ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => pickOnDraftClock(pr.id)}
                  >
                    Draft {pr.lastName}
                  </button>
                  {pr.isInternational && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => stashOnDraftClock(pr.id)}
                      title={`Stash overseas for ${pr.stashYears} year${(pr.stashYears ?? 1) > 1 ? 's' : ''} — develops before joining roster`}
                    >
                      🌍 Stash
                    </button>
                  )}
                </div>
              ) : !night?.active && (franchise.phase === 'draft_scouting' || franchise.phase === 'draft_night') ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 12 }}
                  onClick={() => selectDraftProspect(pr.id)}
                >
                  Quick pick {pr.lastName} (skip live draft)
                </button>
              ) : null}
            </Panel>
          ))}
        </>
      ) : null}

      <TradeNegotiateModal
        key={tradePickNumber ?? 'closed'}
        open={tradePickNumber !== null}
        onClose={closePickTrade}
        franchise={franchise}
        league={league}
        initialPrefill={tradePrefill}
        onSubmit={(proposal) => {
          if (tradePickNumber !== null) {
            submitDraftPickTrade(proposal, tradePickNumber);
          } else {
            submitTradeProposal(proposal);
          }
          closePickTrade();
        }}
        onRequestCounter={(proposal) => {
          requestTradeCounter(proposal);
          closePickTrade();
        }}
        onSubmitChain={submitTradeChain}
      />
    </div>
  );
}
