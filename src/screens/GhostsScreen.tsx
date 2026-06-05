import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';

const SEVERITY_LABEL: Record<string, string> = {
  minor: 'Minor regret',
  major: 'Major decision',
  haunting: 'Franchise ghost',
};

export function GhostsScreen() {
  const { franchise, setScreen } = useGameStore();
  if (!franchise) return null;

  const ghosts = franchise.ghosts;

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Franchise ghosts</p>
          <h1 className="title-lg">What you gave up</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('history')}>Back</button>
      </div>

      <Panel accent>
        <p className="body">
          Players traded away. Picks mortgaged. Prospects passed on. The league keeps score even when you try to forget.
        </p>
      </Panel>

      {ghosts.length === 0 ? (
        <Panel>
          <p className="body">No ghosts yet. That means you haven&apos;t made a painful enough decision.</p>
        </Panel>
      ) : (
        ghosts.map((ghost) => (
          <Panel key={ghost.id} danger={ghost.severity === 'haunting'} warning={ghost.severity === 'major'}>
            <p className="eyebrow">
              S{ghost.season} W{ghost.week} · {SEVERITY_LABEL[ghost.severity] ?? ghost.severity}
            </p>
            <p className="title-md">{ghost.title}</p>
            <p className="body" style={{ marginTop: 8 }}>{ghost.story}</p>
            {ghost.watchNote && (
              <p className="mono" style={{ marginTop: 8, fontSize: 11 }}>Watch: {ghost.watchNote}</p>
            )}
          </Panel>
        ))
      )}
    </div>
  );
}
