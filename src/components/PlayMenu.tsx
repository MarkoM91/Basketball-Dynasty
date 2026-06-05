import type { SeasonPhase } from '../types/game';
import { phaseLabel } from '../engine/simulation';

export function PlayMenu({
  phase,
  gamesThisWeek,
  gamesPerWeek,
  onPrimary,
  primaryLabel,
  secondaryActions,
}: {
  phase: SeasonPhase;
  gamesThisWeek: number;
  gamesPerWeek: number;
  onPrimary: () => void;
  primaryLabel: string;
  secondaryActions?: { label: string; onClick: () => void }[];
}) {
  const gamesLeft = Math.max(0, gamesPerWeek - gamesThisWeek);

  return (
    <div className="play-menu">
      <div className="play-menu-main">
        <button type="button" className="play-menu-btn" onClick={onPrimary}>
          <span className="play-menu-icon">▶</span>
          <span>
            <span className="play-menu-label">{primaryLabel}</span>
            <span className="play-menu-phase">{phaseLabel(phase)}</span>
          </span>
        </button>
        {phase === 'regular_season' || phase === 'trade_deadline' ? (
          <p className="play-menu-meta">
            {gamesLeft} game{gamesLeft === 1 ? '' : 's'} left this week · 78-game schedule
          </p>
        ) : null}
      </div>
      {secondaryActions && secondaryActions.length > 0 && (
        <div className="play-menu-secondary">
          {secondaryActions.map((action) => (
            <button key={action.label} type="button" className="btn btn-secondary" onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
