import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LEAGUE_TEAM_TEMPLATES } from '../data/league';
import { SCENARIOS } from '../data/scenarios';
import { getTeamVisual } from '../lib/visuals/teamLogos';
import { TeamLogo } from '../components/TeamLogo';
import { useGameStore } from '../store/gameStore';
import type { ScenarioId } from '../types/game';

export function OnboardingScreen() {
  const navigate = useNavigate();
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const {
    onboardingStep,
    selectedScenario,
    selectScenario,
    advanceOnboarding,
    resetOnboarding,
    startGame,
    startCustomGame,
  } = useGameStore();

  const step = onboardingStep <= 0 ? 1 : onboardingStep;

  const mainMenuLink = (
    <div className="start-page-nav">
      <Link to="/" className="back-link" onClick={() => resetOnboarding()}>
        ← Main menu
      </Link>
    </div>
  );

  if (showTeamPicker) {
    return (
      <div className="page landing-page landing-page-wide">
        <div className="start-page-nav">
          <button type="button" className="back-link" onClick={() => setShowTeamPicker(false)}>
            ← Scenario stories
          </button>
        </div>
        <p className="eyebrow">Any team</p>
        <h1 className="title-lg">Pick a franchise</h1>
        <p className="body" style={{ marginBottom: 20 }}>
          Same 30 teams — no scripted crisis. You set the plan.
        </p>
        <div className="team-picker-grid">
          {LEAGUE_TEAM_TEMPLATES.map((team) => {
            const visual = getTeamVisual(team.city, team.name);
            return (
              <button
                key={`${team.city}-${team.name}`}
                type="button"
                className="team-picker-card"
                style={{ '--team-accent': visual.primary } as CSSProperties}
                onClick={() => {
                  startCustomGame(team.city, team.name, team.market);
                  navigate('/office');
                }}
              >
                <TeamLogo city={team.city} name={team.name} size={48} />
                <div className="team-picker-copy">
                  <p className="eyebrow" style={{ marginBottom: 4 }}>{team.market} market</p>
                  <p className="team-picker-name">{team.city} {team.name}</p>
                  <p className="team-picker-abbrev">{visual.abbrev}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="page landing-page landing-page-wide">
        {mainMenuLink}
        <p className="eyebrow">Pick your scenario</p>
        <h1 className="title-lg">Choose a franchise</h1>
        <p className="body scenario-page-intro" style={{ marginBottom: 16 }}>
          Each card is a crisis, not a tutorial. Tap one to take the job.
        </p>
        <div className="scenario-grid">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
            const s = SCENARIOS[id];
            const f = s.franchise;
            return (
              <button
                key={id}
                type="button"
                className={`scenario-card ${selectedScenario === id ? 'selected' : ''}`}
                onClick={() => {
                  selectScenario(id);
                  advanceOnboarding();
                }}
              >
                <div className="scenario-card-head">
                  <TeamLogo city={f.city} name={f.name} size={44} />
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 4 }}>{s.title}</p>
                    <p className="scenario-card-team">{f.city} {f.name}</p>
                  </div>
                </div>
                <p className="scenario-card-hook">{s.hook}</p>
                <p className="body scenario-card-briefing">{s.briefing}</p>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn-ghost scenario-pick-team-btn"
          style={{ marginTop: 12, width: '100%' }}
          onClick={() => setShowTeamPicker(true)}
        >
          Or pick any team yourself →
        </button>
      </div>
    );
  }

  const scenario = selectedScenario ? SCENARIOS[selectedScenario] : null;
  if (!scenario) return null;

  const f = scenario.franchise;
  const star = f.roster.find((p) => p.isStar);

  return (
    <div className="page landing-page">
      {mainMenuLink}

      <div className="onboarding-hero">
        <TeamLogo city={f.city} name={f.name} size={64} />
        <div>
          <p className="eyebrow">Ownership briefing — Season {f.season}</p>
          <h1 className="title-lg" style={{ margin: 0 }}>{f.city} {f.name}</h1>
        </div>
      </div>

      <div className="panel panel-accent">
        <p className="eyebrow">Situation</p>
        <p className="body">{scenario.hook}</p>
      </div>

      <div className="stat-grid">
        <div className="stat-cell">
          <div className="stat-label">Ownership goal</div>
          <div className="stat-value" style={{ fontSize: 13 }}>{f.ownership.goal}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Record</div>
          <div className="stat-value">{f.record.wins}–{f.record.losses}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Window</div>
          <div className="stat-value">{f.window}</div>
        </div>
        <div className="stat-cell">
          <div className="stat-label">Job security</div>
          <div className="stat-value">{f.jobSecurity}%</div>
        </div>
      </div>

      {star && (
        <div className="panel panel-warning" style={{ marginTop: 12 }}>
          <p className="eyebrow">Franchise star</p>
          <p className="title-md">{star.firstName} {star.lastName}</p>
          <p className="body">{star.gmNote}</p>
        </div>
      )}

      <div className="panel" style={{ marginTop: 12 }}>
        <p className="eyebrow">First major decision</p>
        <p className="body">{scenario.firstDecision}</p>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 16, width: '100%' }}
        onClick={() => {
          startGame();
          navigate('/office');
        }}
      >
        Take control of the front office
      </button>
    </div>
  );
}
