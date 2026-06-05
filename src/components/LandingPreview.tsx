import { LEAGUE_TEAM_TEMPLATES } from '../data/league';
import { TeamLogo } from './TeamLogo';

const PREVIEW_HOME = LEAGUE_TEAM_TEMPLATES.find((t) => t.city === 'Portland')!;
const PREVIEW_AWAY = LEAGUE_TEAM_TEMPLATES.find((t) => t.city === 'Washington')!;

const PREVIEW_PLAYERS = [
  { name: 'Jalen Brooks', pos: 'PG', ovr: 88 },
  { name: 'Devin Carter', pos: 'SG', ovr: 80 },
  { name: 'Anthony Green', pos: 'C', ovr: 73 },
  { name: 'Aaron Adams', pos: 'PG', ovr: 67 },
];

export function LandingPreview() {
  return (
    <div className="landing-preview" aria-hidden>
      <p className="eyebrow">In your league</p>
      <div className="landing-preview-scoreboard">
        <div className="landing-preview-team landing-preview-team-win">
          <TeamLogo city={PREVIEW_HOME.city} name={PREVIEW_HOME.name} size={36} />
          <span>{PREVIEW_HOME.city}</span>
          <strong>108</strong>
        </div>
        <div className="landing-preview-team">
          <TeamLogo city={PREVIEW_AWAY.city} name={PREVIEW_AWAY.name} size={36} />
          <span>{PREVIEW_AWAY.city}</span>
          <strong>101</strong>
        </div>
      </div>
      <div className="landing-preview-leaders">
        {PREVIEW_PLAYERS.map((p) => (
          <div key={p.name} className="landing-preview-player">
            <span>{p.name} · {p.pos}</span>
            <span className="landing-preview-ovr">{p.ovr}</span>
          </div>
        ))}
      </div>
      <p className="body" style={{ fontSize: 11, margin: '10px 0 0', color: 'var(--silver)' }}>
        Illustrative — your league generates its own teams and storylines.
      </p>
    </div>
  );
}
