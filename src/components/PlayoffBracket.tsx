import type { League, PlayoffRound, PlayoffSeries, PlayoffState } from '../types/game';
import { getTeamById } from '../data/league';
import {
  BRACKET_ROUNDS,
  bracketHasFullHistory,
  buildFallbackFirstRoundSeries,
  buildPlayoffRunSummary,
  findUserEliminationSeries,
  getAllBracketSeries,
  groupSeriesByRound,
  opponentInSeries,
} from '../engine/playoffBracket';
import { roundLabel } from '../engine/playoffs';
import { Panel } from './UI';

type Props = {
  state: PlayoffState;
  league: League;
  userTeamId: string;
};

function TeamLine({
  seed,
  teamId,
  wins,
  league,
  isWinner,
  isUser,
}: {
  seed: number;
  teamId: string;
  wins: number;
  league: League;
  isWinner: boolean;
  isUser: boolean;
}) {
  const team = getTeamById(league, teamId);
  return (
    <div className={`bracket-team${isWinner ? ' bracket-team--winner' : ''}${isUser ? ' bracket-team--user' : ''}`}>
      <span className="bracket-seed">#{seed}</span>
      <span className="bracket-name">{team?.fullName ?? 'Unknown'}</span>
      <span className="bracket-wins">{wins}</span>
    </div>
  );
}

function MatchupCard({
  series,
  league,
  userTeamId,
}: {
  series: PlayoffSeries;
  league: League;
  userTeamId: string;
}) {
  const userLost =
    series.userInvolved && series.complete && series.winnerId && series.winnerId !== userTeamId;
  const userActive = series.userInvolved && !series.complete;

  return (
    <div
      className={`bracket-matchup${series.userInvolved ? ' bracket-matchup--user' : ''}${userLost ? ' bracket-matchup--loss' : ''}${userActive ? ' bracket-matchup--live' : ''}`}
    >
      <TeamLine
        seed={series.higherSeed.seed}
        teamId={series.higherSeed.teamId}
        wins={series.higherWins}
        league={league}
        isWinner={series.winnerId === series.higherSeed.teamId}
        isUser={series.higherSeed.teamId === userTeamId}
      />
      <TeamLine
        seed={series.lowerSeed.seed}
        teamId={series.lowerSeed.teamId}
        wins={series.lowerWins}
        league={league}
        isWinner={series.winnerId === series.lowerSeed.teamId}
        isUser={series.lowerSeed.teamId === userTeamId}
      />
      {userLost && <span className="chip chip-danger bracket-tag">You lost here</span>}
      {userActive && <span className="chip chip-gold bracket-tag">Your series</span>}
      {series.userInvolved && series.complete && series.winnerId === userTeamId && (
        <span className="chip chip-success bracket-tag">You advanced</span>
      )}
    </div>
  );
}

function RoundColumn({
  round,
  series,
  league,
  userTeamId,
}: {
  round: PlayoffRound;
  series: PlayoffSeries[];
  league: League;
  userTeamId: string;
}) {
  if (!series.length) return null;

  return (
    <div className="bracket-round">
      <p className="bracket-round-label">{roundLabel(round)}</p>
      {series.map((item) => (
        <MatchupCard key={item.id} series={item} league={league} userTeamId={userTeamId} />
      ))}
    </div>
  );
}

export function PlayoffBracket({ state, league, userTeamId }: Props) {
  const summary = buildPlayoffRunSummary(state, league, userTeamId);
  const fullHistory = bracketHasFullHistory(state);
  let grouped = groupSeriesByRound(getAllBracketSeries(state));

  if (!fullHistory && state.round === 'Complete') {
    const fallback = buildFallbackFirstRoundSeries(league, userTeamId, state.userResult);
    if (fallback && !grouped['First Round'].some((series) => series.userInvolved)) {
      grouped = {
        ...grouped,
        'First Round': [fallback, ...grouped['First Round']],
      };
    }
  }

  const elimination = findUserEliminationSeries(state, userTeamId);
  const eliminationOpponent = elimination
    ? getTeamById(league, opponentInSeries(elimination, userTeamId).teamId)?.fullName
    : undefined;

  return (
    <Panel accent={Boolean(elimination)} className="bracket-panel">
      <p className="eyebrow">Playoff bracket</p>
      <p className="body bracket-summary">{summary}</p>

      {elimination && eliminationOpponent && (
        <p className="body bracket-elimination">
          <strong style={{ color: 'var(--off-white)' }}>Elimination:</strong>{' '}
          {roundLabel(elimination.round)} vs {eliminationOpponent}
        </p>
      )}

      {!fullHistory && state.round === 'Complete' && (
        <p className="body bracket-note">
          Earlier rounds from this save were not stored — full brackets are tracked for new playoff runs.
        </p>
      )}

      <div className="bracket-grid">
        {BRACKET_ROUNDS.map((round) => (
          <RoundColumn
            key={round}
            round={round}
            series={grouped[round]}
            league={league}
            userTeamId={userTeamId}
          />
        ))}
      </div>

      {state.championName && (
        <p className="body" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          <strong style={{ color: 'var(--gold)' }}>Champion:</strong> {state.championName}
        </p>
      )}
    </Panel>
  );
}
