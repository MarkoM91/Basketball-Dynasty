import { buildPlayoffRunSummary } from '../engine/playoffBracket';
import { roundLabel, seriesScoreline, userPlayoffGamePending } from '../engine/playoffs';
import { useGameStore } from '../store/gameStore';
import { PlayoffBracket } from '../components/PlayoffBracket';
import { Panel } from '../components/UI';

export function PlayoffsScreen() {
  const { franchise, league, advancePlayoffGame, simPlayoffSeries, setScreen, watchPlayoffs } = useGameStore();

  if (!franchise || !league) return null;

  if (!franchise.playoffs) {
    return (
      <div className="page">
        <div className="header-bar">
          <div>
            <p className="eyebrow">Playoffs</p>
            <h1 className="title-lg">League bracket</h1>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
        </div>
        <Panel accent>
          <p className="body" style={{ margin: 0 }}>
            The playoff bracket is not loaded yet. Start it to follow the top 16 even if your team missed out.
          </p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={watchPlayoffs}>
            Load playoff bracket
          </button>
        </Panel>
      </div>
    );
  }

  const po = franchise.playoffs;
  const userTeamId = franchise.leagueTeamId;
  const userSeries = po.series.filter((s) => s.userInvolved && !s.complete);
  const userGamePending = userPlayoffGamePending(po, league);
  const runSummary = buildPlayoffRunSummary(po, league, userTeamId);
  const spectating = !franchise.madePlayoffs || po.userResult === 'Missed playoffs';

  const handleNextGame = () => {
    if (userGamePending) {
      setScreen('play_game');
      return;
    }
    advancePlayoffGame();
  };

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Playoff command center</p>
          <h1 className="title-lg">{roundLabel(po.round)}</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
      </div>

      <PlayoffBracket state={po} league={league} userTeamId={userTeamId} />

      {spectating && po.round !== 'Complete' && (
        <Panel warning>
          <p className="eyebrow">Spectating</p>
          <p className="body" style={{ margin: 0 }}>
            You missed the top 16. Sim league games round-by-round to follow the championship bracket.
          </p>
        </Panel>
      )}

      {po.userEliminated && !spectating && po.round !== 'Complete' && (
        <Panel danger>
          <p className="eyebrow">Eliminated</p>
          <p className="body">{runSummary} The bracket below updates as you sim each round.</p>
        </Panel>
      )}

      <Panel accent>
        <div className="stat-grid">
          <div className="stat-cell">
            <div className="stat-label">Round</div>
            <div className="stat-value">{roundLabel(po.round)}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Field</div>
            <div className="stat-value">16 teams</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Your run</div>
            <div className="stat-value" style={{ fontSize: 12 }}>
              {spectating
                ? 'Watching'
                : po.userResult ?? (po.userEliminated ? 'Eliminated' : 'Alive')}
            </div>
          </div>
        </div>
      </Panel>

      {userSeries.length > 0 && (
        <Panel accent>
          <p className="eyebrow">Your active series</p>
          {userSeries.map((series) => (
            <p key={series.id} className="title-md" style={{ fontSize: 14, margin: 0 }}>
              {seriesScoreline(series, league)}
            </p>
          ))}
        </Panel>
      )}

      {po.active && (
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-primary" onClick={handleNextGame}>
            {userGamePending
              ? 'Set starting five & play'
              : spectating
                ? 'Sim next league game'
                : userSeries.length
                  ? 'Sim next playoff game'
                  : 'Sim league games'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={simPlayoffSeries}>
            {spectating || po.userEliminated ? 'Sim this round' : 'Sim round to completion'}
          </button>
        </div>
      )}

      {po.round === 'Complete' && (
        <Panel accent>
          <p className="eyebrow">Champion</p>
          <p className="title-md">{po.championName ?? 'TBD'}</p>
          {spectating && (
            <p className="body" style={{ marginTop: 8 }}>
              {runSummary}
            </p>
          )}
          <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setScreen('home')}>
            Season review
          </button>
        </Panel>
      )}
    </div>
  );
}
