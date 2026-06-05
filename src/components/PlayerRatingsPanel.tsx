import type { Player } from '../types/game';
import {
  COMPACT_RATING_KEYS,
  derivePlayerRatings,
  ovrTier,
  playerHeightLabel,
  RATING_ROWS,
} from '../lib/playerRatings';

export function PlayerRatingsPanel({
  player,
  compact = false,
}: {
  player: Player;
  compact?: boolean;
}) {
  const ratings = derivePlayerRatings(player);

  if (compact) {
    return (
      <div className="ratings-compact">
        <div className="ratings-compact-grid">
          {COMPACT_RATING_KEYS.map(({ key, label }) => (
            <span key={key} className="ratings-compact-cell" title={label}>
              <span className="ratings-compact-label">{label}</span>
              <strong>{ratings[key]}</strong>
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ratings-panel">
      <div className="ratings-header">
        <div>
          <span className="ratings-ovr">{ratings.ovr}</span>
          <span className="ratings-tier">{ovrTier(ratings.ovr)}</span>
        </div>
        <div className="ratings-pot-block">
          <span className="ratings-label">Potential</span>
          <strong>{ratings.pot}</strong>
        </div>
        <div className="ratings-pot-block">
          <span className="ratings-label">Height</span>
          <strong>{playerHeightLabel(player)}</strong>
        </div>
      </div>
      <div className="ratings-grid">
        {RATING_ROWS.map(({ key, label, abbr }) => (
          <div key={key} className="rating-row">
            <span className="rating-name" title={label}>{abbr ?? label}</span>
            <div className="rating-bar-track">
              <div className="rating-bar-fill" style={{ width: `${ratings[key]}%` }} />
            </div>
            <span className="rating-num">{ratings[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
