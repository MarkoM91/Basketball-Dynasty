import { useMemo, useState } from 'react';
import { formatMoney, playerName } from '../data/scenarios';
import { getTeamById, strategyLabel } from '../data/league';
import { pickKey, formatCapBar, CAP_LIMIT } from '../engine/cap';
import {
  generatePartnerTradeAssets,
  pickDescription,
  validateProposal,
} from '../engine/tradeBuilder';
import { chainSummary, validateTradeChain } from '../engine/tradeChain';
import { partnerInterestLabel, suggestDealFixes, type DealSuggestion } from '../engine/tradeSuggestions';
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
  const [chainMode, setChainMode] = useState(false);
  const [facilitatorTeamId, setFacilitatorTeamId] = useState('');
  const [dealSuggestions, setDealSuggestions] = useState<DealSuggestion[]>([]);
  const [suggestionsChecked, setSuggestionsChecked] = useState(false);

  const tradePartners = league.teams.filter((t) => !t.isUser);
  const partner = partnerTeamId ? getTeamById(league, partnerTeamId) : undefined;
  const facilitator = facilitatorTeamId ? getTeamById(league, facilitatorTeamId) : undefined;

  const partnerAssets = useMemo(
    () => (partner ? generatePartnerTradeAssets(partner) : []),
    [partner],
  );

  const partnerPickOffers: DraftPick[] = useMemo(() => {
    if (!partner) return [];
    return [
      { year: franchise.season + 1, round: 1, originalTeam: partner.fullName, protections: 'Top-8 protected' },
      { year: franchise.season + 2, round: 2, originalTeam: partner.fullName },
    ];
  }, [partner, franchise.season]);

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

  const chain: TradeChainProposal | null =
    chainMode && partner && facilitator
      ? {
          facilitatorTeamId,
          userToPartner: proposal,
          partnerToFacilitator: {
            partnerTeamId: facilitatorTeamId,
            incomingPlayers: generatePartnerTradeAssets(facilitator).slice(0, 1),
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
          {[1, 2, 3].map((n) => (
            <span key={n} className={`trade-negotiate-step ${step >= n ? 'trade-negotiate-step-active' : ''}`}>
              {n}
            </span>
          ))}
        </div>

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

            <div className="trade-cap-strip" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--surface-2, rgba(255,255,255,0.04))', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="eyebrow" style={{ margin: 0 }}>Cap sheet</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6, fontSize: 12 }}>
                <span>Out: {formatMoney(packageSalaries.outgoing)}</span>
                <span>In: {formatMoney(packageSalaries.incoming)}</span>
                <span style={{ color: packageSalaries.net > 0 ? 'var(--warning, #e6a700)' : 'var(--success, #3dd68c)' }}>
                  Net: {packageSalaries.net >= 0 ? '+' : ''}{formatMoney(packageSalaries.net)}
                </span>
              </div>
              {validation && (
                <p className="mono" style={{ fontSize: 11, marginTop: 6, marginBottom: 0, opacity: 0.9 }}>
                  Your payroll: {formatCapBar(franchise.cap.payroll, CAP_LIMIT)}
                  {packageSalaries.outgoing > 0 || packageSalaries.incoming > 0
                    ? ` → ${formatCapBar(validation.userProjectedPayroll, CAP_LIMIT)} after trade`
                    : ''}
                </p>
              )}
              {partner && validation?.partnerCapNote && (packageSalaries.outgoing > 0 || packageSalaries.incoming > 0) && (
                <p className="body" style={{ fontSize: 11, marginTop: 6, marginBottom: 0, opacity: 0.85 }}>
                  {partner.fullName}: {validation.partnerCapNote}
                  {validation.partnerProjectedPayroll > 0
                    ? ` (${formatCapBar(validation.partnerProjectedPayroll, CAP_LIMIT)} est.)`
                    : ''}
                </p>
              )}
            </div>

            <div className="trade-negotiate-actions">
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
            <div className="trade-split trade-split-review">
              <div>
                <p className="stat-label">You send</p>
                <p style={{ margin: '6px 0 0', fontSize: 14 }}>
                  {outgoingPlayerIds.length || outgoingPickKeys.length
                    ? [
                        ...franchise.roster
                          .filter((p) => outgoingPlayerIds.includes(p.id))
                          .map((p) => playerName(p)),
                        ...franchise.draftPicks
                          .filter((pick) => outgoingPickKeys.includes(pickKey(pick)))
                          .map(pickDescription),
                      ].join(', ') || '—'
                    : '—'}
                </p>
              </div>
              <div>
                <p className="stat-label">You get</p>
                <p style={{ margin: '6px 0 0', fontSize: 14 }}>
                  {[
                    ...partnerAssets.filter((p) => incomingPlayerIds.includes(p.id)).map((p) => playerName(p)),
                    ...incomingPicks.map(pickDescription),
                  ].join(', ') || '—'}
                </p>
              </div>
            </div>

            <div className="trade-interest-bar" style={{ marginTop: 12 }}>
              <span className="stat-label">Partner interest</span>
              <strong
                className={
                  validation.partnerAcceptScore >= 62
                    ? 'success-text'
                    : validation.partnerAcceptScore >= 48
                      ? ''
                      : 'danger-text'
                }
              >
                {validation.partnerAcceptScore}% — {partnerInterestLabel(validation.partnerAcceptScore)}
              </strong>
            </div>
            {!validation.salaryMatch && (
              <p className="body danger" style={{ fontSize: 12, marginTop: 8 }}>
                Your cap office blocked this — adjust the package or tap Fix this deal.
              </p>
            )}
            {!validation.partnerSalaryMatch && (
              <p className="body danger" style={{ fontSize: 12, marginTop: 8 }}>
                {partner.fullName}&apos;s cap sheet cannot absorb this structure — add outgoing salary or take back more money.
              </p>
            )}
            {validation.capWarnings.map((warn) => (
              <p key={warn} className="body" style={{ fontSize: 12, marginTop: 6, color: 'var(--warning, #e6a700)' }}>
                {warn}
              </p>
            ))}
            {validation.partnerCapNote && validation.partnerSalaryMatch && (
              <p className="body" style={{ fontSize: 12, marginTop: 8, opacity: 0.9 }}>
                Partner cap read: {validation.partnerCapNote}
              </p>
            )}
            {validation.errors.map((err) => (
              <p key={err} className="body danger" style={{ fontSize: 12, marginTop: 4 }}>
                {err}
              </p>
            ))}

            {validation.partnerAcceptScore < 62 && (
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
              style={{ marginTop: 12, width: '100%' }}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Hide advanced' : 'Advanced options'}
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

            <div className="trade-negotiate-actions" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
                Edit package
              </button>
              {chainMode && chain && chainValidation?.valid ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onSubmitChain(chain);
                    onClose();
                  }}
                >
                  Execute 3-team trade
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onSubmit(proposal);
                    onClose();
                  }}
                >
                  {negotiation ? 'Resubmit offer' : 'Submit offer'}
                </button>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 8, width: '100%' }}
              onClick={() => {
                onRequestCounter(proposal);
                onClose();
              }}
            >
              Request counter only
            </button>
          </>
        )}
      </div>
    </div>
  );
}
