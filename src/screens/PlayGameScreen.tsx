import { useEffect, useMemo, useRef, useState } from 'react';
import { playerName } from '../data/scenarios';
import { getTeamById } from '../data/league';
import { getUserPlayoffMatchup } from '../engine/playoffs';
import { currentScheduledGame, opponentStrength } from '../engine/schedule';
import { autoStartingFive, GAMES_PER_WEEK } from '../engine/simulation';
import { gameDayOdds, scoutOpponent, standingsLine } from '../engine/gameDay';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TeamLogo } from '../components/TeamLogo';
import { CourtBackdrop } from '../components/CourtBackdrop';
import { Icon } from '../components/Icon';
import { useGameStore } from '../store/gameStore';
import type { GameLogEntry, Player, Position } from '../types/game';

const SLOTS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const EMPTY: string[] = ['', '', '', '', ''];

/**
 * Game day. Fixes and simplifications:
 * - Lineup is five FIXED slots (PG→C). The old packed array shifted everyone left when a starter
 *   was removed, so removing your SG moved the SF into the SG slot.
 * - Tap a slot → picker with natural-position players first; picking a current starter swaps.
 * - The matchup shows both sides' strength and a win chance, so lineup choices have stakes.
 * - Play / Sim week are pinned above the nav instead of under an 18-row list.
 */
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
  const [editFive, setEditFive] = useState(false);
  const [recapId, setRecapId] = useState<string | null>(null);
  // Id of the newest game BEFORE pressing Play; when a newer one appears, show its recap.
  const pendingRecap = useRef<string | null | undefined>(undefined);
  const topGameId = franchise?.gameLog?.[0]?.id;
  useEffect(() => {
    if (pendingRecap.current !== undefined && topGameId && topGameId !== pendingRecap.current) {
      setRecapId(topGameId);
      pendingRecap.current = undefined;
    }
  }, [topGameId]);
  const [slots, setSlots] = useState<string[]>(EMPTY);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const drag = useRef<{ from: number; pointerId: number } | null>(null);

  // Initialise once per franchise from the saved five (or the best auto lineup).
  useEffect(() => {
    if (!franchise) return;
    const healthy = new Set(franchise.roster.filter((p) => !p.injured).map((p) => p.id));
    const saved = franchise.startingFive?.length === 5 ? franchise.startingFive : autoStartingFive(franchise);
    setSlots(saved.map((id) => (healthy.has(id) ? id : '')).concat(EMPTY).slice(0, 5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [franchise?.id]);

  const isPlayoffs = franchise?.phase === 'playoffs';
  const gamesPlayed = franchise?.gamesThisWeek ?? 0;
  const gamesLeft = franchise ? Math.max(0, GAMES_PER_WEEK - gamesPlayed) : 0;
  const isRegularSeason = franchise?.phase === 'regular_season' || franchise?.phase === 'trade_deadline';
  const weekComplete = isRegularSeason && gamesLeft === 0;
  const nextRegular = franchise && league && !isPlayoffs ? currentScheduledGame(franchise, league) : null;
  const playoffMatchup =
    isPlayoffs && franchise?.playoffs && league ? getUserPlayoffMatchup(franchise.playoffs, league) : null;

  const opponentId = isPlayoffs ? playoffMatchup?.opponentId : nextRegular?.opponentId;
  const opponent = opponentId && league ? getTeamById(league, opponentId) : undefined;
  const home = isPlayoffs ? false : Boolean(nextRegular?.home);
  const full = slots.every(Boolean);

  const secondGame = !isPlayoffs && gamesPlayed >= 1;
  const odds = useMemo(() => {
    if (!franchise || !league || !opponentId || !full) return null;
    const opp = opponentStrength(league, opponentId, franchise, franchise.week);
    const current = gameDayOdds(franchise, slots, opp, home, secondGame);
    const auto = autoStartingFive(franchise);
    const best = auto.length === 5 ? gameDayOdds(franchise, auto, opp, home, secondGame) : current;
    return { ...current, bestWin: best.win };
  }, [franchise, league, opponentId, slots, full, home, secondGame]);
  const scouting = useMemo(
    () => (franchise && league && opponentId ? scoutOpponent(league, opponentId, franchise) : null),
    [franchise, league, opponentId],
  );

  if (!franchise) return null;

  const byId = (id: string) => franchise.roster.find((p) => p.id === id);

  const commit = (next: string[]) => {
    setSlots(next);
    if (next.every(Boolean)) setStartingFive(next);
  };

  const assign = (slot: number, playerId: string) => {
    const next = [...slots];
    const from = next.indexOf(playerId);
    if (from >= 0) next[from] = next[slot]; // swap with whoever held the target slot
    next[slot] = playerId;
    commit(next);
    setPickingSlot(null);
  };

  const swapSlots = (from: number, to: number) => {
    if (from === to || to < 0 || to >= SLOTS.length) return;
    const next = [...slots];
    [next[from], next[to]] = [next[to], next[from]];
    commit(next);
  };

  const slotAtPoint = (x: number, y: number): number | null => {
    const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-lineup-slot]');
    return row ? Number(row.dataset.lineupSlot) : null;
  };

  const cancelDrag = () => {
    drag.current = null;
    setDragSlot(null);
    setDropSlot(null);
  };

  const bestLineup = () => {
    const picks = autoStartingFive(franchise);
    if (picks.length === 5) commit(picks);
  };

  const canPlay = full && (isPlayoffs ? playoffMatchup !== null : gamesLeft > 0 && isRegularSeason && Boolean(nextRegular));

  const handlePlay = () => {
    if (!full) return;
    setStartingFive(slots);
    if (!isPlayoffs) pendingRecap.current = franchise.gameLog?.[0]?.id ?? null;
    if (isPlayoffs) playPlayoffGame();
    else playGame();
  };

  const winTone = !odds ? '' : odds.win >= 60 ? 'good' : odds.win >= 45 ? 'mid' : 'bad';

  // ── Slot picker ─────────────────────────────────────────────────────────────
  if (pickingSlot !== null) {
    const pos = SLOTS[pickingSlot];
    const healthy = franchise.roster.filter((p) => !p.injured);
    const natural = healthy.filter((p) => p.position === pos).sort((a, b) => b.overall - a.overall);
    const others = healthy.filter((p) => p.position !== pos).sort((a, b) => b.overall - a.overall);
    const injured = franchise.roster.filter((p) => p.injured);
    const row = (p: Player) => {
      const at = slots.indexOf(p.id);
      const current = at === pickingSlot;
      return (
        <li key={p.id}>
          <button
            type="button"
            className={`deal-option ${current ? 'is-on' : ''}`}
            onClick={() => assign(pickingSlot, p.id)}
          >
            <PlayerAvatar player={p} size={40} showOverall={false} />
            <span className="deal-option-copy">
              <strong>{playerName(p)}</strong>
              <span>
                {p.position} · {p.age}
                {at >= 0 && !current ? ` · starting at ${SLOTS[at]} (swap)` : ''}
                {current ? ' · current starter' : ''}
              </span>
            </span>
            <span className="deal-ovr">{p.overall}</span>
          </button>
        </li>
      );
    };
    return (
      <div className="deal-sheet" role="dialog" aria-modal="true" aria-label={`Choose your ${pos}`}>
        <header className="deal-head">
          <div>
            <p className="eyebrow">Starting five</p>
            <h2 className="deal-title">Choose your {pos}</h2>
          </div>
          <button type="button" className="deal-close" onClick={() => setPickingSlot(null)} aria-label="Close">
            <Icon name="x" size={22} />
          </button>
        </header>
        <div className="deal-body">
          {natural.length > 0 && <p className="deal-section-label">Natural {pos}s</p>}
          <ul className="deal-pick-list">{natural.map(row)}</ul>
          <p className="deal-section-label">Everyone else</p>
          <ul className="deal-pick-list">{others.map(row)}</ul>
          {injured.length > 0 && (
            <p className="deal-hint" style={{ marginTop: 16 }}>
              Out injured: {injured.map((p) => `${playerName(p)} (${p.injuryWeeks ?? '?'}w)`).join(', ')}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Recap (shown right after Play — no jump to Box Scores) ─────────────────
  const recap: GameLogEntry | undefined = recapId ? franchise.gameLog?.find((g) => g.id === recapId) : undefined;
  if (recap) {
    const standing = league ? standingsLine(league) : null;
    const performers = [
      recap.topScorer && `${recap.topScorer.name} ${recap.topScorer.pts} pts`,
      recap.topRebounder && `${recap.topRebounder.name} ${recap.topRebounder.reb} reb`,
      recap.topAssister && `${recap.topAssister.name} ${recap.topAssister.ast} ast`,
    ].filter(Boolean) as string[];
    const nextAction = () => {
      setRecapId(null);
      if (gamesLeft > 0) return;
      advanceWeek();
      // Both games played → straight to next week's Game Day (advanceWeek lands on the Office).
      const after = useGameStore.getState();
      const inSeason = after.franchise?.phase === 'regular_season' || after.franchise?.phase === 'trade_deadline';
      if (inSeason && after.screen === 'home') setScreen('play_game');
    };
    return (
      <div className="page page-court gameday">
        <section className={`recap recap--${recap.won ? 'win' : 'loss'}`}>
          <p className="eyebrow">
            Final · {recap.home ? 'vs' : '@'} {recap.opponent}
            {recap.winChance !== undefined ? ` · you had a ${recap.winChance}% chance` : ''}
          </p>
          <div className="recap-score">
            <span className="recap-result">{recap.won ? 'W' : 'L'}</span>
            <strong>{recap.teamScore}</strong>
            <span className="recap-dash">–</span>
            <strong className="recap-them">{recap.oppScore}</strong>
          </div>
          <h1 className="title-lg recap-headline">{recap.headline ?? recap.note}</h1>
          {recap.quarters && (
            <table className="recap-quarters">
              <thead>
                <tr><th /><th>1</th><th>2</th><th>3</th><th>4</th><th>F</th></tr>
              </thead>
              <tbody>
                <tr>
                  <th>{franchise.name}</th>
                  {recap.quarters.map(([us], i) => <td key={i}>{us}</td>)}
                  <td className="recap-final">{recap.teamScore}</td>
                </tr>
                <tr>
                  <th>{recap.opponent.split(' ').slice(-1)[0]}</th>
                  {recap.quarters.map(([, them], i) => <td key={i}>{them}</td>)}
                  <td className="recap-final">{recap.oppScore}</td>
                </tr>
              </tbody>
            </table>
          )}
          {recap.turningPoint && <p className="recap-turning"><Icon name="development" size={14} /> Turning point: {recap.turningPoint}</p>}
          {performers.length > 0 && (
            <ul className="recap-performers">
              {performers.map((line) => <li key={line}>{line}</li>)}
            </ul>
          )}
          {standing && <p className="recap-standing">{standing}</p>}
          <button type="button" className="btn btn-ghost recap-box" onClick={() => setScreen('results')}>
            All box scores
          </button>
        </section>
        <div className="gameday-bar">
          {gamesLeft > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => { setRecapId(null); advanceWeek(); }}>
              Sim rest of week
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={nextAction}>
            {gamesLeft > 0 ? 'Next game' : 'Next week'}
          </button>
        </div>
      </div>
    );
  }

  // ── Game day ────────────────────────────────────────────────────────────────
  return (
    <div className="page page-court gameday">
      <CourtBackdrop compact>
        <p className="eyebrow">
          {isPlayoffs
            ? `Playoffs · ${playoffMatchup?.round ?? franchise.playoffs?.round ?? 'Postseason'}`
            : weekComplete
              ? `Week ${franchise.week} · ${GAMES_PER_WEEK} of ${GAMES_PER_WEEK} games played`
              : `Week ${franchise.week} · Game ${Math.min(gamesPlayed + 1, GAMES_PER_WEEK)} of ${GAMES_PER_WEEK}`}
        </p>
        {opponent ? (
          <div className="gameday-matchup">
            <TeamLogo city={franchise.city} name={franchise.name} size={44} />
            <span className="gameday-vs">{home ? 'vs' : '@'}</span>
            <TeamLogo city={opponent.city} name={opponent.name} size={44} />
            <h1 className="title-lg gameday-opp">{opponent.fullName}</h1>
          </div>
        ) : (
          <h1 className="title-lg">{isPlayoffs ? 'No active series' : weekComplete ? 'Week complete' : 'No game scheduled'}</h1>
        )}
        {weekComplete && <p className="gameday-series">Both games are finished. Advance to next week to keep playing.</p>}
        {isPlayoffs && playoffMatchup && <p className="gameday-series">{playoffMatchup.seriesLine}</p>}
        {odds && (
          <div className="gameday-odds">
            <div>
              <span>Your five</span>
              <strong>{odds.you}</strong>
            </div>
            <div>
              <span>{opponent?.abbrev ?? 'Them'}</span>
              <strong>{odds.them}</strong>
            </div>
            <div className={`gameday-win gameday-win--${winTone}`}>
              <span>Win chance</span>
              <strong>{odds.win}%</strong>
            </div>
          </div>
        )}
        {odds && odds.reasons.length > 0 && (
          <p className="gameday-why">Why: {odds.reasons.join(' · ')}</p>
        )}
        {scouting && (
          <p className="gameday-scout">
            <strong>{scouting.record}</strong>
            {scouting.star ? ` · ${scouting.star.name} (${scouting.star.overall}) leads them` : ''}
            <span>{scouting.line}</span>
          </p>
        )}
      </CourtBackdrop>

      <section className="panel gameday-five">
        <div className="gameday-five-head">
          <p className="eyebrow" style={{ margin: 0 }}>Starting five</p>
          <button type="button" className="btn btn-ghost" onClick={() => setEditFive((v) => !v)}>
            {editFive ? 'Done' : 'Edit'}
          </button>
        </div>
        {odds && odds.bestWin > odds.win && (
          <button type="button" className="gameday-best-hint" onClick={bestLineup}>
            Best lineup: {odds.bestWin}% (+{odds.bestWin - odds.win}) — tap to use it
          </button>
        )}
        {!editFive && (
          <ul className="gameday-chips">
            {SLOTS.map((pos, i) => {
              const p = slots[i] ? byId(slots[i]) : undefined;
              return (
                <li key={pos}>
                  <button type="button" onClick={() => setPickingSlot(i)}>
                    <span className="gameday-chip-pos">{pos}</span>
                    <span className="gameday-chip-name">{p ? p.lastName : 'Empty'}</span>
                    <span className="gameday-chip-ovr">{p ? p.overall : '—'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {editFive && (<>
        <p className="gameday-drag-hint">Drag the handles to swap positions, or tap a player to choose a replacement.</p>
        <ul className="gameday-slots">
          {SLOTS.map((pos, i) => {
            const p = slots[i] ? byId(slots[i]) : undefined;
            const outOfPosition = p && p.position !== pos;
            return (
              <li key={pos} data-lineup-slot={i} className={`gameday-slot-wrap ${dragSlot === i ? 'is-dragging' : ''} ${dropSlot === i && dragSlot !== i ? 'is-drop-target' : ''}`}>
                <button type="button" className={`gameday-slot ${p ? '' : 'is-empty'}`} onClick={() => setPickingSlot(i)}>
                  <span className="gameday-slot-pos">{pos}</span>
                  {p ? (
                    <>
                      <PlayerAvatar player={p} size={40} showOverall={false} />
                      <span className="deal-option-copy">
                        <strong>{playerName(p)}</strong>
                        <span>{outOfPosition ? `Natural ${p.position} · playing ${pos}` : `${p.age} yrs`}</span>
                      </span>
                      <span className="deal-ovr">{p.overall}</span>
                    </>
                  ) : (
                    <span className="deal-option-copy">
                      <strong>Pick a {pos}</strong>
                      <span>Tap to choose</span>
                    </span>
                  )}
                  <Icon name="chevron-right" size={18} className="deal-chevron" />
                </button>
                <button
                  type="button"
                  className="gameday-drag-handle"
                  aria-label={`Move ${p ? playerName(p) : pos}. Drag to swap positions or use arrow keys.`}
                  disabled={!p}
                  onPointerDown={(event) => {
                    if (!event.isPrimary || event.button !== 0) return;
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    drag.current = { from: i, pointerId: event.pointerId };
                    setDragSlot(i);
                    setDropSlot(i);
                  }}
                  onPointerMove={(event) => {
                    if (drag.current?.pointerId !== event.pointerId) return;
                    setDropSlot(slotAtPoint(event.clientX, event.clientY));
                    // The handle owns the gesture; the rest of the row remains scrollable.
                    if (event.clientY < 100) window.scrollBy(0, -12);
                    else if (event.clientY > window.innerHeight - 170) window.scrollBy(0, 12);
                  }}
                  onPointerUp={(event) => {
                    const current = drag.current;
                    if (!current || current.pointerId !== event.pointerId) return;
                    const target = slotAtPoint(event.clientX, event.clientY);
                    if (target !== null) swapSlots(current.from, target);
                    cancelDrag();
                  }}
                  onPointerCancel={cancelDrag}
                  onLostPointerCapture={cancelDrag}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                      event.preventDefault();
                      swapSlots(i, i + (event.key === 'ArrowUp' ? -1 : 1));
                    }
                  }}
                ><span aria-hidden="true">⠿</span></button>
              </li>
            );
          })}
        </ul>
        </>)}
      </section>

      {!isPlayoffs && (
        <div className="gameday-skip">
          {confirmSkip ? (
            <>
              <span>Sim the whole regular season?</span>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmSkip(false)}>Cancel</button>
              <button type="button" className="btn btn-secondary" onClick={advanceToPlayoffs}>Yes, skip</button>
            </>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmSkip(true)}>
              Skip to playoffs
            </button>
          )}
        </div>
      )}

      <div className="gameday-bar">
        {!isPlayoffs && !weekComplete && (
          <button type="button" className="btn btn-secondary" onClick={advanceWeek}>
            {gamesLeft > 0 ? 'Sim week' : 'Next week'}
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={!weekComplete && !canPlay} onClick={weekComplete ? advanceWeek : handlePlay}>
          {weekComplete
            ? 'Next week'
            : !full
            ? 'Fill all 5 slots'
            : isPlayoffs
              ? 'Play playoff game'
              : gamesLeft > 0
                ? `Play game · ${gamesLeft} left`
                : 'Week done'}
        </button>
      </div>
    </div>
  );
}
