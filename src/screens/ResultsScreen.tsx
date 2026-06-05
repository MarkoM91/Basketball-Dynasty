import { franchiseRegularSeasonRecord } from '../engine/regularSeasonRecord';
import { GameResultCard } from '../components/GameResultCard';
import { CourtBackdrop } from '../components/CourtBackdrop';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';

export function ResultsScreen() {
  const { franchise, league, lastWeekSummary, setScreen } = useGameStore();
  if (!franchise) return null;

  const record = franchiseRegularSeasonRecord(franchise, league ?? undefined);

  const log = franchise.gameLog ?? [];
  const lastWeek = franchise.week > 1 ? franchise.week - 1 : franchise.week;
  const thisWeekGames = log.filter((g) => g.week === lastWeek && g.season === franchise.season);
  const recent = log.slice(0, 12);

  return (
    <div className="page page-court">
      <CourtBackdrop compact>
        <div className="header-bar" style={{ marginBottom: 0 }}>
          <div>
            <p className="eyebrow">Box scores</p>
            <h1 className="title-lg">Your results</h1>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
        </div>
        <p className="body" style={{ marginTop: 8 }}>
          Season record {record.wins}–{record.losses} · {log.length} games logged
        </p>
      </CourtBackdrop>

      {thisWeekGames.length > 0 && (
        <Panel accent className="animate-slide-up">
          <p className="eyebrow">Latest week — Week {lastWeek}</p>
          <div className="game-results-grid">
            {thisWeekGames.map((game) => (
              <GameResultCard key={game.id} game={game} highlight />
            ))}
          </div>
        </Panel>
      )}

      {lastWeekSummary && thisWeekGames.length === 0 && (
        <Panel accent>
          <p className="eyebrow">Last simmed week</p>
          <p style={{ margin: 0 }}>{lastWeekSummary.headline}</p>
        </Panel>
      )}

      <Panel>
        <p className="eyebrow">Season game log</p>
        {recent.length === 0 ? (
          <p className="body">No games yet. Advance the week during the regular season to populate scores.</p>
        ) : (
          <div className="game-results-grid">
            {recent.map((game) => (
              <GameResultCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
