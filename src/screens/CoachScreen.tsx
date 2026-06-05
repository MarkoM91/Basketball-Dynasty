import { CoachAvatar } from '../components/PlayerAvatar';
import { formatMoney } from '../data/scenarios';
import { useGameStore } from '../store/gameStore';
import { MoraleChip, Panel } from '../components/UI';

export function CoachScreen() {
  const {
    franchise,
    fireHeadCoach,
    hireHeadCoach,
    refreshCoachMarket,
    setScreen,
  } = useGameStore();
  if (!franchise) return null;

  const c = franchise.coach;
  const market = franchise.coachMarket ?? [];
  const isInterim = c.name.includes('Interim');

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Coaching staff</p>
          <h1 className="title-lg">Sideline control</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('roster')}>Back</button>
      </div>

      <Panel accent className="coach-card">
        <div className="coach-card-row">
          <CoachAvatar name={c.name} size={56} />
          <div>
            <p className="title-md" style={{ margin: 0 }}>{c.name}</p>
            <p className="body" style={{ fontSize: 12, marginTop: 4 }}>
              {isInterim ? 'Interim staff holding the fort.' : 'Your current head coach.'}
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="analysis-block" style={{ marginTop: 0 }}>
          <div className="analysis-row"><span>Offensive system</span><strong>{c.offensiveSystem}</strong></div>
          <div className="analysis-row"><span>Defensive system</span><strong>{c.defensiveSystem}</strong></div>
          <div className="analysis-row"><span>Player development</span><strong>{c.devRating}/100</strong></div>
          <div className="analysis-row"><span>Playoff adjustments</span><strong>{c.playoffRating}/100</strong></div>
          <div className="analysis-row"><span>Locker room</span><strong><MoraleChip value={c.lockerRoom} /></strong></div>
          <div className="analysis-row"><span>Star relationship</span><strong><MoraleChip value={c.starRelationship} /></strong></div>
          <div className="analysis-row">
            <span>Contract</span>
            <strong>
              {(c.contractYearsRemaining ?? 0) > 0
                ? `${c.contractYearsRemaining} yr${c.contractYearsRemaining === 1 ? '' : 's'} · ${c.annualSalary ? formatMoney(c.annualSalary) : '—'}/yr`
                : 'Expiring'}
            </strong>
          </div>
        </div>
      </Panel>

      <Panel>
        <p className="eyebrow">Strengths</p>
        {c.strengths.map((s) => (
          <p key={s} className="body" style={{ margin: '4px 0' }}>+ {s}</p>
        ))}
      </Panel>

      <Panel warning>
        <p className="eyebrow">Weaknesses</p>
        {c.weaknesses.map((w) => (
          <p key={w} className="body" style={{ margin: '4px 0' }}>− {w}</p>
        ))}
      </Panel>

      {!isInterim && (
        <button type="button" className="btn btn-danger" style={{ width: '100%', marginBottom: 12 }} onClick={fireHeadCoach}>
          Fire head coach
        </button>
      )}

      <Panel accent>
        <div className="header-bar" style={{ marginBottom: 8 }}>
          <p className="eyebrow" style={{ margin: 0 }}>Coaching market</p>
          <button type="button" className="btn btn-ghost" onClick={refreshCoachMarket}>Refresh</button>
        </div>
        {market.length === 0 ? (
          <p className="body">No candidates available. Refresh the market.</p>
        ) : (
          market.map((candidate) => (
            <div key={candidate.id} className="coach-candidate">
              <div>
                <p className="title-md" style={{ fontSize: 14, margin: 0 }}>{candidate.name}</p>
                <span className={`chip ${candidate.reputation === 'Elite' ? 'chip-gold' : candidate.reputation === 'Risky' ? 'chip-warning' : ''}`}>
                  {candidate.reputation}
                </span>
                <p className="body" style={{ fontSize: 12, marginTop: 6 }}>{candidate.blurb}</p>
                <p className="mono" style={{ fontSize: 11, marginTop: 4 }}>
                  Dev {candidate.devRating} · PO {candidate.playoffRating} · {candidate.askingYears}yr
                </p>
              </div>
              <button type="button" className="btn btn-primary" style={{ width: 'auto', padding: '10px 16px' }} onClick={() => hireHeadCoach(candidate.id)}>
                Hire
              </button>
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}
