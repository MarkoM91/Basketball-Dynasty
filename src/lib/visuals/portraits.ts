import type { Player } from '../../types/game';
import { hashString, pickFrom, pickInt } from './hash';

const SKIN = ['#f5d0b5', '#e8b796', '#c68642', '#8d5524', '#6b4423', '#a3755a'];
const HAIR = ['#1a1a1a', '#3d2314', '#6b4423', '#b8860b', '#4a3728', '#2c2c2c', '#8b6914'];
const SHIRT = ['#2a3040', '#1c2230', '#3d4a5c', '#4a3518', '#1a3a44'];

export function buildPortraitSvg(
  player: Pick<Player, 'id' | 'firstName' | 'lastName' | 'age' | 'position'>,
): string {
  const seed = hashString(`${player.id}-${player.firstName}-${player.lastName}`);
  const skin = pickFrom(SKIN, seed);
  const hair = pickFrom(HAIR, seed, 1);
  const shirt = pickFrom(SHIRT, seed, 2);
  const hairStyle = pickInt(seed, 0, 3, 3);
  const hasBeard = pickInt(seed, 0, 10, 4) > 7 && player.age >= 26;
  const smile = pickInt(seed, 0, 10, 5) > 3;
  const eyeOffset = pickInt(seed, -2, 2, 6);

  const hairPaths = [
    'M 18 28 Q 26 8 34 28 Q 34 18 26 14 Q 18 18 18 28',
    'M 16 30 Q 26 6 36 30 L 36 22 Q 26 12 16 22 Z',
    'M 14 26 Q 26 4 38 26 Q 38 20 26 16 Q 14 20 14 26',
    'M 18 32 Q 26 10 34 32 L 34 24 Q 26 18 18 24 Z',
  ];

  const mouthPath = smile
    ? 'M 22 40 Q 26 44 30 40'
    : 'M 22 41 L 30 41';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" role="img" aria-label="${player.firstName} ${player.lastName}">
  <rect width="52" height="52" fill="${shirt}" rx="26"/>
  <ellipse cx="26" cy="54" rx="18" ry="14" fill="${shirt}"/>
  <ellipse cx="26" cy="28" rx="14" ry="16" fill="${skin}"/>
  <path d="${hairPaths[hairStyle]}" fill="${hair}"/>
  <ellipse cx="${22 + eyeOffset}" cy="27" rx="2.2" ry="2.8" fill="#fff"/>
  <ellipse cx="${30 + eyeOffset}" cy="27" rx="2.2" ry="2.8" fill="#fff"/>
  <circle cx="${22 + eyeOffset}" cy="27.5" r="1.2" fill="#1a1a1a"/>
  <circle cx="${30 + eyeOffset}" cy="27.5" r="1.2" fill="#1a1a1a"/>
  <path d="M 26 31 L 26 34" stroke="${skin}" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
  <path d="${mouthPath}" stroke="#6b4423" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  ${hasBeard ? `<ellipse cx="26" cy="36" rx="9" ry="5" fill="${hair}" opacity="0.35"/>` : ''}
</svg>`;
}

export function portraitDataUri(
  player: Pick<Player, 'id' | 'firstName' | 'lastName' | 'age' | 'position'>,
): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildPortraitSvg(player))}`;
}
