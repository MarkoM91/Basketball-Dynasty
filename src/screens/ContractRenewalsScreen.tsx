import { formatMoney, playerName } from '../data/scenarios';
import { computePayroll, formatCapBar, CAP_LIMIT } from '../engine/cap';
import {
  coachNeedsRenewal,
  coachRenewalTerms,
  expiringPlayers,
  pendingRenewalCount,
  playerRenewalTerms,
} from '../engine/contractRenewals';
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
  const payroll = computePayroll(franchise);
  const coachTerms = coachPending ? coachRenewalTerms(franchise.coach) : null;

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
          <span>Payroll</span>
          <strong>{formatCapBar(payroll, CAP_LIMIT)}</strong>
        </div>
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
            return (
              <div key={player.id} className="renewal-card renewal-card-player">
                <PlayerAvatar player={player} size={44} />
                <div className="renewal-card-copy">
                  <strong>
                    {playerName(player)} · {player.overall} OVR
                  </strong>
                  <span>
                    {player.position} · {player.age} yrs · was {formatMoney(player.contract.annualSalary)}
                  </span>
                  <span className="renewal-offer">
                    Offer: {terms.years} years · {formatMoney(terms.salary)}/yr
                  </span>
                </div>
                <div className="renewal-actions renewal-actions-inline">
                  <button type="button" className="btn btn-primary" onClick={() => renewPlayerContract(player.id)}>
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
          {pending > 0
            ? 'Resolve every pending renewal before opening free agency.'
            : 'Roster and coaching staff set. Open the market to chase outside talent.'}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 12, width: '100%' }}
          disabled={pending > 0}
          onClick={openFreeAgency}
        >
          Open free agency
        </button>
      </Panel>
    </div>
  );
}
