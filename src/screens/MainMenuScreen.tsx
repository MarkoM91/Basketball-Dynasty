import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatSavedAt } from '../lib/saveFile';
import { useGameStore } from '../store/gameStore';
import { SCENARIOS } from '../data/scenarios';
import { franchiseRegularSeasonRecord } from '../engine/regularSeasonRecord';
import { calendarLabel, phaseLabel } from '../engine/simulation';
import { TeamLogo } from '../components/TeamLogo';
import { LandingFooter, LandingHeader } from '../components/LandingChrome';
import { LandingSeoSection } from '../components/LandingSeoSection';
import { Icon } from '../components/Icon';

const FEATURES = [
  { icon: 'play' as const, title: 'Set your starting five', body: 'Pick your lineup before every game. Matchups matter — your rotation choices affect the outcome.' },
  { icon: 'scout' as const, title: 'Imperfect-scouting draft', body: '60 picks, scout ranges, lottery odds, and bust risk on every board.' },
  { icon: 'trade' as const, title: 'Trade war room', body: 'Block players, counter offers, and negotiate with AI front offices.' },
  { icon: 'coach' as const, title: 'Hire & fire coaches', body: 'Sign or cut your head coach each offseason. Development and playoff ratings shape your ceiling.' },
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
  } = useGameStore();
  const [confirmingNew, setConfirmingNew] = useState(false);

  // In-page confirmation instead of window.confirm(): in-app browsers and some mobile web views
  // block native dialogs, which made confirm() return false silently and the button do nothing.
  const startNewFranchise = () => {
    setConfirmingNew(false);
    if (started) resetGame();
    else resetOnboarding();
    navigate('/start');
  };

  const handleNewGame = () => {
    if (started && !confirmingNew) {
      setConfirmingNew(true);
      return;
    }
    startNewFranchise();
  };

  /* ── RETURNING USER ─────────────────────────────────────────── */
  if (started && franchise) {
    const r = franchiseRegularSeasonRecord(franchise, league ?? undefined);
    return (
      <div className="landing-page">
        <div className="bg-mesh" aria-hidden="true" />
        <div className="bg-grain" aria-hidden="true" />
        <LandingHeader />


        <div className="mm-return-layout">
          {/* Continue card */}
          <div className="mm-return-card panel panel-accent">
            {/* Team header */}
            <div className="mm-return-team">
              <TeamLogo city={franchise.city} name={franchise.name} size={64} />
              <div>
                <p className="eyebrow" style={{ marginBottom: 2 }}>Continue dynasty</p>
                <p className="title-md" style={{ margin: 0 }}>{franchise.city} {franchise.name}</p>
                <p className="body" style={{ fontSize: 12, marginTop: 4, color: 'var(--silver)' }}>
                  Season {franchise.season} · {calendarLabel(franchise)} · {r.wins}–{r.losses}
                </p>
              </div>
            </div>

            {/* Status row */}
            <div className="mm-return-status">
              <div className="mm-return-stat">
                <span className="mm-return-stat-label">Phase</span>
                <span className="mm-return-stat-value">{phaseLabel(franchise.phase)}</span>
              </div>
              {selectedScenario && (
                <div className="mm-return-stat">
                  <span className="mm-return-stat-label">Scenario</span>
                  <span className="mm-return-stat-value">{SCENARIOS[selectedScenario].title}</span>
                </div>
              )}
              <div className="mm-return-stat">
                <span className="mm-return-stat-label">Roster</span>
                <span className="mm-return-stat-value">{franchise.roster.length} players</span>
              </div>
            </div>

            {/* Primary CTA */}
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 20, padding: '14px 0', fontSize: 16 }}
              onClick={() => navigate('/office')}
            >
              Open front office →
            </button>

            {/* Secondary actions */}
            <div className="mm-return-secondary">
              {confirmingNew ? (
                <div className="mm-confirm" role="alertdialog" aria-label="Start a new franchise?">
                  <p>
                    Retire {franchise.city} {franchise.name} and start over? This save will be deleted.
                  </p>
                  <div className="mm-confirm-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setConfirmingNew(false)}>
                      Keep playing
                    </button>
                    <button type="button" className="btn btn-primary mm-confirm-danger" onClick={startNewFranchise}>
                      Yes, start new
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost mm-return-sec-btn" onClick={handleNewGame}>
                  New franchise
                </button>
              )}
            </div>

            {lastSavedAt && (
              <p className="mono" style={{ fontSize: 10, marginTop: 12, color: 'var(--silver)', textAlign: 'center' }}>
                Last saved {formatSavedAt(lastSavedAt)}
              </p>
            )}
          </div>
        </div>

        <LandingSeoSection />
        <LandingFooter logoLinksHome />
      </div>
    );
  }

  /* ── NEW USER ────────────────────────────────────────────────── */
  return (
    <div className="landing-page">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />
      <LandingHeader />

      <div className="landing-layout">
        <div className="landing-hero">
          <p className="eyebrow">Free online basketball manager game</p>
          <h1 className="title-lg landing-headline">
            Build a <span className="landing-headline-accent">dynasty</span>.{' '}
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
                <span className="landing-feature-icon"><Icon name={feature.icon} size={20} /></span>
                <p className="landing-feature-title">{feature.title}</p>
                <p className="body landing-feature-body" style={{ fontSize: 12, margin: 0 }}>{feature.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-stack">
          <div className="landing-cta-card">
            <p className="eyebrow">Get started</p>
            <p className="body landing-cta-copy" style={{ marginTop: 6 }}>
              Pick a scripted scenario or choose any of 30 franchises — logos, cap sheets, and rosters included.
            </p>
            <button type="button" className="btn btn-primary landing-play-btn" onClick={handleNewGame}>
              <Icon name="play" size={16} /> Start new franchise
            </button>
          </div>
        </div>
      </div>

      <LandingSeoSection />
      <LandingFooter logoLinksHome />
    </div>
  );
}
