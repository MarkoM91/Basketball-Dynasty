import { useEffect, useMemo, useState } from 'react';
import { formatMoney, playerName } from '../data/scenarios';
import { getTeamById, strategyLabel, teamWantsPicks, teamWantsVeterans } from '../data/league';
import { pickKey } from '../engine/cap';
import { LEAGUE_CALENDAR_YEAR } from '../data/leagueWorld';
import { generatePartnerTradeAssets, pickDescription, validateProposal } from '../engine/tradeBuilder';
import { chainSummary, validateTradeChain } from '../engine/tradeChain';
import { suggestDealFixes, type DealSuggestion } from '../engine/tradeSuggestions';
import { scoreTrade } from '../engine/trades';
import { PlayerAvatar } from './PlayerAvatar';
import { TeamLogo } from './TeamLogo';
import { Icon } from './Icon';
import type {
  DraftPick,
  Franchise,
  League,
  LeagueTeam,
  Player,
  TradeChainProposal,
  TradeProposal,
  TradeValidation,
} from '../types/game';

/**
 * Mobile-first deal builder.
 *
 * Two steps instead of three: pick a partner, then build the deal on one column. Each side shows
 * only what's IN the deal; "+ Add" opens a full-screen picker (no more two side-by-side scroll
 * boxes listing your whole roster). One pinned verdict replaces the cap strip, points bar and
 * separate review screen, and Send lives right next to it.
 */

type Side = 'get' | 'send';

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function wantsLabel(team: LeagueTeam): string {
  if (teamWantsPicks(team.strategy)) return 'Wants picks & youth';
  if (teamWantsVeterans(team.strategy)) return 'Wants proven vets';
  return 'Open to offers';
}

interface Verdict {
  tone: 'good' | 'mid' | 'bad' | 'idle';
  headline: string;
  detail: string;
}

function dealVerdict(validation: TradeValidation | null, hasAssets: boolean): Verdict {
  if (!validation || !hasAssets) {
    return { tone: 'idle', headline: 'Add players or picks', detail: 'Pick what you want, then what you give.' };
  }
  if (!validation.salaryMatch) {
    return { tone: 'bad', headline: 'Your cap blocks this', detail: validation.salaryMatchNote };
  }
  if (!validation.partnerSalaryMatch) {
    return { tone: 'bad', headline: 'Their cap blocks this', detail: 'Send more salary back or take less.' };
  }
  const hardError = validation.errors.find((e) => e !== validation.stepienWarning);
  if (hardError) return { tone: 'bad', headline: 'Not allowed', detail: hardError };
  const score = validation.partnerAcceptScore;
  if (score >= 62) return { tone: 'good', headline: `Likely yes · ${score}%`, detail: validation.partnerVerdict };
  if (score >= 48) return { tone: 'mid', headline: `Maybe · ${score}%`, detail: 'Close — sweeten it a little or ask for a counter.' };
  return { tone: 'bad', headline: `Unlikely · ${score}%`, detail: 'They want more value. Try "Fix this deal".' };
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
  const [partnerTeamId, setPartnerTeamId] = useState(initialPartnerId ?? '');
  const [outgoingPlayerIds, setOutgoingPlayerIds] = useState<string[]>(initialPrefill?.outgoingPlayerIds ?? []);
  const [outgoingPickKeys, setOutgoingPickKeys] = useState<string[]>(initialPrefill?.outgoingPickKeys ?? []);
  const [incomingPlayerIds, setIncomingPlayerIds] = useState<string[]>(
    initialPrefill?.incomingPlayers?.map((p) => p.id) ?? [],
  );
  const [incomingPicks, setIncomingPicks] = useState<DraftPick[]>(initialPrefill?.incomingPicks ?? []);
  const [picker, setPicker] = useState<Side | null>(null);
  const [dealSuggestions, setDealSuggestions] = useState<DealSuggestion[] | null>(null);
  const [showChain, setShowChain] = useState(false);
  const [facilitatorTeamId, setFacilitatorTeamId] = useState('');

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

  // Lock page scroll behind the full-screen sheet.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const proposal: TradeProposal = {
    partnerTeamId,
    incomingPlayers: partnerAssets.filter((p) => incomingPlayerIds.includes(p.id)),
    outgoingPlayerIds,
    incomingPicks,
    outgoingPickKeys,
  };
  const validation = partnerTeamId ? validateProposal(franchise, league, proposal) : null;
  const tradeScore = useMemo(
    () =>
      partnerTeamId
        ? scoreTrade(franchise, outgoingPlayerIds, outgoingPickKeys, proposal.incomingPlayers, incomingPicks)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [franchise, partnerTeamId, outgoingPlayerIds, outgoingPickKeys, incomingPlayerIds, incomingPicks, partnerAssets],
  );

  const chain: TradeChainProposal | null =
    showChain && partner && facilitator
      ? {
          facilitatorTeamId,
          userToPartner: proposal,
          partnerToFacilitator: {
            partnerTeamId: facilitatorTeamId,
            incomingPlayers: generatePartnerTradeAssets(facilitator, league, franchise).slice(0, 1),
            outgoingPlayerIds: [],
            incomingPicks: [{ year: LEAGUE_CALENDAR_YEAR + 1, round: 2, originalTeam: facilitator.fullName }],
            outgoingPickKeys: [],
          },
        }
      : null;
  const chainValidation = chain ? validateTradeChain(franchise, league, chain) : null;

  if (!open) return null;

  const hasAssets =
    outgoingPlayerIds.length + outgoingPickKeys.length + incomingPlayerIds.length + incomingPicks.length > 0;
  const verdict = dealVerdict(validation, hasAssets);
  const salaryOut = franchise.roster
    .filter((p) => outgoingPlayerIds.includes(p.id))
    .reduce((s, p) => s + p.contract.annualSalary, 0);
  const salaryIn = proposal.incomingPlayers.reduce((s, p) => s + p.contract.annualSalary, 0);

  const resetDeal = () => {
    setIncomingPlayerIds([]);
    setIncomingPicks([]);
    setDealSuggestions(null);
  };

  const selectPartner = (teamId: string) => {
    setPartnerTeamId(teamId);
    resetDeal();
  };

  const applySuggestion = (s: DealSuggestion) => {
    setOutgoingPlayerIds(s.proposal.outgoingPlayerIds);
    setOutgoingPickKeys(s.proposal.outgoingPickKeys);
    setIncomingPlayerIds(s.proposal.incomingPlayers.map((p) => p.id));
    setIncomingPicks(s.proposal.incomingPicks);
    setDealSuggestions(null);
  };

  const isIncomingPick = (pick: DraftPick) =>
    incomingPicks.some((p) => pickKey(p) === pickKey(pick) && p.year === pick.year);
  const toggleIncomingPick = (pick: DraftPick) =>
    setIncomingPicks(
      isIncomingPick(pick)
        ? incomingPicks.filter((p) => !(pickKey(p) === pickKey(pick) && p.year === pick.year))
        : [...incomingPicks, pick],
    );

  // ── Step 1: partner ──────────────────────────────────────────────────────────
  if (!partner) {
    return (
      <div className="deal-sheet" role="dialog" aria-modal="true" aria-label="Pick a trade partner">
        <header className="deal-head">
          <div>
            <p className="eyebrow">New trade</p>
            <h2 className="deal-title">Pick a partner</h2>
          </div>
          <button type="button" className="deal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={22} />
          </button>
        </header>
        <div className="deal-body">
          <ul className="deal-partner-list">
            {tradePartners.map((t) => (
              <li key={t.id}>
                <button type="button" className="deal-partner" onClick={() => selectPartner(t.id)}>
                  <TeamLogo city={t.city} name={t.name} size={40} />
                  <span className="deal-partner-copy">
                    <strong>{t.fullName}</strong>
                    <span>{strategyLabel(t.strategy)} · {wantsLabel(t)}</span>
                  </span>
                  <Icon name="chevron-right" size={18} className="deal-chevron" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // ── Picker (full screen, one list, big rows) ─────────────────────────────────
  if (picker) {
    const sending = picker === 'send';
    const players: Player[] = sending
      ? [...franchise.roster].sort((a, b) => b.overall - a.overall)
      : partnerAssets;
    const selectedCount = sending
      ? outgoingPlayerIds.length + outgoingPickKeys.length
      : incomingPlayerIds.length + incomingPicks.length;
    return (
      <div className="deal-sheet" role="dialog" aria-modal="true" aria-label={sending ? 'Choose what you send' : 'Choose what you get'}>
        <header className="deal-head">
          <div>
            <p className="eyebrow">{sending ? 'You send' : `From ${partner.fullName}`}</p>
            <h2 className="deal-title">{sending ? 'Your assets' : 'Their assets'}</h2>
          </div>
        </header>
        <div className="deal-body">
          <p className="deal-section-label">Players</p>
          <ul className="deal-pick-list">
            {players.map((p) => {
              const on = sending ? outgoingPlayerIds.includes(p.id) : incomingPlayerIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`deal-option ${on ? 'is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      sending
                        ? setOutgoingPlayerIds(toggleId(outgoingPlayerIds, p.id))
                        : setIncomingPlayerIds(toggleId(incomingPlayerIds, p.id))
                    }
                  >
                    <PlayerAvatar player={p} size={40} />
                    <span className="deal-option-copy">
                      <strong>{playerName(p)}</strong>
                      <span>
                        {p.position} · {p.age} · {formatMoney(p.contract.annualSalary)}
                        {p.injured ? ' · Injured' : ''}
                      </span>
                    </span>
                    <span className="deal-ovr">{p.overall}</span>
                    <span className="deal-check" aria-hidden="true">{on && <Icon name="check" size={16} />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="deal-section-label">Draft picks</p>
          <ul className="deal-pick-list">
            {(sending ? franchise.draftPicks : partnerPickOffers).map((pick) => {
              const key = pickKey(pick);
              const on = sending ? outgoingPickKeys.includes(key) : isIncomingPick(pick);
              return (
                <li key={`${key}-${pick.year}`}>
                  <button
                    type="button"
                    className={`deal-option ${on ? 'is-on' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      sending ? setOutgoingPickKeys(toggleId(outgoingPickKeys, key)) : toggleIncomingPick(pick)
                    }
                  >
                    <span className="deal-pick-badge">R{pick.round}</span>
                    <span className="deal-option-copy">
                      <strong>{pickDescription(pick)}</strong>
                      <span>{sending ? 'Your pick' : `${partner.fullName} pick`}</span>
                    </span>
                    <span className="deal-check" aria-hidden="true">{on && <Icon name="check" size={16} />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <footer className="deal-foot">
          <button type="button" className="btn btn-primary" onClick={() => setPicker(null)}>
            Done{selectedCount ? ` · ${selectedCount} selected` : ''}
          </button>
        </footer>
      </div>
    );
  }

  // ── Step 2: the deal ─────────────────────────────────────────────────────────
  const getRows = [
    ...proposal.incomingPlayers.map((p) => ({
      key: p.id,
      player: p,
      label: playerName(p),
      meta: `${p.position} · ${p.overall} OVR · ${formatMoney(p.contract.annualSalary)}`,
      remove: () => setIncomingPlayerIds(incomingPlayerIds.filter((id) => id !== p.id)),
    })),
    ...incomingPicks.map((pick) => ({
      key: `${pickKey(pick)}-${pick.year}`,
      player: undefined,
      label: pickDescription(pick),
      meta: 'Draft pick',
      remove: () => toggleIncomingPick(pick),
    })),
  ];
  const sendRows = [
    ...franchise.roster
      .filter((p) => outgoingPlayerIds.includes(p.id))
      .map((p) => ({
        key: p.id,
        player: p as Player | undefined,
        label: playerName(p),
        meta: `${p.position} · ${p.overall} OVR · ${formatMoney(p.contract.annualSalary)}`,
        remove: () => setOutgoingPlayerIds(outgoingPlayerIds.filter((id) => id !== p.id)),
      })),
    ...franchise.draftPicks
      .filter((pick) => outgoingPickKeys.includes(pickKey(pick)))
      .map((pick) => ({
        key: pickKey(pick),
        player: undefined as Player | undefined,
        label: pickDescription(pick),
        meta: 'Draft pick',
        remove: () => setOutgoingPickKeys(outgoingPickKeys.filter((k) => k !== pickKey(pick))),
      })),
  ];

  const sideBlock = (side: Side, rows: typeof getRows) => (
    <section className="deal-side">
      <div className="deal-side-head">
        <p className="deal-section-label">{side === 'get' ? 'You get' : 'You send'}</p>
        {rows.some((r) => r.player) && (
          <span className="deal-salary">
            {formatMoney(side === 'get' ? salaryIn : salaryOut)}
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <ul className="deal-rows">
          {rows.map((r) => (
            <li key={r.key} className="deal-row">
              {r.player ? <PlayerAvatar player={r.player} size={36} /> : <span className="deal-pick-badge">Pick</span>}
              <span className="deal-option-copy">
                <strong>{r.label}</strong>
                <span>{r.meta}</span>
              </span>
              <button type="button" className="deal-remove" onClick={r.remove} aria-label={`Remove ${r.label}`}>
                <Icon name="x" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="deal-add" onClick={() => setPicker(side)}>
        + {side === 'get' ? `Add from ${partner.name}` : 'Add from your team'}
      </button>
    </section>
  );

  const needsFix =
    hasAssets && validation && (!validation.valid || validation.partnerAcceptScore < 62);

  return (
    <div className="deal-sheet" role="dialog" aria-modal="true" aria-label={`Trade with ${partner.fullName}`}>
      <header className="deal-head">
        <button type="button" className="deal-partner-head" onClick={() => setPartnerTeamId('')}>
          <TeamLogo city={partner.city} name={partner.name} size={36} />
          <span>
            <span className="eyebrow">{negotiation ? `Round ${negotiation.round} of 3` : 'Trade with'}</span>
            <span className="deal-title">{partner.fullName}</span>
          </span>
          <span className="deal-change">Change</span>
        </button>
        <button type="button" className="deal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={22} />
        </button>
      </header>

      <div className="deal-body">
        <p className="deal-hint">{wantsLabel(partner)}</p>
        {sideBlock('get', getRows)}
        <div className="deal-swap" aria-hidden="true"><Icon name="trade" size={18} /></div>
        {sideBlock('send', sendRows)}

        {needsFix && (
          <section className="deal-fix">
            {dealSuggestions === null ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => validation && setDealSuggestions(suggestDealFixes(franchise, league, proposal, validation))}
              >
                Fix this deal
              </button>
            ) : dealSuggestions.length === 0 ? (
              <p className="deal-hint">No quick fix — try picks, more salary, or a different target.</p>
            ) : (
              <ul className="deal-rows">
                {dealSuggestions.slice(0, 3).map((s) => (
                  <li key={s.id} className="deal-row deal-suggestion">
                    <span className="deal-option-copy">
                      <strong>{s.title}</strong>
                      <span>{s.detail}</span>
                    </span>
                    <button type="button" className="btn btn-ghost" onClick={() => applySuggestion(s)}>
                      {s.projectedScore}% · Apply
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <details className="deal-more" open={showChain}>
          <summary onClick={(e) => { e.preventDefault(); setShowChain((v) => !v); }}>3-team trade</summary>
          {showChain && (
            <div className="deal-chain">
              <select
                className="deal-select"
                value={facilitatorTeamId}
                onChange={(e) => setFacilitatorTeamId(e.target.value)}
              >
                <option value="">Third team…</option>
                {tradePartners
                  .filter((t) => t.id !== partnerTeamId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.fullName}</option>
                  ))}
              </select>
              {chain && chainValidation && <p className="deal-hint">{chainSummary(chain, franchise)}</p>}
            </div>
          )}
        </details>
      </div>

      <footer className="deal-foot">
        <div className={`deal-verdict deal-verdict--${verdict.tone}`}>
          <strong>{verdict.headline}</strong>
          <span>
            {verdict.detail}
            {tradeScore && tradeScore.verdict !== 'empty' && verdict.tone !== 'idle' ? ` · Value: ${tradeScore.label.toLowerCase()}` : ''}
          </span>
        </div>
        <div className="deal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!hasAssets}
            onClick={() => { onRequestCounter(proposal); onClose(); }}
          >
            Ask for counter
          </button>
          {showChain && chain && chainValidation?.valid ? (
            <button type="button" className="btn btn-primary" onClick={() => { onSubmitChain(chain); onClose(); }}>
              Send 3-team deal
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!validation?.valid}
              onClick={() => { onSubmit(proposal); onClose(); }}
            >
              {negotiation ? 'Resend offer' : 'Send offer'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
