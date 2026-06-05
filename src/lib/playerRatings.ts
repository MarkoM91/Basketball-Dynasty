import type { Player, Position } from '../types/game';
import { hashString, pickInt } from './visuals/hash';

/** Elite skill strengths derived from ratings (display only). */
export type SkillBadge = '3' | 'A' | 'B' | 'Di' | 'Dp' | 'Po' | 'Ps' | 'R' | 'V';

export interface PlayerRatings {
  ovr: number;
  pot: number;
  hgt: number;
  fg: number;
  tp: number;
  ft: number;
  dr: number;
  ps: number;
  reb: number;
  di: number;
  dp: number;
  ath: number;
  po: number;
  endu: number;
  skills: SkillBadge[];
  heightIn: number;
}

const SKILL_LABELS: Record<SkillBadge, string> = {
  '3': 'Three-point shooter',
  A: 'Athlete',
  B: 'Ball handler',
  Di: 'Interior defender',
  Dp: 'Perimeter defender',
  Po: 'Post scorer',
  Ps: 'Passer',
  R: 'Rebounder',
  V: 'Volume scorer',
};

export { SKILL_LABELS };

const POS_BIAS: Record<
  Position,
  Partial<Record<'fg' | 'tp' | 'dr' | 'ps' | 'reb' | 'di' | 'dp' | 'ath' | 'po' | 'hgt', number>>
> = {
  PG: { dr: 8, ps: 10, tp: 4, reb: -6, di: -8, dp: 2, hgt: -10 },
  SG: { fg: 4, tp: 8, dr: 4, ps: 2, reb: -4, di: -6, dp: 4, ath: 4 },
  SF: { fg: 2, tp: 4, reb: 2, di: 0, dp: 4, ath: 4, ps: 0 },
  PF: { reb: 8, di: 6, po: 6, tp: 2, dr: -4, dp: 0, hgt: 4 },
  C: { reb: 10, di: 10, po: 8, hgt: 12, tp: -8, dr: -8, dp: -6, ps: -4 },
};

function clamp(n: number, lo = 30, hi = 99): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function heightInches(position: Position, hgtRating: number): number {
  const base = position === 'C' ? 82 : position === 'PF' ? 80 : position === 'SF' ? 78 : position === 'SG' ? 76 : 74;
  return base + Math.round((hgtRating - 50) / 4);
}

function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

export function derivePlayerRatings(player: Player): PlayerRatings {
  const seed = hashString(player.id);
  const bias = POS_BIAS[player.position];
  const anchor = player.overall;

  const jitter = (salt: number, spread = 14) => pickInt(seed, -spread, spread, salt);

  const ratings = {
    ovr: player.overall,
    pot: player.potential,
    hgt: clamp(anchor + (bias.hgt ?? 0) + jitter(1, 10)),
    fg: clamp(anchor + (bias.fg ?? 0) + jitter(2)),
    tp: clamp(anchor + (bias.tp ?? 0) + jitter(3)),
    ft: clamp(anchor - 4 + jitter(4, 10)),
    dr: clamp(anchor + (bias.dr ?? 0) + jitter(5)),
    ps: clamp(anchor + (bias.ps ?? 0) + jitter(6)),
    reb: clamp(anchor + (bias.reb ?? 0) + jitter(7)),
    di: clamp(anchor + (bias.di ?? 0) + jitter(8)),
    dp: clamp(anchor + (bias.dp ?? 0) + jitter(9)),
    ath: clamp(anchor + (bias.ath ?? 0) + jitter(10)),
    po: clamp(anchor + (bias.po ?? 0) + jitter(11)),
    endu: clamp(anchor - 2 + jitter(12, 12)),
    skills: [] as SkillBadge[],
    heightIn: 0,
  };

  const skills: SkillBadge[] = [];
  if (ratings.tp >= 62) skills.push('3');
  if (ratings.ath >= 62) skills.push('A');
  if (ratings.dr >= 58) skills.push('B');
  if (ratings.di >= 58) skills.push('Di');
  if (ratings.dp >= 58) skills.push('Dp');
  if (ratings.po >= 58) skills.push('Po');
  if (ratings.ps >= 58) skills.push('Ps');
  if (ratings.reb >= 58) skills.push('R');
  if (player.overall >= 74 && ratings.fg >= 58) skills.push('V');

  ratings.skills = skills;
  ratings.heightIn = heightInches(player.position, ratings.hgt);
  return ratings;
}

export function skillLabel(skill: SkillBadge): string {
  return SKILL_LABELS[skill];
}

export function playerHeightLabel(player: Player): string {
  return formatHeight(derivePlayerRatings(player).heightIn);
}

export const RATING_ROWS: { key: keyof PlayerRatings; label: string; abbr?: string }[] = [
  { key: 'hgt', label: 'Height', abbr: 'Height' },
  { key: 'fg', label: 'Inside scoring', abbr: 'Inside' },
  { key: 'tp', label: 'Three-point shooting', abbr: '3PT' },
  { key: 'ft', label: 'Free throws', abbr: 'FT' },
  { key: 'dr', label: 'Ball handling', abbr: 'Handle' },
  { key: 'ps', label: 'Passing', abbr: 'Pass' },
  { key: 'reb', label: 'Rebounding', abbr: 'Reb' },
  { key: 'di', label: 'Interior defense', abbr: 'Int D' },
  { key: 'dp', label: 'Perimeter defense', abbr: 'Per D' },
  { key: 'ath', label: 'Athleticism', abbr: 'Ath' },
  { key: 'po', label: 'Post scoring', abbr: 'Post' },
  { key: 'endu', label: 'Stamina', abbr: 'Stamina' },
];

/** Key ratings shown on roster cards — labels are human-readable. */
export const COMPACT_RATING_KEYS: { key: 'fg' | 'tp' | 'ps' | 'dr' | 'reb' | 'di' | 'dp'; label: string }[] = [
  { key: 'fg', label: 'Inside' },
  { key: 'tp', label: '3PT' },
  { key: 'ps', label: 'Pass' },
  { key: 'dr', label: 'Handle' },
  { key: 'reb', label: 'Reb' },
  { key: 'di', label: 'Int D' },
  { key: 'dp', label: 'Per D' },
];

export function ovrTier(ovr: number): string {
  if (ovr >= 85) return 'All-time tier';
  if (ovr >= 75) return 'MVP candidate';
  if (ovr >= 65) return 'All-league caliber';
  if (ovr >= 55) return 'Starter';
  if (ovr >= 45) return 'Rotation';
  return 'Fringe';
}
