import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LandingFooter, LandingHeader } from '../components/LandingChrome';
import { NbaToolsNav } from '../components/NbaToolsNav';
import { LUXURY_TAX_FAQ } from '../content/capTools';
import { fmtDollars, luxuryTax, TAX_BRACKET, trueCostOfSalary } from '../engine/nbaCapRules';
import { NBA_FIRST_APRON, NBA_SEASON, NBA_SECOND_APRON, NBA_TAX, fmtExact, fmtMoney } from '../engine/nbaTradeRules';
import { PUBLIC_PAGES } from '../seo';

const PRESETS: { label: string; payroll: number }[] = [
  { label: 'Just over the tax', payroll: NBA_TAX + 4_000_000 },
  { label: 'At the first apron', payroll: NBA_FIRST_APRON },
  { label: 'At the second apron', payroll: NBA_SECOND_APRON },
  { label: 'Big spender', payroll: 250_000_000 },
];

const toDollars = (v: string) => {
  const n = Number.parseFloat(v.replace(/[$,m\s]/gi, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1_000_000) : 0;
};
const toInput = (n: number) => String(Math.round(n / 1_000) / 1_000);

export function LuxuryTaxScreen() {
  const page = PUBLIC_PAGES['/luxury-tax-calculator'];
  const [payroll, setPayroll] = useState(toInput(NBA_FIRST_APRON));
  const [repeater, setRepeater] = useState(false);
  const [addSalary, setAddSalary] = useState('10');
  const pay = toDollars(payroll);
  const bill = useMemo(() => luxuryTax(pay, repeater), [pay, repeater]);
  const other = useMemo(() => luxuryTax(pay, !repeater), [pay, repeater]);
  const add = toDollars(addSalary);
  const cost = useMemo(() => trueCostOfSalary(pay, add, repeater), [pay, add, repeater]);

  return (
    <div className="landing-page guide-page">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />
      <LandingHeader logoLinksHome={false} />

      <main className="guide-main tc-main">
        <p className="eyebrow">Free tool · {NBA_SEASON} rules</p>
        <h1 className="title-lg">{page.h1}</h1>
        <p className="body guide-lead">{page.description}</p>

        <section className="tc-side panel" aria-label="Team salary">
          <label className="tc-field">
            <span>Team salary at the end of the season ($M)</span>
            <input inputMode="decimal" value={payroll} onChange={(e) => setPayroll(e.target.value)} />
          </label>
          <div className="tc-presets" role="group" aria-label="Quick payroll presets">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" className="btn btn-ghost" onClick={() => setPayroll(toInput(p.payroll))}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="seg tc-seg" role="radiogroup" aria-label="Taxpayer type">
            <button type="button" role="radio" aria-checked={!repeater} className={!repeater ? 'is-on' : ''} onClick={() => setRepeater(false)}>
              Standard taxpayer
            </button>
            <button type="button" role="radio" aria-checked={repeater} className={repeater ? 'is-on' : ''} onClick={() => setRepeater(true)}>
              Repeater
            </button>
          </div>
          <p className="tc-hint">A repeater paid the tax in at least three of the previous four seasons.</p>
        </section>

        <section className={`tc-result panel ${bill.over > 0 ? 'is-bad' : 'is-ok'}`} aria-live="polite">
          <p className="eyebrow">Luxury tax bill</p>
          <p className="lt-big">{bill.over > 0 ? fmtDollars(bill.tax) : '$0'}</p>
          <p className="tc-verdict-reason">
            {bill.over > 0
              ? `${fmtMoney(bill.over)} over the ${fmtExact(NBA_TAX)} tax line. Total cost with salaries: ${fmtMoney(pay + bill.tax)}.`
              : `Under the ${fmtExact(NBA_TAX)} tax line, so no tax. Room before the line: ${fmtMoney(NBA_TAX - pay)}.`}
          </p>
          {bill.over > 0 && (
            <>
              <dl className="tc-verdict-stats">
                <div><dt>Next $1 costs</dt><dd>${(1 + bill.marginalRate).toFixed(2)}</dd></div>
                <div><dt>Tax rate now</dt><dd>${bill.marginalRate.toFixed(2)}</dd></div>
                <div><dt>{repeater ? 'If not repeater' : 'If repeater'}</dt><dd>{fmtMoney(other.tax)}</dd></div>
                <div><dt>Brackets</dt><dd>{bill.lines.length}</dd></div>
              </dl>
              <div className="lt-table-wrap">
                <table className="lt-table">
                  <caption>Bracket by bracket ({fmtExact(TAX_BRACKET)} each)</caption>
                  <thead>
                    <tr><th>Bracket</th><th>Taxed</th><th>Rate</th><th>Tax</th></tr>
                  </thead>
                  <tbody>
                    {bill.lines.map((l) => (
                      <tr key={l.bracket}>
                        <td>{l.bracket}</td>
                        <td>{fmtMoney(l.taxed)}</td>
                        <td>${l.rate.toFixed(2)}</td>
                        <td>{fmtMoney(l.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section className="tc-side panel" aria-label="True cost of a contract">
          <p className="eyebrow">What a new contract really costs</p>
          <label className="tc-field">
            <span>Add a player earning ($M)</span>
            <input inputMode="decimal" value={addSalary} onChange={(e) => setAddSalary(e.target.value)} />
          </label>
          <p className="lt-cost">
            {add > 0 ? (
              cost.extraTax > 0
                ? <>A {fmtMoney(add)} player costs <strong>{fmtMoney(cost.total)}</strong> this season: {fmtMoney(add)} in salary plus {fmtMoney(cost.extraTax)} in extra tax.</>
                : <>A {fmtMoney(add)} player adds no tax at this payroll.</>
            ) : 'Enter a salary to see its real cost.'}
          </p>
        </section>

        <section className="guide-section">
          <h2 className="title-md landing-seo-title">How the NBA luxury tax works in {NBA_SEASON}</h2>
          <p className="body">
            Every dollar of team salary above the {fmtExact(NBA_TAX)} tax line is taxed, in brackets of
            {' '}{fmtExact(TAX_BRACKET)}. The rate climbs with each bracket, so the last dollars a team
            spends are by far the most expensive.
          </p>
          <ul className="body tc-rules">
            <li><strong>Standard taxpayers:</strong> $1.00, $1.25, $3.50 and $4.75 per dollar in the first four brackets.</li>
            <li><strong>Repeaters:</strong> $3.00, $3.25, $5.50 and $6.75.</li>
            <li><strong>After the fourth bracket:</strong> $0.50 more per dollar for every further bracket.</li>
            <li><strong>Aprons:</strong> at {fmtExact(NBA_FIRST_APRON)} and {fmtExact(NBA_SECOND_APRON)}, teams also lose trade and signing options.</li>
          </ul>
          <p className="body">
            Hoops Rumors lists the Nuggets, Warriors, Lakers and Suns as repeater-eligible for {NBA_SEASON}.
          </p>
        </section>

        <section className="guide-faq" aria-labelledby="lt-faq-title">
          <h2 id="lt-faq-title" className="title-md landing-seo-title">Luxury tax FAQ</h2>
          <div className="landing-faq-list">
            {LUXURY_TAX_FAQ.map((item) => (
              <details key={item.question} className="landing-faq-item">
                <summary>{item.question}</summary>
                <p className="body landing-faq-answer">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <NbaToolsNav current="/luxury-tax-calculator" />

        <p className="body tc-sources">
          Thresholds: <a href="https://pr.nba.com/2026-27-salary-cap/" rel="noopener" target="_blank">NBA release on the {NBA_SEASON} salary cap</a>.
          Brackets and rates: <a href="https://www.hoopsrumors.com/2026/08/hoops-rumors-glossary-luxury-tax-penalties-5.html" rel="noopener" target="_blank">Hoops Rumors luxury tax glossary</a>.
          Unofficial tool, not affiliated with the NBA.
        </p>

        <div className="guide-cta panel panel-accent">
          <p className="eyebrow">Run the payroll yourself</p>
          <p className="body" style={{ marginTop: 8 }}>
            In Basketball Dynasty, a free basketball GM game, you decide whether a title shot is worth
            the tax bill, and your owner decides whether you keep your job.
          </p>
          <div className="compare-cta-row">
            <Link to="/start" className="btn btn-primary">Play free</Link>
          </div>
        </div>
      </main>

      <LandingFooter logoLinksHome={false} />
    </div>
  );
}
