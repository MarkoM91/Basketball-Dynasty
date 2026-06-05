import { phaseLabel, statusFromRecord, GAMES_PER_WEEK } from '../engine/simulation';
import { franchiseRegularSeasonRecord } from '../engine/regularSeasonRecord';
import { userPlayoffGamePending } from '../engine/playoffs';
import { getStandings } from '../data/league';
import { computeTeamFinances, formatFin } from '../engine/finances';
import { nextScheduledGame } from '../engine/schedule';
import { GameResultCard } from '../components/GameResultCard';
import { CourtBackdrop } from '../components/CourtBackdrop';
import { TeamLogo } from '../components/TeamLogo';
import { PlayMenu } from '../components/PlayMenu';
import { StandingsTable } from '../components/StandingsTable';
import { useViewTeamRoster } from '../hooks/useViewTeamRoster';
import { useGameStore } from '../store/gameStore';
import { MoraleChip, Panel, ProgressBar } from '../components/UI';

function primaryCta(phase: string, userPlayoffPending: boolean, draftOnClock: boolean): string {
  switch (phase) {
    case 'playoffs':
      return userPlayoffPending ? 'Set starting five & play' : 'Sim league playoff games';
    case 'free_agency': return 'Advance free agency market';
    case 'contract_renewals': return 'Review contract renewals';
    case 'season_review': return 'Enter offseason (draft first)';
    case 'training_camp': return 'Open regular season';
    case 'draft_scouting':
    case 'draft_night':
      return draftOnClock ? 'Make your pick' : 'Run to my pick';
    default: return 'Advance Week';
  }
}

export function HomeScreen() {
  const {
    franchise,
    league,
    leagueHeadlines,
    advanceWeek,
    advanceToPlayoffs,
    lastWeekSummary,
    setScreen,
    resolvePendingEvent,
    startDraftNight,
    runToUserPick,
  } = useGameStore();
  const viewTeamRoster = useViewTeamRoster();
  if (!franchise) return null;

  const record = franchiseRegularSeasonRecord(franchise, league ?? undefined);
  const pending = franchise.pendingEvents?.[0];
  const review = franchise.seasonReview;
  const recentGames = (franchise.gameLog ?? []).slice(0, 3);
  const pendingRFA = (franchise.rfaOffers ?? []).filter((o) => o.status === 'pending').length;
  const userPlayoffPending =
    franchise.phase === 'playoffs' &&
    franchise.playoffs?.active &&
    league
      ? userPlayoffGamePending(franchise.playoffs, league)
      : false;

  const fin = computeTeamFinances(franchise);
  const standings = league ? getStandings(league) : [];
  const userRank = standings.findIndex((t) => t.isUser) + 1;
  const miniStandings = standings.slice(0, 5);
  const nextGame = league ? nextScheduledGame(franchise, league) : undefined;

  const draftOnClock = Boolean(franchise.draftNight?.active && franchise.draftNight.onClock);

  const playPrimary = () => {
    if (userPlayoffPending) {
      setScreen('play_game');
      return;
    }
    if (franchise.phase === 'regular_season' || franchise.phase === 'trade_deadline') {
      const left = GAMES_PER_WEEK - (franchise.gamesThisWeek ?? 0);
      if (left > 0) setScreen('play_game');
      else advanceWeek();
      return;
    }
    if (franchise.phase === 'draft_scouting' || franchise.phase === 'draft_night') {
      if (!franchise.draftNight?.active) {
        startDraftNight();
      } else if (!franchise.draftNight.onClock) {
        runToUserPick();
        setScreen('draft');
      } else {
        setScreen('draft');
      }
      return;
    }
    if (franchise.phase === 'contract_renewals') {
      setScreen('contract_renewals');
      return;
    }
    if (franchise.phase === 'free_agency') {
      setScreen('free_agency');
      return;
    }
    if (franchise.phase === 'playoffs') {
      setScreen('playoffs');
      return;
    }
    advanceWeek();
  };

  const playLabel = userPlayoffPending
    ? 'Set starting five & play'
    : franchise.phase === 'regular_season' || franchise.phase === 'trade_deadline'
      ? (franchise.gamesThisWeek ?? 0) < GAMES_PER_WEEK
        ? 'Play next game'
        : 'Advance week'
      : primaryCta(franchise.phase, userPlayoffPending, draftOnClock);

  return (
    <div className="page page-court">
      <CourtBackdrop compact>
        <div className="header-bar desktop-hide-header" style={{ marginBottom: 0 }}>
          <div className="office-hero-title">
            <TeamLogo city={franchise.city} name={franchise.name} size={44} />
            <div>
              <p className="eyebrow">Season {franchise.season} — Week {franchise.week}</p>
              <h1 className="title-lg">{franchise.city} {franchise.name}</h1>
            </div>
          </div>
          <span className="chip chip-gold">{phaseLabel(franchise.phase)}</span>
        </div>
        <div className="hero-record animate-pulse-glow">
          <span className="hero-record-label">Record</span>
          <span className="hero-record-value">{record.wins}–{record.losses}</span>
          <span className="hero-record-status">{statusFromRecord(franchise)}</span>
        </div>
      </CourtBackdrop>

      <PlayMenu
        phase={franchise.phase}
        gamesThisWeek={franchise.gamesThisWeek ?? 0}
        gamesPerWeek={GAMES_PER_WEEK}
        primaryLabel={playLabel}
        onPrimary={playPrimary}
        secondaryActions={[
          { label: 'Schedule', onClick: () => setScreen('schedule') },
          { label: 'Finances', onClick: () => setScreen('finances') },
          { label: 'League', onClick: () => setScreen('league') },
        ]}
      />

      {(nextGame || league) && (
        <Panel accent className="animate-slide-up">
          <div className="header-bar" style={{ marginBottom: 8 }}>
            <p className="eyebrow" style={{ margin: 0 }}>Dashboard</p>
            <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setScreen('schedule')}>
              Full schedule →
            </button>
          </div>
          <div className="bbgm-dash-grid">
            {nextGame && (
              <div className="bbgm-dash-card">
                <p className="eyebrow">Next game</p>
                <button
                  type="button"
                  className="dash-opponent-btn"
                  onClick={() => viewTeamRoster(nextGame.opponentId)}
                >
                  <span className="title-md" style={{ fontSize: 15, margin: 0 }}>
                    {nextGame.home ? 'vs' : '@'} {nextGame.opponentName}
                  </span>
                </button>
                <p className="body" style={{ fontSize: 12 }}>Week {nextGame.week} · Play menu to sim</p>
              </div>
            )}
            <div className="bbgm-dash-card">
              <p className="eyebrow">Finances</p>
              <p className={`title-md ${fin.profit >= 0 ? 'success-text' : 'danger-text'}`} style={{ fontSize: 15, margin: '4px 0' }}>
                {formatFin(fin.profit)} profit
              </p>
              <p className="body" style={{ fontSize: 12 }}>
                Rev {formatFin(fin.revenue.total)} · Exp {formatFin(fin.expenses.total)}
              </p>
            </div>
            {league && userRank > 0 && (
              <div className="bbgm-dash-card">
                <p className="eyebrow">Standings</p>
                <p className="title-md" style={{ fontSize: 15, margin: '4px 0' }}>#{userRank} · {record.wins}–{record.losses}</p>
                <p className="body" style={{ fontSize: 12 }}>
                  Playoff odds {franchise.playoffOdds}%
                </p>
              </div>
            )}
          </div>
        </Panel>
      )}

      {league && miniStandings.length > 0 && (
        <Panel>
          <p className="eyebrow">League leaders</p>
          <StandingsTable
            teams={miniStandings}
            userTeamId={franchise.leagueTeamId}
            compact
            onTeamClick={(team) => viewTeamRoster(team.id)}
          />
          <button type="button" className="btn btn-ghost" style={{ marginTop: 8, width: '100%' }} onClick={() => setScreen('league')}>
            Full standings & stat leaders
          </button>
        </Panel>
      )}

      <div className="home-dashboard">
        <div className="home-dashboard-main">
      {(recentGames.length > 0 || franchise.phase === 'regular_season') && (
        <Panel accent className="animate-slide-up">
          <div className="header-bar" style={{ marginBottom: 8 }}>
            <p className="eyebrow" style={{ margin: 0 }}>Recent results</p>
            <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setScreen('results')}>
              All scores →
            </button>
          </div>
          {recentGames.length === 0 ? (
            <p className="body">Advance the week to sim your next games. Scores appear here immediately.</p>
          ) : (
            <div className="game-results-grid">
              {recentGames.map((game) => (
                <GameResultCard key={game.id} game={game} highlight={game.id === recentGames[0]?.id} />
              ))}
            </div>
          )}
        </Panel>
      )}

      {review && franchise.phase === 'season_review' && (
        <Panel accent>
          <p className="eyebrow">Season review — Grade {review.grade}</p>
          <p className="body">{review.ownershipVerdict}</p>
          {review.primaryIssue && (
            <p className="body" style={{ marginTop: 8 }}>
              Primary issue: {review.primaryIssue}
            </p>
          )}
          <p className="body" style={{ marginTop: 8 }}>
            Offseason priority: {review.offseasonPriority}
          </p>
        </Panel>
      )}

      {pending && (
        <Panel warning>
          <p className="eyebrow">{pending.title}</p>
          <p className="body">{pending.body}</p>
          {pending.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="event-option"
              onClick={() => resolvePendingEvent(pending.id, opt.id)}
            >
              {opt.label}
              <small>{opt.effects}</small>
            </button>
          ))}
        </Panel>
      )}

      {(franchise.phase === 'regular_season' || franchise.phase === 'trade_deadline') && (
        <Panel accent className="animate-slide-up">
          <p className="eyebrow">This week — {franchise.gamesThisWeek ?? 0}/3 games played</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => setScreen('play_game')}>
              Play game — set starting five
            </button>
            <button type="button" className="btn btn-secondary" onClick={advanceWeek}>
              Advance week
            </button>
            <button type="button" className="btn btn-ghost" onClick={advanceToPlayoffs}>
              Skip to playoffs
            </button>
          </div>
        </Panel>
      )}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 8, marginBottom: 12, display: franchise.phase === 'regular_season' || franchise.phase === 'trade_deadline' ? 'none' : undefined }}
        onClick={advanceWeek}
      >
        {primaryCta(franchise.phase, userPlayoffPending, draftOnClock)}
      </button>

      {franchise.phase === 'playoffs' && (
        <button type="button" className="btn btn-secondary" style={{ marginBottom: 12, width: '100%' }} onClick={() => setScreen('playoffs')}>
          Open playoff command center
        </button>
      )}

      {franchise.phase === 'contract_renewals' && (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ marginBottom: 12, width: '100%' }}
          onClick={() => setScreen('contract_renewals')}
        >
          Open contract renewals
        </button>
      )}

      {franchise.phase === 'free_agency' && (
        <button type="button" className="btn btn-secondary" style={{ marginBottom: 12, width: '100%' }} onClick={() => setScreen('free_agency')}>
          Open free agency war room
        </button>
      )}
        </div>

        <div className="home-dashboard-side">
      <Panel>
        <div className="stat-grid">
          <div className="stat-cell">
            <div className="stat-label">Playoff odds</div>
            <div className="stat-value success">{franchise.playoffOdds}%</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Title odds</div>
            <div className="stat-value">{franchise.titleOdds}%</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Window</div>
            <div className="stat-value" style={{ fontSize: 12 }}>{franchise.window}</div>
          </div>
          <div className="stat-cell">
            <div className="stat-label">Job security</div>
            <div className="stat-value">{franchise.jobSecurity}%</div>
          </div>
        </div>
        <ProgressBar value={franchise.jobSecurity} />
      </Panel>

      <Panel>
        <p className="eyebrow">Franchise pulse</p>
        <div className="analysis-block" style={{ marginTop: 0 }}>
          <div className="analysis-row"><span>Ownership goal</span><strong>{franchise.ownership.goal}</strong></div>
          <div className="analysis-row"><span>Fan mood</span><strong><MoraleChip value={franchise.fanMood} /></strong></div>
          <div className="analysis-row"><span>Locker room</span><strong><MoraleChip value={franchise.lockerRoom} /></strong></div>
          <div className="analysis-row"><span>Star happiness</span><strong><MoraleChip value={franchise.starHappiness} /></strong></div>
        </div>
      </Panel>

      {pendingRFA > 0 && franchise.phase === 'free_agency' && (
        <Panel warning>
          <p className="eyebrow">Restricted free agency</p>
          <p className="body">{pendingRFA} offer sheet{pendingRFA > 1 ? 's' : ''} on your RFAs — match or lose them.</p>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setScreen('free_agency')}>
            Review offer sheets
          </button>
        </Panel>
      )}

      {leagueHeadlines.length > 0 && franchise.phase === 'regular_season' && (
        <Panel>
          <p className="eyebrow">League intel</p>
          {leagueHeadlines.slice(0, 2).map((h) => (
            <p key={h} className="body" style={{ margin: '4px 0', fontSize: 12 }}>{h}</p>
          ))}
          <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setScreen('league')}>
            League table & leaders
          </button>
        </Panel>
      )}

      {lastWeekSummary && franchise.phase === 'regular_season' && (
        <Panel>
          <p className="eyebrow">Last week summary</p>
          <p style={{ margin: 0, fontSize: 14 }}>{lastWeekSummary.headline}</p>
          {lastWeekSummary.injuryNote && (
            <p className="body" style={{ marginTop: 8, color: '#e87878' }}>{lastWeekSummary.injuryNote}</p>
          )}
        </Panel>
      )}

      <div className="home-quick-grid">
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('results')}>Box scores</button>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('roster')}>Roster</button>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('league')}>League table</button>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('trade')}>Trades</button>
      </div>
        </div>
      </div>
    </div>
  );
}
