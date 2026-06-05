import { getStandings } from '../data/league';
import { franchiseRegularSeasonRecord } from '../engine/regularSeasonRecord';
import { buildSeasonSchedule, scheduleRecord, SEASON_GAME_COUNT } from '../engine/schedule';
import { TeamLogo } from '../components/TeamLogo';
import { useViewTeamRoster } from '../hooks/useViewTeamRoster';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';

export function ScheduleScreen() {
  const { franchise, league, setScreen } = useGameStore();
  const viewTeamRoster = useViewTeamRoster();
  if (!franchise || !league) return null;

  const schedule = buildSeasonSchedule(franchise, league);
  const played = scheduleRecord(schedule);
  const record = franchiseRegularSeasonRecord(franchise, league);
  const upcoming = schedule.filter((g) => !g.played);
  const currentWeek = schedule.filter((g) => g.week === franchise.week);

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Season {franchise.season}</p>
          <h1 className="title-lg">Schedule</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
      </div>

      <Panel accent>
        <div className="stat-grid">
          <div className="stat-cell">
            <div className="stat-label">Record</div>
            <div className="stat-value">{record.wins}–{record.losses}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Scheduled</div>
            <div className="stat-value">{schedule.length} / {SEASON_GAME_COUNT}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Logged</div>
            <div className="stat-value">{played.wins + played.losses}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Week</div>
            <div className="stat-value">{franchise.week} / 26</div>
          </div>
        </div>
      </Panel>

      {currentWeek.length > 0 && (
        <Panel accent>
          <p className="eyebrow">This week — Week {franchise.week}</p>
          {currentWeek.map((g) => (
            <ScheduleRow key={g.id} game={g} onTeamClick={viewTeamRoster} />
          ))}
        </Panel>
      )}

      <Panel>
        <p className="eyebrow">Upcoming</p>
        {upcoming.slice(0, 12).map((g) => (
          <ScheduleRow key={g.id} game={g} onTeamClick={viewTeamRoster} />
        ))}
        {upcoming.length === 0 && <p className="body">Regular season complete.</p>}
      </Panel>

      <Panel>
        <p className="eyebrow">Standings context</p>
        <p className="body" style={{ fontSize: 12 }}>
          #{getStandings(league).findIndex((t) => t.isUser) + 1} in league · Playoff odds {franchise.playoffOdds}%
        </p>
      </Panel>
    </div>
  );
}

function ScheduleRow({
  game,
  onTeamClick,
}: {
  game: {
    id: string;
    week: number;
    opponentId: string;
    home: boolean;
    opponentName: string;
    played: boolean;
    won?: boolean;
    score?: string;
  };
  onTeamClick?: (teamId: string) => void;
}) {
  const parts = game.opponentName.split(' ');
  const city = parts.slice(0, -1).join(' ') || game.opponentName;
  const name = parts.at(-1) ?? '';

  return (
    <div className={`schedule-row ${game.played ? (game.won ? 'schedule-win' : 'schedule-loss') : ''}`}>
      <span className="schedule-week mono">Wk {game.week}</span>
      <span className="schedule-home">{game.home ? 'vs' : '@'}</span>
      <button
        type="button"
        className="schedule-team-btn"
        onClick={() => onTeamClick?.(game.opponentId)}
      >
        <TeamLogo city={city} name={name} size={28} />
        <span className="schedule-opp">{game.opponentName}</span>
      </button>
      <span className="schedule-result">
        {game.played ? (
          <>
            <strong className={game.won ? 'success' : 'danger'}>{game.won ? 'W' : 'L'}</strong>{' '}
            {game.score}
          </>
        ) : (
          <span className="chip">Upcoming</span>
        )}
      </span>
    </div>
  );
}
