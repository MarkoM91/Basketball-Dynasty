export const SITE_URL = 'https://basketballdynasty.com';
export const SITE_NAME = 'Basketball Dynasty';
export const SITE_DESCRIPTION =
  'The best free browser basketball GM simulation. Run trades, salary cap, draft, coaching, playoffs — no download, no install. Start your dynasty now.';

export const SITE_KEYWORDS = [
  'basketball manager game',
  'basketball GM simulation',
  'online basketball manager',
  'free basketball GM game',
  'browser basketball game',
  'basketball dynasty game',
  'basketball front office simulator',
  'basketball GM game online',
  'nba gm game online',
  'trade deadline simulator',
  'basketball draft game',
  'basketball manager like football manager',
  'set starting lineup basketball game',
  'basketball gm no download',
  'basketball trade simulator',
  'hire fire coach basketball game',
].join(', ');

export const PUBLIC_PAGES: Record<
  string,
  {
    title: string;
    description: string;
    changefreq: 'weekly' | 'monthly';
    priority: number;
    h1?: string;
  }
> = {
  '/': {
    title: 'Basketball Dynasty — The Best Free Browser Basketball GM Simulation',
    description: SITE_DESCRIPTION,
    h1: 'Build a basketball dynasty — free browser GM sim',
    changefreq: 'weekly',
    priority: 1,
  },
  '/start': {
    title: 'Start Your Franchise — Free Basketball GM Simulation | Basketball Dynasty',
    description:
      'Pick a scripted crisis or any of 30 franchises. Build a dynasty in the best free browser basketball GM sim — salary cap, trades, draft, playoffs, coaching.',
    h1: 'Choose a franchise',
    changefreq: 'monthly',
    priority: 0.9,
  },
  '/guide': {
    title: 'How to Play Basketball Dynasty — Complete GM Guide',
    description:
      'Master Basketball Dynasty: lineup decisions, trade negotiations, salary cap, two-round draft, free agency, coaching hires, and 16-team playoffs. Full guide for the best free basketball GM game.',
    h1: 'How to play Basketball Dynasty',
    changefreq: 'monthly',
    priority: 0.85,
  },
  '/compare': {
    title: 'Best Free Basketball Manager Game — Basketball Dynasty vs Basketball GM',
    description:
      'See why Basketball Dynasty is the best free browser basketball manager game. Compare lineup control, trade war room, cap management, coaching, draft scouting, and mobile play.',
    h1: 'Compare basketball manager games',
    changefreq: 'monthly',
    priority: 0.85,
  },
};

export const LANDING_FAQ = [
  {
    question: 'Is Basketball Dynasty the best free basketball GM game?',
    answer:
      'Basketball Dynasty is built to be the deepest free browser basketball GM simulation available — combining trade negotiations, salary cap management, imperfect scouting, coaching hires, and full playoff brackets in one game with no download and no paywall.',
  },
  {
    question: 'Is Basketball Dynasty free to play?',
    answer:
      'Yes. Basketball Dynasty is completely free with no paywalls, microtransactions, or account signup required. Play instantly in your browser.',
  },
  {
    question: 'Do I need to download anything?',
    answer:
      'No download or install required. The game runs entirely in your web browser on desktop and mobile. Your franchise saves locally on your device.',
  },
  {
    question: 'What can I manage as general manager?',
    answer:
      'You control everything: set your starting five lineup, run trade block negotiations, scout and draft prospects, work the salary cap and luxury tax, pitch free agents, hire and fire coaches, manage ticket revenue, and run a full 16-team best-of-seven playoff bracket.',
  },
  {
    question: 'How is Basketball Dynasty different from Basketball GM?',
    answer:
      'Basketball Dynasty focuses on front-office tension and GM decision-making: set your lineup before each game, negotiate trades in a live war room, manage rival free-agent bids, deal with ownership job security, and follow franchise memory that tracks every decision across seasons.',
  },
  {
    question: 'Is there a basketball manager game like Football Manager?',
    answer:
      'Basketball Dynasty is the closest browser equivalent — a deep management sim where your decisions have real consequences: imperfect scouting, trade counters, salary cap traps, coaching ratings, and ownership pressure all shape your dynasty.',
  },
  {
    question: 'Can I play on mobile?',
    answer:
      'Yes. Basketball Dynasty is fully playable on phone and tablet browsers — no app store install required. The interface is optimized for mobile touch.',
  },
  {
    question: 'Can I set my own starting lineup?',
    answer:
      'Yes. Before every game you choose your starting five and rotation. Matchups and lineup decisions affect the outcome — it\'s not just simulated automatically.',
  },
] as const;

export const COMPETITOR_GAPS = [
  {
    title: 'Set your starting five',
    body: 'Pick your lineup before every game. Matchups matter — your rotation choices affect the outcome.',
  },
  {
    title: 'Front-office depth',
    body: 'Cap room, luxury tax, MLE decisions, and ownership patience — not just roster ratings.',
  },
  {
    title: 'Live trade war room',
    body: 'Block players, submit packages, and negotiate counters with AI front offices.',
  },
  {
    title: 'Scouting uncertainty',
    body: 'Two-round draft with bust risk, lottery odds, and imperfect scout ranges on every prospect.',
  },
  {
    title: 'Hire & fire coaches',
    body: 'Sign or cut your head coach each offseason. Development and playoff ratings shape your ceiling.',
  },
] as const;

/** In-app routes — useful content for players, not search landing pages. */
export const APP_ROUTE_PATHS = [
  '/office',
  '/roster',
  '/trades',
  '/draft',
  '/cap',
  '/development',
  '/coach',
  '/media',
  '/history',
  '/ghosts',
  '/playoffs',
  '/free-agency',
  '/renewals',
  '/league',
  '/results',
  '/play',
  '/schedule',
  '/finances',
] as const;

export function absoluteUrl(path: string): string {
  if (path === '/') return `${SITE_URL}/`;
  return `${SITE_URL}${path}`;
}

export function webApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    description: SITE_DESCRIPTION,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      '30-team league with 82-game schedule',
      'Trade block and AI negotiation',
      'Two-round draft with scouting ranges',
      'Free agency with rival pitch mechanics',
      'Salary cap and luxury tax management',
      '16-team playoff bracket',
      'Local save export and import',
    ],
  };
}

export function faqPageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: LANDING_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    logo: absoluteUrl('/icon.svg'),
  };
}

export function videoGameJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: SITE_NAME,
    url: absoluteUrl('/'),
    description: SITE_DESCRIPTION,
    gamePlatform: 'Web browser',
    applicationCategory: 'Game',
    genre: 'Sports simulation',
    playMode: 'SinglePlayer',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };
}
