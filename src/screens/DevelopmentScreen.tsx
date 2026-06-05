import { DEV_PLANS } from '../engine/trades';
import { playerName } from '../data/scenarios';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { PlayerRatingsPanel } from '../components/PlayerRatingsPanel';
import { useGameStore } from '../store/gameStore';
import type { DevFocus, Player, Position } from '../types/game';
import { Panel } from '../components/UI';

const FOCUSES = Object.keys(DEV_PLANS) as DevFocus[];

const POSITION_FOCUS: Record<Position, DevFocus[]> = {
  PG: ['Primary Ball Handler', 'Defensive Stopper', 'Catch-and-Shoot Wing', 'Sixth Man Scorer', 'Off-Ball Movement'],
  SG: ['Catch-and-Shoot Wing', 'Sixth Man Scorer', 'Primary Ball Handler', 'Defensive Stopper', 'Off-Ball Movement'],
  SF: ['Catch-and-Shoot Wing', 'Defensive Stopper', 'Off-Ball Movement', 'Sixth Man Scorer', 'Primary Ball Handler'],
  PF: ['Stretch Big', 'Playmaking Big', 'Defensive Stopper', 'Rim Protector', 'Strength & Conditioning'],
  C: ['Rim Protector', 'Stretch Big', 'Playmaking Big', 'Strength & Conditioning', 'Defensive Stopper'],
};

function orderedFocuses(position: Position, current?: DevFocus): DevFocus[] {
  const preferred = POSITION_FOCUS[position];
  const rest = FOCUSES.filter((f) => !preferred.includes(f));
  const list = [...preferred, ...rest];
  if (current && !list.slice(0, 5).includes(current)) {
    return [current, ...list.filter((f) => f !== current)];
  }
  return list;
}

function devProgress(overall: number, potential: number): number {
  if (potential <= overall) return 100;
  const floor = Math.max(50, overall - 15);
  return Math.round(((overall - floor) / (potential - floor)) * 100);
}

function statLine(p: Player): string {
  const s = p.seasonStats;
  if (!s || s.games === 0) return 'No games yet';
  return `${s.ppg.toFixed(1)} / ${s.rpg.toFixed(1)} / ${s.apg.toFixed(1)}`;
}

function DevTrendBadge({ trend }: { trend: Player['devTrend'] }) {
  const cls =
    trend === 'Up' ? 'chip chip-success' : trend === 'Down' ? 'chip chip-danger' : trend === 'Stalled' ? 'chip chip-warning' : 'chip';
  return <span className={cls}>Dev {trend}</span>;
}

function DevPlayerCard({
  player,
  onAssign,
}: {
  player: Player;
  onAssign: (focus: DevFocus) => void;
}) {
  const gap = player.potential - player.overall;
  const pct = devProgress(player.overall, player.potential);
  const focuses = orderedFocuses(player.position, player.devFocus).slice(0, 6);
  const stats = player.seasonStats;

  return (
    <Panel className="dev-player-card">
      <div className="dev-player-top">
        <PlayerAvatar player={player} size={56} showOverall={false} />
        <div className="dev-player-identity">
          <p className="dev-player-name">{playerName(player)}</p>
          <div className="player-meta">
            <span className="chip chip-gold">{player.position}</span>
            <span className="chip">{player.role}</span>
            <span className="chip">{player.age} yrs</span>
            <DevTrendBadge trend={player.devTrend} />
          </div>
        </div>
      </div>

      <div className="dev-ratings">
        <div className="dev-rating-block">
          <span className="dev-rating-label">Overall</span>
          <span className="dev-rating-value dev-rating-ovr">{player.overall}</span>
        </div>
        <div className="dev-rating-track">
          <div className="dev-rating-bar">
            <div className="dev-rating-fill" style={{ width: `${pct}%` }} />
            <div className="dev-rating-marker" style={{ left: `${pct}%` }} />
          </div>
          <p className="dev-rating-caption">
            {gap > 0 ? (
              <>
                <strong>+{gap}</strong> room to potential ceiling
              </>
            ) : (
              'At projected ceiling'
            )}
          </p>
        </div>
        <div className="dev-rating-block dev-rating-block-pot">
          <span className="dev-rating-label">Potential</span>
          <span className="dev-rating-value dev-rating-pot">{player.potential}</span>
        </div>
      </div>

      <PlayerRatingsPanel player={player} compact />

      <div className="stat-grid dev-stat-grid">
        <div className="stat-cell">
          <div className="stat-label">Season line</div>
          <div className="stat-value dev-stat-line">{statLine(player)}</div>
          <div className="dev-stat-sub">PTS / REB / AST</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Minutes</div>
          <div className="stat-value">{stats?.games ? stats.mpg.toFixed(1) : player.minutesPerGame}</div>
          <div className="dev-stat-sub">{stats?.games ? `${stats.games} GP` : 'Projected MPG'}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Role</div>
          <div className="stat-value" style={{ fontSize: 13 }}>{player.role}</div>
          <div className="dev-stat-sub">{player.minutesPerGame} MPG plan</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Work ethic</div>
          <div className="stat-value">{player.workEthic}</div>
          <div className="dev-stat-sub">Coach dev {player.devTrend === 'Up' ? 'on track' : 'watch'}</div>
        </div>
      </div>

      {player.gmNote && (
        <p className="body dev-gm-note">
          <strong>Scout note:</strong> {player.gmNote}
        </p>
      )}

      <p className="eyebrow dev-focus-heading">
        Assign development focus
        {player.devFocus && <span className="chip chip-gold dev-active-focus">{player.devFocus}</span>}
      </p>
      <div className="dev-focus-grid">
        {focuses.map((focus) => {
          const plan = DEV_PLANS[focus];
          const active = player.devFocus === focus;
          return (
            <button
              key={focus}
              type="button"
              className={`dev-focus-option ${active ? 'dev-focus-option-active' : ''}`}
              onClick={() => onAssign(focus)}
            >
              <span className="dev-focus-title">{focus}</span>
              <span className="dev-focus-detail">
                <span>↑ {plan.improves}</span>
                <span>⚠ {plan.risk}</span>
                <span>{plan.timeline}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export function DevelopmentScreen() {
  const { franchise, assignDevFocus, setScreen } = useGameStore();
  if (!franchise) return null;

  const developable = franchise.roster
    .filter((p) => p.age < 28 && p.overall < p.potential && !p.injured)
    .sort((a, b) => b.potential - b.overall - (a.potential - a.overall));

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Player development</p>
          <h1 className="title-lg">Development plans</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
      </div>

      <Panel accent>
        <p className="body">
          Overall and potential show where each player is today vs their ceiling. Season stats and role minutes drive how fast they climb.
        </p>
      </Panel>

      {developable.map((p) => (
        <DevPlayerCard key={p.id} player={p} onAssign={(focus) => assignDevFocus(p.id, focus)} />
      ))}

      {developable.length === 0 && (
        <Panel><p className="body">No active development projects. Core is aging or at ceiling.</p></Panel>
      )}
    </div>
  );
}
