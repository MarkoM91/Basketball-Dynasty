import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatMoney, playerName } from '../data/scenarios';
import { getTeamById, strategyLabel } from '../data/league';
import { teamRegularSeasonRecord } from '../engine/regularSeasonRecord';
import { generateTeamRoster } from '../engine/leagueRosters';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TeamLogo } from '../components/TeamLogo';
import { ovrTier } from '../lib/playerRatings';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';

export function TeamRosterScreen() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { league, franchise } = useGameStore();

  const team = useMemo(
    () => (league && teamId ? getTeamById(league, teamId) : undefined),
    [league, teamId],
  );

  const roster = useMemo(
    () => (team ? generateTeamRoster(team) : []),
    [team],
  );

  if (!franchise || !league) return <Navigate to="/" replace />;
  if (!teamId) return <Navigate to="/office" replace />;
  if (teamId === franchise.leagueTeamId) return <Navigate to="/roster" replace />;
  if (!team) return <Navigate to="/office" replace />;

  const sorted = [...roster].sort((a, b) => b.overall - a.overall);

  const teamRecord = teamRegularSeasonRecord(team);

  return (
    <div className="page">
      <div className="header-bar">
        <div className="team-roster-hero">
          <TeamLogo city={team.city} name={team.name} size={52} />
          <div>
            <p className="eyebrow">League roster</p>
            <h1 className="title-lg" style={{ margin: 0 }}>{team.fullName}</h1>
            <p className="body" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
              {teamRecord.wins}–{teamRecord.losses} · {strategyLabel(team.strategy)} · STR {Math.round(team.strength)}
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Back</button>
      </div>

      <Panel accent>
        <div className="bbgm-table-wrap">
          <table className="bbgm-table roster-stats-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Age</th>
                <th>Ovr</th>
                <th>Pot</th>
                <th>Role</th>
                <th>Contract</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className={p.isStar ? 'roster-star-row' : undefined}>
                  <td className="roster-player-cell">
                    <div className="roster-player-name">
                      <PlayerAvatar player={p} size={32} />
                      <div>
                        <strong>{playerName(p)}</strong>
                        <span className="roster-player-meta">{ovrTier(p.overall)}</span>
                      </div>
                    </div>
                  </td>
                  <td>{p.position}</td>
                  <td className="roster-stat-num">{p.age}</td>
                  <td className="roster-stat-num roster-ovr">{p.overall}</td>
                  <td className="roster-stat-num">{p.potential}</td>
                  <td>{p.role}</td>
                  <td className="roster-contract">
                    {p.contract.yearsRemaining}yr · {formatMoney(p.contract.annualSalary)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
