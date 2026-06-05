export type CompareCell = 'yes' | 'partial' | 'no' | string;

export type CompareRow = {
  feature: string;
  dynasty: CompareCell;
  basketballGm: CompareCell;
  typical: CompareCell;
  note?: string;
};

export const COMPARE_INTRO =
  'Shopping for a free browser basketball manager game? Here is how Basketball Dynasty stacks up against the category leader and typical online sims — focused on front-office gameplay, not graphics.';

export const COMPARE_ROWS: CompareRow[] = [
  {
    feature: 'Price',
    dynasty: 'Free',
    basketballGm: 'Free',
    typical: 'Free–paid',
  },
  {
    feature: 'Browser, no download',
    dynasty: 'yes',
    basketballGm: 'yes',
    typical: 'partial',
  },
  {
    feature: 'Account required',
    dynasty: 'no',
    basketballGm: 'no',
    typical: 'Often yes',
  },
  {
    feature: 'League setup',
    dynasty: 'Real leagues',
    basketballGm: 'Real leagues + historical seasons',
    typical: 'Varies',
  },
  {
    feature: 'Trade war room & counters',
    dynasty: 'yes',
    basketballGm: 'yes',
    typical: 'partial',
    note: 'Dynasty emphasizes block lists, submitted packages, and negotiation counters.',
  },
  {
    feature: 'Free agency rival pitches',
    dynasty: 'yes',
    basketballGm: 'partial',
    typical: 'no',
    note: 'Match rival offers or sell a role — breaking promises has consequences.',
  },
  {
    feature: 'Draft scouting uncertainty',
    dynasty: 'yes',
    basketballGm: 'yes',
    typical: 'partial',
    note: 'Scout ranges, bust risk, and lottery odds on a two-round board.',
  },
  {
    feature: 'Luxury tax & job security',
    dynasty: 'yes',
    basketballGm: 'yes',
    typical: 'partial',
    note: 'Ownership tracks patience — early exits on win-now rosters cost you.',
  },
  {
    feature: 'Visual playoff bracket',
    dynasty: 'yes',
    basketballGm: 'yes',
    typical: 'partial',
    note: 'Follow the full bracket after elimination with round-by-round sim controls.',
  },
  {
    feature: 'Franchise memory & ghosts',
    dynasty: 'yes',
    basketballGm: 'partial',
    typical: 'no',
    note: 'Passed draft picks and trade regrets resurface in later seasons.',
  },
  {
    feature: 'Scripted scenario starts',
    dynasty: 'yes',
    basketballGm: 'no',
    typical: 'partial',
    note: 'Open with a built-in crisis — cap crunch, win-now pressure, or rebuild mandate.',
  },
  {
    feature: 'Mobile-friendly browser UI',
    dynasty: 'yes',
    basketballGm: 'yes',
    typical: 'partial',
  },
];

export const COMPARE_FAQ = [
  {
    question: 'Is Basketball Dynasty a Basketball GM clone?',
    answer:
      'No. Both are free browser basketball manager games, but Basketball Dynasty uses a fictional 30-team league with scenario starts, rival free-agent pitches, trade negotiation counters, and franchise memory mechanics designed for narrative front-office tension.',
  },
  {
    question: 'Which game should I play if I want real league history?',
    answer:
      'Basketball GM is the better fit for historical rosters, real stats, and multi-decade leagues. Basketball Dynasty is built for original franchises, ownership pressure, and dynasty storytelling in the browser.',
  },
  {
    question: 'Can I play both?',
    answer:
      'Yes. Many GM sim fans keep one game for historical depth and another for a fresh fictional league with different trade and free-agency mechanics.',
  },
] as const;

export function compareFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: COMPARE_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function cellLabel(value: CompareCell): string {
  if (value === 'yes') return 'Yes';
  if (value === 'partial') return 'Partial';
  if (value === 'no') return 'No';
  return value;
}
