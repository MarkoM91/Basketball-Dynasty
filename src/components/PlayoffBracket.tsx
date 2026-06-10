import { useEffect, useRef } from 'react';
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

const ROUND_MATCHUP_COUNT: Record<PlayoffRound, number> = {
  'First Round': 8,
  'Quarterfinals': 4,
  'Semifinals': 2,
  'Finals': 1,
  'Complete': 0,
};

function TbdMatchup() {
  return (
    <div className="bracket-matchup bracket-matchup--tbd">
      <div className="bracket-team">
        <span className="bracket-seed">—</span>
        <span className="bracket-name bracket-tbd-name">TBD</span>
        <span className="bracket-wins">—</span>
      </div>
      <div className="bracket-team">
        <span className="bracket-seed">—</span>
        <span className="bracket-name bracket-tbd-name">TBD</span>
        <span className="bracket-wins">—</span>
      </div>
    </div>
  );
}

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
  isActive,
}: {
  round: PlayoffRound;
  series: PlayoffSeries[];
  league: League;
  userTeamId: string;
  isActive: boolean;
}) {
  const expected = ROUND_MATCHUP_COUNT[round];
  const tbdCount = Math.max(0, expected - series.length);

  return (
    <div className={`bracket-round${isActive ? ' bracket-round--active' : ''}`}>
      <p className="bracket-round-label">{roundLabel(round)}</p>
      <div className="bracket-round-matchups">
        {series.map((item) => (
          <MatchupCard key={item.id} series={item} league={league} userTeamId={userTeamId} />
        ))}
        {Array.from({ length: tbdCount }).map((_, i) => (
          <TbdMatchup key={`tbd-${i}`} />
        ))}
      </div>
    </div>
  );
}

export function PlayoffBracket({ state, league, userTeamId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRoundRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (activeRoundRef.current && scrollRef.current) {
      const el = activeRoundRef.current;
      const container = scrollRef.current;
      const elLeft = el.offsetLeft;
      const elWidth = el.offsetWidth;
      const containerWidth = container.offsetWidth;
      container.scrollLeft = elLeft - containerWidth / 2 + elWidth / 2;
    }
  }, [state.round]);

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

      <div className="bracket-scroll-wrapper">
        <div className="bracket-grid" ref={scrollRef}>
          {BRACKET_ROUNDS.map((round) => {
            const isActive = state.round === round;
            return (
              <div
                key={round}
                ref={isActive ? activeRoundRef : undefined}
                className="bracket-round-wrapper"
              >
                <RoundColumn
                  round={round}
                  series={grouped[round]}
                  league={league}
                  userTeamId={userTeamId}
                  isActive={isActive}
                />
              </div>
            );
          })}
        </div>
        <div className="bracket-fade-right" />
      </div>

      {state.championName && (
        <p className="body" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          <strong style={{ color: 'var(--gold)' }}>Champion:</strong> {state.championName}
        </p>
      )}
    </Panel>
  );
}
