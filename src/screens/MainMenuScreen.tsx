import { useNavigate } from 'react-router-dom';
import { formatSavedAt } from '../lib/saveFile';
import { useGameStore } from '../store/gameStore';
import { SCENARIOS } from '../data/scenarios';
import { franchiseRegularSeasonRecord } from '../engine/regularSeasonRecord';
import { phaseLabel } from '../engine/simulation';
import { TeamLogo } from '../components/TeamLogo';
import { LandingFooter, LandingHeader } from '../components/LandingChrome';
import { LandingPreview } from '../components/LandingPreview';
import { LandingSeoSection } from '../components/LandingSeoSection';

const FEATURES = [
  { icon: '🎯', title: 'Imperfect-scouting draft', body: '60 picks, scout ranges, lottery odds, and bust risk on every board.' },
  { icon: '🔄', title: 'Trade war room', body: 'Block players, counter offers, and negotiate with AI front offices.' },
  { icon: '🏆', title: 'Full playoff bracket', body: 'Best-of-seven rounds, play-in tension, and dynasty memory.' },
  { icon: '📈', title: 'Finances & cap', body: 'Luxury tax, MLE room, ticket revenue, and ownership patience.' },
];

export function MainMenuScreen() {
  const navigate = useNavigate();
  const {
    started,
    franchise,
    league,
    selectedScenario,
    lastSavedAt,
    resetGame,
    resetOnboarding,
    exportSave,
    importSave,
  } = useGameStore();

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const ok = importSave(text);
      if (ok) navigate('/office');
    };
    input.click();
  };

  const handleNewGame = () => {
    if (started && !window.confirm('Retire your current dynasty and start a new franchise?')) return;
    if (started) resetGame();
    else resetOnboarding();
    navigate('/start');
  };

  return (
    <div className="landing-page">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />

      <LandingHeader />

      <div className="landing-layout">
        {started && franchise && (
          <div className="panel panel-accent landing-card landing-continue-card landing-continue-slot">
            <div className="landing-continue-head">
              <TeamLogo city={franchise.city} name={franchise.name} size={52} />
              <div>
                <p className="eyebrow">Continue dynasty</p>
                <p className="title-md" style={{ margin: 0 }}>{franchise.city} {franchise.name}</p>
              </div>
            </div>
            <p className="body landing-continue-summary" style={{ marginTop: 10 }}>
              Season {franchise.season}, Week {franchise.week} ·{' '}
              {(() => {
                const r = franchiseRegularSeasonRecord(franchise, league ?? undefined);
                return `${r.wins}–${r.losses}`;
              })()}
            </p>
            <div className="landing-continue-meta">
              <p className="body" style={{ fontSize: 12, marginTop: 4 }}>
                {phaseLabel(franchise.phase)}
                {selectedScenario ? ` · ${SCENARIOS[selectedScenario].title}` : ''}
              </p>
              {lastSavedAt && (
                <p className="mono" style={{ fontSize: 11, marginTop: 8, color: 'var(--silver)' }}>
                  Last saved {formatSavedAt(lastSavedAt)}
                </p>
              )}
            </div>
            <button type="button" className="btn btn-primary" style={{ marginTop: 14, width: '100%' }} onClick={() => navigate('/office')}>
              Open front office
            </button>
          </div>
        )}

        <div className="landing-hero">
          <p className="eyebrow">Free online basketball manager game</p>
          <h1 className="title-lg landing-headline">
            Build a <span className="landing-headline-accent">dynasty</span>.
            <br />
            Or get fired trying.
          </h1>
          <p className="body landing-copy landing-copy-full">
            Browser basketball GM simulation with trades, salary cap, two-round draft, free agency,
            playoff bracket, and franchise memory. Play free — no download, saves on this device.
          </p>
          <p className="body landing-copy landing-copy-short">
            Free browser basketball manager. Trades, cap, draft, playoffs — no install.
          </p>

          <div className="landing-trust">
            <div><strong>30</strong><span>teams</span></div>
            <div><strong>16</strong><span>playoff seeds</span></div>
            <div><strong>0–100</strong><span>ratings</span></div>
            <div><strong>0</strong><span>install</span></div>
          </div>

          <div className="landing-feature-grid">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="landing-feature-card">
                <span className="landing-feature-icon" aria-hidden>{feature.icon}</span>
                <p className="landing-feature-title">{feature.title}</p>
                <p className="body landing-feature-body" style={{ fontSize: 12, margin: 0 }}>{feature.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-stack">
          <div className="landing-cta-card">
            <p className="eyebrow">{started ? 'New dynasty' : 'Get started'}</p>
            <p className="body landing-cta-copy" style={{ marginTop: 6 }}>
              Pick a scripted scenario or choose any of 30 franchises — logos, cap sheets, and rosters included.
            </p>
            <button type="button" className="btn btn-primary landing-play-btn" onClick={handleNewGame}>
              {started ? 'Start new franchise' : '▶ Start new franchise'}
            </button>
          </div>

          <div className="landing-extra">
            <LandingPreview />

            <div className="panel landing-card">
              <p className="eyebrow">Dynasty files</p>
              <p className="body">Export your save to back up a long rebuild, or import on another device.</p>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" disabled={!started} onClick={() => exportSave()}>
                  Export save file
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleImport}>
                  Import save file
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <LandingSeoSection />

      <LandingFooter logoLinksHome />
    </div>
  );
}
