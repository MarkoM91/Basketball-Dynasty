import type { Player, Position } from '../types/game';
import { portraitDataUri } from '../lib/visuals/portraits';
import { playerName } from '../data/scenarios';

const POSITION_COLORS: Record<Position, string> = {
  PG: '#3d7a8b',
  SG: '#6b4c9a',
  SF: '#a67c3d',
  PF: '#3d8b6e',
  C: '#8b4545',
};

export function PlayerAvatar({
  player,
  size = 52,
  showOverall = true,
}: {
  player: Pick<Player, 'id' | 'firstName' | 'lastName' | 'age' | 'position' | 'overall'>;
  size?: number;
  showOverall?: boolean;
}) {
  const ring =
    player.overall >= 85 ? '#c9a84c' : player.overall >= 78 ? '#a67c3d' : 'rgba(255,255,255,0.12)';
  const src = portraitDataUri(player);

  return (
    <div className="player-avatar-wrap" style={{ width: size, height: size }}>
      <div
        className="player-face-ring"
        style={{
          width: size,
          height: size,
          borderColor: ring,
          boxShadow: `0 0 0 1px ${(POSITION_COLORS[player.position] ?? '#666')}33`,
        }}
      >
        <img
          src={src}
          alt={playerName(player)}
          className="player-face-img"
          width={size}
          height={size}
          loading="lazy"
        />
      </div>
      {showOverall && <span className="player-avatar-ovr">{player.overall}</span>}
      <span className="player-avatar-pos">{player.position}</span>
    </div>
  );
}

export function CoachAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const parts = name.split(' ');
  const initials = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  return (
    <div className="player-avatar-wrap coach-avatar" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r="24" fill="#2a3040" stroke="#c9a84c" strokeWidth="2" />
        <text x="26" y="30" textAnchor="middle" fill="#c9a84c" fontSize="14" fontWeight="700" fontFamily="DM Sans, sans-serif">
          {initials}
        </text>
      </svg>
    </div>
  );
}
