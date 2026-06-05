import {
  RATING_ROWS,
  SKILL_LABELS,
  type SkillBadge,
  ovrTier,
} from '../lib/playerRatings';
import { Panel } from './UI';

const SKILL_ORDER: SkillBadge[] = ['3', 'A', 'B', 'Di', 'Dp', 'Po', 'Ps', 'R', 'V'];

export function RatingsLegend({ compact = false }: { compact?: boolean }) {
  return (
    <Panel className="ratings-legend">
      <p className="eyebrow">How to read player ratings</p>
      <p className="body" style={{ fontSize: 12, marginBottom: 10 }}>
        All skills use a 0–100 scale (higher is better). Overall and potential summarize fit; the bars below break down strengths.
      </p>

      <div className={compact ? 'legend-grid-compact' : 'legend-grid'}>
        <div>
          <p className="stat-label">Skill strengths</p>
          <p className="body" style={{ fontSize: 11, marginBottom: 6, color: 'var(--silver)' }}>
            Earned when a rating crosses the elite threshold (~58–62+).
          </p>
          <ul className="legend-list">
            {SKILL_ORDER.map((key) => (
              <li key={key}>
                <span className="trait-chip trait-chip-legend">{SKILL_LABELS[key]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="stat-label">Attribute bars</p>
          <ul className="legend-list legend-list-plain">
            {RATING_ROWS.map(({ key, label, abbr }) => (
              <li key={key}>
                <strong>{abbr ?? label}</strong>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {!compact && (
          <div>
            <p className="stat-label">Overall tiers</p>
            <ul className="legend-list legend-list-plain">
              {[90, 80, 70, 60, 50].map((ovr) => (
                <li key={ovr}>
                  <strong>{ovr}+</strong>
                  <span>{ovrTier(ovr)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
