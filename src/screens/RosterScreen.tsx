import { formatMoney, playerName } from '../data/scenarios';
import { ROSTER_SIZE } from '../data/rosterBuilder';
import { formatCapBar } from '../engine/cap';
import { estimatePER, statDelta } from '../engine/stats';
import { playerHeightLabel, ovrTier } from '../lib/playerRatings';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { isPlayerOnBlock } from '../engine/tradeBlock';
import { isRookie, rosterRookies, rookiePickLabel } from '../engine/rookies';
import { waiveablePlayers } from '../engine/rosterCuts';
import { useGameStore } from '../store/gameStore';
import type { Player, PlayerSeasonStats } from '../types/game';
import { Panel } from '../components/UI';

function formatStat(value: number, digits = 1): string {
  return value.toFixed(digits);
}

function StatCell({
  value,
  prior,
  digits = 1,
  empty = '—',
}: {
  value: number | null;
  prior?: number;
  digits?: number;
  empty?: string;
}) {
  if (value === null) return <td className="roster-stat-num">{empty}</td>;
  const delta = prior !== undefined ? statDelta(value, prior) : null;
  return (
    <td className="roster-stat-num">
      <span>{formatStat(value, digits)}</span>
      {delta !== null && delta !== 0 && (
        <span className={`stat-delta ${delta > 0 ? 'stat-delta-up' : 'stat-delta-down'}`}>
          {delta > 0 ? '+' : ''}{formatStat(delta, digits)}
        </span>
      )}
    </td>
  );
}

function playerStatsRow(p: Player): {
  stats: PlayerSeasonStats | null;
  prior: PlayerSeasonStats | undefined;
  per: number | null;
  priorPer: number | null;
} {
  const stats = p.seasonStats && p.seasonStats.games > 0 ? p.seasonStats : null;
  const prior =
    p.priorSeasonStats && p.priorSeasonStats.games > 0 ? p.priorSeasonStats : undefined;
  return {
    stats,
    prior,
    per: stats ? estimatePER(stats) : null,
    priorPer: prior ? estimatePER(prior) : null,
  };
}

export function RosterScreen() {
  const { franchise, setScreen, toggleTradeBlockPlayer, releasePlayerContract } = useGameStore();
  if (!franchise) return null;

  const sorted = [...franchise.roster].sort((a, b) => b.overall - a.overall);
  const releaseableIds = new Set(waiveablePlayers(franchise).map((p) => p.id));
  const rookies = rosterRookies(franchise.roster, franchise.season);
  const coach = franchise.coach;
  const priorSeason = franchise.season - 1;
  const preDraft =
    franchise.phase === 'playoffs' ||
    franchise.phase === 'season_review' ||
    franchise.phase === 'draft_scouting' ||
    franchise.phase === 'draft_night';

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Roster portfolio</p>
          <h1 className="title-lg">Team Roster</h1>
          <p className="body" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
            Cap space · <strong style={{ color: 'var(--off-white)' }}>{formatCapBar(franchise.cap.payroll, franchise.cap.capLimit)}</strong>
            {' · '}<strong style={{ color: franchise.roster.length < ROSTER_SIZE ? 'var(--danger, #dc5050)' : 'inherit' }}>{franchise.roster.length}/{ROSTER_SIZE} players</strong>
            {' · '}{rookies.length} rookie{rookies.length === 1 ? '' : 's'}
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
      </div>

      {rookies.length === 0 && preDraft && (
        <Panel>
          <p className="body" style={{ margin: 0, fontSize: 13 }}>
            No rookies on the roster yet — they appear here after <strong>draft night</strong> with a green
            <span className="chip chip-rookie" style={{ margin: '0 6px', verticalAlign: 'middle' }}>Rookie</span>
            tag and pick number in the <strong>Rk</strong> column.
          </p>
        </Panel>
      )}

      <Panel accent className="coach-card">
        <div className="coach-card-row">
          <div className="coach-card-info">
            <p className="eyebrow">Head coach</p>
            <p className="title-md" style={{ margin: 0 }}>{coach.name}</p>
            <p className="body" style={{ fontSize: 12, marginTop: 4 }}>
              {coach.offensiveSystem} · Dev {coach.devRating} · Playoffs {coach.playoffRating}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setScreen('coach')}>
            Manage head coach
          </button>
        </div>
      </Panel>

      <Panel accent>
        <div className="header-bar" style={{ marginBottom: 8 }}>
          <p className="body" style={{ margin: 0, flex: 1 }}>
            Season stats · green/red deltas vs {priorSeason} (when available)
          </p>
          <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setScreen('trade')}>
            Trade block →
          </button>
        </div>

        <div className="bbgm-table-wrap">
          <table className="bbgm-table roster-stats-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Rk</th>
                <th>Pos</th>
                <th>Age</th>
                <th>Ovr</th>
                <th>Pot</th>
                <th>G</th>
                <th>MP</th>
                <th>PTS</th>
                <th>TRB</th>
                <th>AST</th>
                <th>PER</th>
                <th>Contract</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const { stats, prior, per, priorPer } = playerStatsRow(p);
                const onBlock = isPlayerOnBlock(franchise, p.id);
                const rookie = isRookie(p, franchise.season);
                const rk = rookiePickLabel(p, franchise.season);
                const rowClass = [
                  p.isStar ? 'roster-star-row' : '',
                  rookie ? 'roster-rookie-row' : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined;
                return (
                  <tr key={p.id} className={rowClass}>
                    <td className="roster-player-cell">
                      <div className="roster-player-name">
                        <PlayerAvatar player={p} size={32} />
                        <div>
                          <strong>{playerName(p)}</strong>
                          <span className="roster-player-meta">
                            {playerHeightLabel(p)} · {ovrTier(p.overall)}
                            {rookie && <span className="chip chip-rookie" style={{ marginLeft: 6 }}>Rookie</span>}
                            {p.injured && <span className="chip chip-danger" style={{ marginLeft: 6 }}>Out {p.injuryWeeks}w</span>}
                            {p.contract.isRestricted && <span className="chip chip-warning" style={{ marginLeft: 6 }}>RFA</span>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="roster-stat-num">
                      {rk ? (
                        <span className="chip chip-rookie" title="Rookie">{rk}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{p.position}</td>
                    <td className="roster-stat-num">{p.age}</td>
                    <td className="roster-stat-num roster-ovr">
                      <span title={p.hiddenOverall !== undefined ? 'Scouted estimate — true rating still emerging' : undefined}>
                        {p.hiddenOverall !== undefined ? `~${p.hiddenOverall}` : p.overall}
                      </span>
                      {p.prevOverall !== undefined && p.overall !== p.prevOverall && (
                        <span className={`stat-delta ${p.overall > p.prevOverall ? 'stat-delta-up' : 'stat-delta-down'}`}
                          title={`Was ${p.prevOverall} last season`}>
                          {p.overall > p.prevOverall ? '+' : ''}{p.overall - p.prevOverall}
                        </span>
                      )}
                    </td>
                    <td className="roster-stat-num">{p.potential}</td>
                    <td className="roster-stat-num">{stats?.games ?? '—'}</td>
                    <StatCell value={stats?.mpg ?? null} prior={prior?.mpg} />
                    <StatCell value={stats?.ppg ?? null} prior={prior?.ppg} />
                    <StatCell value={stats?.rpg ?? null} prior={prior?.rpg} />
                    <StatCell value={stats?.apg ?? null} prior={prior?.apg} />
                    <StatCell value={per} prior={priorPer ?? undefined} />
                    <td className="roster-contract">
                      {rk && `${rk} · `}
                      {p.contract.yearsRemaining}yr · {formatMoney(p.contract.annualSalary)}
                    </td>
                    <td>
                      <div className="roster-row-actions">
                        <button
                          type="button"
                          className={`btn ${onBlock ? 'btn-primary' : 'btn-ghost'}`}
                          style={{ padding: '4px 8px', fontSize: 10 }}
                          onClick={() => toggleTradeBlockPlayer(p.id)}
                        >
                          {onBlock ? 'Block' : 'Shop'}
                        </button>
                        {releaseableIds.has(p.id) && (
                          <button
                            type="button"
                            className="btn btn-ghost roster-release-btn"
                            style={{ padding: '4px 8px', fontSize: 10 }}
                            onClick={() => releasePlayerContract(p.id)}
                          >
                            Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
