import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ScreenId, SeasonPhase } from '../types/game';
import { CORE, MORE, contextualTab, useSaveFileActions } from './DesktopSidebar';

type NavItem = { id: ScreenId; label: string; icon: string };

/**
 * Mobile bottom navigation. The desktop sidebar (hidden < 960px) is the only place most screens
 * were linked from, so phones could never reach Coaching, Development, Free agency, Media, History,
 * Ghosts or save export/import. Layout: Office · Roster · [phase action] · Trades · More.
 */
export function MobileNav({
  screen,
  phase,
  onNavigate,
}: {
  screen: ScreenId;
  phase: SeasonPhase;
  onNavigate: (s: ScreenId) => void;
}) {
  const [open, setOpen] = useState(false);
  const { exportSave, handleImport } = useSaveFileActions();
  const action = contextualTab(phase);

  const tabs: NavItem[] = [
    { id: 'home', label: 'Office', icon: '◆' },
    { id: 'roster', label: 'Roster', icon: '▤' },
    { ...action, label: shortLabel(action.label) },
    { id: 'trade', label: 'Trades', icon: '⇄' },
  ];
  const tabIds = new Set(tabs.map((t) => t.id));
  const sheetItems: NavItem[] = [...CORE, ...MORE].filter(
    (item, i, all) => !tabIds.has(item.id) && all.findIndex((x) => x.id === item.id) === i,
  );
  const moreActive = !tabIds.has(screen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const go = (id: ScreenId) => {
    setOpen(false);
    onNavigate(id);
  };

  return (
    <>
      {open && (
        <div className="more-sheet-backdrop" onClick={() => setOpen(false)}>
          <div
            className="more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="All front-office screens"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="more-sheet-handle" aria-hidden="true" />
            <div className="more-sheet-grid">
              {sheetItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`more-sheet-item ${screen === item.id ? 'active' : ''}`}
                  onClick={() => go(item.id)}
                >
                  <span className="more-sheet-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="more-sheet-footer">
              <button type="button" className="btn btn-ghost" onClick={() => exportSave()}>Export save</button>
              <button type="button" className="btn btn-ghost" onClick={handleImport}>Import save</button>
            </div>
            <div className="more-sheet-links">
              <Link to="/" onClick={() => setOpen(false)}>Main menu</Link>
              <Link to="/guide" onClick={() => setOpen(false)}>How to play</Link>
            </div>
          </div>
        </div>
      )}
      <nav className="nav-bar" aria-label="Game navigation">
        {tabs.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${i === 2 ? 'nav-item-action' : ''} ${screen === item.id ? 'active' : ''}`}
            onClick={() => go(item.id)}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className={`nav-item ${moreActive || open ? 'active' : ''}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="nav-icon" aria-hidden="true">☰</span>
          More
        </button>
      </nav>
    </>
  );
}

function shortLabel(label: string): string {
  if (label === 'Play game') return 'Play';
  if (label === 'Free agency') return 'FA';
  return label;
}
