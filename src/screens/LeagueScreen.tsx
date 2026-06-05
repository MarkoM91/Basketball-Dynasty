import { useState } from 'react';
import { getStandings, strategyLabel } from '../data/league';
import { StandingsTable } from '../components/StandingsTable';
import { useViewTeamRoster } from '../hooks/useViewTeamRoster';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';

type Tab = 'standings' | 'leaders';

export function LeagueScreen() {
  const { league, franchise, leagueHeadlines, setScreen } = useGameStore();
  const viewTeamRoster = useViewTeamRoster();
  const [tab, setTab] = useState<Tab>('standings');
  if (!league || !franchise) return null;

  const standings = getStandings(league);
  const stats = franchise.leagueStats;
  const userTeam = standings.find((t) => t.isUser);

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">League intelligence</p>
          <h1 className="title-lg">30-team board</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
      </div>

      {userTeam && (
        <Panel accent>
          <div className="stat-grid">
            <div className="stat-cell">
              <div className="stat-label">Your rank</div>
              <div className="stat-value">#{standings.findIndex((t) => t.isUser) + 1}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Record</div>
              <div className="stat-value">{userTeam.wins}–{userTeam.losses}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Strategy</div>
              <div className="stat-value" style={{ fontSize: 12 }}>{strategyLabel(userTeam.strategy)}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-label">Strength</div>
              <div className="stat-value">{Math.round(userTeam.strength)}</div>
            </div>
          </div>
        </Panel>
      )}

      <div className="tab-row">
        <button type="button" className={`tab-btn ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>
          Standings
        </button>
        <button type="button" className={`tab-btn ${tab === 'leaders' ? 'active' : ''}`} onClick={() => setTab('leaders')}>
          Stat leaders
        </button>
      </div>

      {tab === 'standings' && (
        <Panel className="standings-panel">
          <p className="eyebrow">League table — Season {league.season}</p>
          <StandingsTable
            teams={standings}
            userTeamId={franchise.leagueTeamId}
            onTeamClick={(team) => viewTeamRoster(team.id)}
          />
        </Panel>
      )}

      {tab === 'leaders' && stats && (
        <>
          {(['ppg', 'rpg', 'apg'] as const).map((cat) => (
            <Panel key={cat}>
              <p className="eyebrow">{cat === 'ppg' ? 'Points per game' : cat === 'rpg' ? 'Rebounds per game' : 'Assists per game'}</p>
              {stats[cat].map((leader) => (
                <div key={`${cat}-${leader.rank}-${leader.playerName}`} className="leader-row">
                  <span className="standings-rank">{leader.rank}</span>
                  <span className={leader.isUser ? 'leader-user' : ''}>
                    {leader.playerName}
                    <small>{leader.teamName} · {leader.position}</small>
                  </span>
                  <strong>{leader.value}</strong>
                </div>
              ))}
            </Panel>
          ))}
        </>
      )}

      {tab === 'leaders' && !stats && (
        <Panel><p className="body">Play regular-season games to sync league stat leaders.</p></Panel>
      )}

      {leagueHeadlines.length > 0 && (
        <Panel>
          <p className="eyebrow">League movement</p>
          {leagueHeadlines.map((h) => (
            <p key={h} className="body" style={{ margin: '6px 0' }}>{h}</p>
          ))}
        </Panel>
      )}
    </div>
  );
}
