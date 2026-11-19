import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LandingFooter, LandingHeader } from '../components/LandingChrome';
import { NbaToolsNav } from '../components/NbaToolsNav';
import {
  CAP_STATUS_LABEL, NBA_CAP, NBA_FIRST_APRON, NBA_SEASON, NBA_SECOND_APRON, NBA_TAX,
  checkMultiTeamTrade, fmtExact, fmtMoney, type SideVerdict, type TradeAsset,
} from '../engine/nbaTradeRules';
import { TRADE_CHECKER_FAQ } from '../content/tradeChecker';
import { PUBLIC_PAGES, SITE_URL } from '../seo';

interface DraftPlayer {
  name: string;
  salary: string;
  /** Index of the receiving team. */
  to: number;
}

interface DraftTeam {
  name: string;
  payroll: string;
  hardCapped: boolean;
  players: DraftPlayer[];
}

// A worked example so the page (and its prerendered HTML) shows a real verdict straight away.
const EXAMPLE: DraftTeam[] = [
  { name: 'Team A', payroll: '182', hardCapped: false, players: [{ name: 'Starting guard', salary: '24', to: 1 }] },
  { name: 'Team B', payroll: '178', hardCapped: false, players: [{ name: 'Wing', salary: '18.5', to: 0 }, { name: 'Backup center', salary: '9', to: 0 }] },
];

const PRESETS: { label: string; payroll: number }[] = [
  { label: 'Under cap', payroll: NBA_CAP - 12_000_000 },
  { label: 'Over cap', payroll: NBA_CAP + 15_000_000 },
  { label: 'Taxpayer', payroll: NBA_TAX + 3_000_000 },
  { label: '1st apron', payroll: NBA_FIRST_APRON + 3_000_000 },
  { label: '2nd apron', payroll: NBA_SECOND_APRON + 3_000_000 },
];

const toDollars = (v: string) => {
  const n = Number.parseFloat(v.replace(/[$,m\s]/gi, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1_000_000) : 0;
};
const toInput = (n: number) => String(Math.round(n / 100_000) / 10);

// ── Share links: the whole trade lives in ?t= so a link reproduces it exactly. ──
type Packed = [string, string, 0 | 1, [string, string, number][]][];

function encodeTrade(teams: DraftTeam[]): string {
  const packed: Packed = teams.map((t) => [t.name, t.payroll, t.hardCapped ? 1 : 0, t.players.map((p) => [p.name, p.salary, p.to])]);
  const json = JSON.stringify(packed);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeTrade(param: string): DraftTeam[] | null {
  try {
    const b64 = param.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const packed = JSON.parse(new TextDecoder().decode(bytes)) as Packed;
    if (!Array.isArray(packed) || packed.length < 2 || packed.length > 3) return null;
    return packed.map(([name, payroll, hc, players]) => ({
      name: String(name).slice(0, 30),
      payroll: String(payroll).slice(0, 10),
      hardCapped: hc === 1,
      players: (Array.isArray(players) ? players : []).slice(0, 8).map(([n, s, to]) => ({
        name: String(n).slice(0, 40),
        salary: String(s).slice(0, 10),
        to: Math.max(0, Math.min(packed.length - 1, Number(to) || 0)),
      })),
    }));
  } catch {
    return null;
  }
}

function initialTeams(): DraftTeam[] {
  if (typeof window === 'undefined') return EXAMPLE;
  const param = new URLSearchParams(window.location.search).get('t');
  return (param && decodeTrade(param)) || EXAMPLE;
}

// ── Payroll bar ──────────────────────────────────────────────────────────────
const BAR_MIN = 130_000_000;
const BAR_MAX = 240_000_000;
const pct = (n: number) => `${Math.max(0, Math.min(100, ((n - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100))}%`;
const LINES = [
  { at: NBA_CAP, label: 'Cap' },
  { at: NBA_TAX, label: 'Tax' },
  { at: NBA_FIRST_APRON, label: '1st' },
  { at: NBA_SECOND_APRON, label: '2nd' },
];

function PayrollBar({ before, after }: { before: number; after: number }) {
  return (
    <div className="tc-bar" role="img" aria-label={`Team salary goes from ${fmtMoney(before)} to ${fmtMoney(after)}`}>
      <div className="tc-bar-track">
        <div className={`tc-bar-fill is-${after > NBA_FIRST_APRON ? 'apron' : after > NBA_TAX ? 'tax' : after > NBA_CAP ? 'over' : 'under'}`} style={{ width: pct(after) }} />
        <span className="tc-bar-before" style={{ left: pct(before) }} title={`Before: ${fmtMoney(before)}`} />
        {LINES.map((l) => (
          <span key={l.label} className="tc-bar-line" style={{ left: pct(l.at) }}>
            <em>{l.label}</em>
          </span>
        ))}
      </div>
    </div>
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
      <PayrollBar before={v.payrollAfter - v.incoming + v.outgoing} after={v.payrollAfter} />
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

function TeamEditor({
  team,
  index,
  teams,
  onChange,
  onRemove,
}: {
  team: DraftTeam;
  index: number;
  teams: DraftTeam[];
  onChange: (next: DraftTeam) => void;
  onRemove?: () => void;
}) {
  const multi = teams.length > 2;
  const setPlayer = (i: number, patch: Partial<DraftPlayer>) =>
    onChange({ ...team, players: team.players.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const firstOther = index === 0 ? 1 : 0;
  return (
    <fieldset className="tc-side panel">
      <legend className="eyebrow">Team {index + 1}</legend>
      <label className="tc-field">
        <span>Team name</span>
        <input value={team.name} onChange={(e) => onChange({ ...team, name: e.target.value })} maxLength={30} />
      </label>
      <label className="tc-field">
        <span>Team salary before the trade ($M)</span>
        <input inputMode="decimal" value={team.payroll} onChange={(e) => onChange({ ...team, payroll: e.target.value })} />
      </label>
      <div className="tc-presets" role="group" aria-label={`Quick salary presets for team ${index + 1}`}>
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn btn-ghost" onClick={() => onChange({ ...team, payroll: toInput(p.payroll) })}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="tc-check">
        <input type="checkbox" checked={team.hardCapped} onChange={(e) => onChange({ ...team, hardCapped: e.target.checked })} />
        <span>Hard-capped at the first apron (used the full mid-level or bi-annual exception, or took a sign-and-trade)</span>
      </label>
      <div className="tc-field">
        <span>Players sent out</span>
        {team.players.map((p, i) => (
          <div key={i} className="tc-player">
            <input
              className="tc-player-name"
              placeholder="Player (optional)"
              aria-label={`Team ${index + 1} player ${i + 1} name`}
              value={p.name}
              maxLength={40}
              onChange={(e) => setPlayer(i, { name: e.target.value })}
            />
            <input
              className="tc-player-salary"
              inputMode="decimal"
              placeholder="$M"
              aria-label={`Team ${index + 1} player ${i + 1} salary in millions`}
              value={p.salary}
              onChange={(e) => setPlayer(i, { salary: e.target.value })}
            />
            {multi && (
              <select aria-label={`Team ${index + 1} player ${i + 1} goes to`} value={p.to} onChange={(e) => setPlayer(i, { to: Number(e.target.value) })}>
                {teams.map((t, ti) => ti !== index && <option key={ti} value={ti}>to {t.name || `Team ${ti + 1}`}</option>)}
              </select>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`Remove player ${i + 1}`}
              onClick={() => onChange({ ...team, players: team.players.filter((_, j) => j !== i) })}
            >
              ✕
            </button>
          </div>
        ))}
        {team.players.length < 8 && (
          <button
            type="button"
            className="btn btn-secondary tc-add"
            onClick={() => onChange({ ...team, players: [...team.players, { name: '', salary: '', to: firstOther }] })}
          >
            + Add a player
          </button>
        )}
      </div>
      {onRemove && (
        <button type="button" className="btn btn-ghost" onClick={onRemove}>Remove this team</button>
      )}
    </fieldset>
  );
}

export function TradeCheckerScreen() {
  const page = PUBLIC_PAGES['/trade-checker'];
  const [teams, setTeams] = useState<DraftTeam[]>(initialTeams);
  const [shareState, setShareState] = useState<'idle' | 'copied' | string>('idle');

  const result = useMemo(() => {
    const assets: TradeAsset[] = teams.flatMap((t, from) =>
      t.players.map((p) => ({ from, to: teams.length === 2 ? 1 - from : p.to, salary: toDollars(p.salary), name: p.name })),
    );
    const parsed = teams.map((t, i) => ({ name: t.name.trim() || `Team ${i + 1}`, payroll: toDollars(t.payroll), hardCappedAtFirstApron: t.hardCapped }));
    return { ...checkMultiTeamTrade(parsed, assets), empty: assets.every((a) => !a.salary) };
  }, [teams]);

  const setTeam = (i: number, next: DraftTeam) => {
    setTeams((ts) => ts.map((t, j) => (j === i ? next : t)));
    setShareState('idle');
  };
  const addTeam = () =>
    setTeams((ts) => [...ts, { name: `Team ${String.fromCharCode(65 + ts.length)}`, payroll: toInput(NBA_CAP + 15_000_000), hardCapped: false, players: [{ name: '', salary: '', to: 0 }] }]);
  const removeTeam = (i: number) =>
    setTeams((ts) =>
      ts.filter((_, j) => j !== i).map((t) => ({
        ...t,
        // Players headed to the removed team (or past it) are re-pointed so nothing goes missing.
        players: t.players.map((p) => ({ ...p, to: p.to === i ? 0 : p.to > i ? p.to - 1 : p.to })),
      })),
    );

  const share = async () => {
    const url = `${SITE_URL}/trade-checker?t=${encodeTrade(teams)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
    } catch {
      setShareState(url);
    }
  };

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

        <div className={`tc-sides ${teams.length > 2 ? 'is-three' : ''}`}>
          {teams.map((t, i) => (
            <TeamEditor
              key={i}
              team={t}
              index={i}
              teams={teams}
              onChange={(next) => setTeam(i, next)}
              onRemove={teams.length > 2 ? () => removeTeam(i) : undefined}
            />
          ))}
        </div>
        {teams.length < 3 && (
          <button type="button" className="btn btn-ghost tc-add-team" onClick={addTeam}>+ Make it a 3-team trade</button>
        )}

        <section className={`tc-result panel ${result.ok ? 'is-ok' : 'is-bad'}`} aria-live="polite">
          <p className="eyebrow">Result</p>
          <h2 className="title-md">
            {result.empty ? 'Add the salaries each team sends' : result.ok ? 'This trade works on salary' : "This trade doesn't work"}
          </h2>
          {!result.empty && result.sides.map((v, i) => <Verdict key={i} v={v} />)}
          <div className="tc-actions">
            <button type="button" className="btn btn-primary" onClick={share} disabled={result.empty}>
              {shareState === 'copied' ? 'Link copied' : 'Copy share link'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { setTeams(EXAMPLE); setShareState('idle'); }}>
              Reset example
            </button>
          </div>
          {shareState !== 'idle' && shareState !== 'copied' && (
            <label className="tc-field">
              <span>Copy this link</span>
              <input readOnly value={shareState} onFocus={(e) => e.currentTarget.select()} />
            </label>
          )}
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
            <li><strong>Hard-capped teams:</strong> a team that used the full mid-level or bi-annual exception, or took a sign-and-trade, can't end above the first apron.</li>
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

        <NbaToolsNav current="/trade-checker" />

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
