import { playerName } from '../data/scenarios';
import type { DraftRecapPick, Franchise } from '../types/game';
import { draftRound } from './draftNight';
import { isRookie } from './rookies';

function recapFromLog(franchise: Franchise): DraftRecapPick[] {
  const night = franchise.draftNight;
  if (!night) return [];

  return night.log
    .filter((entry) => entry.isUser)
    .map((entry) => {
      const player = franchise.roster.find((p) => playerName(p) === entry.prospectName);
      const prospect =
        night.board.find(
          (p) => `${p.firstName} ${p.lastName}` === entry.prospectName,
        ) ??
        franchise.draftBoard.find(
          (p) => `${p.firstName} ${p.lastName}` === entry.prospectName,
        );

      return {
        pick: entry.pick,
        round: draftRound(entry.pick),
        playerName: entry.prospectName,
        position: player?.position ?? prospect?.position,
        overall: player?.overall,
        archetype: prospect?.archetype,
        note: entry.note ?? prospect?.scoutNote,
      };
    });
}

export function getUserDraftRecap(franchise: Franchise): DraftRecapPick[] {
  const fromLog = recapFromLog(franchise);
  if (fromLog.length > 0) return fromLog;

  const inNewDraftCycle =
    franchise.phase === 'draft_scouting' || franchise.phase === 'draft_night';
  if (inNewDraftCycle) return [];

  if (franchise.draftRecap?.length) return franchise.draftRecap;

  return franchise.roster
    .filter((player) => isRookie(player, franchise.season))
    .sort((a, b) => (a.draftPick ?? 999) - (b.draftPick ?? 999))
    .map((player) => ({
      pick: player.draftPick ?? 0,
      round: player.draftPick && player.draftPick > 30 ? 2 : 1,
      playerName: playerName(player),
      position: player.position,
      overall: player.overall,
      note: player.gmNote,
    }));
}

export function buildDraftRecap(franchise: Franchise): DraftRecapPick[] {
  const recap = recapFromLog(franchise);
  if (recap.length === 0) return franchise.draftRecap ?? [];
  return recap;
}

export function withDraftRecap(franchise: Franchise): Franchise {
  const recap = buildDraftRecap(franchise);
  if (recap.length === 0) return franchise;
  return { ...franchise, draftRecap: recap };
}
