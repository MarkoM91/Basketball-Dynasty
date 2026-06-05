import { Link } from 'react-router-dom';

type LandingChromeProps = {
  /** When false, logo is not a link (guide/compare subpages). */
  logoLinksHome?: boolean;
};

function BrandMark() {
  return (
    <>
      <div className="brand-mark" aria-hidden>
        BD
      </div>
      <span className="brand-name">Basketball Dynasty</span>
    </>
  );
}

export function LandingHeader({ logoLinksHome = true }: LandingChromeProps) {
  return (
    <header className="landing-topbar landing-topbar--logo-only">
      {logoLinksHome ? (
        <Link to="/" className="brand-lockup brand-lockup-link" aria-label="Basketball Dynasty home">
          <BrandMark />
        </Link>
      ) : (
        <div className="brand-lockup brand-lockup-static" aria-label="Basketball Dynasty">
          <BrandMark />
        </div>
      )}
    </header>
  );
}

export function LandingFooter({ logoLinksHome = true }: LandingChromeProps) {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-bar">
        {logoLinksHome ? (
          <Link to="/" className="brand-lockup brand-lockup-link" aria-label="Basketball Dynasty home">
            <BrandMark />
          </Link>
        ) : (
          <div className="brand-lockup brand-lockup-static" aria-label="Basketball Dynasty">
            <BrandMark />
          </div>
        )}
        <nav className="landing-footer-nav" aria-label="Site footer">
          <Link to="/guide" className="btn btn-ghost landing-guide-link">
            How to play
          </Link>
          <Link to="/compare" className="btn btn-ghost landing-guide-link">
            Compare
          </Link>
        </nav>
      </div>
      <p className="landing-footer-copy">
        Free browser basketball manager · No download required · League rosters as of 4 June 2026
      </p>
    </footer>
  );
}
