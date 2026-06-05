export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickFrom<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

export function pickInt(seed: number, min: number, max: number, salt = 0): number {
  const span = max - min + 1;
  return min + ((seed + salt * 9973) % span);
}
