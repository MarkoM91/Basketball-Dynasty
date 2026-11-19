import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LandingFooter, LandingHeader } from '../components/LandingChrome';
import { NbaToolsNav } from '../components/NbaToolsNav';
import { MAX_CONTRACT_FAQ } from '../content/capTools';
import { fmtDollars, maxContract, SERVICE_TIERS, type ServiceTier } from '../engine/nbaCapRules';
import { NBA_CAP, NBA_SEASON, fmtExact, fmtMoney } from '../engine/nbaTradeRules';
import { PUBLIC_PAGES } from '../seo';

const TIERS: ServiceTier[] = ['young', 'mid', 'veteran'];

export function MaxContractScreen() {
  const page = PUBLIC_PAGES['/max-contract-calculator'];
  const [tier, setTier] = useState<ServiceTier>('mid');
  const [ownTeam, setOwnTeam] = useState(true);
  const [years, setYears] = useState(5);
  const [previous, setPrevious] = useState('');
  const maxYears = ownTeam ? 5 : 4;
  const length = Math.min(years, maxYears);
  const prevDollars = Math.round((Number.parseFloat(previous.replace(/[$,m\s]/gi, '')) || 0) * 1_000_000);
  const deal = useMemo(() => maxContract({ tier, ownTeam, years: length, previousSalary: prevDollars }), [tier, ownTeam, length, prevDollars]);
  const other = useMemo(() => maxContract({ tier, ownTeam: !ownTeam, years: ownTeam ? 4 : 5, previousSalary: prevDollars }), [tier, ownTeam, prevDollars]);

  return (
    <div className="landing-page guide-page">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />
      <LandingHeader logoLinksHome={false} />

      <main className="guide-main tc-main">
        <p className="eyebrow">Free tool · {NBA_SEASON} rules</p>
        <h1 className="title-lg">{page.h1}</h1>
        <p className="body guide-lead">{page.description}</p>

        <section className="tc-side panel" aria-label="Contract details">
          <div className="tc-field">
            <span>Years in the NBA</span>
            <div className="seg tc-seg" role="radiogroup" aria-label="Years in the NBA">
              {TIERS.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tier === t} className={tier === t ? 'is-on' : ''} onClick={() => setTier(t)}>
                  {SERVICE_TIERS[t].label.replace(' in the NBA', '')}
                  <small>{Math.round(SERVICE_TIERS[t].pct * 100)}% of cap</small>
                </button>
              ))}
            </div>
          </div>
          <div className="tc-field">
            <span>Signing with</span>
            <div className="seg tc-seg" role="radiogroup" aria-label="Signing with">
              <button type="button" role="radio" aria-checked={ownTeam} className={ownTeam ? 'is-on' : ''} onClick={() => setOwnTeam(true)}>
                His own team<small>8% raises, up to 5 years</small>
              </button>
              <button type="button" role="radio" aria-checked={!ownTeam} className={!ownTeam ? 'is-on' : ''} onClick={() => setOwnTeam(false)}>
                A new team<small>5% raises, up to 4 years</small>
              </button>
            </div>
          </div>
          <label className="tc-field">
            <span>Contract length: {length} {length === 1 ? 'year' : 'years'}</span>
            <input type="range" min={1} max={maxYears} value={length} onChange={(e) => setYears(Number(e.target.value))} />
          </label>
          <label className="tc-field">
            <span>Previous salary, optional ($M)</span>
            <input inputMode="decimal" placeholder="e.g. 45" value={previous} onChange={(e) => setPrevious(e.target.value)} />
          </label>
        </section>

        <section className="tc-result panel is-ok" aria-live="polite">
          <p className="eyebrow">Max contract</p>
          <p className="lt-big">{fmtMoney(deal.total)}</p>
          <p className="tc-verdict-reason">
            {length} {length === 1 ? 'year' : 'years'}, starting at {fmtDollars(deal.firstYear)}
            {deal.basis === 'previous_salary'
              ? ' (105% of his previous salary, which beats his tier maximum).'
              : ` (${Math.round(SERVICE_TIERS[tier].pct * 100)}% of the ${fmtExact(NBA_CAP)} cap).`}
          </p>
          <div className="lt-table-wrap">
            <table className="lt-table">
              <caption>Year by year ({Math.round(deal.raisePct * 100)}% raises)</caption>
              <thead>
                <tr><th>Season</th><th>Salary</th></tr>
              </thead>
              <tbody>
                {deal.years.map((y) => (
                  <tr key={y.season}><td>{y.season}</td><td>{fmtDollars(y.salary)}</td></tr>
                ))}
                <tr className="lt-total"><td>Total</td><td>{fmtDollars(deal.total)}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="tc-hint">
            {ownTeam
              ? `With a new team the most he could sign for is ${other.years.length} years and ${fmtMoney(other.total)}.`
              : `Re-signing with his own team, he could get ${other.years.length} years and ${fmtMoney(other.total)}.`}
          </p>
        </section>

        <section className="guide-section">
          <h2 className="title-md landing-seo-title">How NBA max contracts work in {NBA_SEASON}</h2>
          <ul className="body tc-rules">
            <li><strong>Starting salary:</strong> 25%, 30% or 35% of the cap, by years of service, or 105% of the previous salary if higher.</li>
            <li><strong>Own team:</strong> up to five years with 8% raises, using Bird rights.</li>
            <li><strong>New team:</strong> up to four years with 5% raises.</li>
            <li><strong>Supermax:</strong> a player with 7–9 years who meets award criteria can get 35% from his team.</li>
            <li><strong>Rookie extensions:</strong> start at 25%, or up to 30% if he meets the award criteria in the Rose Rule.</li>
            <li><strong>Over-38 rule:</strong> limits long deals for older players.</li>
          </ul>
        </section>

        <section className="guide-faq" aria-labelledby="mc-faq-title">
          <h2 id="mc-faq-title" className="title-md landing-seo-title">Max contract FAQ</h2>
          <div className="landing-faq-list">
            {MAX_CONTRACT_FAQ.map((item) => (
              <details key={item.question} className="landing-faq-item">
                <summary>{item.question}</summary>
                <p className="body landing-faq-answer">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <NbaToolsNav current="/max-contract-calculator" />

        <p className="body tc-sources">
          Cap: <a href="https://pr.nba.com/2026-27-salary-cap/" rel="noopener" target="_blank">NBA release on the {NBA_SEASON} salary cap</a>.
          Tiers and raises: <a href="https://www.hoopsrumors.com/2025/08/early-nba-maximum-salary-projections-for-2026-27.html" rel="noopener" target="_blank">Hoops Rumors maximum salary guide</a>.
          Unofficial tool, not affiliated with the NBA.
        </p>

        <div className="guide-cta panel panel-accent">
          <p className="eyebrow">Hand out the max yourself</p>
          <p className="body" style={{ marginTop: 8 }}>
            In Basketball Dynasty, a free basketball GM game, the max-contract decision is yours,
            and a Mercenary will ask for every dollar.
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
