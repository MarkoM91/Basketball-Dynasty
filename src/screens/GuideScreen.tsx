import { Link } from 'react-router-dom';
import { GUIDE_FAQ, GUIDE_SECTIONS, GUIDE_TIPS } from '../content/guide';
import { LandingFooter, LandingHeader } from '../components/LandingChrome';
import { PUBLIC_PAGES } from '../seo';

export function GuideScreen() {
  const page = PUBLIC_PAGES['/guide'];

  return (
    <div className="landing-page guide-page">
      <div className="bg-mesh" aria-hidden="true" />
      <div className="bg-grain" aria-hidden="true" />

      <LandingHeader logoLinksHome={false} />

      <main className="guide-main">
        <p className="eyebrow">How to play</p>
        <h1 className="title-lg">{page.h1 ?? 'How to play Basketball Dynasty'}</h1>
        <p className="body guide-lead">{page.description}</p>

        <nav className="guide-toc" aria-label="Guide sections">
          <p className="eyebrow">On this page</p>
          <ol>
            {GUIDE_SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="guide-sections">
          {GUIDE_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="guide-section panel">
              <h2 className="title-md guide-section-title">{section.title}</h2>
              <p className="body guide-section-body">{section.body}</p>
            </section>
          ))}
        </div>

        <section className="guide-tips panel" aria-labelledby="guide-tips-title">
          <h2 id="guide-tips-title" className="title-md guide-section-title">GM tips</h2>
          <ul className="guide-tip-list">
            {GUIDE_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <section className="guide-faq" aria-labelledby="guide-faq-title">
          <h2 id="guide-faq-title" className="title-md landing-seo-title">Guide FAQ</h2>
          <div className="landing-faq-list">
            {GUIDE_FAQ.map((item) => (
              <details key={item.question} className="landing-faq-item">
                <summary>{item.question}</summary>
                <p className="body landing-faq-answer">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="guide-cta panel panel-accent">
          <p className="eyebrow">Ready to play?</p>
          <p className="body" style={{ marginTop: 8 }}>
            Start a free browser franchise — no download, no account required.
          </p>
          <Link to="/start" className="btn btn-primary" style={{ marginTop: 14, display: 'inline-block' }}>
            Start new franchise
          </Link>
        </div>
      </main>

      <LandingFooter logoLinksHome={false} />
    </div>
  );
}