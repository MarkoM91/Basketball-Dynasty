import { useGameStore } from '../store/gameStore';
import { MoraleChip, Panel, ProgressBar } from '../components/UI';

export function MediaScreen() {
  const { franchise, setScreen } = useGameStore();
  if (!franchise) return null;

  const o = franchise.ownership;

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Ownership & media</p>
          <h1 className="title-lg">Pressure machine</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('cap')}>Back</button>
      </div>

      <Panel accent>
        <p className="eyebrow">Ownership goal</p>
        <p className="title-md" style={{ fontSize: 15 }}>{o.goal}</p>
        <p className="body" style={{ marginTop: 8 }}>{o.evaluation}</p>
        <ProgressBar value={o.confidence} />
        <p className="body" style={{ marginTop: 8, fontSize: 12 }}>Confidence: {o.confidence}% · Patience: {o.patience}%</p>
      </Panel>

      <Panel danger>
        <p className="eyebrow">Risk</p>
        <p className="body">{o.risk}</p>
      </Panel>

      <Panel>
        <p className="eyebrow">Fan sentiment</p>
        <MoraleChip value={franchise.fanMood} />
        <p className="body" style={{ marginTop: 8 }}>
          {franchise.fanMood === 'Frustrated'
            ? 'Fans question the direction. Rebuild patience is thinning.'
            : franchise.fanMood === 'Happy'
              ? 'Market is buying in. Mistakes will be forgiven — for now.'
              : 'Fan base is watching. Playoff results will move the needle.'}
        </p>
      </Panel>

      <Panel>
        <p className="eyebrow">Media narratives</p>
        {franchise.media.length === 0 ? (
          <p className="body">No major storylines yet.</p>
        ) : (
          franchise.media.map((m) => (
            <div key={m.id} style={{ marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 14, fontStyle: 'italic' }}>&ldquo;{m.headline}&rdquo;</p>
              <p className="mono" style={{ marginTop: 4, color: 'var(--silver)' }}>
                Week {m.week}, Season {m.season}
              </p>
            </div>
          ))
        )}
      </Panel>

      <Panel warning>
        <p className="eyebrow">Suggested narrative</p>
        <p className="body">
          {franchise.window.includes('Rebuild')
            ? '"Is the front office wasting its young core\'s timeline?"'
            : franchise.starHappiness === 'Concerned'
              ? '"Is the front office wasting its star\'s prime?"'
              : '"Can this roster survive a tough Western road trip?"'}
        </p>
      </Panel>
    </div>
  );
}
