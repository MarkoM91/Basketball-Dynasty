import { useState } from 'react';
import { formatMoney, playerName } from '../data/scenarios';
import { ROSTER_SIZE } from '../data/rosterBuilder';
import { canOpenRegularSeason, rosterOverCount, waiveablePlayers } from '../engine/rosterCuts';
import { PlayerAvatar } from './PlayerAvatar';
import type { Franchise, Player, Position } from '../types/game';
import { Icon } from './Icon';

/** How much a player is worth keeping: today's rating, plus upside if young, minus age decline. */
function keepValue(p: Player): number {
  const gap = p.potential - p.overall;
  // Raw 19–22-year-olds (often fresh draftees) are worth patience; vets on expiring deals aren't.
  const upside = p.age <= 22 ? gap * 0.9 : p.age <= 24 ? gap * 0.6 : p.age <= 27 ? gap * 0.25 : 0;
  const expiring = p.contract.yearsRemaining <= 1 && p.age >= 26 ? 1 : 0;
  const decline = p.age >= 33 ? 4 : p.age >= 31 ? 2 : 0;
  return p.overall + upside - decline - expiring;
}

function cutReason(p: Player): string {
  const bits: string[] = [];
  if (p.age >= 31) bits.push(`${p.age}, declining`);
  else if (p.age <= 24 && p.potential - p.overall >= 6) bits.push(`raw, +${p.potential - p.overall} upside`);
  bits.push(`${p.overall} OVR`);
  if (p.contract.yearsRemaining <= 1) bits.push('expiring');
  return bits.join(' · ');
}

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
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const over = rosterOverCount(franchise);
  const total = franchise.roster.length;
  const gate = canOpenRegularSeason(franchise);
  const ok = gate.ok;
  const fillPct = Math.min(100, (ROSTER_SIZE / Math.max(total, ROSTER_SIZE)) * 100);

  // Lowest keep-value first; the bottom `over` players are the suggested cuts.
  const candidates = [...waiveablePlayers(franchise)].sort((a, b) => keepValue(a) - keepValue(b));
  const suggested = new Set(candidates.slice(0, over).map((p) => p.id));

  const positionCount = (pos: Position) => franchise.roster.filter((p) => p.position === pos).length;
  const thinWarning = (p: Player) => {
    const left = positionCount(p.position) - 1;
    return left < 2 ? `Leaves ${left} ${p.position}` : null;
  };

  const release = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      setConfirmAll(false);
      return;
    }
    setConfirmId(null);
    onWaive(id);
  };

  const releaseSuggested = () => {
    if (!confirmAll) {
      setConfirmAll(true);
      setConfirmId(null);
      return;
    }
    setConfirmAll(false);
    [...suggested].forEach((id) => onWaive(id));
  };

  return (
    <div className="tc-card">
      <div className="tc-header">
        <div>
          <p className="eyebrow" style={{ marginBottom: 2 }}>Training camp</p>
          <p className="tc-title">
            {ok ? 'Roster set — ready to tip off' : `Cut ${over} to reach ${ROSTER_SIZE}`}
          </p>
        </div>
        <div className="tc-roster-badge" style={{ color: ok ? 'var(--success)' : 'var(--danger)' }}>
          <span className="tc-badge-num">{total}</span>
          <span className="tc-badge-den">/{ROSTER_SIZE}</span>
        </div>
      </div>

      <div className="tc-progress-track">
        <div
          className="tc-progress-fill"
          style={{ width: `${fillPct}%`, background: ok ? 'var(--success)' : 'var(--danger)' }}
        />
      </div>

      {over > 0 && (
        <>
          {suggested.size > 0 && (
            <button
              type="button"
              className={`btn ${confirmAll ? 'btn-primary' : 'btn-secondary'} tc-cut-suggested`}
              onClick={releaseSuggested}
            >
              {confirmAll
                ? `Confirm: release ${suggested.size === 1 ? 'him' : `these ${suggested.size}`}`
                : `Cut the ${suggested.size === 1 ? '' : `${suggested.size} `}suggested`}
            </button>
          )}
          <p className="tc-help">Suggested cuts weigh rating, youth upside and age. Tap Release twice to confirm.</p>
          <ul className="tc-player-list">
            {candidates.length === 0 ? (
              <li className="tc-empty">No waiveable players — trade for roster room.</li>
            ) : (
              candidates.map((player) => {
                const isSuggested = suggested.has(player.id);
                const confirming = confirmId === player.id;
                const thin = thinWarning(player);
                return (
                  <li key={player.id} className={`tc-player-row ${isSuggested ? 'is-suggested' : ''}`}>
                    <PlayerAvatar player={player} size={40} showOverall={false} />
                    <div className="tc-player-info">
                      <span className="tc-player-name">{playerName(player)}</span>
                      <span className="tc-player-meta">
                        {player.position} · {cutReason(player)}
                      </span>
                      <span className="tc-player-meta">
                        {formatMoney(player.contract.annualSalary)} × {player.contract.yearsRemaining}yr
                        {thin && (
                          <em className="tc-thin">
                            {' '}
                            <Icon name="alert" size={12} /> {thin}
                          </em>
                        )}
                      </span>
                      {isSuggested && <span className="chip chip-warning tc-suggest-chip">Suggested cut</span>}
                    </div>
                    <div className="tc-release-wrap">
                      <button
                        type="button"
                        className={`tc-release-btn ${confirming ? 'is-confirm' : ''}`}
                        onClick={() => release(player.id)}
                      >
                        {confirming ? 'Confirm' : 'Release'}
                      </button>
                      {confirming && (
                        <button type="button" className="tc-cancel" onClick={() => setConfirmId(null)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}

      <div className="tc-footer">
        <button
          type="button"
          className={`tc-cta${ok ? ' tc-cta--ready' : ' tc-cta--locked'}`}
          disabled={!ok}
          onClick={onOpenSeason}
        >
          <span className="tc-cta-icon"><Icon name="play" size={16} /></span>
          <span className="tc-cta-label">{ok ? 'Open regular season' : gate.reason ?? 'Finish cuts first'}</span>
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
