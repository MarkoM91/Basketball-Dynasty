import { Link } from 'react-router-dom';
import { LogoHex } from './LandingChrome';
import { formatSavedAt } from '../lib/saveFile';
import { calendarLabel, phaseLabel } from '../engine/simulation';
import { franchiseRegularSeasonRecord } from '../engine/regularSeasonRecord';
import { TeamLogo } from './TeamLogo';
import { Icon, type IconName } from './Icon';
import { useGameStore } from '../store/gameStore';
import type { ScreenId, SeasonPhase } from '../types/game';

export function contextualTab(phase: SeasonPhase): { id: ScreenId; label: string; icon: IconName } {
  if (phase === 'playoffs') return { id: 'playoffs', label: 'Playoffs', icon: 'playoffs' };
  if (phase === 'free_agency') return { id: 'free_agency', label: 'Free agency', icon: 'free-agency' };
  if (phase === 'contract_renewals') return { id: 'contract_renewals', label: 'Renewals', icon: 'renewals' };
  if (phase === 'draft_scouting' || phase === 'draft_night') return { id: 'draft', label: 'Draft', icon: 'draft' };
  if (phase === 'regular_season' || phase === 'trade_deadline') {
    return { id: 'play_game', label: 'Play game', icon: 'play' };
  }
  return { id: 'league', label: 'League', icon: 'league' };
}

export const CORE: { id: ScreenId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Front office', icon: 'office' },
  { id: 'roster', label: 'Roster', icon: 'roster' },
  { id: 'trade', label: 'Trades', icon: 'trade' },
  { id: 'cap', label: 'Cap desk', icon: 'cap' },
];

export const MORE: { id: ScreenId; label: string; icon: IconName }[] = [
  { id: 'schedule', label: 'Schedule', icon: 'schedule' },
  { id: 'finances', label: 'Finances', icon: 'finances' },
  { id: 'league', label: 'League table', icon: 'league' },
  { id: 'results', label: 'Box scores', icon: 'scores' },
  { id: 'coach', label: 'Coaching', icon: 'coach' },
  { id: 'development', label: 'Development', icon: 'development' },
  { id: 'draft', label: 'Draft board', icon: 'draft' },
  { id: 'free_agency', label: 'Free agency', icon: 'free-agency' },
  { id: 'playoffs', label: 'Playoffs', icon: 'playoffs' },
  { id: 'media', label: 'Media', icon: 'media' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'ghosts', label: 'Ghosts', icon: 'ghost' },
];

/** Export / import save actions — shared by the desktop sidebar and the mobile More sheet. */
export function useSaveFileActions() {
  const exportSave = useGameStore((s) => s.exportSave);
  const importSave = useGameStore((s) => s.importSave);
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
  return { exportSave, handleImport };
}

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
  const { exportSave, handleImport } = useSaveFileActions();

  if (!franchise) return null;

  const record = franchiseRegularSeasonRecord(franchise, league ?? undefined);
  const seasonTab = contextualTab(franchise.phase);

  const navBtn = (item: { id: ScreenId; label: string; icon: IconName }) => (
    <button
      key={item.id}
      type="button"
      className={`desktop-nav-item ${screen === item.id ? 'active' : ''}`}
      onClick={() => onNavigate(item.id)}
    >
      <span className="desktop-nav-icon"><Icon name={item.icon} size={17} /></span>
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
            S{franchise.season} · {calendarLabel(franchise, true)} · {record.wins}–{record.losses}
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
          Season {franchise.season} · {calendarLabel(franchise)}
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
