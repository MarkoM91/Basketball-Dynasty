import { NBA_CAP, NBA_SEASON, NBA_TAX, fmtExact } from '../engine/nbaTradeRules';
import { TAX_BRACKET } from '../engine/nbaCapRules';
import { SITE_URL } from '../seo';

export const NBA_TOOLS = [
  { href: '/trade-checker', title: 'NBA trade checker', description: 'Does a trade work under salary-matching and apron rules?' },
  { href: '/luxury-tax-calculator', title: 'Luxury tax calculator', description: "A team's 2026-27 tax bill, bracket by bracket." },
  { href: '/max-contract-calculator', title: 'Max contract calculator', description: 'What a max deal is worth, year by year.' },
] as const;

export const LUXURY_TAX_FAQ = [
  {
    question: `What is the NBA luxury tax line for ${NBA_SEASON}?`,
    answer: `${fmtExact(NBA_TAX)}. Teams whose salary is above it at the end of their season pay tax on every dollar over the line.`,
  },
  {
    question: 'How is the luxury tax calculated?',
    answer: `The amount over the line is split into brackets of ${fmtExact(TAX_BRACKET)}. Standard taxpayers pay $1.00 per dollar in the first bracket, $1.25 in the second, $3.50 in the third and $4.75 in the fourth, then $0.50 more for each bracket after that.`,
  },
  {
    question: 'What is a repeater taxpayer?',
    answer: 'A team that paid the tax in at least three of the previous four seasons. Repeaters pay $3.00, $3.25, $5.50 and $6.75 per dollar in the first four brackets, then $0.50 more per bracket.',
  },
  {
    question: 'When is the luxury tax bill set?',
    answer: "On the team's salary at the end of its season. Trades and waivers before then can lower the bill, which is why teams make tax-saving moves at the trade deadline.",
  },
  {
    question: 'Where does the tax money go?',
    answer: 'Part of it is paid out to teams that stay under the tax, so going over the line costs a team twice: it pays the tax and misses out on that share.',
  },
];

export const MAX_CONTRACT_FAQ = [
  {
    question: `How much is an NBA max contract in ${NBA_SEASON}?`,
    answer: `The starting salary is a share of the ${fmtExact(NBA_CAP)} cap: 25% for players with 0–6 years of service, 30% for 7–9 years and 35% for 10 or more.`,
  },
  {
    question: 'How do raises work on a max contract?',
    answer: 'Each year adds a percentage of the first-year salary: 8% a year when re-signing with your own team (up to five years), and 5% a year when signing with a new team (up to four years).',
  },
  {
    question: 'Can a max contract start above the tier?',
    answer: "Yes. A player can always receive 105% of his previous salary, even if that is more than his tier's maximum.",
  },
  {
    question: 'What is the supermax?',
    answer: 'The designated veteran extension lets a player with 7–9 years of service earn 35% of the cap if he meets award criteria, such as All-NBA, MVP or Defensive Player of the Year, and is still with the team that drafted him (or traded for him on his rookie deal). Pick the 10+ tier to see that amount.',
  },
  {
    question: 'Are these numbers official?',
    answer: `The cap is the NBA's official ${NBA_SEASON} figure. Contracts signed in later seasons use that season's cap, so treat future starting salaries as estimates.`,
  },
];

const faqLd = (faq: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
});

const appLd = (name: string, path: string, description: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name,
  url: `${SITE_URL}${path}`,
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Any (browser)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description,
});

export function luxuryTaxJsonLd() {
  return [appLd('NBA Luxury Tax Calculator', '/luxury-tax-calculator', `Calculate an NBA team's ${NBA_SEASON} luxury tax bill, including repeater rates.`), faqLd(LUXURY_TAX_FAQ)];
}

export function maxContractJsonLd() {
  return [appLd('NBA Max Contract Calculator', '/max-contract-calculator', `Calculate an NBA maximum contract for ${NBA_SEASON}, year by year.`), faqLd(MAX_CONTRACT_FAQ)];
}
