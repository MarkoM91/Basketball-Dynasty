import { useEffect, useState } from 'react';
import { playerName } from '../data/scenarios';
import { getUserPlayoffMatchup } from '../engine/playoffs';
import { currentScheduledGame } from '../engine/schedule';
import { autoStartingFive, GAMES_PER_WEEK, lineupStrength } from '../engine/simulation';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { CourtBackdrop } from '../components/CourtBackdrop';
import { useGameStore } from '../store/gameStore';
import { Panel } from '../components/UI';
import type { Position } from '../types/game';

const SLOT_LABELS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export function PlayGameScreen() {
  const {
    franchise,
    league,
    setStartingFive,
    playGame,
    playPlayoffGame,
    advanceWeek,
    advanceToPlayoffs,
    setScreen,
  } = useGameStore();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [lineup, setLineup] = useState<string[]>([]);

  useEffect(() => {
    if (franchise?.startingFive?.length === 5) {
      setLineup(franchise.startingFive);
    }
  }, [franchise?.startingFive]);

  const isPlayoffs = franchise?.phase === 'playoffs';
  const gamesLeft = franchise ? GAMES_PER_WEEK - (franchise.gamesThisWeek ?? 0) : 0;
  const nextRegular =
    franchise && league && !isPlayoffs ? currentScheduledGame(franchise, league) : null;
  const matchup =
    isPlayoffs && franchise?.playoffs && league
      ? getUserPlayoffMatchup(franchise.playoffs, league)
      : null;

  const strength =
    franchise && lineup.length === 5 ? Math.round(lineupStrength(franchise, lineup)) : 0;

  if (!franchise) return null;

  const canPlayRegular =
    (franchise.phase === 'regular_season' || franchise.phase === 'trade_deadline') &&
    gamesLeft > 0 &&
    lineup.length === 5;

  const canPlayPlayoffs = isPlayoffs && lineup.length === 5 && matchup !== null;

  const commitLineup = (next: string[]) => {
    setLineup(next);
    if (next.length === 5) setStartingFive(next);
  };

  const togglePlayer = (playerId: string) => {
    if (lineup.includes(playerId)) {
      commitLineup(lineup.filter((id) => id !== playerId));
      return;
    }
    if (selectedSlot !== null) {
      const next = [...lineup];
      while (next.length <= selectedSlot) next.push('');
      next[selectedSlot] = playerId;
      commitLineup(next.filter(Boolean).slice(0, 5));
      setSelectedSlot(null);
      return;
    }
    if (lineup.length >= 5) return;
    commitLineup([...lineup, playerId]);
  };

  const resetLineup = () => {
    setSelectedSlot(null);
    const picks = autoStartingFive(franchise);
    if (picks.length === 5) commitLineup(picks);
  };

  const clearLineup = () => {
    setSelectedSlot(null);
    setLineup([]);
  };

  const handlePlay = () => {
    if (lineup.length === 5) setStartingFive(lineup);
    if (isPlayoffs) {
      playPlayoffGame();
      return;
    }
    playGame();
  };

  const handleBack = () => {
    setScreen(isPlayoffs ? 'playoffs' : 'home');
  };

  const rosterSorted = [...franchise.roster]
    .filter((p) => !p.injured)
    .sort((a, b) => b.overall - a.overall);

  return (
    <div className="page page-court">
      <CourtBackdrop compact>
        <div className="header-bar" style={{ marginBottom: 0 }}>
          <div>
            <p className="eyebrow">
              {isPlayoffs
                ? `Playoffs — ${matchup?.round ?? franchise.playoffs?.round ?? 'Postseason'}`
                : `Game day — Week ${franchise.week}`}
            </p>
            <h1 className="title-lg">Set your starting five</h1>
          </div>
          <button type="button" className="btn btn-ghost" onClick={handleBack}>Back</button>
        </div>
        <p className="body" style={{ marginTop: 8 }}>
          {isPlayoffs ? (
            matchup ? (
              <>
                vs <strong>{matchup.opponentName}</strong> · {matchup.seriesLine}
                {lineup.length === 5 && (
                  <> · Lineup strength <strong style={{ color: 'var(--gold)' }}>{strength}</strong></>
                )}
              </>
            ) : (
              'No active series — return to the playoff center.'
            )
          ) : (
            <>
              {nextRegular ? (
                <>
                  {nextRegular.home ? 'vs' : '@'} <strong>{nextRegular.opponentName}</strong>
                  {' · '}
                </>
              ) : null}
              Games this week: {franchise.gamesThisWeek ?? 0}/{GAMES_PER_WEEK}
              {lineup.length === 5 && (
                <> · Lineup strength <strong style={{ color: 'var(--gold)' }}>{strength}</strong></>
              )}
            </>
          )}
        </p>
      </CourtBackdrop>

      <Panel accent>
        <div className="lineup-court">
          {SLOT_LABELS.map((pos, i) => {
            const player = franchise.roster.find((p) => p.id === lineup[i]);
            return (
              <button
                key={pos}
                type="button"
                className={`lineup-slot ${selectedSlot === i ? 'lineup-slot-active' : ''} ${player ? 'lineup-slot-filled' : ''}`}
                onClick={() => setSelectedSlot(selectedSlot === i ? null : i)}
              >
                <span className="lineup-slot-pos">{pos}</span>
                {player ? (
                  <>
                    <PlayerAvatar player={player} size={44} showOverall={false} />
                    <span className="lineup-slot-name">{player.lastName}</span>
                    <span className="lineup-slot-ovr">{player.overall}</span>
                  </>
                ) : (
                  <span className="lineup-slot-empty">Tap slot, then player</span>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={resetLineup}>
            Reset lineup
            <small style={{ display: 'block', fontSize: 11, opacity: 0.75, marginTop: 2 }}>
              Auto-pick your best available starters by position
            </small>
          </button>
          {lineup.length > 0 && (
            <button type="button" className="btn btn-ghost" style={{ width: '100%' }} onClick={clearLineup}>
              Clear all slots
            </button>
          )}
        </div>
      </Panel>

      <Panel>
        <p className="eyebrow">Available players</p>
        {rosterSorted.map((p) => {
          const inLineup = lineup.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              className={`lineup-pick ${inLineup ? 'lineup-pick-active' : ''}`}
              onClick={() => togglePlayer(p.id)}
            >
              <PlayerAvatar player={p} size={40} showOverall={false} />
              <span>{playerName(p)}</span>
              <strong>{p.overall}</strong>
              {inLineup && <span className="chip chip-gold">START</span>}
            </button>
          );
        })}
      </Panel>

      <div style={{ display: 'grid', gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={isPlayoffs ? !canPlayPlayoffs : !canPlayRegular}
          onClick={handlePlay}
        >
          {isPlayoffs
            ? canPlayPlayoffs
              ? 'Play playoff game'
              : 'Pick 5 starters to play'
            : canPlayRegular
              ? `Play game (${gamesLeft} left this week)`
              : 'Pick 5 starters to play'}
        </button>
        {!isPlayoffs && (
          <>
            <button type="button" className="btn btn-secondary" onClick={advanceWeek}>
              Advance week {gamesLeft > 0 ? `(auto-sim ${gamesLeft} remaining)` : ''}
            </button>
            <button type="button" className="btn btn-ghost" onClick={advanceToPlayoffs}>
              Skip to playoffs
            </button>
          </>
        )}
      </div>
    </div>
  );
}
