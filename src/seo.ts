export const SITE_URL = 'https://basketballdynasty.com';
export const SITE_NAME = 'Basketball Dynasty';
export const SITE_DESCRIPTION =
  'Free online basketball manager game in your browser. Run the front office — trades, salary cap, draft, playoffs, and job security. No download required.';

export const SITE_KEYWORDS = [
  'basketball manager game',
  'basketball GM simulation',
  'online basketball manager',
  'free basketball sim',
  'browser basketball game',
  'basketball dynasty game',
  'basketball front office simulator',
  'basketball GM game online',
  'trade deadline simulator',
  'basketball draft game',
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
    title: 'Free Online Basketball Manager Game | Basketball Dynasty',
    description: SITE_DESCRIPTION,
    h1: 'Build a basketball dynasty — free browser GM sim',
    changefreq: 'weekly',
    priority: 1,
  },
  '/start': {
    title: 'Start Your Franchise | Free Browser Basketball GM Sim',
    description:
      'Pick a scripted crisis or any of 30 franchises. Free browser basketball GM sim — cap, trades, draft, playoffs.',
    h1: 'Choose a franchise',
    changefreq: 'monthly',
    priority: 0.9,
  },
  '/guide': {
    title: 'How to Play | Basketball Dynasty GM Guide',
    description:
      'Learn how to play Basketball Dynasty — weekly season sim, trades, salary cap, draft, free agency, playoffs, and saving your franchise in this free browser basketball manager game.',
    h1: 'How to play Basketball Dynasty',
    changefreq: 'monthly',
    priority: 0.85,
  },
  '/compare': {
    title: 'Compare Basketball Manager Games | Basketball Dynasty vs Basketball GM',
    description:
      'Compare Basketball Dynasty to Basketball GM and other free browser basketball manager games — trades, draft, cap, free agency, playoffs, and mobile play.',
    h1: 'Compare basketball manager games',
    changefreq: 'monthly',
    priority: 0.85,
  },
};

export const LANDING_FAQ = [
  {
    question: 'Is Basketball Dynasty free to play?',
    answer:
      'Yes. Basketball Dynasty is a free browser basketball manager game with no paywalls, microtransactions, or required account signup.',
  },
  {
    question: 'Do I need to download anything?',
    answer:
      'No download or install is required. The game runs in your web browser on desktop and mobile. Your franchise saves locally on your device.',
  },
  {
    question: 'What can I manage as general manager?',
    answer:
      'You control roster moves, trade block negotiations, two-round draft scouting, salary cap and luxury tax, free agency pitches, coaching hires, ticket revenue, and a full best-of-seven playoff bracket.',
  },
  {
    question: 'How is this different from other basketball GM games?',
    answer:
      'Basketball Dynasty focuses on front-office tension: imperfect scouting ranges, rival free-agent pitches, trade war-room counters, ownership job security, and franchise memory that follows your decisions season to season.',
  },
  {
    question: 'Can I play on mobile?',
    answer:
      'Yes. The interface is built for phone and tablet browsers as well as desktop, with no app store install required.',
  },
] as const;

export const COMPETITOR_GAPS = [
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
    title: 'Playoff bracket you can follow',
    body: '16-team bracket, best-of-seven rounds, and sim controls even after your team is eliminated.',
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
      '30-team league with 78-game schedule',
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
