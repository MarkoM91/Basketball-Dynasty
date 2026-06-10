import { formatMoney, playerName } from '../data/scenarios';
import { birdRightsLabel, canRenewWithBirdRights, capRoomBreakdown, formatUsableCapRoom } from '../engine/cap';
import { ovrTier } from '../lib/playerRatings';
import {
  coachNeedsRenewal,
  coachRenewalTerms,
  expiringPlayers,
  pendingRenewalCount,
  playerRenewalTerms,
} from '../engine/contractRenewals';
import { canOpenFreeAgency } from '../engine/rosterCuts';
import { CoachAvatar, PlayerAvatar } from '../components/PlayerAvatar';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';

export function ContractRenewalsScreen() {
  const {
    franchise,
    renewPlayerContract,
    releasePlayerContract,
    renewCoachContract,
    declineCoachContract,
    openFreeAgency,
    setScreen,
  } = useGameStore();

  if (!franchise) return null;

  const expiring = expiringPlayers(franchise);
  const coachPending = coachNeedsRenewal(franchise);
  const pending = pendingRenewalCount(franchise);
  const coachTerms = coachPending ? coachRenewalTerms(franchise.coach) : null;
  const faGate = canOpenFreeAgency(franchise);

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Offseason · Before free agency</p>
          <h1 className="title-lg">Contract renewals</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>
          Back
        </button>
      </div>

      <Panel accent>
        <p className="body" style={{ marginBottom: 8 }}>
          Decide who stays on your payroll before outside free agents hit the market.
        </p>
        <div className="analysis-row">
          <span>Usable cap room</span>
          <strong>{formatUsableCapRoom(franchise.cap)}</strong>
        </div>
        <p className="body" style={{ fontSize: 12, margin: '4px 0 8px', opacity: 0.85 }}>
          {capRoomBreakdown(franchise.cap)}
        </p>
        {(franchise.cap.capHoldsTotal ?? 0) > 0 && (
          <div className="analysis-row">
            <span>Cap holds (unsigned)</span>
            <strong>{formatMoney(franchise.cap.capHoldsTotal)}</strong>
          </div>
        )}
        {(franchise.cap.incompleteRosterCharge ?? 0) > 0 && (
          <div className="analysis-row">
            <span>Incomplete roster charge</span>
            <strong>{formatMoney(franchise.cap.incompleteRosterCharge!)}</strong>
          </div>
        )}
        <div className="analysis-row">
          <span>Pending decisions</span>
          <strong>{pending}</strong>
        </div>
      </Panel>

      {coachPending && coachTerms && (
        <Panel warning>
          <p className="eyebrow">Head coach</p>
          <div className="renewal-card">
            <CoachAvatar name={franchise.coach.name} size={48} />
            <div className="renewal-card-copy">
              <strong>{franchise.coach.name}</strong>
              <span>
                Dev {franchise.coach.devRating} · PO {franchise.coach.playoffRating} · contract expired
              </span>
              <span className="renewal-offer">
                Extension: {coachTerms.years} years · {formatMoney(coachTerms.salary)}/yr
              </span>
            </div>
          </div>
          <div className="renewal-actions">
            <button type="button" className="btn btn-primary" onClick={renewCoachContract}>
              Extend coach
            </button>
            <button type="button" className="btn btn-ghost" onClick={declineCoachContract}>
              Part ways
            </button>
          </div>
        </Panel>
      )}

      <Panel>
        <p className="eyebrow">Roster renewals</p>
        {expiring.length === 0 ? (
          <p className="body">No player contracts up for renewal.</p>
        ) : (
          expiring.map((player) => {
            const terms = playerRenewalTerms(player);
            const bird = canRenewWithBirdRights(franchise, player, terms.salary);
            return (
              <div key={player.id} className="renewal-card renewal-card-player">
                <PlayerAvatar player={player} size={44} />
                <div className="renewal-card-copy">
                  <strong>
                    {playerName(player)}
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: 'var(--silver)' }}>
                      {player.overall} OVR · {ovrTier(player.overall)}
                    </span>
                  </strong>
                  <span>
                    {player.position} · {player.age} yrs{player.age >= 32 ? ' ⚠️' : ''} · was {formatMoney(player.contract.annualSalary)}
                  </span>
                  <span className="renewal-offer">
                    {terms.years}yr · {formatMoney(terms.salary)}/yr
                    {(player.contract.birdYears ?? 0) >= 2 && (
                      <> · {birdRightsLabel(player.contract.birdYears ?? 0)}</>
                    )}
                  </span>
                  {!bird.ok && (
                    <span style={{ fontSize: 11, color: 'var(--danger, #dc5050)' }}>
                      {bird.reason}
                    </span>
                  )}
                </div>
                <div className="renewal-actions renewal-actions-inline">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!bird.ok}
                    onClick={() => renewPlayerContract(player.id)}
                  >
                    Re-sign
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => releasePlayerContract(player.id)}>
                    Release
                  </button>
                </div>
              </div>
            );
          })
        )}
      </Panel>

      <Panel accent>
        <p className="eyebrow">Next step</p>
        <p className="body" style={{ marginTop: 6 }}>
          {!faGate.ok
            ? faGate.reason
            : 'Roster and coaching staff set. Open the market to chase outside talent.'}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 12, width: '100%' }}
          disabled={!faGate.ok}
          onClick={openFreeAgency}
        >
          Open free agency
        </button>
      </Panel>
    </div>
  );
}
