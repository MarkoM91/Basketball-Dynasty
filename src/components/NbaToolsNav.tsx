import { Link } from 'react-router-dom';
import { NBA_TOOLS } from '../content/capTools';

/** Cross-links between the free NBA cap tools (and into the game). */
export function NbaToolsNav({ current }: { current: string }) {
  return (
    <nav className="nba-tools-nav panel" aria-label="Free NBA cap tools">
      <p className="eyebrow">More free NBA cap tools</p>
      <ul>
        {NBA_TOOLS.filter((t) => t.href !== current).map((t) => (
          <li key={t.href}>
            <Link to={t.href}>
              <strong>{t.title}</strong>
              <span>{t.description}</span>
            </Link>
          </li>
        ))}
        <li>
          <a href="/guides/nba-free-agency-rules/">
            <strong>How NBA free agency works</strong>
            <span>Cap room, the mid-level exception and Bird rights.</span>
          </a>
        </li>
      </ul>
    </nav>
  );
}
