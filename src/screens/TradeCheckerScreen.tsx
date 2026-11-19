import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LandingFooter, LandingHeader } from '../components/LandingChrome';
import {
  CAP_STATUS_LABEL, NBA_CAP, NBA_FIRST_APRON, NBA_SEASON, NBA_SECOND_APRON, NBA_TAX,
  checkTrade, fmtExact, fmtMoney, type SideVerdict, type TradeSide,
} from '../engine/nbaTradeRules';
import { TRADE_CHECKER_FAQ } from '../content/tradeChecker';
import { PUBLIC_PAGES } from '../seo';

interface DraftSide {
  name: string;
  payroll: string;
  outgoing: string[];
}

// A worked example so the page (and its prerendered HTML) shows a real verdict straight away.
const EXAMPLE: [DraftSide, DraftSide] = [
  { name: 'Team A', payroll: '182', outgoing: ['24'] },
  { name: 'Team B', payroll: '178', outgoing: ['18.5', '9'] },
];

const toDollars = (v: string) => {
  const n = Number.parseFloat(v.replace(/[$,m\s]/gi, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1_000_000) : 0;
};

function toSide(d: DraftSide): TradeSide {
  return { name: d.name.trim() || 'Team', payroll: toDollars(d.payroll), outgoing: d.outgoing.map(toDollars) };
}

function SideEditor({
  side,
  onChange,
  label,
}: {
  side: DraftSide;
  onChange: (next: DraftSide) => void;
  label: string;
}) {
  const setOut = (i: number, v: string) => onChange({ ...side, outgoing: side.outgoing.map((x, j) => (j === i ? v : x)) });
  return (
    <fieldset className="tc-side panel">
      <legend className="eyebrow">{label}</legend>
      <label className="tc-field">
        <span>Team name</span>
        <input value={side.name} onChange={(e) => onChange({ ...side, name: e.target.value })} maxLength={30} />
      </label>
      <label className="tc-field">
        <span>Team salary before the trade ($M)</span>
        <input inputMode="decimal" value={side.payroll} onChange={(e) => onChange({ ...side, payroll: e.target.value })} />
      </label>
      <div className="tc-field">
        <span>Salaries sent out ($M each)</span>
        {side.outgoing.map((v, i) => (
          <div key={i} className="tc-salary-row">
            <input
              inputMode="decimal"
              aria-label={`${label} outgoing salary ${i + 1} in millions`}
              value={v}
              onChange={(e) => setOut(i, e.target.value)}
            />
            {side.outgoing.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost"
                aria-label={`Remove salary ${i + 1}`}
                onClick={() => onChange({ ...side, outgoing: side.outgoing.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {side.outgoing.length < 6 && (
          <button type="button" className="btn btn-secondary tc-add" onClick={() => onChange({ ...side, outgoing: [...side.outgoing, ''] })}>
            + Add a player
          </button>
        )}
      </div>
    </fieldset>
  );
}

function Verdict({ v }: { v: SideVerdict }) {
  return (
    <div className={`tc-verdict ${v.ok ? 'is-ok' : 'is-bad'}`}>
      <p className="tc-verdict-head">
        <strong>{v.name}</strong>
        <span>{v.ok ? 'Works' : "Doesn't work"}</span>
      </p>
      <p className="tc-verdict-reason">{v.reason}</p>
      <dl className="tc-verdict-stats">
        <div><dt>Sends</dt><dd>{fmtMoney(v.outgoing)}</dd></div>
        <div><dt>Receives</dt><dd>{fmtMoney(v.incoming)}</dd></div>
        <div><dt>Max back</dt><dd>{fmtMoney(v.maxIncoming)}</dd></div>
        <div><dt>Salary after</dt><dd>{fmtMoney(v.payrollAfter)}</dd></div>
      </dl>
      <p className="tc-verdict-rule">
        {v.rule} · {CAP_STATUS_LABEL[v.statusBefore]}
        {v.statusAfter !== v.statusBefore ? ` → ${CAP_STATUS_LABEL[v.statusAfter].toLowerCase()}` : ''}
      </p>
      {v.warnings.map((w) => (
        <p key={w} className="tc-verdict-warn">{w}</p>
      ))}
    </div>
  );
}

export function TradeCheckerScreen() {
  const page = PUBLIC_PAGES['/trade-checker'];
  const [a, setA] = useState<DraftSide>(EXAMPLE[0]);
  const [b, setB] = useState<DraftSide>(EXAMPLE[1]);
  const result = useMemo(() => checkTrade(toSide(a), toSide(b)), [a, b]);
  const empty = toSide(a).outgoing.every((x) => !x) && toSide(b).outgoing.every((x) => !x);

  return (
    <div className="landing-page guide-page">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />
      <LandingHeader logoLinksHome={false} />

      <main className="guide-main tc-main">
        <p className="eyebrow">Free tool · {NBA_SEASON} rules</p>
        <h1 className="title-lg">{page.h1}</h1>
        <p className="body guide-lead">{page.description}</p>

        <section className="tc-thresholds" aria-label={`${NBA_SEASON} thresholds`}>
          <div><span>Salary cap</span><strong>{fmtExact(NBA_CAP)}</strong></div>
          <div><span>Tax line</span><strong>{fmtExact(NBA_TAX)}</strong></div>
          <div><span>First apron</span><strong>{fmtExact(NBA_FIRST_APRON)}</strong></div>
          <div><span>Second apron</span><strong>{fmtExact(NBA_SECOND_APRON)}</strong></div>
        </section>

        <div className="tc-sides">
          <SideEditor side={a} onChange={setA} label="Team 1" />
          <SideEditor side={b} onChange={setB} label="Team 2" />
        </div>

        <section className={`tc-result panel ${result.ok ? 'is-ok' : 'is-bad'}`} aria-live="polite">
          <p className="eyebrow">Result</p>
          <h2 className="title-md">
            {empty ? 'Add the salaries each team sends' : result.ok ? 'This trade works on salary' : "This trade doesn't work"}
          </h2>
          {!empty && result.sides.map((v) => <Verdict key={v.name + v.outgoing} v={v} />)}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setA(EXAMPLE[0]);
              setB(EXAMPLE[1]);
            }}
          >
            Reset example
          </button>
        </section>

        <section className="guide-section">
          <h2 className="title-md landing-seo-title">How NBA salary matching works in {NBA_SEASON}</h2>
          <p className="body">
            Every team over the salary cap has to match salaries in a trade. How much it can take back
            depends on how much it sends and where its payroll lands after the deal:
          </p>
          <ul className="body tc-rules">
            <li><strong>Ends under the cap:</strong> absorb salary freely, up to $250K over the cap.</li>
            <li><strong>Sending up to $7.5M:</strong> take back 200% plus $250K.</li>
            <li><strong>Sending $7.5M–$29M:</strong> take back what you send plus $7.5M.</li>
            <li><strong>Sending more than $29M:</strong> take back 125% plus $250K.</li>
            <li><strong>Ends over the first apron:</strong> take back no more than you send.</li>
            <li><strong>Ends over the second apron:</strong> no combining salaries and no cash.</li>
          </ul>
        </section>

        <section className="guide-faq" aria-labelledby="tc-faq-title">
          <h2 id="tc-faq-title" className="title-md landing-seo-title">Trade checker FAQ</h2>
          <div className="landing-faq-list">
            {TRADE_CHECKER_FAQ.map((item) => (
              <details key={item.question} className="landing-faq-item">
                <summary>{item.question}</summary>
                <p className="body landing-faq-answer">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <p className="body tc-sources">
          Thresholds: <a href="https://pr.nba.com/2026-27-salary-cap/" rel="noopener" target="_blank">NBA release on the {NBA_SEASON} salary cap</a>.
          Matching bands: <a href="https://www.hoopsrumors.com/2024/12/what-each-nba-team-can-cant-do-on-the-trade-market.html" rel="noopener" target="_blank">Hoops Rumors CBA trade rules summary</a>.
          Unofficial tool, not affiliated with the NBA.
        </p>

        <div className="guide-cta panel panel-accent">
          <p className="eyebrow">Make the trade for real</p>
          <p className="body" style={{ marginTop: 8 }}>
            Basketball Dynasty is a free basketball GM game with NBA-style cap rules: cap room,
            exceptions, aprons and salary matching. AI front offices counter your offers, stars
            demand trades, and you have a deadline to beat.
          </p>
          <div className="compare-cta-row">
            <Link to="/start" className="btn btn-primary">Play free</Link>
            <a href="/guides/trade-strategy/" className="btn btn-ghost">Trade strategy guide</a>
          </div>
        </div>
      </main>

      <LandingFooter logoLinksHome={false} />
    </div>
  );
}
