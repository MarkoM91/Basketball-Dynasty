import { useEffect, useMemo, useState } from 'react';

import { ROSTER_SIZE } from '../data/rosterBuilder';
import { formatMoney } from '../data/scenarios';

import {
  marketHeatLabel,
  minSalaryToSign,
  offerSalaryBounds,
  pitchLabel,
  previewOffer,
  rivalPitchWarning,
} from '../engine/freeAgency';

import { avoidForAgent, buildFreeAgencyBriefing, targetForAgent } from '../engine/freeAgencyAdvisor';

import { useGameStore } from '../store/gameStore';

import type { FreeAgent, Franchise, League, PitchType } from '../types/game';

import { Panel, ProgressBar } from '../components/UI';

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

function FaOfferPanel({
  fa,
  franchise,
  league,
  recommendedPitch,
  onSubmit,
}: {
  fa: FreeAgent;
  franchise: Franchise;
  league: League;
  recommendedPitch?: PitchType;
  onSubmit: (pitch: PitchType, salary: number, years: number) => void;
}) {
  const bounds = useMemo(() => offerSalaryBounds(franchise, fa), [franchise, fa]);
  const [pitch, setPitch] = useState<PitchType>(
    recommendedPitch ?? (fa.topOfferTeam ? 'max_offer' : 'featured_role'),
  );
  const [salary, setSalary] = useState(bounds.suggested);
  const [years, setYears] = useState(fa.askingYears);

  useEffect(() => {
    setSalary((prev) => Math.max(prev, bounds.suggested));
  }, [fa.id, fa.rivalOfferSalary, fa.userPitchAttempts, bounds.suggested]);

  const preview = useMemo(
    () => previewOffer(franchise, league, fa, pitch, salary, years),
    [franchise, league, fa, pitch, salary, years],
  );

  const salaryMillions = Math.round((salary / 1_000_000) * 10) / 10;

  return (
    <div className="fa-offer-panel">
      <div className="fa-offer-quick">
        {bounds.rival && (
          <button type="button" className="btn btn-ghost" onClick={() => setSalary(bounds.rival!)}>
            Match {formatMoney(bounds.rival!)}
          </button>
        )}
        {bounds.rival && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSalary(Math.round(bounds.rival! * 1.03))}
          >
            Beat rival
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => setSalary(Math.round(bounds.ask * 1.08))}>
          Max ask
        </button>
      </div>

      <label className="stat-label" htmlFor={`fa-salary-${fa.id}`}>
        Offer · cap room {formatMoney(franchise.cap.projectedRoom)}
      </label>
      <div className="fa-offer-salary-row">
        <input
          id={`fa-salary-${fa.id}`}
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={100_000}
          value={salary}
          onChange={(e) => setSalary(Number(e.target.value))}
        />
        <div className="fa-offer-salary-input">
          <span className="mono">$</span>
          <input
            type="number"
            className="mono"
            min={bounds.min / 1_000_000}
            max={bounds.max / 1_000_000}
            step={0.1}
            value={salaryMillions}
            onChange={(e) => {
              const next = Math.round(Number(e.target.value) * 1_000_000);
              if (Number.isFinite(next)) {
                setSalary(Math.max(bounds.min, Math.min(bounds.max, next)));
              }
            }}
          />
          <span className="mono">M × {years}yr</span>
        </div>
      </div>

      <input
        id={`fa-years-${fa.id}`}
        type="number"
        min={1}
        max={5}
        value={years}
        onChange={(e) => setYears(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
        className="fa-offer-years"
        aria-label="Contract years"
      />

      <div className="fa-pitch-row">
        {PITCHES.map((p) => (
          <button
            key={p}
            type="button"
            className={`fa-pitch-chip${pitch === p ? ' fa-pitch-chip-active' : ''}${recommendedPitch === p ? ' fa-pitch-chip-rec' : ''}`}
            onClick={() => setPitch(p)}
            title={pitchLabel(p)}
          >
            {pitchShortLabel(p)}
          </button>
        ))}
      </div>

      <p className="fa-offer-status">
        {!preview.capOk && <span className="danger-text">{preview.capReason} · </span>}
        {preview.likelySign ? (
          <span className="success-text">Ready to sign</span>
        ) : !preview.beatsRival && bounds.rival ? (
          <span className="danger-text">
            Raise to {formatMoney(minSalaryToSign(fa, pitch))}/yr to beat {fa.topOfferTeam ?? 'rival bid'}
          </span>
        ) : preview.projectedInterest < preview.signThreshold ? (
          <span>Interest {preview.projectedInterest}% — need {preview.signThreshold}%</span>
        ) : (
          <span className="success-text">Salary works — submit offer</span>
        )}
      </p>

      <button type="button" className="btn btn-primary fa-offer-submit" onClick={() => onSubmit(pitch, salary, years)}>
        Offer {formatMoney(salary)}/yr · {pitchShortLabel(pitch)}
      </button>
    </div>
  );
}

export function FreeAgencyScreen() {
  const { franchise, league, pitchAgent, advanceFreeAgency, matchRFA, declineRFA, setScreen } = useGameStore();

  const briefing = useMemo(
    () => (franchise && league ? buildFreeAgencyBriefing(franchise, league) : null),
    [franchise, league],
  );

  if (!franchise) return null;

  const available = franchise.freeAgents.filter((a) => !a.signed);
  const signed = franchise.freeAgents.filter((a) => a.signed);
  const pendingRFA = (franchise.rfaOffers ?? []).filter((o) => o.status === 'pending');

  return (
    <div className="page">
      <div className="header-bar">
        <div>
          <p className="eyebrow">Free agency</p>
          <h1 className="title-lg">Sign players</h1>
          <p className="body" style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}>
            {franchise.roster.length}/{ROSTER_SIZE} roster · {formatMoney(franchise.cap.projectedRoom)} room
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setScreen('home')}>Back</button>
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
          {briefing.targets.length > 0 && (
            <ul className="fa-target-list">
              {briefing.targets.slice(0, 3).map((target) => (
                <li key={target.id}>
                  <strong>{target.playerName}</strong> ({target.overall}) — {target.headline}. {pitchShortLabel(target.recommendedPitch)}.
                </li>
              ))}
            </ul>
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
        available.map((fa) => {
          const target = briefing ? targetForAgent(briefing, fa.id) : undefined;
          const avoid = briefing ? avoidForAgent(briefing, fa.id) : undefined;
          if (!league) return null;

          return (
            <Panel key={fa.id} accent={Boolean(target?.urgency === 'high')}>
              <div className="fa-player-head">
                <div>
                  <p className="title-md">{fa.firstName} {fa.lastName} · {fa.age} · {fa.position}</p>
                  <div className="fa-player-chips">
                    <span className="chip chip-gold">{fa.archetype}</span>
                    <span className="chip">{marketHeatLabel(fa)}</span>
                    {(fa.suitorCount ?? 0) > 0 && (
                      <span className="chip chip-warning">{fa.suitorCount} suitors</span>
                    )}
                    {target && (
                      <span className={`chip ${target.urgency === 'high' ? 'chip-success' : 'chip-warning'}`}>
                        Target
                      </span>
                    )}
                    {avoid && !target && <span className="chip chip-danger">Pass</span>}
                  </div>
                </div>
                <div className="fa-player-ask">
                  <div className="fa-player-ovr">{fa.overall}</div>
                  <div className="mono">{formatMoney(fa.askingSalary)}</div>
                </div>
              </div>

              {fa.topOfferTeam && (
                <p className="fa-rival-line danger-text">
                  {rivalPitchWarning(fa) ?? `Leaning ${fa.topOfferTeam}`}
                </p>
              )}

              <p className="body" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>{fa.scoutNote}</p>

              <p className="eyebrow" style={{ marginTop: 10 }}>Your interest</p>
              <ProgressBar value={fa.interest} />

              <FaOfferPanel
                key={`${fa.id}-${fa.rivalOfferSalary ?? 0}-${fa.userPitchAttempts ?? 0}`}
                fa={fa}
                franchise={franchise}
                league={league}
                recommendedPitch={target?.recommendedPitch}
                onSubmit={(pitch, salary, years) => pitchAgent(fa.id, pitch, salary, years)}
              />
            </Panel>
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
        <button type="button" className="btn btn-secondary" style={{ marginTop: 8, width: '100%' }} onClick={advanceFreeAgency}>
          Advance market
        </button>
      )}
    </div>
  );
}
