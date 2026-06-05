import { playerName } from '../data/scenarios';
import { draftPickSummary } from '../engine/draftOrder';
import { getUserDraftRecap } from '../engine/draftRecap';
import {
  availableProspects,
  draftRound,
  formatUserPickLabel,
  isUserDraftComplete,
  pickInRound,
} from '../engine/draftNight';
import { useGameStore } from '../store/gameStore';
import type { DraftRecapPick } from '../types/game';
import { Panel } from '../components/UI';

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
  const { franchise, league, startDraftNight, runToUserPick, advanceDraftPick, pickOnDraftClock, selectDraftProspect, setScreen } = useGameStore();
  if (!franchise) return null;

  const night = franchise.draftNight;
  const pick = franchise.draftPickNumber;
  const pickSummary = league ? draftPickSummary(league, franchise.city, franchise.name) : '';
  const draftRecap = getUserDraftRecap(franchise);
  const draftComplete =
    franchise.phase === 'contract_renewals' ||
    Boolean(night && !night.active && isUserDraftComplete(night));
  const showProspectBoard = !draftComplete;
  const prospects =
    night?.active
      ? availableProspects(night)
      : showProspectBoard && franchise.draftBoard.length > 0
        ? franchise.draftBoard
        : [];
  const userPickLabel = night ? formatUserPickLabel(night) : pick ? `#${pick} & #${pick + 30}` : '';

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

      {draftComplete && <DraftRecapPanel recap={draftRecap} />}

      {draftComplete && (
        <Panel accent>
          <p className="eyebrow">Next step</p>
          <p className="body" style={{ marginTop: 6 }}>
            Rookie deals are signed. Review expiring player and coach contracts before free agency.
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
                <p className="body" style={{ fontSize: 12, margin: 0 }}>
                  Tap <strong>Run to my pick</strong> to reach your next selection ({userPickLabel}).
                </p>
                <button type="button" className="btn btn-primary" onClick={runToUserPick}>
                  Run to my pick
                </button>
                <button type="button" className="btn btn-secondary" onClick={advanceDraftPick}>
                  Sim next pick
                </button>
              </div>
            )}
            {night.onClock && (
              <p className="body" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                Scroll down and tap <strong>Draft [name]</strong> on the player you want.
              </p>
            )}
          </Panel>

        </>
      )}

      {!draftComplete && (
        <Panel>
          <p className="body">
            Scouts are split. Ownership, the coach, and your gut will disagree. Both of your picks will shape the roster.
          </p>
        </Panel>
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
                  <span className="chip chip-gold">{pr.archetype}</span>
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
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => pickOnDraftClock(pr.id)}
                >
                  Draft {pr.lastName}
                </button>
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
    </div>
  );
}
