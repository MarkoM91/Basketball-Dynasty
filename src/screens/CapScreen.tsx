import { formatMoney } from '../data/scenarios';
import { birdRightsLabel, formatCap, formatCapBar, formatUsableCapRoom, isOffseasonCapWindow } from '../engine/cap';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';

export function CapScreen() {
  const { franchise, setScreen } = useGameStore();
  if (!franchise) return null;

  const { cap } = franchise;
  const expiring = franchise.roster.filter((p) => p.contract.isExpiring || p.contract.yearsRemaining <= 1);
  const star = franchise.roster.find((p) => p.isStar);
  const birdPlayers = franchise.roster.filter((p) => (p.contract.birdYears ?? 0) >= 2);

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Salary cap office</p>
          <h1 className="title-lg">CBA cap sheet</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
      </div>

      <Panel accent={!cap.inLuxuryTax && !cap.inSecondApron} danger={cap.inSecondApron} warning={cap.inLuxuryTax && !cap.inSecondApron}>
        <div className="stat-grid">
          <div className="stat-cell">
            <div className="stat-label">Payroll</div>
            <div className="stat-value">{formatMoney(cap.payroll)}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Cap limit</div>
            <div className="stat-value">{formatMoney(cap.capLimit)}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Luxury tax line</div>
            <div className="stat-value">{formatMoney(cap.luxuryTaxLine)}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Second apron</div>
            <div className={`stat-value ${cap.inSecondApron ? 'danger' : ''}`}>
              {cap.inSecondApron ? 'Hard capped' : formatMoney(cap.secondApron)}
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <p className="eyebrow">Exceptions & tax</p>
        <div className="analysis-row"><span>Usable cap room</span><strong>{formatUsableCapRoom(cap)}</strong></div>
        <div className="analysis-row"><span>Cap sheet payroll</span><strong>{formatCapBar(cap.payroll, cap.capLimit)}</strong></div>
        {(cap.rosterSalary ?? 0) > 0 && cap.rosterSalary !== cap.payroll && (
          <div className="analysis-row"><span>Roster salary (book)</span><strong>{formatCap(cap.rosterSalary!)}</strong></div>
        )}
        <div className="analysis-row"><span>Raw room</span><strong>{formatCap(cap.projectedRoom)}</strong></div>
        {cap.capHoldsTotal > 0 && (
          <div className="analysis-row"><span>Cap holds</span><strong>{formatCap(cap.capHoldsTotal)}</strong></div>
        )}
        {(cap.incompleteRosterCharge ?? 0) > 0 && (
          <div className="analysis-row"><span>Incomplete roster</span><strong>{formatCap(cap.incompleteRosterCharge!)}</strong></div>
        )}
        {isOffseasonCapWindow(franchise.phase) && cap.capHolds.length > 0 && (
          <>
            {cap.capHolds.map((h) => (
              <div key={h.playerId} className="analysis-row" style={{ fontSize: 12, opacity: 0.85 }}>
                <span>{h.name}</span>
                <strong>{formatCap(h.amount)}</strong>
              </div>
            ))}
          </>
        )}
        <div className="analysis-row"><span>MLE available</span><strong>{cap.mleUsed ? 'Used' : formatCap(cap.mleAvailable)}</strong></div>
        <div className="analysis-row"><span>BAE available</span><strong>{cap.baeAvailable ? formatCap(cap.baeAvailable) : 'Frozen (tax team)'}</strong></div>
        <div className="analysis-row"><span>Projected tax bill</span><strong className={cap.taxBill ? 'danger' : ''}>{cap.taxBill ? formatCap(cap.taxBill) : '$0'}</strong></div>
        <div className="analysis-row"><span>Dead money</span><strong>{formatCap(cap.deadMoney)}</strong></div>
        {cap.hardCapped && (
          <p className="body danger" style={{ marginTop: 8 }}>
            Second apron hard cap active — no MLE, no BAE, strict trade matching.
          </p>
        )}
      </Panel>

      {cap.warnings.map((w) => (
        <Panel key={w} warning>
          <p className="eyebrow">Cap warning</p>
          <p className="body">{w}</p>
        </Panel>
      ))}

      {birdPlayers.length > 0 && (
        <Panel>
          <p className="eyebrow">Bird rights</p>
          {birdPlayers.slice(0, 5).map((p) => (
            <div key={p.id} className="analysis-row">
              <span>{p.firstName} {p.lastName}</span>
              <strong>{birdRightsLabel(p.contract.birdYears ?? 0)}</strong>
            </div>
          ))}
        </Panel>
      )}

      {star && (
        <Panel>
          <p className="eyebrow">Star extension risk</p>
          <p className="title-md">{star.firstName} {star.lastName}</p>
          <p className="body">
            {birdRightsLabel(star.contract.birdYears ?? 0)} Extending at the max will push the team{' '}
            {cap.inLuxuryTax ? 'deeper into' : 'toward'} the luxury tax by {franchise.season + 2}.
          </p>
        </Panel>
      )}

      <Panel>
        <p className="eyebrow">Expiring / extension decisions</p>
        {expiring.length === 0 ? (
          <p className="body">No major contract decisions this block.</p>
        ) : (
          expiring.map((p) => (
            <div key={p.id} className="analysis-row">
              <span>{p.firstName} {p.lastName}</span>
              <strong>{formatMoney(p.contract.annualSalary)} · {p.contract.yearsRemaining}yr</strong>
            </div>
          ))
        )}
      </Panel>

      <Panel>
        <p className="eyebrow">Future picks</p>
        {franchise.draftPicks.map((pick) => (
          <div key={`${pick.year}-${pick.round}`} className="analysis-row">
            <span>{pick.year} Round {pick.round}</span>
            <strong>{pick.protections ?? 'Unprotected'}</strong>
          </div>
        ))}
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('ghosts')}>Franchise ghosts</button>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('history')}>Timeline</button>
      </div>
    </div>
  );
}
