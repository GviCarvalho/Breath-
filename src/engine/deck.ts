import { HAND_SIZE } from './constants';
import type { Posture, TcgCard } from './types';
import { shuffle, uid, seedToRng } from './utils';

type SeedOrRng = string | number | (() => number) | undefined;

// Export alphabet so other modules can generate/validate seeds
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// mapping helpers: index (0..56) -> card
function createCard(type: 'attack' | 'defense' | 'dodge', idx: number, postures: Posture[]): TcgCard {
  const requires = Math.floor(idx / 9);
  const rem = idx % 9;
  const target = Math.floor(rem / 3);
  const final = rem % 3;
  return { id: ALPHABET[idx], type, requires: postures[requires], target: postures[target], final: postures[final] } as TcgCard;
}

export const idxToCardStatic = (idx: number): TcgCard => {
  const postures: Posture[] = ['A', 'B', 'C'];
  if (idx >= 0 && idx <= 26) {
    return createCard('attack', idx, postures);
  }
  if (idx >= 27 && idx <= 53) {
    return createCard('defense', idx - 27, postures);
  }
  if (idx >= 54 && idx <= 56) {
    const final = idx - 54;
    return { id: ALPHABET[idx], type: 'dodge', final: postures[final], target: postures[final] } as TcgCard;
  }
  return { id: ALPHABET[idx % ALPHABET.length], type: 'dodge', final: 'A', target: 'A' } as TcgCard;
};

// helper: given a card, find the index (0..56) that would produce it via idxToCardStatic
export const cardToIdxStatic = (card: TcgCard): number | null => {
  for (let i = 0; i < 57; i++) {
    const c = idxToCardStatic(i);
    // compare meaningful fields
    if (c.type !== card.type) continue;
    if (c.type === 'attack' || c.type === 'defense') {
      if (c.requires === (card as any).requires && c.target === (card as any).target && c.final === (card as any).final) return i;
    } else if (c.type === 'dodge') {
      if (c.final === (card as any).final && c.target === (card as any).target) return i;
    }
  }
  return null;
};

export function makeDeck(seedOrRng: SeedOrRng = Math.random): TcgCard[] {
  // If seedOrRng is a function use it as RNG; if it's a string/number create RNG
  const rng = typeof seedOrRng === 'function' ? seedOrRng : seedToRng(seedOrRng as string | number);

  // If seed is a string and starts with the required 'v1.' prefix, parse compact seed
  if (typeof seedOrRng === 'string' && seedOrRng.trim().startsWith('v1.')) {
    let s = seedOrRng.trim().slice(3);

    // If versioned, support optional checksum as last char
    if (s.length >= 2) {
      s = validateChecksum(s);
    }

    if (s.length > 0 && [...s].every((ch) => ALPHABET.indexOf(ch) !== -1)) {
      const deck: TcgCard[] = [];
      const used = new Set<number>();
      for (let i = 0; i < s.length && deck.length < 21; i++) {
        const ch = s[i];
        const idx = ALPHABET.indexOf(ch);
        if (idx === -1) continue;
          const card = idxToCardStatic(idx);
        deck.push({ ...card, id: `${ch}${i}` });
        used.add(idx);
      }

      // If less than 21, pad deterministically using remaining indices in order
      if (deck.length < 21) {
        for (let idx = 0; idx < 57 && deck.length < 21; idx++) {
          if (used.has(idx)) continue;
          const card = idxToCardStatic(idx);
          deck.push({ ...card, id: `${ALPHABET[idx]}${deck.length}` });
          used.add(idx);
        }
      }

      // If still less (shouldn't happen), repeat from start
      let wrap = 0;
      while (deck.length < 21) {
        const idx = wrap % 57;
        const ch = ALPHABET[idx];
          deck.push({ ...idxToCardStatic(idx), id: `${ch}${deck.length}` });
        wrap++;
      }

      // If payload longer than 21, we've already truncated during creation above
      return deck.slice(0, 21);
    }
  }

  // fallback: sample 21 distinct indices from 0..56 using RNG and map to cards
  const indices: number[] = Array.from({ length: 57 }, (_, i) => i);
  // simple shuffle of indices using rng
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const selected = indices.slice(0, 21);
    const deck = selected.map((idx, pos) => ({ ...idxToCardStatic(idx), id: `x${pos}${ALPHABET[idx]}` }));
  return deck;
}

// encode a deck into the compact v1 seed format
export function encodeDeckToV1(deck: TcgCard[], withChecksum: boolean = true): string {
  // produce payload from first up to 21 cards by mapping each card back to the 0..56 index
  const payloadChars: string[] = [];
  for (let i = 0; i < Math.min(21, deck.length); i++) {
    const card = deck[i];
    const idx = cardToIdxStatic(card) ?? 0;
    payloadChars.push(ALPHABET[idx % ALPHABET.length]);
  }

  let payload = payloadChars.join('');
  if (withChecksum && payload.length > 0) {
    let sum = 0;
    for (const ch of payload) sum += ALPHABET.indexOf(ch);
    const check = ALPHABET[sum % 64];
    payload = payload + check;
  }
  return `v1.${payload}`;
}

function validateChecksum(s: string): string {
  const payload = s.slice(0, -1);
  const checksumChar = s.slice(-1);
  let sum = 0;
  let ok = true;
  for (const ch of payload) {
    const v = ALPHABET.indexOf(ch);
    if (v === -1) { ok = false; break; }
    sum += v;
  }
  if (ok) {
    const expected = ALPHABET[sum % 64];
    if (expected === checksumChar) return payload; // consume checksum
  }
  return s;
}

export interface DrawResult {
  deck: TcgCard[];
  drawn: TcgCard[];
}

export function drawCards(deck: TcgCard[], count: number): DrawResult {
  const drawn: TcgCard[] = [];
  const remaining = deck.slice();
  for (let i = 0; i < count; i++) {
    if (remaining.length === 0) break;
    const card = remaining.shift();
    if (card) drawn.push(card);
  }
  return { deck: remaining, drawn };
}

export function refillHand(hand: TcgCard[], deck: TcgCard[], size: number = HAND_SIZE) {
  const need = Math.max(0, size - hand.length);
  if (need === 0) return { hand, deck };
  const { deck: rest, drawn } = drawCards(deck, need);
  return { hand: [...hand, ...drawn], deck: rest };
}
