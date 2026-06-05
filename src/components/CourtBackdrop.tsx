import type { ReactNode } from 'react';

export function CourtBackdrop({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className={`court-backdrop ${compact ? 'court-backdrop-compact' : ''}`}>
      <svg className="court-lines" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect x="0" y="0" width="400" height="200" fill="none" />
        <rect x="20" y="20" width="360" height="160" fill="none" stroke="rgba(201,168,76,0.12)" strokeWidth="2" />
        <line x1="200" y1="20" x2="200" y2="180" stroke="rgba(201,168,76,0.08)" strokeWidth="2" />
        <circle cx="200" cy="100" r="28" fill="none" stroke="rgba(201,168,76,0.1)" strokeWidth="2" />
        <path d="M 20 60 Q 60 100 20 140" fill="none" stroke="rgba(201,168,76,0.08)" strokeWidth="2" />
        <path d="M 380 60 Q 340 100 380 140" fill="none" stroke="rgba(201,168,76,0.08)" strokeWidth="2" />
      </svg>
      <div className="court-backdrop-content">{children}</div>
    </div>
  );
}
