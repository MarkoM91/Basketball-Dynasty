import { useEffect, useMemo, useState } from 'react';

import { ROSTER_SIZE } from '../data/rosterBuilder';
import { formatMoney } from '../data/scenarios';
import { formatUsableCapRoom } from '../engine/cap';
import { canAddPlayer, signingRosterLimit } from '../engine/rosterCuts';

import {
  marketHeatLabel,
  minSalaryToSign,
  offerSalaryBounds,
  previewOffer,
  rivalPitchWarning,
} from '../engine/freeAgency';

import { avoidForAgent, buildFreeAgencyBriefing, targetForAgent } from '../engine/freeAgencyAdvisor';

import { useGameStore } from '../store/gameStore';

import type { FreeAgent, Franchise, League, PitchType } from '../types/game';

import { Panel, ProgressBar } from '../components/UI';
import { Icon } from '../components/Icon';

const PITCHES: PitchType[] = ['max_offer', 'team_friendly', 'win_now', 'featured_role'];

function pitchShortLabel(p: PitchType): string {
  switch (p) {
    case 'max_offer':
      return 'Max $';
    case 'team_friendly':
      return 'Team deal';
    case 'win_now':
      return 'Win now';
    case 'featured_role':
      return 'Big role';
  }
}

const PITCH_HELP: Record<PitchType, string> = {
  max_offer: 'Lead with money — beats rival bids, costs the most.',
  team_friendly: 'Ask for a discount — works when he likes your situation.',
  win_now: 'Sell the contender — veterans chasing a ring listen.',
  featured_role: 'Promise minutes and touches — young players want a role.',
};

const SALARY_STEP = 250_000;

/**
 * Full-screen offer sheet. Replaces the per-card slider + comma-decimal number box + second
 * years box + four pitch chips that were repeated under every free agent.
 */
function FaOfferSheet({
  fa,
  franchise,
  league,
  recommendedPitch,
  onSubmit,
  onClose,
}: {
  fa: FreeAgent;
  franchise: Franchise;
  league: League;
  recommendedPitch?: PitchType;
  onSubmit: (pitch: PitchType, salary: number, years: number) => void;
  onClose: () => void;
}) {
  const bounds = useMemo(() => offerSalaryBounds(franchise, fa), [franchise, fa]);
  const [pitch, setPitch] = useState<PitchType>(
    recommendedPitch ?? (fa.topOfferTeam ? 'max_offer' : 'featured_role'),
  );
  const [salary, setSalary] = useState(bounds.suggested);
  const [years, setYears] = useState(Math.max(1, Math.min(5, fa.askingYears)));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const clamp = (v: number) => Math.max(bounds.min, Math.min(bounds.max, Math.round(v / 50_000) * 50_000));
  const preview = useMemo(
    () => previewOffer(franchise, league, fa, pitch, salary, years),
    [franchise, league, fa, pitch, salary, years],
  );

  const presets: { label: string; value: number }[] = [
    { label: 'Ask', value: fa.askingSalary },
    ...(bounds.rival
      ? [
          { label: 'Match rival', value: bounds.rival },
          { label: 'Beat rival', value: bounds.rival * 1.03 },
        ]
      : []),
    { label: 'Max room', value: bounds.max },
  ].map((p) => ({ ...p, value: clamp(p.value) }));

  const overRoster = franchise.roster.length >= ROSTER_SIZE;
  const rosterBlocked = !canAddPlayer(franchise);
  const tone = rosterBlocked || !preview.capOk
    ? 'bad'
    : preview.likelySign
      ? 'good'
      : preview.projectedInterest >= preview.signThreshold - 10
        ? 'mid'
        : 'bad';
  const headline = rosterBlocked
    ? 'Roster full'
    : !preview.capOk
    ? 'Cap blocks this'
    : preview.likelySign
      ? 'He signs'
      : !preview.beatsRival && preview.rivalSalary > 0
        ? `${fa.topOfferTeam ?? 'Rival'} wins`
        : 'Not enough';
  const detail = rosterBlocked
    ? `Offseason max is ${signingRosterLimit(franchise)}. Waive or trade someone first.`
    : !preview.capOk
    ? preview.capReason
    : !preview.beatsRival && preview.rivalSalary > 0
      ? `Raise to ${formatMoney(minSalaryToSign(fa, pitch))}/yr to beat their offer.`
      : preview.likelySign
        ? overRoster
          ? `He signs now — cut back to ${ROSTER_SIZE} at training camp.`
          : 'Offer is strong enough to land him.'
        : `Interest ${preview.projectedInterest}% — he needs ${preview.signThreshold}%. Try more money or a different pitch.`;
  const meter = Math.max(0, Math.min(100, preview.projectedInterest));

  return (
    <div className="deal-sheet" role="dialog" aria-modal="true" aria-label={`Offer to ${fa.firstName} ${fa.lastName}`}>
      <header className="deal-head">
        <div>
          <p className="eyebrow">Offer · {fa.position} · {fa.age} · {fa.overall} OVR</p>
          <h2 className="deal-title">{fa.firstName} {fa.lastName}</h2>
        </div>
        <button type="button" className="deal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={22} />
        </button>
      </header>

      <div className="deal-body">
        {fa.topOfferTeam && <p className="fa-sheet-rival">{rivalPitchWarning(fa) ?? `Leaning ${fa.topOfferTeam}`}</p>}

        <p className="deal-section-label">Salary per year</p>
        <div className="fa-stepper">
          <button
            type="button"
            aria-label="Lower salary"
            onClick={() => setSalary(clamp(salary - SALARY_STEP))}
            disabled={salary <= bounds.min}
          >
            −
          </button>
          <div className="fa-stepper-value">
            <strong>{formatMoney(salary)}</strong>
            <span>Asks {formatMoney(fa.askingSalary)} · room {formatUsableCapRoom(franchise.cap)}</span>
          </div>
          <button
            type="button"
            aria-label="Raise salary"
            onClick={() => setSalary(clamp(salary + SALARY_STEP))}
            disabled={salary >= bounds.max}
          >
            +
          </button>
        </div>
        <input
          className="fa-slider"
          type="range"
          aria-label="Salary"
          min={bounds.min}
          max={bounds.max}
          step={50_000}
          value={salary}
          onChange={(e) => setSalary(Number(e.target.value))}
        />
        <div className="fa-presets">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`fa-preset ${salary === p.value ? 'is-on' : ''}`}
              onClick={() => setSalary(p.value)}
            >
              {p.label}
              <span>{formatMoney(p.value)}</span>
            </button>
          ))}
        </div>

        <p className="deal-section-label">Years</p>
        <div className="fa-segment" role="radiogroup" aria-label="Contract years">
          {[1, 2, 3, 4, 5].map((y) => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={years === y}
              className={years === y ? 'is-on' : ''}
              onClick={() => setYears(y)}
            >
              {y}
              {y === fa.askingYears && <small>ask</small>}
            </button>
          ))}
        </div>

        <p className="deal-section-label">Your pitch</p>
        <div className="fa-pitches" role="radiogroup" aria-label="Pitch">
          {PITCHES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={pitch === p}
              className={`fa-pitch ${pitch === p ? 'is-on' : ''}`}
              onClick={() => setPitch(p)}
            >
              <strong>
                {pitchShortLabel(p)}
                {recommendedPitch === p && <em>Recommended</em>}
              </strong>
              <span>{PITCH_HELP[p]}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="deal-foot">
        <div className={`deal-verdict deal-verdict--${tone}`}>
          <strong>{headline}</strong>
          <span>{detail}</span>
        </div>
        <div className="fa-meter" aria-label={`Interest ${meter}%, needs ${preview.signThreshold}%`}>
          <div className={`fa-meter-fill fa-meter-fill--${tone}`} style={{ width: `${meter}%` }} />
          <div className="fa-meter-mark" style={{ left: `${preview.signThreshold}%` }} />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={rosterBlocked || !preview.capOk || !preview.likelySign}
          onClick={() => onSubmit(pitch, salary, years)}
        >
          Offer {formatMoney(salary)} × {years}yr
        </button>
      </footer>
    </div>
  );
}

export function FreeAgencyScreen() {
  const { franchise, league, pitchAgent, advanceFreeAgency, matchRFA, declineRFA, setScreen } = useGameStore();

  const briefing = useMemo(
    () => (franchise && league ? buildFreeAgencyBriefing(franchise, league) : null),
    [franchise, league],
  );

  const [offerFor, setOfferFor] = useState<string | null>(null);

  if (!franchise) return null;

  const available = franchise.freeAgents.filter((a) => !a.signed);
  // Targets first, passes last, then best available.
  const rank = (fa: FreeAgent) =>
    briefing && targetForAgent(briefing, fa.id) ? 0 : briefing && avoidForAgent(briefing, fa.id) ? 2 : 1;
  const sortedAvailable = [...available].sort((a, b) => rank(a) - rank(b) || b.overall - a.overall);
  const offerAgent = offerFor ? available.find((a) => a.id === offerFor) : undefined;
  const signed = franchise.freeAgents.filter((a) => a.signed);
  const pendingRFA = (franchise.rfaOffers ?? []).filter((o) => o.status === 'pending');

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Free agency</p>
          <h1 className="title-lg">Sign players</h1>
        </div>
        <button type="button" className="btn btn-ghost screen-back" onClick={() => setScreen('home')}>Back</button>
      </div>

      <div className="fa-capbar">
        <div className={franchise.roster.length > ROSTER_SIZE ? 'is-warn' : ''}>
          <span>Roster</span>
          <strong>{franchise.roster.length}/{ROSTER_SIZE}</strong>
        </div>
        <div>
          <span>Cap room</span>
          <strong>{formatUsableCapRoom(franchise.cap)}</strong>
        </div>
        <div>
          <span>MLE</span>
          <strong>{franchise.cap.mleUsed ? 'Used' : formatMoney(franchise.cap.mleAvailable)}</strong>
        </div>
      </div>

      {briefing && available.length > 0 && (
        <Panel accent className="fa-briefing-panel">
          <p className="body" style={{ margin: 0 }}>{briefing.summary}</p>
          {briefing.teamNeeds.length > 0 && (
            <div className="fa-need-chips">
              {briefing.teamNeeds.slice(0, 4).map((need) => (
                <span
                  key={need.position}
                  className={`chip ${need.severity === 'critical' ? 'chip-danger' : need.severity === 'moderate' ? 'chip-warning' : ''}`}
                >
                  {need.position}
                </span>
              ))}
            </div>
          )}
        </Panel>
      )}

      {pendingRFA.length > 0 && (
        <Panel warning accent>
          <p className="eyebrow">Offer sheets</p>
          {pendingRFA.map((offer) => (
            <div key={offer.id} className="rfa-offer">
              <div>
                <p className="title-md" style={{ fontSize: 14, margin: 0 }}>{offer.playerName}</p>
                <p className="body" style={{ fontSize: 12, marginTop: 4 }}>
                  {offer.offeringTeam} · {offer.years}yr / {formatMoney(offer.salary)}
                </p>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <button type="button" className="btn btn-primary" style={{ padding: '8px 12px' }} onClick={() => matchRFA(offer.id)}>
                  Match
                </button>
                <button type="button" className="btn btn-ghost" style={{ padding: '8px 12px' }} onClick={() => declineRFA(offer.id)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </Panel>
      )}

      {available.length === 0 ? (
        <Panel>
          <p className="body">Market dried up. Close free agency and move to training camp.</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={advanceFreeAgency}>
            Close free agency
          </button>
        </Panel>
      ) : (
        sortedAvailable.map((fa) => {
          const target = briefing ? targetForAgent(briefing, fa.id) : undefined;
          const avoid = briefing ? avoidForAgent(briefing, fa.id) : undefined;
          return (
            <article key={fa.id} className={`fa-card ${target ? 'is-target' : ''} ${avoid && !target ? 'is-pass' : ''}`}>
              <div className="fa-card-top">
                <div className="fa-card-id">
                  <strong>{fa.firstName} {fa.lastName}</strong>
                  <span>
                    {fa.position} · {fa.age} · {fa.archetype}
                    {fa.formerTeam ? ` · ex-${fa.formerTeam.split(' ').slice(-1)[0]}` : ''}
                  </span>
                </div>
                <div className="fa-card-ovr">
                  <strong>{fa.overall}</strong>
                  <span>{formatMoney(fa.askingSalary)} × {fa.askingYears}y</span>
                </div>
              </div>
              <div className="fa-card-tags">
                {target && <span className="chip chip-success">Target</span>}
                {avoid && !target && <span className="chip chip-danger">Pass</span>}
                <span className="chip">{marketHeatLabel(fa)}</span>
                {(fa.suitorCount ?? 0) > 0 && <span className="chip chip-warning">{fa.suitorCount} suitors</span>}
              </div>
              {fa.topOfferTeam && (
                <p className="fa-card-rival">{rivalPitchWarning(fa) ?? `Leaning ${fa.topOfferTeam}`}</p>
              )}
              <div className="fa-card-interest">
                <span>Interest in you</span>
                <ProgressBar value={fa.interest} />
              </div>
              <button
                type="button"
                className={`btn ${target ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setOfferFor(fa.id)}
              >
                Make offer
              </button>
            </article>
          );
        })
      )}

      {signed.length > 0 && (
        <Panel>
          <p className="eyebrow">Signed</p>
          {signed.map((fa) => (
            <p key={fa.id} className="body" style={{ margin: '4px 0' }}>
              {fa.firstName} {fa.lastName} ({fa.overall} OVR)
            </p>
          ))}
        </Panel>
      )}

      {available.length > 0 && (
        <button type="button" className="btn btn-secondary fa-advance" onClick={advanceFreeAgency}>
          Advance market · rivals make moves
        </button>
      )}

      {offerAgent && league && (
        <FaOfferSheet
          key={`${offerAgent.id}-${offerAgent.rivalOfferSalary ?? 0}-${offerAgent.userPitchAttempts ?? 0}`}
          fa={offerAgent}
          franchise={franchise}
          league={league}
          recommendedPitch={briefing ? targetForAgent(briefing, offerAgent.id)?.recommendedPitch : undefined}
          onClose={() => setOfferFor(null)}
          onSubmit={(pitch, salary, years) => {
            pitchAgent(offerAgent.id, pitch, salary, years);
            setOfferFor(null);
          }}
        />
      )}
    </div>
  );
}
