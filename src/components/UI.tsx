import type { MoraleLevel } from '../types/game';

export function moraleChipClass(m: MoraleLevel): string {
  switch (m) {
    case 'Happy': return 'chip chip-success';
    case 'Stable': return 'chip';
    case 'Concerned': return 'chip chip-warning';
    case 'Frustrated':
    case 'Angry': return 'chip chip-danger';
  }
}

export function MoraleChip({ value }: { value: MoraleLevel }) {
  return <span className={moraleChipClass(value)}>{value}</span>;
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Panel({
  children,
  accent,
  danger,
  warning,
  className = '',
}: {
  children: React.ReactNode;
  accent?: boolean;
  danger?: boolean;
  warning?: boolean;
  className?: string;
}) {
  const variant = danger ? 'panel-danger' : warning ? 'panel-warning' : accent ? 'panel-accent' : '';
  return <div className={`panel ${variant} ${className}`.trim()}>{children}</div>;
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="toast" role="status" onClick={onDismiss}>
      {message}
    </div>
  );
}

export function NavBar({
  screen,
  phase,
  onNavigate,
}: {
  screen: string;
  phase?: import('../types/game').SeasonPhase;
  onNavigate: (s: import('../types/game').ScreenId) => void;
}) {
  const fifthTab =
    phase === 'playoffs'
      ? { id: 'playoffs' as const, label: 'Playoffs', icon: '▶' }
      : phase === 'free_agency'
        ? { id: 'free_agency' as const, label: 'FA', icon: '✦' }
        : phase === 'contract_renewals'
          ? { id: 'contract_renewals' as const, label: 'Renew', icon: '📝' }
          : phase === 'draft_scouting' || phase === 'draft_night'
            ? { id: 'draft' as const, label: 'Draft', icon: '▣' }
            : phase === 'regular_season' || phase === 'trade_deadline'
              ? { id: 'play_game' as const, label: 'Play', icon: '▶' }
              : { id: 'league' as const, label: 'League', icon: '◎' };

  const items: { id: import('../types/game').ScreenId; label: string; icon: string }[] = [
    { id: 'home', label: 'Office', icon: '◆' },
    { id: 'roster', label: 'Roster', icon: '▤' },
    { id: 'trade', label: 'Trades', icon: '⇄' },
    { id: 'cap', label: 'Cap', icon: '$' },
    fifthTab,
  ];

  return (
    <nav className="nav-bar">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-item ${screen === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
