import { buildTeamLogoSvg, getTeamVisual, teamLogoDataUri } from '../lib/visuals/teamLogos';

function resolveTeam(fullName?: string, city?: string, name?: string): { city: string; name: string } {
  if (city && name) return { city, name };
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    const teamName = parts.pop() ?? 'Team';
    const teamCity = parts.join(' ') || 'League';
    return { city: teamCity, name: teamName };
  }
  return { city: city ?? 'League', name: name ?? 'Team' };
}

export function TeamLogo({
  city,
  name,
  fullName,
  size = 36,
}: {
  city?: string;
  name?: string;
  fullName?: string;
  size?: number;
}) {
  const team = resolveTeam(fullName, city, name);
  const visual = getTeamVisual(team.city, team.name);
  const src = teamLogoDataUri(team.city, team.name);

  return (
    <div
      className="team-logo-wrap"
      style={{ width: size, height: size }}
      title={`${team.city} ${team.name}`}
    >
      <img
        src={src}
        alt={`${team.city} ${team.name} logo`}
        width={size}
        height={size}
        className="team-logo-img"
        loading="lazy"
      />
      <span className="team-logo-abbrev">{visual.abbrev}</span>
    </div>
  );
}

/** For places that need inline SVG string (e.g. export) */
export { buildTeamLogoSvg, teamLogoDataUri };
