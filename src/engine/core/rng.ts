export interface RngState {
  seed: string;
  cursor: number;
}

export interface Rng {
  state: RngState;
  next(): number;
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T | undefined;
  fork(salt: string): Rng;
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(state: RngState | string): Rng {
  const seed = typeof state === 'string' ? state : state.seed;
  const startCursor = typeof state === 'string' ? 0 : state.cursor;
  let cursor = startCursor;

  const nextForCursor = (position: number): number => {
    const next = mulberry32(hashString(`${seed}:${position}`));
    return next();
  };

  const api: Rng = {
    get state() {
      return { seed, cursor };
    },
    next() {
      const value = nextForCursor(cursor);
      cursor += 1;
      return value;
    },
    int(min: number, max: number) {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(api.next() * (hi - lo + 1));
    },
    chance(probability: number) {
      return api.next() < Math.max(0, Math.min(1, probability));
    },
    pick<T>(items: readonly T[]): T | undefined {
      if (!items.length) return undefined;
      return items[api.int(0, items.length - 1)];
    },
    fork(salt: string) {
      return createRng({ seed: `${seed}:${salt}:${cursor}`, cursor: 0 });
    },
  };

  return api;
}

