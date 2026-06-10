import { useMemo, useState } from 'react';
import { formatMoney, playerName } from '../data/scenarios';
import { getTeamById, strategyLabel } from '../data/league';
import { pickKey, formatCapBar, CAP_LIMIT } from '../engine/cap';
import { LEAGUE_CALENDAR_YEAR } from '../data/leagueWorld';
import {
  generatePartnerTradeAssets,
  pickDescription,
  validateProposal,
} from '../engine/tradeBuilder';
import { chainSummary, validateTradeChain } from '../engine/tradeChain';
import { partnerInterestLabel, suggestDealFixes, type DealSuggestion } from '../engine/tradeSuggestions';
import { scoreTrade, type TradeScore } from '../engine/trades';
import { PlayerAvatar } from './PlayerAvatar';
import { TeamLogo } from './TeamLogo';
import type {
  DraftPick,
  Franchise,
  League,
  TradeChainProposal,
  TradeProposal,
} from '../types/game';

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function TradeNegotiateModal({
  open,
  onClose,
  franchise,
  league,
  initialPartnerId,
  initialPrefill,
  negotiation,
  onSubmit,
  onRequestCounter,
  onSubmitChain,
}: {
  open: boolean;
  onClose: () => void;
  franchise: Franchise;
  league: League;
  initialPartnerId?: string;
  initialPrefill?: Partial<TradeProposal>;
  negotiation?: Franchise['tradeNegotiation'];
  onSubmit: (proposal: TradeProposal) => void;
  onRequestCounter: (proposal: TradeProposal) => void;
  onSubmitChain: (chain: TradeChainProposal) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(initialPartnerId ? 2 : 1);
  const [partnerTeamId, setPartnerTeamId] = useState(initialPartnerId ?? '');
  const [outgoingPlayerIds, setOutgoingPlayerIds] = useState<string[]>(initialPrefill?.outgoingPlayerIds ?? []);
  const [outgoingPickKeys, setOutgoingPickKeys] = useState<string[]>(initialPrefill?.outgoingPickKeys ?? []);
  const [incomingPlayerIds, setIncomingPlayerIds] = useState<string[]>(
    initialPrefill?.incomingPlayers?.map((p) => p.id) ?? [],
  );
  const [incomingPicks, setIncomingPicks] = useState<DraftPick[]>(initialPrefill?.incomingPicks ?? []);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [capExpanded, setCapExpanded] = useState(false);
  const [capNoteExpanded, setCapNoteExpanded] = useState(false);
  const [chainMode, setChainMode] = useState(false);
  const [facilitatorTeamId, setFacilitatorTeamId] = useState('');
  const [dealSuggestions, setDealSuggestions] = useState<DealSuggestion[]>([]);
  const [suggestionsChecked, setSuggestionsChecked] = useState(false);

  const tradePartners = league.teams.filter((t) => !t.isUser);
  const partner = partnerTeamId ? getTeamById(league, partnerTeamId) : undefined;
  const facilitator = facilitatorTeamId ? getTeamById(league, facilitatorTeamId) : undefined;

  const partnerAssets = useMemo(
    () => (partner ? generatePartnerTradeAssets(partner, league, franchise) : []),
    [partner, league, franchise],
  );

  const partnerPickOffers: DraftPick[] = useMemo(() => {
    if (!partner) return [];
    return [
      { year: LEAGUE_CALENDAR_YEAR + 1, round: 1, originalTeam: partner.fullName, protections: 'Top-8 protected' },
      { year: LEAGUE_CALENDAR_YEAR + 2, round: 1, originalTeam: partner.fullName },
      { year: LEAGUE_CALENDAR_YEAR + 1, round: 2, originalTeam: partner.fullName },
      { year: LEAGUE_CALENDAR_YEAR + 2, round: 2, originalTeam: partner.fullName },
    ];
  }, [partner]);

  const proposal: TradeProposal = {
    partnerTeamId,
    incomingPlayers: partnerAssets.filter((p) => incomingPlayerIds.includes(p.id)),
    outgoingPlayerIds,
    incomingPicks,
    outgoingPickKeys,
  };

  const validation = partnerTeamId ? validateProposal(franchise, league, proposal) : null;

  const packageSalaries = useMemo(() => {
    const outgoing = franchise.roster
      .filter((p) => outgoingPlayerIds.includes(p.id))
      .reduce((s, p) => s + p.contract.annualSalary, 0);
    const incoming = partnerAssets
      .filter((p) => incomingPlayerIds.includes(p.id))
      .reduce((s, p) => s + p.contract.annualSalary, 0);
    return { outgoing, incoming, net: incoming - outgoing };
  }, [franchise.roster, outgoingPlayerIds, partnerAssets, incomingPlayerIds]);

  const tradeScore: TradeScore | null = useMemo(() => {
    if (!partnerTeamId) return null;
    const incoming = partnerAssets.filter((p) => incomingPlayerIds.includes(p.id));
    return scoreTrade(franchise, outgoingPlayerIds, outgoingPickKeys, incoming, incomingPicks);
  }, [franchise, partnerTeamId, outgoingPlayerIds, outgoingPickKeys, incomingPlayerIds, incomingPicks, partnerAssets]);

  const chain: TradeChainProposal | null =
    chainMode && partner && facilitator
      ? {
          facilitatorTeamId,
          userToPartner: proposal,
          partnerToFacilitator: {
            partnerTeamId: facilitatorTeamId,
            incomingPlayers: generatePartnerTradeAssets(facilitator, league, franchise).slice(0, 1),
            outgoingPlayerIds: [],
            incomingPicks: [{ year: franchise.season + 1, round: 2, originalTeam: facilitator.fullName }],
            outgoingPickKeys: [],
          },
        }
      : null;

  const chainValidation = chain ? validateTradeChain(franchise, league, chain) : null;

  if (!open) return null;

  const selectPartner = (teamId: string) => {
    setPartnerTeamId(teamId);
    setIncomingPlayerIds([]);
    setIncomingPicks([]);
    setDealSuggestions([]);
    setSuggestionsChecked(false);
    setStep(2);
  };

  const applySuggestion = (suggestion: DealSuggestion) => {
    const p = suggestion.proposal;
    setOutgoingPlayerIds(p.outgoingPlayerIds);
    setOutgoingPickKeys(p.outgoingPickKeys);
    setIncomingPlayerIds(p.incomingPlayers.map((pl) => pl.id));
    setIncomingPicks(p.incomingPicks);
    setDealSuggestions([]);
    setStep(2);
  };

  const runDealSuggestions = () => {
    if (!validation || !partnerTeamId) return;
    setSuggestionsChecked(true);
    setDealSuggestions(suggestDealFixes(franchise, league, proposal, validation));
  };

  const canReview =
    partnerTeamId &&
    (outgoingPlayerIds.length > 0 ||
      outgoingPickKeys.length > 0 ||
      incomingPlayerIds.length > 0 ||
      incomingPicks.length > 0);

  return (
    <div className="trade-negotiate-overlay" role="dialog" aria-modal="true" aria-label="Make a trade">
      <div className="trade-negotiate-modal">
        <div className="trade-negotiate-head">
          <div>
            <p className="eyebrow">Make offer</p>
            <p className="title-md" style={{ margin: 0 }}>
              {step === 1 && 'Pick a trade partner'}
              {step === 2 && (partner ? partner.fullName : 'Build package')}
              {step === 3 && 'Review & submit'}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={onClose}>
            Close
          </button>
        </div>

        <div className="trade-negotiate-steps">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`trade-negotiate-step ${step >= n ? 'trade-negotiate-step-active' : ''}`}
              style={{ cursor: step > n ? 'pointer' : 'default', background: 'none', border: 'none', padding: 0 }}
              onClick={() => { if (step > n) setStep(n); }}
              aria-label={n === 1 ? 'Back to partner select' : n === 2 ? 'Back to package builder' : undefined}
            >
              {n}
            </button>
          ))}
        </div>
        {step >= 2 && partner && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '4px 8px', marginBottom: 8, alignSelf: 'flex-start' }}
            onClick={() => setStep(1)}
          >
            ← {partner.fullName}
          </button>
        )}

        {negotiation && (
          <p className="body" style={{ fontSize: 12, margin: '0 0 12px' }}>
            Negotiating with <strong>{negotiation.partnerTeamName}</strong> · round {negotiation.round} of 3
          </p>
        )}

        {step === 1 && (
          <div className="trade-partner-grid">
            {tradePartners.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`trade-partner-card ${partnerTeamId === t.id ? 'trade-partner-card-active' : ''}`}
                onClick={() => selectPartner(t.id)}
              >
                <TeamLogo city={t.city} name={t.name} size={40} />
                <div className="trade-partner-copy">
                  <strong>{t.fullName}</strong>
                  <span>{strategyLabel(t.strategy)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && partner && (
          <div className="trade-negotiate-builder">
            <div className="trade-builder-scroll">
            <div className="trade-package-columns">
              <div className="trade-package-col">
                <p className="eyebrow">You send · {franchise.roster.length} players</p>
                <div className="trade-asset-list trade-asset-list-scroll">
                  {[...franchise.roster]
                    .sort((a, b) => b.overall - a.overall)
                    .map((p) => {
                      const selected = outgoingPlayerIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`trade-asset-chip ${selected ? 'trade-asset-chip-active' : ''}`}
                          onClick={() => setOutgoingPlayerIds(toggleId(outgoingPlayerIds, p.id))}
                        >
                          <PlayerAvatar player={p} size={36} />
                          <div>
                            <strong>{playerName(p)}</strong>
                            <span>
                              {p.overall} OVR · {formatMoney(p.contract.annualSalary)}
                              {p.injured ? ' · injured' : ''}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  {franchise.draftPicks.map((pick) => {
                    const key = pickKey(pick);
                    const selected = outgoingPickKeys.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`trade-asset-chip trade-asset-chip-pick ${selected ? 'trade-asset-chip-active' : ''}`}
                        onClick={() => setOutgoingPickKeys(toggleId(outgoingPickKeys, key))}
                      >
                        <span className="trade-pick-icon">P</span>
                        <div>
                          <strong>{pickDescription(pick)}</strong>
                          <span>Draft pick</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="trade-package-col">
                <p className="eyebrow">You get</p>
                <div className="trade-asset-list trade-asset-list-scroll">
                  {partnerAssets.map((p) => {
                    const selected = incomingPlayerIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`trade-asset-chip ${selected ? 'trade-asset-chip-active' : ''}`}
                        onClick={() => setIncomingPlayerIds(toggleId(incomingPlayerIds, p.id))}
                      >
                        <PlayerAvatar player={p} size={36} />
                        <div>
                          <strong>{playerName(p)}</strong>
                          <span>{p.overall} OVR · {formatMoney(p.contract.annualSalary)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {partnerPickOffers.map((pick) => {
                    const key = pickKey(pick);
                    const selected = incomingPicks.some((p) => pickKey(p) === key && p.year === pick.year);
                    return (
                      <button
                        key={`${key}-${pick.year}`}
                        type="button"
                        className={`trade-asset-chip trade-asset-chip-pick ${selected ? 'trade-asset-chip-active' : ''}`}
                        onClick={() => {
                          setIncomingPicks(
                            selected
                              ? incomingPicks.filter((p) => !(pickKey(p) === key && p.year === pick.year))
                              : [...incomingPicks, pick],
                          );
                        }}
                      >
                        <span className="trade-pick-icon">P</span>
                        <div>
                          <strong>{pickDescription(pick)}</strong>
                          <span>From {partner.fullName}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {(packageSalaries.outgoing > 0 || packageSalaries.incoming > 0) && (
              <div className="trade-cap-strip" style={{ marginTop: 12, borderRadius: 8, background: 'var(--surface-2, rgba(255,255,255,0.04))', border: `1px solid ${validation && !validation.salaryMatch ? 'var(--danger, #f55)' : 'rgba(255,255,255,0.08)'}` }}>
                <button
                  type="button"
                  style={{ width: '100%', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}
                  onClick={() => setCapExpanded(v => !v)}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: validation && !validation.salaryMatch ? 'var(--danger, #f55)' : 'var(--success, #3dd68c)' }}>
                    {validation && !validation.salaryMatch ? '✕ Cap blocked' : '✓ Legal match'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-primary, #fff)' }}>
                    Net: {packageSalaries.net >= 0 ? '+' : ''}{formatMoney(packageSalaries.net)}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-primary, #fff)' }}>{capExpanded ? '▲' : '▼'}</span>
                </button>
                {capExpanded && (
                  <div style={{ padding: '0 12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8, fontSize: 12 }}>
                      <span>Out: {formatMoney(packageSalaries.outgoing)}</span>
                      <span>In: {formatMoney(packageSalaries.incoming)}</span>
                    </div>
                    {validation && (
                      <p className="mono" style={{ fontSize: 11, marginTop: 6, marginBottom: 0, opacity: 0.9 }}>
                        {formatCapBar(franchise.cap.payroll, CAP_LIMIT)} → {formatCapBar(validation.userProjectedPayroll, CAP_LIMIT)} after trade
                      </p>
                    )}
                    {validation && (
                      <p className="body" style={{ fontSize: 11, marginTop: 6, marginBottom: 0, opacity: 0.9 }}>
                        {validation.salaryMatchNote}
                      </p>
                    )}
                    {partner && validation?.partnerCapNote && (
                      <p className="body" style={{ fontSize: 11, marginTop: 6, marginBottom: 0, opacity: 0.85 }}>
                        {partner.fullName}: {validation.partnerCapNote}
                        {validation.partnerProjectedPayroll > 0 ? ` (${formatCapBar(validation.partnerProjectedPayroll, CAP_LIMIT)} est.)` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {tradeScore && tradeScore.verdict !== 'empty' && (
              <div className="trade-analyzer-bar">
                <div className="trade-analyzer-sides">
                  <span className="trade-analyzer-side trade-analyzer-side--you">
                    <span className="trade-analyzer-side-label">You send</span>
                    <span className="trade-analyzer-side-pts">{tradeScore.youSend} pts</span>
                  </span>
                  <span className={`trade-analyzer-verdict trade-analyzer-verdict--${tradeScore.verdict}`}>
                    {tradeScore.label}
                  </span>
                  <span className="trade-analyzer-side trade-analyzer-side--them">
                    <span className="trade-analyzer-side-label">You get</span>
                    <span className="trade-analyzer-side-pts">{tradeScore.youGet} pts</span>
                  </span>
                </div>
                <div className="trade-analyzer-track">
                  <div
                    className={`trade-analyzer-fill trade-analyzer-fill--${tradeScore.verdict}`}
                    style={{
                      width: `${Math.round(Math.min(100, Math.max(0,
                        tradeScore.youSend + tradeScore.youGet === 0 ? 50 :
                        (tradeScore.youGet / (tradeScore.youSend + tradeScore.youGet)) * 100
                      )))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            </div>{/* end trade-builder-scroll */}
            <div className="trade-negotiate-actions trade-negotiate-actions-pinned">
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                Change partner
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canReview}
                onClick={() => setStep(3)}
              >
                Review offer
              </button>
            </div>
          </div>
        )}

        {step === 3 && partner && validation && (
          <>
          <div className="trade-review-scroll">
            {/* 1. Partner interest — most actionable signal, shown first and large */}
            <div
              className={`trade-interest-bar trade-interest-bar--prominent ${validation.partnerAcceptScore >= 62 ? 'trade-interest-bar--good' : validation.partnerAcceptScore >= 48 ? 'trade-interest-bar--mid' : 'trade-interest-bar--bad'}`}
              style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2, rgba(255,255,255,0.04))', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span className="stat-label" style={{ margin: 0 }}>Partner interest</span>
              <strong
                style={{ fontSize: 18 }}
                className={validation.partnerAcceptScore >= 62 ? 'success-text' : validation.partnerAcceptScore >= 48 ? '' : 'danger-text'}
              >
                {validation.partnerAcceptScore}% — {partnerInterestLabel(validation.partnerAcceptScore)}
              </strong>
            </div>

            {/* 2. Points balance */}
            {tradeScore && tradeScore.verdict !== 'empty' && (
              <div className={`trade-analyzer-verdict-card trade-analyzer-verdict-card--${tradeScore.verdict}`}>
                <div className="trade-analyzer-verdict-row">
                  <div className="trade-analyzer-verdict-side">
                    <span className="trade-analyzer-verdict-label">You send</span>
                    <span className="trade-analyzer-verdict-pts">{tradeScore.youSend}</span>
                    <span className="trade-analyzer-verdict-sub">pts</span>
                  </div>
                  <div className="trade-analyzer-verdict-center">
                    <span className={`trade-analyzer-verdict-badge trade-analyzer-verdict-badge--${tradeScore.verdict}`}>
                      {tradeScore.verdict === 'great' ? '🏆' :
                       tradeScore.verdict === 'good' ? '✓' :
                       tradeScore.verdict === 'fair' ? '⇌' :
                       tradeScore.verdict === 'overpay' ? '⚠' : '✕'}
                      {' '}{tradeScore.label}
                    </span>
                    {tradeScore.delta !== 0 && (
                      <span className="trade-analyzer-verdict-delta">
                        {tradeScore.delta > 0 ? '+' : ''}{tradeScore.delta} pts
                      </span>
                    )}
                  </div>
                  <div className="trade-analyzer-verdict-side trade-analyzer-verdict-side--right">
                    <span className="trade-analyzer-verdict-label">You get</span>
                    <span className="trade-analyzer-verdict-pts">{tradeScore.youGet}</span>
                    <span className="trade-analyzer-verdict-sub">pts</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Asset summary — tappable to go back and edit */}
            <button
              type="button"
              className="trade-split trade-split-review"
              style={{ width: '100%', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, cursor: 'pointer', textAlign: 'left', padding: '10px 12px', marginTop: 8 }}
              onClick={() => setStep(2)}
              title="Tap to edit package"
            >
              <div>
                <p className="stat-label" style={{ margin: 0 }}>You send <span style={{ opacity: 0.4, fontWeight: 400 }}>· tap to edit</span></p>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {outgoingPlayerIds.length || outgoingPickKeys.length
                    ? [
                        ...franchise.roster.filter((p) => outgoingPlayerIds.includes(p.id)).map((p) => playerName(p)),
                        ...franchise.draftPicks.filter((pick) => outgoingPickKeys.includes(pickKey(pick))).map(pickDescription),
                      ].join(', ')
                    : '—'}
                </p>
              </div>
              <div>
                <p className="stat-label" style={{ margin: 0 }}>You get</p>
                <p style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {[
                    ...partnerAssets.filter((p) => incomingPlayerIds.includes(p.id)).map((p) => playerName(p)),
                    ...incomingPicks.map(pickDescription),
                  ].join(', ') || '—'}
                </p>
              </div>
            </button>

            {/* 4. Cap notes — collapsed by default */}
            <div style={{ marginTop: 10, borderRadius: 8, background: 'var(--surface-2, rgba(255,255,255,0.04))', border: `1px solid ${!validation.salaryMatch || !validation.partnerSalaryMatch ? 'var(--danger, #f55)' : 'rgba(255,255,255,0.08)'}` }}>
              <button
                type="button"
                style={{ width: '100%', background: 'none', border: 'none', padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}
                onClick={() => setCapNoteExpanded(v => !v)}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: !validation.salaryMatch || !validation.partnerSalaryMatch ? 'var(--danger, #f55)' : 'var(--success, #3dd68c)' }}>
                  {!validation.salaryMatch ? '✕ Your cap blocked' : !validation.partnerSalaryMatch ? '✕ Partner cap blocked' : '✓ Cap clear'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.5 }}>{capNoteExpanded ? '▲' : '▼'}</span>
              </button>
              {capNoteExpanded && (
                <div style={{ padding: '0 12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 12 }}>
                  <p className={`body ${validation.salaryMatch ? '' : 'danger'}`} style={{ marginTop: 8, marginBottom: 0 }}>
                    {validation.salaryMatchNote}
                  </p>
                  {!validation.salaryMatch && (
                    <p className="body danger" style={{ marginTop: 4, marginBottom: 0 }}>
                      Your cap office blocked this — adjust the package or tap Fix this deal.
                    </p>
                  )}
                  {!validation.partnerSalaryMatch && (
                    <p className="body danger" style={{ marginTop: 6, marginBottom: 0 }}>
                      {partner.fullName}&apos;s cap sheet cannot absorb this — add outgoing salary or take back more.
                    </p>
                  )}
                  {validation.capWarnings.map((warn) => (
                    <p key={warn} className="body" style={{ marginTop: 6, marginBottom: 0, color: 'var(--warning, #e6a700)' }}>
                      {warn}
                    </p>
                  ))}
                  {validation.partnerCapNote && validation.partnerSalaryMatch && (
                    <p className="body" style={{ marginTop: 6, marginBottom: 0, opacity: 0.85 }}>
                      {partner.fullName}: {validation.partnerCapNote}
                    </p>
                  )}
                </div>
              )}
            </div>
            {validation.errors
              .filter((err) => err !== validation.stepienWarning)
              .map((err) => (
                <p key={err} className="body danger" style={{ fontSize: 12, marginTop: 4 }}>
                  {err}
                </p>
              ))}

            {(validation.partnerAcceptScore < 62 ||
              !validation.salaryMatch ||
              !validation.partnerSalaryMatch ||
              validation.stepienWarning) && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: 12, width: '100%' }}
                  onClick={runDealSuggestions}
                >
                  Fix this deal
                </button>
                {dealSuggestions.length > 0 && (
                  <div className="deal-suggestions" style={{ marginTop: 10 }}>
                    {dealSuggestions.map((sug) => (
                      <div key={sug.id} className="deal-suggestion-card">
                        <div className="header-bar" style={{ marginBottom: 4 }}>
                          <strong style={{ fontSize: 13 }}>{sug.title}</strong>
                          <span className="chip chip-gold">→ {sug.projectedScore}%</span>
                        </div>
                        <p className="body" style={{ fontSize: 12, margin: '0 0 8px' }}>{sug.detail}</p>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '6px 10px', fontSize: 11 }}
                          onClick={() => applySuggestion(sug)}
                        >
                          Apply tweak
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {suggestionsChecked && dealSuggestions.length === 0 && (
                  <p className="body" style={{ fontSize: 12, marginTop: 8 }}>
                    No quick fix — try picks, salary balance, or a different target.
                  </p>
                )}
              </>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 12, width: '100%', fontSize: 12, opacity: 0.7 }}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Hide advanced options' : 'Advanced options'}
            </button>
            {showAdvanced && (
              <div style={{ marginTop: 10 }}>
                <label className="analysis-row" style={{ cursor: 'pointer' }}>
                  <span>
                    <input type="checkbox" checked={chainMode} onChange={(e) => setChainMode(e.target.checked)} />
                    {' '}3-team trade chain
                  </span>
                </label>
                {chainMode && (
                  <>
                    <label className="stat-label" style={{ marginTop: 8 }}>Facilitator team</label>
                    <select
                      className="btn btn-ghost"
                      style={{ width: '100%', marginTop: 6 }}
                      value={facilitatorTeamId}
                      onChange={(e) => setFacilitatorTeamId(e.target.value)}
                    >
                      <option value="">Select facilitator…</option>
                      {tradePartners
                        .filter((t) => t.id !== partnerTeamId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>{t.fullName}</option>
                        ))}
                    </select>
                    {chain && chainValidation && (
                      <p className="body" style={{ fontSize: 12, marginTop: 8 }}>{chainSummary(chain, franchise)}</p>
                    )}
                  </>
                )}
              </div>
            )}

          </div>

          <div className="trade-negotiate-actions trade-negotiate-actions-pinned">
            {chainMode && chain && chainValidation?.valid ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => { onSubmitChain(chain); onClose(); }}
              >
                Execute 3-team trade
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={!validation.valid}
                onClick={() => { onSubmit(proposal); onClose(); }}
              >
                {negotiation ? 'Resubmit offer' : 'Submit offer'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => { onRequestCounter(proposal); onClose(); }}
            >
              Request counter only
            </button>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
