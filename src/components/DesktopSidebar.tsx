import { Link } from 'react-router-dom';
import { LogoHex } from './LandingChrome';
import { formatSavedAt } from '../lib/saveFile';
import { phaseLabel } from '../engine/simulation';
import { franchiseRegularSeasonRecord } from '../engine/regularSeasonRecord';
import { TeamLogo } from './TeamLogo';
import { useGameStore } from '../store/gameStore';
import type { ScreenId, SeasonPhase } from '../types/game';

function contextualTab(phase: SeasonPhase): { id: ScreenId; label: string; icon: string } {
  if (phase === 'playoffs') return { id: 'playoffs', label: 'Playoffs', icon: '▶' };
  if (phase === 'free_agency') return { id: 'free_agency', label: 'Free agency', icon: '✦' };
  if (phase === 'contract_renewals') return { id: 'contract_renewals', label: 'Renewals', icon: '📝' };
  if (phase === 'draft_scouting' || phase === 'draft_night') return { id: 'draft', label: 'Draft', icon: '▣' };
  if (phase === 'regular_season' || phase === 'trade_deadline') {
    return { id: 'play_game', label: 'Play game', icon: '▶' };
  }
  return { id: 'league', label: 'League', icon: '◎' };
}

const CORE: { id: ScreenId; label: string; icon: string }[] = [
  { id: 'home', label: 'Front office', icon: '◆' },
  { id: 'roster', label: 'Roster', icon: '▤' },
  { id: 'trade', label: 'Trades', icon: '⇄' },
  { id: 'cap', label: 'Cap desk', icon: '$' },
];

const MORE: { id: ScreenId; label: string; icon: string }[] = [
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'finances', label: 'Finances', icon: '💰' },
  { id: 'league', label: 'League table', icon: '◎' },
  { id: 'results', label: 'Box scores', icon: '■' },
  { id: 'coach', label: 'Coaching', icon: '◉' },
  { id: 'development', label: 'Development', icon: '↗' },
  { id: 'draft', label: 'Draft board', icon: '▣' },
  { id: 'free_agency', label: 'Free agency', icon: '✦' },
  { id: 'playoffs', label: 'Playoffs', icon: '▶' },
  { id: 'media', label: 'Media', icon: '◈' },
  { id: 'history', label: 'History', icon: '⏱' },
  { id: 'ghosts', label: 'Ghosts', icon: '◌' },
];

export function DesktopSidebar({
  screen,
  onNavigate,
}: {
  screen: ScreenId;
  onNavigate: (s: ScreenId) => void;
}) {
  const franchise = useGameStore((s) => s.franchise);
  const league = useGameStore((s) => s.league);
  const lastSavedAt = useGameStore((s) => s.lastSavedAt);
  const exportSave = useGameStore((s) => s.exportSave);
  const importSave = useGameStore((s) => s.importSave);

  if (!franchise) return null;

  const record = franchiseRegularSeasonRecord(franchise, league ?? undefined);
  const seasonTab = contextualTab(franchise.phase);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      importSave(text);
    };
    input.click();
  };

  const navBtn = (item: { id: ScreenId; label: string; icon: string }) => (
    <button
      key={item.id}
      type="button"
      className={`desktop-nav-item ${screen === item.id ? 'active' : ''}`}
      onClick={() => onNavigate(item.id)}
    >
      <span className="desktop-nav-icon">{item.icon}</span>
      {item.label}
    </button>
  );

  return (
    <aside className="desktop-sidebar">
      <div className="desktop-sidebar-brand">
        <Link to="/" className="desktop-logo">
          <span className="desktop-logo-mark"><LogoHex /></span>
          <span>
            <span className="desktop-logo-title">Basketball Dynasty</span>
            <span className="desktop-logo-sub">Browser GM sim</span>
          </span>
        </Link>
      </div>

      <div className="desktop-franchise-card">
        <TeamLogo city={franchise.city} name={franchise.name} size={44} />
        <div>
          <p className="desktop-franchise-label">Your franchise</p>
          <p className="desktop-franchise-name">
            {franchise.city} {franchise.name}
          </p>
          <p className="desktop-franchise-meta">
            S{franchise.season} · Wk {franchise.week} · {record.wins}–{record.losses}
          </p>
        </div>
      </div>

      <nav className="desktop-nav">
        <p className="desktop-nav-group">Command</p>
        {CORE.map(navBtn)}
        {navBtn(seasonTab)}

        <p className="desktop-nav-group">League & legacy</p>
        {MORE.filter((item) => item.id !== seasonTab.id).map(navBtn)}
      </nav>

      <div className="desktop-sidebar-footer">
        <div className="desktop-save-row">
          <button type="button" className="btn btn-ghost desktop-save-btn" onClick={() => exportSave()}>
            Export
          </button>
          <button type="button" className="btn btn-ghost desktop-save-btn" onClick={handleImport}>
            Import
          </button>
        </div>
        <p className="desktop-save-note">
          {lastSavedAt ? `Saved · ${formatSavedAt(lastSavedAt)}` : 'Auto-save on this device'}
        </p>
        <div className="desktop-sidebar-links">
          <Link to="/guide" className="desktop-sidebar-link">How to play</Link>
          <Link to="/compare" className="desktop-sidebar-link">Compare</Link>
          <a href="https://basketballdynasty.com" className="desktop-sidebar-link" target="_blank" rel="noopener">Site</a>
          <a href="https://discord.gg/Uh7Z9j6uS" className="desktop-sidebar-link" target="_blank" rel="noopener">Discord</a>
          <a href="https://www.reddit.com/r/BasketballDynastyGM" className="desktop-sidebar-link" target="_blank" rel="noopener">Reddit</a>
        </div>
      </div>
    </aside>
  );
}

export function DesktopHeader() {
  const franchise = useGameStore((s) => s.franchise);
  const league = useGameStore((s) => s.league);
  if (!franchise) return null;

  const record = franchiseRegularSeasonRecord(franchise, league ?? undefined);

  return (
    <header className="desktop-header">
      <div>
        <p className="desktop-header-eyebrow">
          Season {franchise.season} · Week {franchise.week}
        </p>
        <h1 className="desktop-header-title">
          {franchise.city} {franchise.name}
        </h1>
      </div>
      <div className="desktop-header-pills">
        <span className="chip chip-gold">{phaseLabel(franchise.phase)}</span>
        <span className="chip">
          {record.wins}–{record.losses}
        </span>
        <span className="chip">Job {franchise.jobSecurity}%</span>
      </div>
    </header>
  );
}
