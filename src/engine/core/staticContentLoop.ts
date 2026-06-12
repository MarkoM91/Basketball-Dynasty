import type { LeagueState, NewsEvent, StaticContentItem } from './models';

const DEFAULT_STATIC_CONTENT: StaticContentItem[] = [
  {
    slug: '/games-like-basketball-gm',
    title: 'Games Like Basketball GM',
    description: 'Static comparison page for high-intent management sim searches.',
    bundle: 'static',
    dirty: true,
  },
  {
    slug: '/guides/first-season',
    title: 'Beginner First Season Guide',
    description: 'Onboarding guide rendered outside the game bundle.',
    bundle: 'static',
    dirty: true,
  },
  {
    slug: '/guides/trade-strategy',
    title: 'Trade Strategy Guide',
    description: 'Negotiation and trade AI education page.',
    bundle: 'static',
    dirty: true,
  },
  {
    slug: '/guides/draft-scouting',
    title: 'Draft Scouting Guide',
    description: 'Draft ranges, lottery, and hidden gem strategy page.',
    bundle: 'static',
    dirty: true,
  },
  {
    slug: '/guides/salary-cap',
    title: 'Salary Cap Guide',
    description: 'Contract and cap management guide page.',
    bundle: 'static',
    dirty: true,
  },
];

export function ensureStaticContentLoop(state: LeagueState): LeagueState {
  if (state.staticContent.length) return state;
  return { ...state, staticContent: DEFAULT_STATIC_CONTENT };
}

export function processStaticPublishing(state: LeagueState): LeagueState {
  const withDefaults = ensureStaticContentLoop(state);
  const dirty = withDefaults.staticContent.filter((item) => item.dirty);
  if (!dirty.length) return withDefaults;

  const news: NewsEvent[] = dirty.map((item) => ({
    id: `news-${withDefaults.calendar.day}-${item.slug.replaceAll('/', '-')}-publish`,
    dateISO: withDefaults.calendar.dateISO,
    season: withDefaults.league.season,
    type: 'publishing',
    headline: `Static page queued for prerender: ${item.slug}.`,
    severity: 'minor',
  }));

  return {
    ...withDefaults,
    staticContent: withDefaults.staticContent.map((item) =>
      item.dirty ? { ...item, dirty: false, lastGeneratedISO: withDefaults.calendar.dateISO } : item,
    ),
    news: [...news, ...withDefaults.news],
  };
}

