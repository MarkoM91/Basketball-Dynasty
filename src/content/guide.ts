export const GUIDE_SECTIONS = [
  {
    id: 'start',
    title: '1. Start a franchise',
    body:
      'From the home page, tap Start new franchise. Pick a scripted scenario — each one opens with a real front-office crisis — or choose any of the 30 teams. Your save stores locally in the browser; export it anytime from the main menu.',
  },
  {
    id: 'season',
    title: '2. Run the regular season',
    body:
      'Each week simulates up to three games on a 78-game schedule. Set your starting five before user games, or sim the week from the office. Track standings, schedule, and league headlines as 29 AI teams compete for the 16 playoff seeds.',
  },
  {
    id: 'roster',
    title: '3. Manage your roster',
    body:
      'The roster screen shows ratings, roles, contracts, morale, and injuries. All 30 teams use fictional parody names (rosters as of 4 June 2026). Assign development focus to young players. Before playoff or user games, confirm your starting five — lineup strength directly affects sim outcomes.',
  },
  {
    id: 'trades',
    title: '4. Work the trade market',
    body:
      'Use the trade war room to add players or picks to your block, review incoming offers, and build counter packages. Salary must match within cap rules. Deadline week adds pressure — bad deals haunt you through franchise memory.',
  },
  {
    id: 'cap',
    title: '5. Watch the cap sheet',
    body:
      'The cap desk shows projected room, luxury tax, and mid-level exceptions. Every signing and trade ripples through future seasons. Ownership tracks job security — expensive mediocrity gets you fired faster than a honest rebuild.',
  },
  {
    id: 'offseason',
    title: '6. Survive the offseason',
    body:
      'After season review, the calendar moves to draft scouting, a two-round draft night, contract renewals, and free agency. Scout ranges are imperfect — bust risk is real. Rival teams pitch your targets; match money or sell a role.',
  },
  {
    id: 'playoffs',
    title: '7. Chase the bracket',
    body:
      'Sixteen teams enter best-of-seven rounds. Play your games with a set lineup or sim forward. If you are eliminated, the full bracket keeps updating — sim each round until a champion is crowned and offseason begins.',
  },
  {
    id: 'save',
    title: '8. Save and continue',
    body:
      'Progress auto-saves on this device. Export your dynasty file from the main menu before switching browsers or clearing storage. Import restores the same franchise on another device.',
  },
] as const;

export const GUIDE_TIPS = [
  'Rebuild teams: draft and develop before chasing max free agents.',
  'Contenders: upgrade the closing lineup at the trade deadline, not the bench.',
  'Free agency: read rival interest — sometimes walking away is the win.',
  'Draft: scout ranges lie; floor and bust risk matter as much as ceiling.',
  'Job security: ownership remembers early playoff exits on win-now rosters.',
] as const;

export const GUIDE_FAQ = [
  {
    question: 'How long is a season?',
    answer: 'The regular season is 78 games across weekly turns, followed by a 16-team playoff bracket and a full offseason cycle.',
  },
  {
    question: 'Can I play individual games?',
    answer: 'Yes. User games prompt you to set a starting five on the play screen. Other games in the week can be simulated automatically.',
  },
  {
    question: 'What happens if I get fired?',
    answer: 'Job security tracks ownership patience. Deep runs extend your leash; expensive early exits shrink it. The franchise memory log records major decisions either way.',
  },
] as const;

export function howToJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Play Basketball Dynasty',
    description:
      'Step-by-step guide to the free browser basketball manager game — roster, trades, cap, draft, free agency, and playoffs.',
    totalTime: 'PT30M',
    step: GUIDE_SECTIONS.map((section, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: section.title,
      text: section.body,
      url: `https://basketballdynasty.com/guide#${section.id}`,
    })),
  };
}

export function guideFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: GUIDE_FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
