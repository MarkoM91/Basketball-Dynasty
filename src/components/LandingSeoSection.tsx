import {
  COMPETITOR_GAPS,
  LANDING_FAQ,
  PUBLIC_PAGES,
  SITE_DESCRIPTION,
} from '../seo';
import { Link } from 'react-router-dom';
import { LandingCompareSection } from './LandingCompareSection';

export function LandingSeoSection() {
  return (
    <section className="landing-seo" aria-labelledby="landing-seo-title">
      <div className="landing-seo-intro">
        <p className="eyebrow">Free browser basketball manager</p>
        <h2 id="landing-seo-title" className="title-md landing-seo-title">
          Run a pro basketball front office online — no download
        </h2>
        <p className="body landing-seo-lead">
          {SITE_DESCRIPTION} Compete against 29 AI teams, survive the trade deadline, draft with
          imperfect scouting, and chase a title through a 16-team playoff bracket.
        </p>
      </div>

      <div className="landing-seo-grid">
        {COMPETITOR_GAPS.map((item) => (
          <article key={item.title} className="landing-seo-card">
            <h3 className="landing-seo-card-title">{item.title}</h3>
            <p className="body landing-seo-card-body">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="landing-seo-keywords">
        <p className="eyebrow">Built for GM sim fans searching for</p>
        <ul className="landing-seo-tag-list">
          {[
            'free online basketball manager game',
            'basketball GM simulation browser',
            'basketball dynasty builder',
            'basketball front office simulator',
            'trade deadline & cap management game',
            'playoff bracket basketball sim',
          ].map((phrase) => (
            <li key={phrase}>{phrase}</li>
          ))}
        </ul>
      </div>

      <LandingCompareSection />

      <div className="landing-seo-faq">
        <h2 className="title-md landing-seo-title">Frequently asked questions</h2>
        <div className="landing-faq-list">
          {LANDING_FAQ.map((item) => (
            <details key={item.question} className="landing-faq-item">
              <summary>{item.question}</summary>
              <p className="body landing-faq-answer">{item.answer}</p>
            </details>
          ))}
        </div>
        <p className="body landing-seo-more" style={{ marginTop: 16, marginBottom: 0 }}>
          New to GM sims? Read the full{' '}
          <Link to="/guide">how to play guide</Link> — season loop, trades, cap, draft, and playoffs.
        </p>
      </div>
    </section>
  );
}

export function StartPageSeoIntro() {
  const page = PUBLIC_PAGES['/start'];
  return (
    <section className="landing-seo-start" aria-label="About starting a franchise">
      <p className="body landing-seo-lead" style={{ marginBottom: 0 }}>
        {page.description} Choose a scripted scenario with a built-in crisis, or pick any franchise
        in the league and write your own rebuild or win-now story.
      </p>
    </section>
  );
}
