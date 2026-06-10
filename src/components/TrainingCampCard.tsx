import { formatMoney, playerName } from '../data/scenarios';
import { ROSTER_SIZE } from '../data/rosterBuilder';
import { canOpenRegularSeason, rosterOverCount, waiveablePlayers } from '../engine/rosterCuts';
import { PlayerAvatar } from './PlayerAvatar';
import type { Franchise } from '../types/game';

export function TrainingCampCard({
  franchise,
  onWaive,
  onOpenSeason,
  onOpenRoster,
  onOpenTrades,
}: {
  franchise: Franchise;
  onWaive: (id: string) => void;
  onOpenSeason: () => void;
  onOpenRoster: () => void;
  onOpenTrades: () => void;
}) {
  const over = rosterOverCount(franchise);
  const total = franchise.roster.length;
  const gate = canOpenRegularSeason(franchise);
  const candidates = [...waiveablePlayers(franchise)].sort((a, b) => a.overall - b.overall);
  const fillPct = Math.min(100, (ROSTER_SIZE / Math.max(total, ROSTER_SIZE)) * 100);
  const ok = gate.ok;

  return (
    <div className="tc-card">
      {/* Header */}
      <div className="tc-header">
        <div>
          <p className="eyebrow" style={{ marginBottom: 2 }}>Training Camp</p>
          <p className="tc-title">
            {ok ? 'Roster set — ready to tip off' : `Cut ${over} to finalize your roster`}
          </p>
        </div>
        <div className="tc-roster-badge" style={{ color: ok ? 'var(--success, #4ade80)' : 'var(--danger, #f87171)' }}>
          <span className="tc-badge-num">{total}</span>
          <span className="tc-badge-den">/{ROSTER_SIZE}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="tc-progress-track">
        <div
          className="tc-progress-fill"
          style={{
            width: `${fillPct}%`,
            background: ok ? 'var(--success, #4ade80)' : 'var(--danger, #f87171)',
          }}
        />
      </div>

      {/* Player list — only shown when cuts needed */}
      {over > 0 && (
        <div className="tc-player-list">
          {candidates.length === 0 ? (
            <p className="tc-empty">No waiveable players — trade for roster room.</p>
          ) : (
            candidates.map((player) => (
              <div key={player.id} className="tc-player-row">
                <PlayerAvatar player={player} size={34} />
                <div className="tc-player-info">
                  <span className="tc-player-name">{playerName(player)}</span>
                  <span className="tc-player-meta">
                    {player.position} · {player.age}y · {player.overall} OVR
                  </span>
                </div>
                <div className="tc-player-contract">
                  <span className="tc-player-salary">{formatMoney(player.contract.annualSalary)}</span>
                  <span className="tc-player-years">{player.contract.yearsRemaining}yr</span>
                </div>
                <button type="button" className="tc-release-btn" onClick={() => onWaive(player.id)}>
                  Release
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer CTA */}
      <div className="tc-footer">
        <button
          type="button"
          className={`tc-cta${ok ? ' tc-cta--ready' : ' tc-cta--locked'}`}
          disabled={!ok}
          onClick={onOpenSeason}
        >
          <span className="tc-cta-icon">▶</span>
          <span className="tc-cta-label">Open regular season</span>
        </button>
        <div className="tc-links">
          <button type="button" className="btn btn-ghost tc-link-btn" onClick={onOpenRoster}>
            Full roster
          </button>
          <button type="button" className="btn btn-ghost tc-link-btn" onClick={onOpenTrades}>
            Trade for room
          </button>
        </div>
      </div>
    </div>
  );
}
