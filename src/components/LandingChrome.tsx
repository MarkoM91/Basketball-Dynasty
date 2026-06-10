import { useState } from 'react';
import { Link } from 'react-router-dom';

type LandingChromeProps = {
  /** When false, logo is not a link (guide/compare subpages). */
  logoLinksHome?: boolean;
};

// ── Logo options ────────────────────────────────────────────────

/** 1. Hardwood Hex — gold hex frame, basketball face inside */
export function LogoHex() {
  return (
    <svg viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1-outer" x1="4" y1="2" x2="40" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0d070" />
          <stop offset="100%" stopColor="#8a5010" />
        </linearGradient>
        <linearGradient id="g1-ball" x1="6" y1="8" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e07030" />
          <stop offset="100%" stopColor="#a03808" />
        </linearGradient>
        <clipPath id="c1-inner">
          {/* Slightly inset hex for basketball face */}
          <polygon points="22,6 37,14 37,30 22,38 7,30 7,14" />
        </clipPath>
        <clipPath id="c1-outer">
          <polygon points="22,2 40,12 40,32 22,42 4,32 4,12" />
        </clipPath>
      </defs>

      {/* Gold hex border ring */}
      <polygon points="22,2 40,12 40,32 22,42 4,32 4,12" fill="url(#g1-outer)" />

      {/* Basketball face inset */}
      <polygon points="22,6 37,14 37,30 22,38 7,30 7,14" fill="url(#g1-ball)" />

      {/* Bold basketball seams */}
      {/* Vertical S-curve */}
      <path d="M22 7 Q30 22 22 37" stroke="#1a0800" strokeWidth="1.8" fill="none" strokeLinecap="round" clipPath="url(#c1-inner)" />
      <path d="M22 7 Q14 22 22 37" stroke="#1a0800" strokeWidth="1.8" fill="none" strokeLinecap="round" clipPath="url(#c1-inner)" />
      {/* Horizontal seam */}
      <path d="M7 22 Q14.5 17 22 22 Q29.5 27 37 22" stroke="#1a0800" strokeWidth="1.8" fill="none" strokeLinecap="round" clipPath="url(#c1-inner)" />

      {/* Gold hex outer border */}
      <polygon points="22,2 40,12 40,32 22,42 4,32 4,12" fill="none" stroke="#f0d070" strokeWidth="1.5" />
      {/* Inner ring border */}
      <polygon points="22,6 37,14 37,30 22,38 7,30 7,14" fill="none" stroke="#c06020" strokeWidth="0.6" opacity="0.5" />
    </svg>
  );
}

/** 2. Crown — 3 basketball circles atop a regal crown base */
function LogoCrown() {
  return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g2" x1="4" y1="0" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0d070" />
          <stop offset="100%" stopColor="#a05c10" />
        </linearGradient>
      </defs>
      {/* Crown base */}
      <path d="M6 38 L6 24 L14 32 L22 14 L30 32 L38 24 L38 38 Z" fill="url(#g2)" />
      {/* Crown base platform */}
      <rect x="4" y="36" width="36" height="5" rx="2" fill="url(#g2)" />
      {/* Basketball on left point */}
      <circle cx="14" cy="32" r="4" fill="url(#g2)" stroke="#0a0a0a" strokeWidth="0.5" opacity="0.9" />
      <path d="M14 28 Q16.5 32 14 36" stroke="#0a0a0a" strokeWidth="0.7" fill="none" opacity="0.5" />
      <path d="M10 32 Q14 30.5 18 32" stroke="#0a0a0a" strokeWidth="0.7" fill="none" opacity="0.5" />
      {/* Basketball on center peak */}
      <circle cx="22" cy="14" r="5" fill="url(#g2)" stroke="#0a0a0a" strokeWidth="0.5" opacity="0.9" />
      <path d="M22 9 Q25 14 22 19" stroke="#0a0a0a" strokeWidth="0.8" fill="none" opacity="0.5" />
      <path d="M17 14 Q22 12 27 14" stroke="#0a0a0a" strokeWidth="0.8" fill="none" opacity="0.5" />
      {/* Basketball on right point */}
      <circle cx="30" cy="32" r="4" fill="url(#g2)" stroke="#0a0a0a" strokeWidth="0.5" opacity="0.9" />
      <path d="M30 28 Q32.5 32 30 36" stroke="#0a0a0a" strokeWidth="0.7" fill="none" opacity="0.5" />
      <path d="M26 32 Q30 30.5 34 32" stroke="#0a0a0a" strokeWidth="0.7" fill="none" opacity="0.5" />
    </svg>
  );
}

/** 3. Ring — championship ring from above, bold "D" in center stone */
function LogoRing() {
  return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g3a" x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0d878" />
          <stop offset="100%" stopColor="#8a5010" />
        </linearGradient>
        <linearGradient id="g3b" x1="10" y1="10" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a2a4a" />
          <stop offset="100%" stopColor="#0a0f1e" />
        </linearGradient>
      </defs>
      {/* Outer ring band */}
      <circle cx="22" cy="22" r="20" fill="url(#g3a)" />
      {/* Inner gem face */}
      <circle cx="22" cy="22" r="13" fill="url(#g3b)" />
      {/* Gem facets */}
      <path d="M22 9 L32 22 L22 35 L12 22 Z" stroke="#c9a84c" strokeWidth="0.6" fill="none" opacity="0.35" />
      <line x1="22" y1="9" x2="22" y2="35" stroke="#c9a84c" strokeWidth="0.5" opacity="0.25" />
      <line x1="12" y1="22" x2="32" y2="22" stroke="#c9a84c" strokeWidth="0.5" opacity="0.25" />
      {/* "D" letterform */}
      <text x="22" y="28" textAnchor="middle" fontSize="16" fontWeight="900" fontFamily="Georgia,serif" fill="#c9a84c" letterSpacing="-1">D</text>
      {/* Ring band detail notches */}
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const r = 17.5;
        const rad = (deg * Math.PI) / 180;
        const x = 22 + r * Math.cos(rad);
        const y = 22 + r * Math.sin(rad);
        return <circle key={i} cx={x} cy={y} r="1.2" fill="#0a0a0a" opacity="0.3" />;
      })}
    </svg>
  );
}

/** 4. Court Monogram — bold "BD" built from court lines + arc */
function LogoCourt() {
  return (
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g4" x1="2" y1="2" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8c76a" />
          <stop offset="100%" stopColor="#9a6318" />
        </linearGradient>
      </defs>
      {/* Background square with rounded corners */}
      <rect x="2" y="2" width="40" height="40" rx="8" fill="#111318" stroke="url(#g4)" strokeWidth="1.5" />
      {/* Court center circle */}
      <circle cx="22" cy="22" r="10" stroke="#c9a84c" strokeWidth="1" fill="none" opacity="0.2" />
      {/* Center line */}
      <line x1="22" y1="2" x2="22" y2="42" stroke="#c9a84c" strokeWidth="0.8" opacity="0.15" />
      {/* 3pt arc suggestion — top */}
      <path d="M10 34 Q22 6 34 34" stroke="#c9a84c" strokeWidth="0.8" fill="none" opacity="0.2" />
      {/* Bold "BD" */}
      <text x="22" y="30" textAnchor="middle" fontSize="17" fontWeight="900" fontFamily="Arial Black,sans-serif" fill="url(#g4)" letterSpacing="-1">BD</text>
    </svg>
  );
}

/** 5. Shard — angular diamond / championship gem, no text needed at small size */
function LogoShard() {
  return (
    <svg viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g5a" x1="22" y1="2" x2="22" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f5e090" />
          <stop offset="50%" stopColor="#c9a030" />
          <stop offset="100%" stopColor="#7a4a08" />
        </linearGradient>
        <linearGradient id="g5b" x1="2" y1="20" x2="42" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8c040" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#f5e090" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {/* Main shard / gem shape */}
      <polygon points="22,2 40,18 22,48 4,18" fill="url(#g5a)" />
      {/* Upper facet divider */}
      <line x1="22" y1="2" x2="4" y2="18" stroke="#fff" strokeWidth="0.6" opacity="0.3" />
      <line x1="22" y1="2" x2="40" y2="18" stroke="#fff" strokeWidth="0.6" opacity="0.3" />
      {/* Horizontal belt */}
      <line x1="4" y1="18" x2="40" y2="18" stroke="#fff" strokeWidth="0.8" opacity="0.25" />
      {/* Lower facet lines */}
      <line x1="22" y1="48" x2="10" y2="28" stroke="#000" strokeWidth="0.6" opacity="0.2" />
      <line x1="22" y1="48" x2="34" y2="28" stroke="#000" strokeWidth="0.6" opacity="0.2" />
      {/* Basketball seam on shard */}
      <path d="M22 10 Q27 18 22 34" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.3" />
      <path d="M22 10 Q17 18 22 34" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.3" />
      <path d="M10 20 Q16 17 22 20 Q28 23 34 20" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

const LOGO_OPTIONS = [
  { id: 'hex',    label: 'Hardwood Hex',    Logo: LogoHex   },
  { id: 'crown',  label: 'Crown',           Logo: LogoCrown },
  { id: 'ring',   label: 'Dynasty Ring',    Logo: LogoRing  },
  { id: 'court',  label: 'Court Mono',      Logo: LogoCourt },
  { id: 'shard',  label: 'Shard',           Logo: LogoShard },
] as const;

type LogoId = typeof LOGO_OPTIONS[number]['id'];

// Change this to whichever ID you want to use in production
const ACTIVE_LOGO: LogoId = 'hex';

function BrandMark({ logoId = ACTIVE_LOGO }: { logoId?: LogoId }) {
  const option = LOGO_OPTIONS.find((o) => o.id === logoId) ?? LOGO_OPTIONS[0];
  return (
    <>
      <option.Logo />
      <span className="brand-name">Basketball Dynasty</span>
    </>
  );
}

/** Temporary picker — drop this inside the landing page to compare options visually */
export function LogoPicker() {
  const [active, setActive] = useState<LogoId>(ACTIVE_LOGO);
  return (
    <div className="logo-picker">
      <p className="logo-picker-label">Logo options — pick one</p>
      <div className="logo-picker-grid">
        {LOGO_OPTIONS.map(({ id, label, Logo }) => (
          <button
            key={id}
            type="button"
            className={`logo-picker-option ${active === id ? 'logo-picker-option--active' : ''}`}
            onClick={() => setActive(id)}
          >
            <div className="logo-picker-svg"><Logo /></div>
            <span className="logo-picker-name">{label}</span>
            {active === id && <span className="logo-picker-check">✓</span>}
          </button>
        ))}
      </div>
      <p className="logo-picker-hint">
        To set permanently, change <code>ACTIVE_LOGO</code> in <code>LandingChrome.tsx</code>
      </p>
    </div>
  );
}

export function LandingHeader({ logoLinksHome = true }: LandingChromeProps) {
  return (
    <header className="landing-topbar">
      <Link to="/" className="brand-lockup brand-lockup-link" aria-label="Basketball Dynasty home">
        <BrandMark />
      </Link>
      {!logoLinksHome && (
        <nav className="landing-topbar-nav">
          <Link to="/" className="btn btn-ghost landing-topbar-btn">
            ← Main menu
          </Link>
          <Link to="/guide" className="btn btn-ghost landing-topbar-btn">
            Guide
          </Link>
          <Link to="/compare" className="btn btn-ghost landing-topbar-btn">
            Compare
          </Link>
        </nav>
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
          <a href="https://discord.gg/Uh7Z9j6uS" className="btn btn-ghost landing-guide-link" target="_blank" rel="noopener">
            Discord
          </a>
          <a href="https://www.reddit.com/r/BasketballDynastyGM" className="btn btn-ghost landing-guide-link" target="_blank" rel="noopener">
            Reddit
          </a>
        </nav>
      </div>
      <p className="landing-footer-copy">
        Free browser basketball manager · No download required · League rosters as of 4 June 2026
      </p>
    </footer>
  );
}
