import { useRef, useState } from 'react';
import { formatMoney, playerName } from '../data/scenarios';
import { ROSTER_SIZE } from '../data/rosterBuilder';
import { rosterCutsNeeded, waiveablePlayers } from '../engine/rosterCuts';
import { PlayerAvatar } from './PlayerAvatar';
import { Panel } from './UI';
import type { Franchise, Player } from '../types/game';
import { ovrTier } from '../lib/playerRatings';

export function RosterCutsPanel({
  franchise,
  onWaive,
  onOpenRoster,
  onOpenTrades,
}: {
  franchise: Franchise;
  onWaive: (playerId: string) => void;
  onOpenRoster?: () => void;
  onOpenTrades?: () => void;
}) {
  const over = rosterCutsNeeded(franchise);
  const inFreeAgency = franchise.phase === 'free_agency';
  const atCap = franchise.roster.length >= ROSTER_SIZE;
  // Capture initial over count so progress dots are stable as store updates
  const initialOver = useRef(inFreeAgency ? 1 : over);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const dragStart = useRef<number | null>(null);

  if (over <= 0 && !(inFreeAgency && atCap)) {
    return (
      <Panel accent>
        <div className="analysis-row">
          <span>Roster size</span>
          <strong>{franchise.roster.length} / {ROSTER_SIZE}</strong>
        </div>
      </Panel>
    );
  }

  const totalNeeded = initialOver.current;
  // remaining comes directly from the store — unblocks the FA button as soon as store updates
  const remaining = inFreeAgency ? (atCap ? 1 : 0) : over;
  const released = Math.max(0, totalNeeded - remaining);

  const candidates: Player[] = [...waiveablePlayers(franchise)]
    .sort((a, b) => a.overall - b.overall)
    .filter((p) => !processedIds.includes(p.id));

  const clampedIndex = Math.min(currentIndex, Math.max(0, candidates.length - 1));
  const current = candidates[clampedIndex] ?? null;
  const prevCard = candidates[clampedIndex - 1] ?? null;
  const nextCard = candidates[clampedIndex + 1] ?? null;

  const advance = (id: string) => {
    setProcessedIds((s) => [...s, id]);
    // After removal the same index points to next candidate automatically
  };

  const handleRelease = (p: Player) => {
    onWaive(p.id);
    advance(p.id);
  };

  const handleSkip = (p: Player) => {
    advance(p.id);
    // Advance index only if more cards exist
    setCurrentIndex((i) => Math.min(i + 1, candidates.length - 2));
  };

  const goNext = () => setCurrentIndex((i) => Math.min(i + 1, candidates.length - 1));
  const goPrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

  // Drag / swipe support
  const handlePointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX;
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    const delta = e.clientX - dragStart.current;
    dragStart.current = null;
    if (delta < -40) goNext();
    else if (delta > 40) goPrev();
  };

  return (
    <div className="cut-day-panel">
      {/* Header */}
      <div className="cut-day-header">
        <div className="cut-day-header-left">
          <span className="cut-day-icon">✂</span>
          <div>
            <p className="cut-day-title">
              {inFreeAgency ? 'Roster Full' : 'Cut Day'}
            </p>
            <p className="cut-day-sub">
              {remaining === 0
                ? "All cuts made — you're clear."
                : inFreeAgency
                ? 'Release or trade to open a spot.'
                : `Release ${remaining} player${remaining === 1 ? '' : 's'} before free agency.`}
            </p>
          </div>
        </div>
        <div className="cut-day-count">
          <span className="cut-day-count-num" style={{ color: remaining > 0 ? '#f87171' : '#4ade80' }}>
            {remaining}
          </span>
          <span className="cut-day-count-label">left</span>
        </div>
      </div>

      {/* Progress dots */}
      {totalNeeded > 0 && (
        <div className="cut-day-progress">
          {Array.from({ length: totalNeeded }).map((_, i) => (
            <span key={i} className={`cut-day-dot ${i < released ? 'cut-day-dot--done' : 'cut-day-dot--pending'}`} />
          ))}
          <span className="cut-day-progress-label">{released} of {totalNeeded} released</span>
        </div>
      )}

      {remaining > 0 && current ? (
        <>
          {/* Card slider */}
          <div
            className="cut-day-slider"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            style={{ userSelect: 'none', touchAction: 'pan-y' }}
          >
            {/* Prev card (desktop only) */}
            <div className={`cut-day-slide cut-day-slide--side ${!prevCard ? 'cut-day-slide--empty' : ''}`}>
              {prevCard && <SliderCard player={prevCard} dim onClick={goPrev} />}
            </div>

            {/* Active card */}
            <div className="cut-day-slide cut-day-slide--active">
              <SliderCard player={current} />
              <div className="cut-day-actions">
                <button type="button" className="cut-day-btn-release" onClick={() => handleRelease(current)}>
                  ✕ Release
                </button>
                <button type="button" className="cut-day-btn-keep" onClick={() => handleSkip(current)}>
                  Keep →
                </button>
              </div>
            </div>

            {/* Next card (desktop only) */}
            <div className={`cut-day-slide cut-day-slide--side ${!nextCard ? 'cut-day-slide--empty' : ''}`}>
              {nextCard && <SliderCard player={nextCard} dim onClick={goNext} />}
            </div>
          </div>

          {/* Mobile nav dots */}
          {candidates.length > 1 && (
            <div className="cut-day-nav-dots">
              {candidates.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`cut-day-nav-dot ${i === clampedIndex ? 'cut-day-nav-dot--active' : ''}`}
                  onClick={() => setCurrentIndex(i)}
                />
              ))}
            </div>
          )}
        </>
      ) : remaining > 0 ? (
        <div className="cut-day-empty">
          <p className="body" style={{ margin: 0, fontSize: 13, color: 'var(--silver)' }}>
            No more waiveable players — use Trade for room.
          </p>
        </div>
      ) : null}

      {/* Secondary actions */}
      <div className="cut-day-secondary">
        {onOpenRoster && (
          <button type="button" className="btn btn-ghost cut-day-sec-btn" onClick={onOpenRoster}>
            View full roster
          </button>
        )}
        {onOpenTrades && (
          <button type="button" className="btn btn-ghost cut-day-sec-btn" onClick={onOpenTrades}>
            Trade for room
          </button>
        )}
      </div>
    </div>
  );
}

function SliderCard({ player, dim, onClick }: { player: Player; dim?: boolean; onClick?: () => void }) {
  return (
    <div className={`cut-day-card ${dim ? 'cut-day-card--dim' : ''}`} onClick={onClick} style={dim ? { cursor: 'pointer' } : undefined}>
      <div className="cut-day-card-player">
        <PlayerAvatar player={player} size={52} />
        <div className="cut-day-card-info">
          <p className="cut-day-card-name">{playerName(player)}</p>
          <p className="cut-day-card-meta">{player.position} · Age {player.age}</p>
          <p className="cut-day-card-ovr">
            <span className="cut-day-card-ovr-num">{player.overall}</span>
            <span className="cut-day-card-ovr-tier"> OVR · {ovrTier(player.overall)}</span>
          </p>
        </div>
      </div>
      <div className="cut-day-card-contract">
        <p className="cut-day-card-salary">{formatMoney(player.contract.annualSalary)}</p>
        <p className="cut-day-card-years">{player.contract.yearsRemaining}yr left</p>
      </div>
    </div>
  );
}
