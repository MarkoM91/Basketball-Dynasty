import type { LeagueTeam } from '../types/game';
import { strategyLabel } from '../data/league';
import { formatWinPct } from '../engine/leagueSimulation';
import { TeamLogo } from './TeamLogo';
function gamesBack(first: LeagueTeam, team: LeagueTeam): string {
  if (team.id === first.id) return '—';
  const gb = ((first.wins - team.wins) + (team.losses - first.losses)) / 2;
  if (gb <= 0) return '—';
  return gb % 1 === 0 ? String(gb) : gb.toFixed(1);
}

function marginOfVictory(team: LeagueTeam): number {
  return Math.round((team.ppgFor - team.ppgAgainst) * 10) / 10;
}

export function StandingsTable({
  teams,
  userTeamId,
  compact,
  onTeamClick,
}: {
  teams: LeagueTeam[];
  userTeamId?: string;
  compact?: boolean;
  onTeamClick?: (team: LeagueTeam) => void;
}) {
  const leader = teams[0];

  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>W</th>
            <th>L</th>
            <th>Win%</th>
            {!compact && <th>GB</th>}
            <th title="Points scored per game">PS</th>
            <th title="Points allowed per game">PA</th>
            {!compact && <th title="Point differential per game">MOV</th>}
            {!compact && <th>STR</th>}
            <th>{compact ? 'Mode' : 'Strategy'}</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => {
            const isUser = t.isUser || t.id === userTeamId;
            const mov = marginOfVictory(t);
            return (
              <tr key={t.id} className={isUser ? 'standings-user-row' : undefined}>
                <td className="standings-rank">{i + 1}</td>
                <td className="standings-team">
                  {onTeamClick ? (
                    <button type="button" className="standings-team-btn" onClick={() => onTeamClick(t)}>
                      <div className="standings-team-cell">
                        <TeamLogo city={t.city} name={t.name} size={28} />
                        <span className="standings-team-name">{compact ? t.abbrev ?? t.name : t.fullName}</span>
                        {isUser && <span className="chip chip-gold" style={{ marginLeft: 6 }}>YOU</span>}
                      </div>
                    </button>
                  ) : (
                    <div className="standings-team-cell">
                      <TeamLogo city={t.city} name={t.name} size={28} />
                      <span className="standings-team-name">{compact ? t.abbrev ?? t.name : t.fullName}</span>
                      {isUser && <span className="chip chip-gold" style={{ marginLeft: 6 }}>YOU</span>}
                    </div>
                  )}
                </td>
                <td className="standings-num success">{t.wins}</td>
                <td className="standings-num">{t.losses}</td>
                <td className="standings-num mono">{formatWinPct(t.wins, t.losses)}</td>
                {!compact && <td className="standings-num mono">{leader ? gamesBack(leader, t) : '—'}</td>}
                <td className="standings-num mono">{t.ppgFor.toFixed(1)}</td>
                <td className="standings-num mono">{t.ppgAgainst.toFixed(1)}</td>
                {!compact && (
                  <td className={`standings-num mono ${mov > 0 ? 'success' : mov < 0 ? 'danger' : ''}`}>
                    {mov > 0 ? '+' : ''}{mov.toFixed(1)}
                  </td>
                )}
                {!compact && <td className="standings-num mono">{Math.round(t.strength)}</td>}
                <td className="standings-strategy">{strategyLabel(t.strategy)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
