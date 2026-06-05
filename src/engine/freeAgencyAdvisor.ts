import type { FreeAgent, Franchise, League, PitchType, Player, Position } from '../types/game';
import { POSITION_TARGETS } from '../data/rosterBuilder';
import { formatMoney, uid } from '../data/scenarios';
import { canSignFreeAgent } from './cap';

export interface TeamNeed {
  position: Position;
  label: string;
  severity: 'critical' | 'moderate' | 'depth';
}

export interface FaTargetSuggestion {
  id: string;
  agentId: string;
  playerName: string;
  overall: number;
  position: Position;
  fitScore: number;
  headline: string;
  detail: string;
  recommendedPitch: PitchType;
  pitchReason: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface FaAvoidSuggestion {
  id: string;
  agentId: string;
  playerName: string;
  reason: string;
}

export interface FreeAgencyBriefing {
  summary: string;
  teamNeeds: TeamNeed[];
  capNote: string;
  targets: FaTargetSuggestion[];
  avoid: FaAvoidSuggestion[];
  strategyNote: string;
}

const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

function countByPosition(roster: Player[]): Record<Position, number> {
  const counts: Record<Position, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  for (const player of roster) counts[player.position] += 1;
  return counts;
}

function bestAtPosition(roster: Player[], position: Position): number {
  const atPos = roster.filter((player) => player.position === position);
  if (!atPos.length) return 0;
  return Math.max(...atPos.map((player) => player.overall));
}

function starterCount(roster: Player[], position: Position): number {
  return roster.filter((player) => player.position === position && player.overall >= 78).length;
}

export function analyzeTeamNeeds(franchise: Franchise): TeamNeed[] {
  const counts = countByPosition(franchise.roster);
  const needs: TeamNeed[] = [];
  const contending = franchise.window.includes('Contender');

  for (const position of POSITIONS) {
    const count = counts[position];
    const best = bestAtPosition(franchise.roster, position);
    const starters = starterCount(franchise.roster, position);
    const target = POSITION_TARGETS[position];

    if (count === 0) {
      needs.push({
        position,
        label: `No ${position} on roster — emergency hole.`,
        severity: 'critical',
      });
      continue;
    }

    if (count < target - 1) {
      needs.push({
        position,
        label: `Thin at ${position} — only ${count} on the roster.`,
        severity: 'moderate',
      });
      continue;
    }

    if (contending && best < 76) {
      needs.push({
        position,
        label: `${position} upgrade needed — top option is ${best} OVR.`,
        severity: 'critical',
      });
      continue;
    }

    if (starters === 0 && best < 80) {
      needs.push({
        position,
        label: `No starter-caliber ${position} — best is ${best} OVR.`,
        severity: contending ? 'critical' : 'moderate',
      });
      continue;
    }

    if (best < 72) {
      needs.push({
        position,
        label: `${position} depth weak — floor is ${best} OVR.`,
        severity: 'depth',
      });
    }
  }

  return needs.sort((a, b) => {
    const rank = { critical: 0, moderate: 1, depth: 2 };
    return rank[a.severity] - rank[b.severity];
  });
}

function capBriefing(franchise: Franchise): string {
  const { cap } = franchise;
  if (cap.inSecondApron) {
    return 'Second apron — hard-capped. Only minimum deals or trade exceptions are realistic.';
  }
  if (cap.projectedRoom <= 0 && !cap.inLuxuryTax) {
    return `No cap room (${formatMoney(0)}). Use MLE (${formatMoney(cap.mleAvailable)}) or minimum contracts only.`;
  }
  if (cap.projectedRoom <= 0 && cap.inLuxuryTax) {
    return `Tax team with no room — taxpayer MLE (${formatMoney(cap.mleAvailable)}) or minimums. Ownership hates adding tax.`;
  }
  if (cap.projectedRoom < 8_000_000) {
    return `Tight room (${formatMoney(cap.projectedRoom)}). One mid-level signing max — pick your spot carefully.`;
  }
  return `${formatMoney(cap.projectedRoom)} in room. You can chase one starter or two rotation pieces.`;
}

function strategyBriefing(franchise: Franchise): string {
  if (franchise.window.includes('Contender') || franchise.window.includes('Rising')) {
    return 'Win-now window — prioritize fit and defense over long-term upside. Role players who raise the floor beat empty-calorie stats.';
  }
  if (franchise.window.includes('Rebuild')) {
    return 'Rebuild mode — avoid long expensive deals. Target young rotation players on team-friendly pitches or save room for the draft.';
  }
  if (franchise.window === 'Expensive Mediocrity') {
    return 'Stuck in the middle — one smart signing can shift the timeline. Do not pay starter money for bench production.';
  }
  return 'Roster is still taking shape — balance upside with positional holes before camp.';
}

function recommendPitch(
  franchise: Franchise,
  agent: FreeAgent,
  need: TeamNeed | undefined,
  canAffordMax: boolean,
): { pitch: PitchType; reason: string } {
  if (agent.topOfferTeam) {
    if (canAffordMax && agent.overall >= 84) {
      return { pitch: 'max_offer', reason: 'Star market — only max money has a chance.' };
    }
    if (canAffordMax) {
      return { pitch: 'max_offer', reason: 'Rival interest — pay up or walk.' };
    }
    return { pitch: 'team_friendly', reason: 'Leaning elsewhere without cap to compete.' };
  }

  if (!canAffordMax && agent.askingSalary > franchise.cap.mleAvailable) {
    return { pitch: 'team_friendly', reason: 'Only a discount fits the cap sheet.' };
  }

  if (franchise.window.includes('Contender') && agent.priorities.includes('winning')) {
    return { pitch: 'win_now', reason: 'Win-now window matches his goals.' };
  }

  if (need && (need.severity === 'critical' || need.severity === 'moderate')) {
    if (agent.priorities.includes('role')) {
      return { pitch: 'featured_role', reason: `Clear ${agent.position} minutes to sell.` };
    }
    if (agent.overall >= 80 && canAffordMax) {
      return { pitch: 'max_offer', reason: 'Starter at a position of need.' };
    }
  }

  if (franchise.cap.projectedRoom < agent.askingSalary * 0.5 || franchise.cap.inLuxuryTax) {
    return { pitch: 'team_friendly', reason: 'Keep payroll flexible.' };
  }

  if (agent.priorities.includes('money')) {
    return { pitch: 'max_offer', reason: 'Money-first — lead with dollars.' };
  }

  return { pitch: 'featured_role', reason: 'Sell a defined rotation role.' };
}

function scoreFreeAgent(
  franchise: Franchise,
  agent: FreeAgent,
  needs: TeamNeed[],
): number {
  let score = agent.interest * 0.35;
  const need = needs.find((item) => item.position === agent.position);
  const best = bestAtPosition(franchise.roster, agent.position);
  const count = countByPosition(franchise.roster)[agent.position];

  if (need?.severity === 'critical') score += 38;
  else if (need?.severity === 'moderate') score += 24;
  else if (need?.severity === 'depth') score += 10;

  if (agent.overall > best) score += Math.min(22, (agent.overall - best) * 2.5);
  if (agent.overall >= 80) score += franchise.window.includes('Contender') ? 12 : 4;
  if (franchise.window.includes('Rebuild') && agent.age <= 27) score += 8;
  if (franchise.window.includes('Rebuild') && agent.overall >= 82) score -= 18;

  if (count >= POSITION_TARGETS[agent.position] + 1) score -= 16;
  if (count >= POSITION_TARGETS[agent.position] + 2) score -= 12;

  const capCheck = canSignFreeAgent(franchise, agent.askingSalary);
  if (capCheck.ok) score += 14;
  else if (canSignFreeAgent(franchise, Math.round(agent.askingSalary * 0.88)).ok) score += 4;
  else score -= 35;

  if (agent.topOfferTeam) {
    const tier = agent.overall >= 84 ? 'star' : agent.overall >= 80 ? 'starter' : agent.overall >= 75 ? 'rotation' : 'depth';
    if (tier === 'star' || tier === 'starter') score -= tier === 'star' ? 28 : 18;
    else score -= 12;
  }

  return Math.round(score);
}

function buildSummary(franchise: Franchise, needs: TeamNeed[], targets: FaTargetSuggestion[]): string {
  const topNeed = needs[0];
  if (!targets.length) {
    if (franchise.cap.projectedRoom <= 0) {
      return `Cap room is gone. Assistant GM says: stand pat or hunt minimum contracts${topNeed ? ` at ${topNeed.position}` : ''}.`;
    }
    return 'No clear free-agent fits on the board — consider advancing the market or pivoting to trades.';
  }

  const lead = targets[0];
  const needText = topNeed ? ` Biggest hole: ${topNeed.position}.` : '';
  return `${franchise.window}.${needText} Top target: ${lead.playerName} (${lead.overall} OVR) — ${lead.headline.toLowerCase()}.`;
}

export function buildFreeAgencyBriefing(franchise: Franchise, _league: League): FreeAgencyBriefing {
  const available = franchise.freeAgents.filter((agent) => !agent.signed);
  const teamNeeds = analyzeTeamNeeds(franchise);
  const capNote = capBriefing(franchise);
  const strategyNote = strategyBriefing(franchise);

  const scored = available
    .map((agent) => {
      const fitScore = scoreFreeAgent(franchise, agent, teamNeeds);
      const need = teamNeeds.find((item) => item.position === agent.position);
      const canAfford = canSignFreeAgent(franchise, agent.askingSalary).ok;
      const { pitch, reason } = recommendPitch(franchise, agent, need, canAfford);

      let headline = 'Solid rotation fit';
      if (need?.severity === 'critical' && agent.overall >= 78) headline = 'Fills a starting hole';
      else if (need?.severity === 'moderate') headline = 'Addresses depth need';
      else if (agent.overall >= 82) headline = 'Star talent available';
      else if (!canAfford) headline = 'Cap stretch — risky';

      let detail = need ? need.label.split(' — ')[0] : `${agent.archetype} at ${agent.position}`;

      const urgency: FaTargetSuggestion['urgency'] =
        fitScore >= 75 && need?.severity === 'critical'
          ? 'high'
          : fitScore >= 55
            ? 'medium'
            : 'low';

      return {
        id: uid('fab'),
        agentId: agent.id,
        playerName: `${agent.firstName} ${agent.lastName}`,
        overall: agent.overall,
        position: agent.position,
        fitScore,
        headline,
        detail,
        recommendedPitch: pitch,
        pitchReason: reason,
        urgency,
      };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  const targets = scored.filter((item) => item.fitScore >= 45).slice(0, 4);

  const avoid = scored
    .filter((item) => {
      const agent = available.find((a) => a.id === item.agentId)!;
      const count = countByPosition(franchise.roster)[agent.position];
      const crowded = count >= POSITION_TARGETS[agent.position] + 2;
      const cantAfford = !canSignFreeAgent(franchise, Math.round(agent.askingSalary * 0.85)).ok;
      const rebuildStar = franchise.window.includes('Rebuild') && agent.overall >= 82;
      const rivalCommitted =
        Boolean(agent.topOfferTeam) &&
        ((agent.userPitchAttempts ?? 0) >= 2 || !canSignFreeAgent(franchise, agent.askingSalary).ok);
      return item.fitScore < 35 || crowded || cantAfford || rebuildStar || rivalCommitted;
    })
    .slice(0, 3)
    .map((item) => {
      const agent = available.find((a) => a.id === item.agentId)!;
      let reason = 'Low roster fit — does not move the needle.';
      if (
        agent.topOfferTeam &&
        ((agent.userPitchAttempts ?? 0) >= 2 || !canSignFreeAgent(franchise, agent.askingSalary).ok)
      ) {
        reason = `Leaning ${agent.topOfferTeam} — without max money and multiple pitches left, walk away.`;
      } else if (!canSignFreeAgent(franchise, Math.round(agent.askingSalary * 0.85)).ok) {
        reason = `Cap-illegal at ${formatMoney(agent.askingSalary)} — no path without clearing salary.`;
      } else if (countByPosition(franchise.roster)[agent.position] >= POSITION_TARGETS[agent.position] + 2) {
        reason = `Crowded at ${agent.position} — minutes are already spoken for.`;
      } else if (franchise.window.includes('Rebuild') && agent.overall >= 82) {
        reason = 'Rebuild timeline — star money better spent on picks and young core.';
      }
      return {
        id: uid('faa'),
        agentId: item.agentId,
        playerName: item.playerName,
        reason,
      };
    });

  return {
    summary: buildSummary(franchise, teamNeeds, targets),
    teamNeeds: teamNeeds.slice(0, 4),
    capNote,
    targets,
    avoid: avoid.filter((item) => !targets.some((target) => target.agentId === item.agentId)),
    strategyNote,
  };
}

export function targetForAgent(briefing: FreeAgencyBriefing, agentId: string): FaTargetSuggestion | undefined {
  return briefing.targets.find((item) => item.agentId === agentId);
}

export function avoidForAgent(briefing: FreeAgencyBriefing, agentId: string): FaAvoidSuggestion | undefined {
  return briefing.avoid.find((item) => item.agentId === agentId);
}
