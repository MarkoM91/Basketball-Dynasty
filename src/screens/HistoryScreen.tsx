import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';

export function HistoryScreen() {
  const navigate = useNavigate();
  const { franchise, setScreen, resetGame } = useGameStore();
  if (!franchise) return null;

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Franchise memory</p>
          <h1 className="title-lg">Your timeline</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('cap')}>Back</button>
      </div>

      <Panel accent>
        <p className="body">
          The game remembers the pick you traded, the prospect you passed on, and the contract that haunts your cap sheet.
        </p>
        <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setScreen('ghosts')}>
          View franchise ghosts ({franchise.ghosts?.length ?? 0})
        </button>
      </Panel>

      {franchise.memory.length === 0 ? (
        <Panel><p className="body">No franchise history yet. Make a move that matters.</p></Panel>
      ) : (
        <Panel>
          {franchise.memory.map((mem) => (
            <div key={mem.id} className="memory-item">
              <strong>S{mem.season} W{mem.week}</strong> — {mem.text}
            </div>
          ))}
        </Panel>
      )}

      <button
        type="button"
        className="btn btn-danger"
        style={{ marginTop: 16, width: '100%' }}
        onClick={() => {
          resetGame();
          navigate('/');
        }}
      >
        Retire GM — return to main menu
      </button>
    </div>
  );
}
