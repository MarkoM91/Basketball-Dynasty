import { Link } from 'react-router-dom';
import {
  COMPARE_FAQ,
  COMPARE_INTRO,
  COMPARE_ROWS,
  cellLabel,
} from '../content/compare';
import { LandingFooter, LandingHeader } from '../components/LandingChrome';
import { PUBLIC_PAGES } from '../seo';
function CompareTable({ caption }: { caption?: string }) {
  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        {caption && <caption className="compare-caption">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Basketball Dynasty</th>
            <th scope="col">Basketball GM</th>
            <th scope="col">Typical browser sim</th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map((row) => (
            <tr key={row.feature}>
              <th scope="row">
                {row.feature}
                {row.note && <span className="compare-row-note">{row.note}</span>}
              </th>
              <td className="compare-cell compare-cell--us">{cellLabel(row.dynasty)}</td>
              <td className="compare-cell">{cellLabel(row.basketballGm)}</td>
              <td className="compare-cell">{cellLabel(row.typical)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LandingCompareSection() {
  return (
    <section className="landing-compare" aria-labelledby="landing-compare-title">
      <p className="eyebrow">Compare</p>
      <h2 id="landing-compare-title" className="title-md landing-seo-title">
        Basketball Dynasty vs other basketball GM games
      </h2>
      <p className="body landing-seo-lead">{COMPARE_INTRO}</p>
      <CompareTable caption="Feature comparison for free online basketball manager games" />
      <p className="body landing-seo-more" style={{ marginTop: 16, marginBottom: 0 }}>
        <Link to="/compare">See full comparison</Link> including FAQ for Basketball GM fans.
      </p>
    </section>
  );
}

export function CompareScreen() {
  const page = PUBLIC_PAGES['/compare'];

  return (
    <div className="landing-page guide-page">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />

      <LandingHeader logoLinksHome={false} />

      <main className="guide-main">
        <p className="eyebrow">Compare</p>        <h1 className="title-lg">{page.h1 ?? 'Compare basketball manager games'}</h1>
        <p className="body guide-lead">{page.description}</p>

        <CompareTable caption="Basketball Dynasty compared to Basketball GM and typical browser basketball sims" />

        <section className="guide-faq" aria-labelledby="compare-faq-title">
          <h2 id="compare-faq-title" className="title-md landing-seo-title">Comparison FAQ</h2>
          <div className="landing-faq-list">
            {COMPARE_FAQ.map((item) => (
              <details key={item.question} className="landing-faq-item">
                <summary>{item.question}</summary>
                <p className="body landing-faq-answer">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="guide-cta panel panel-accent">
          <p className="eyebrow">Try the difference</p>
          <p className="body" style={{ marginTop: 8 }}>
            Start a free fictional franchise with trade counters, rival free-agent pitches, and a
            playoff bracket you can follow all the way to a title.
          </p>
          <div className="compare-cta-row">
            <Link to="/start" className="btn btn-primary">
              Start new franchise
            </Link>
            <Link to="/guide" className="btn btn-ghost">
              How to play
            </Link>
          </div>
        </div>
      </main>

      <LandingFooter logoLinksHome={false} />
    </div>
  );
}