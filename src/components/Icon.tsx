import type { ReactElement } from 'react';

/**
 * Front-office icon set — one consistent stroke family (24px grid, 1.75 stroke, square caps)
 * replacing the mix of emoji and Unicode glyphs (📅 💰 ◆ ▤ ✦ …) that made the UI read like a
 * generic chat app. Icons inherit `currentColor`, so they follow text/active colours.
 */
export type IconName =
  | 'office'
  | 'roster'
  | 'trade'
  | 'cap'
  | 'draft'
  | 'play'
  | 'schedule'
  | 'finances'
  | 'league'
  | 'scores'
  | 'coach'
  | 'development'
  | 'free-agency'
  | 'playoffs'
  | 'media'
  | 'history'
  | 'ghost'
  | 'renewals'
  | 'more'
  | 'check'
  | 'x'
  | 'alert'
  | 'trophy'
  | 'globe'
  | 'scissors'
  | 'scout'
  | 'chevron-right';

const PATHS: Record<IconName, ReactElement> = {
  // Clipboard with a play diagram — the GM's desk.
  office: (
    <>
      <path d="M8 4h8v3H8z" />
      <path d="M6 5.5H4.5v15h15v-15H18" />
      <path d="M8.5 12l2 2M10.5 12l-2 2M14 16.5a1.75 1.75 0 1 0 0-.01" />
      <path d="M11.5 13.5l2.5 1.5" />
    </>
  ),
  // Jersey.
  roster: (
    <>
      <path d="M8 3.5 4 6v5l3-1v10.5h10V10l3 1V6l-4-2.5" />
      <path d="M8 3.5c.6 1.6 2.2 2.6 4 2.6s3.4-1 4-2.6" />
      <path d="M10.5 12.5h3M12 12.5v4" />
    </>
  ),
  trade: (
    <>
      <path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5" />
      <path d="M20 16H6M9.5 12.5 6 16l3.5 3.5" />
    </>
  ),
  cap: (
    <>
      <path d="M3.5 6.5h17v11h-17z" />
      <path d="M14.2 9.5c-.4-.6-1.2-1-2.2-1-1.3 0-2.2.7-2.2 1.6 0 2.1 4.5 1.2 4.5 3.4 0 .9-1 1.6-2.3 1.6-1 0-1.9-.4-2.3-1.1" />
      <path d="M12 7.5v1M12 15.5v1" />
    </>
  ),
  // Podium with numbered steps.
  draft: (
    <>
      <path d="M9 9.5h6v11H9zM3.5 13.5H9v7H3.5zM15 15.5h5.5v5H15z" />
      <path d="M12 4.5v2.5M11 5.2l1-.7" />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5z" />,
  schedule: (
    <>
      <path d="M4 6h16v14H4zM4 10h16M8.5 3.5V8M15.5 3.5V8" />
      <path d="M8 13.5h2v2H8z" />
    </>
  ),
  finances: <path d="M4 20h16M6.5 16.5v-5M10.5 16.5V8M14.5 16.5v-3.5M18.5 16.5V5" />,
  // Standings table.
  league: (
    <>
      <path d="M4 4.5h16v15H4zM4 9h16M4 14.25h16M9.5 4.5v15" />
    </>
  ),
  // Scoreboard.
  scores: (
    <>
      <path d="M3.5 6.5h17v11h-17zM12 6.5v11" />
      <path d="M6.5 10v4M9 10h-1.5M15.5 10h2v2h-2v2h2" />
    </>
  ),
  // Whistle.
  coach: (
    <>
      <path d="M13 9.5a5 5 0 1 1-4.7 6.6" />
      <path d="M8.3 16.1 3.5 14v-4.5H20V14h-5.5" />
      <path d="M6 9.5V6.5" />
    </>
  ),
  development: (
    <>
      <path d="M3.5 18.5 9.5 12.5l3.5 3.5 7.5-8.5" />
      <path d="M15 7.5h5.5V13" />
    </>
  ),
  // Signed contract.
  'free-agency': (
    <>
      <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
      <path d="M9 9.5h6M9 13h4" />
      <path d="M8.5 17.5c1-1.2 1.8-1.2 2.4 0 .6 1.2 1.4 1.2 2.6-.4" />
    </>
  ),
  // Bracket.
  playoffs: (
    <>
      <path d="M3.5 5h5v4h-5M3.5 15h5v4h-5" />
      <path d="M8.5 7h3v10h-3M11.5 12h4" />
      <path d="M15.5 9.5h5v5h-5z" />
    </>
  ),
  // Press microphone.
  media: (
    <>
      <path d="M9.5 3.5h5v9h-5z" />
      <path d="M6.5 10.5a5.5 5.5 0 0 0 11 0M12 16v4.5M8.5 20.5h7" />
    </>
  ),
  history: (
    <>
      <path d="M4.2 12a7.8 7.8 0 1 0 2.3-5.5" />
      <path d="M4 3.5v4.5h4.5M12 8v4.5l3 2" />
    </>
  ),
  ghost: (
    <>
      <path d="M5.5 20.5V11a6.5 6.5 0 0 1 13 0v9.5l-2.2-1.6-2.1 1.6-2.2-1.6-2.2 1.6-2.1-1.6z" />
      <path d="M9.5 11v1.5M14.5 11v1.5" />
    </>
  ),
  renewals: (
    <>
      <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
      <path d="M9 10.5h6M9 14h6" />
      <path d="M15 3.5V7h3.5" />
    </>
  ),
  more: <path d="M4 7h16M4 12h16M4 17h10" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3.5 21 19.5H3z" />
      <path d="M12 9.5v4.5M12 16.5v.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6H4v1.5a3 3 0 0 0 3.5 3M16.5 6H20v1.5a3 3 0 0 1-3.5 3" />
      <path d="M12 13.5V17M8 20.5h8M9.5 17h5v3.5h-5z" />
    </>
  ),
  globe: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5S14.3 18.1 12 20.5C9.7 18.1 8.6 15.3 8.6 12S9.7 5.9 12 3.5z" />
    </>
  ),
  scissors: (
    <>
      <path d="M6.5 9a2.5 2.5 0 1 0 0-.01M6.5 19a2.5 2.5 0 1 0 0-.01" />
      <path d="M8.6 10.3 20 17.5M8.6 17.7 20 6.5" />
    </>
  ),
  // Binoculars.
  scout: (
    <>
      <path d="M7 19.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM17 19.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M10.5 16h3M4.5 13.5 6.5 5h3l1 8M19.5 13.5 17.5 5h-3l-1 8" />
    </>
  ),
  'chevron-right': <path d="M9.5 5.5 16 12l-6.5 6.5" />,
};

export function Icon({
  name,
  size = 18,
  className = '',
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}) {
  const filled = name === 'play';
  return (
    <svg
      className={`icon icon-${name} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.75}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {PATHS[name]}
    </svg>
  );
}
