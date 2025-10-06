import type { PlayerState, TcgCard } from './types';

export function cloneCard(card: TcgCard | null | undefined): TcgCard | null {
  return card ? { ...card } : null;
}

export function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    hand: player.hand.map((c) => ({ ...c })),
    revealed: cloneCard(player.revealed) ?? null,
  };
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function shuffle<T>(input: T[], rng: () => number = Math.random): T[] {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- seeded RNG helpers ---
// xmur3 hash -> produces a 32-bit seed from string
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

// mulberry32 PRNG seeded with integer
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// convert a seed (string or number) into an RNG function
export function seedToRng(seed: string | number): () => number {
  if (typeof seed === 'number') {
    return mulberry32(seed >>> 0);
  }
  const h = xmur3(seed)();
  return mulberry32(h);
}
