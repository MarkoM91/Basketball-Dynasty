import { useEffect, useMemo, useState } from 'react';
import { playerName } from '../data/scenarios';
import { getTeamById } from '../data/league';
import { getUserPlayoffMatchup } from '../engine/playoffs';
import { currentScheduledGame, opponentStrength } from '../engine/schedule';
import { autoStartingFive, estimateWinChance, GAMES_PER_WEEK, lineupTalent } from '../engine/simulation';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { TeamLogo } from '../components/TeamLogo';
import { CourtBackdrop } from '../components/CourtBackdrop';
import { Icon } from '../components/Icon';
import { useGameStore } from '../store/gameStore';
import type { Player, Position } from '../types/game';

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
  } = useGameStore();
  const [slots, setSlots] = useState<string[]>(EMPTY);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [confirmSkip, setConfirmSkip] = useState(false);

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

  const odds = useMemo(() => {
    if (!franchise || !league || !opponentId || !full) return null;
    const opp = opponentStrength(league, opponentId, franchise, franchise.week);
    return {
      you: Math.round(lineupTalent(franchise, slots)),
      them: Math.round(opp),
      win: estimateWinChance(franchise, slots, opp, home),
    };
  }, [franchise, league, opponentId, slots, full, home]);

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

  const bestLineup = () => {
    const picks = autoStartingFive(franchise);
    if (picks.length === 5) commit(picks);
  };

  const canPlay = full && (isPlayoffs ? playoffMatchup !== null : gamesLeft > 0 && isRegularSeason && Boolean(nextRegular));

  const handlePlay = () => {
    if (!full) return;
    setStartingFive(slots);
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
      </CourtBackdrop>

      <section className="panel gameday-five">
        <div className="gameday-five-head">
          <p className="eyebrow" style={{ margin: 0 }}>Starting five</p>
          <button type="button" className="btn btn-ghost" onClick={bestLineup}>
            Best lineup
          </button>
        </div>
        <ul className="gameday-slots">
          {SLOTS.map((pos, i) => {
            const p = slots[i] ? byId(slots[i]) : undefined;
            const outOfPosition = p && p.position !== pos;
            return (
              <li key={pos}>
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
              </li>
            );
          })}
        </ul>
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
