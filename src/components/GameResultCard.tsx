import type { GameLogEntry } from '../types/game';
import { TeamLogo } from './TeamLogo';

export function GameResultCard({ game, highlight }: { game: GameLogEntry; highlight?: boolean }) {
  return (
    <div className={`game-result-card ${game.won ? 'game-win' : 'game-loss'} ${highlight ? 'game-highlight' : ''}`}>
      <div className="game-result-meta">
        <span className="mono">S{game.season} W{game.week}</span>
        <span className={`chip ${game.won ? 'chip-success' : 'chip-danger'}`}>{game.won ? 'W' : 'L'}</span>
        <span className="mono">{game.home ? 'HOME' : 'AWAY'}</span>
      </div>
      <div className="game-result-matchup">
        <TeamLogo fullName={game.opponent} size={32} />
        <div className="game-result-scoreline">
          <span className="game-result-us">{game.teamScore}</span>
          <span className="game-result-dash">–</span>
          <span className="game-result-them">{game.oppScore}</span>
        </div>
      </div>
      <p className="game-result-opp">vs {game.opponent}</p>
      {game.topScorer && (
        <p className="game-result-leaders mono">
          {game.topScorer.name} {game.topScorer.pts}pts
          {game.topRebounder ? ` · ${game.topRebounder.name} ${game.topRebounder.reb}reb` : ''}
          {game.topAssister ? ` · ${game.topAssister.name} ${game.topAssister.ast}ast` : ''}
        </p>
      )}
      <p className="body" style={{ marginTop: 6, fontSize: 12 }}>{game.note}</p>
    </div>
  );
}
