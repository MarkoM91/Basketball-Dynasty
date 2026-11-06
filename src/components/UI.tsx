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

export function Toast({ message, onDismiss, mobile }: { message: string; onDismiss: () => void; mobile?: boolean }) {
  return (
    <div className={`toast ${mobile ? 'toast-mobile' : ''}`} role="status" onClick={onDismiss}>
      {message}
    </div>
  );
}

