import {
  MATCH_HIGH_BAND, MATCH_LOW_BAND, NBA_CAP, NBA_FIRST_APRON, NBA_SEASON, NBA_SECOND_APRON, NBA_TAX, fmtExact, fmtMoney,
} from '../engine/nbaTradeRules';
import { SITE_URL } from '../seo';

export const TRADE_CHECKER_FAQ = [
  {
    question: 'How does NBA trade salary matching work?',
    answer: `A team over the salary cap must send out enough salary to cover what it takes back. If the team stays under the first apron after the trade, it can take back 200% of outgoing salary plus $250K when sending up to ${fmtMoney(MATCH_LOW_BAND)}, the outgoing salary plus ${fmtMoney(MATCH_LOW_BAND)} when sending ${fmtMoney(MATCH_LOW_BAND)}–${fmtMoney(MATCH_HIGH_BAND)}, and 125% plus $250K when sending more than ${fmtMoney(MATCH_HIGH_BAND)}.`,
  },
  {
    question: 'What changes for teams over the first apron?',
    answer: `A team that ends the trade above the first apron (${fmtExact(NBA_FIRST_APRON)} in ${NBA_SEASON}) can't take back more salary than it sends out.`,
  },
  {
    question: 'What can second-apron teams not do in trades?',
    answer: `Teams above the second apron (${fmtExact(NBA_SECOND_APRON)}) can't combine two or more salaries to match a bigger one, and can't send cash. Combining salaries also hard-caps any team at the second apron for the rest of the season.`,
  },
  {
    question: 'Can a team under the cap absorb a contract?',
    answer: `Yes. A team can take on salary without matching as long as it finishes the trade no more than $250K over the ${fmtExact(NBA_CAP)} cap.`,
  },
  {
    question: 'Is this checker official?',
    answer: `No. It applies the main salary-matching rules with the official ${NBA_SEASON} cap (${fmtExact(NBA_CAP)}), tax line (${fmtExact(NBA_TAX)}) and aprons. Real trades also involve trade kickers, recently signed players, cash and traded player exceptions, which this tool doesn't model.`,
  },
];

export function tradeCheckerJsonLd() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'NBA Trade Salary Checker',
      url: `${SITE_URL}/trade-checker`,
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Any (browser)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: `Check whether an NBA trade works under ${NBA_SEASON} salary-matching and apron rules.`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: TRADE_CHECKER_FAQ.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];
}
