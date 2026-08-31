// mulberry32, split so the cursor can live in game state instead of a closure.
// Every draw returns the next cursor, which keeps the reducer pure and makes a
// run reproducible from its seed alone.

export interface Draw {
  value: number; // 0..1
  next: number;
}

export function draw(cursor: number): Draw {
  const a = (cursor + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, next: a };
}

/** Uniform in [lo, hi). */
export function drawRange(cursor: number, lo: number, hi: number): Draw {
  const d = draw(cursor);
  return { value: lo + d.value * (hi - lo), next: d.next };
}

export function drawInt(cursor: number, n: number): Draw {
  const d = draw(cursor);
  return { value: Math.floor(d.value * n), next: d.next };
}

export function pick<T>(cursor: number, items: readonly T[]): { value: T | undefined; next: number } {
  if (items.length === 0) return { value: undefined, next: draw(cursor).next };
  const d = drawInt(cursor, items.length);
  return { value: items[d.value], next: d.next };
}

/** Hash a human-typed seed string into a 32-bit cursor. */
export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
