import { canPlayCard } from './rules';
import type { PlayerState, TcgCard, Posture } from './types';
import type { Predictor, OpponentAction } from './predictor';
import { postureCharToIndex } from './predictor';

export function chooseCardForAi(player: PlayerState, opponent: PlayerState): TcgCard | null {
  const playable = player.hand.filter((card) => canPlayCard(player, card));
  if (playable.length === 0) return player.hand[0] ?? null;
  const snipe = playable.find((card) => card.type === 'attack' && card.target === opponent.posture);
  if (snipe) return snipe;
  const guard = playable.find((card) => card.type === 'defense' && card.target === opponent.posture);
  if (guard) return guard;
  const evasive = playable.find((card) => card.type === 'dodge' && card.final && card.final !== player.posture);
  if (evasive) return evasive;
  return playable[0];
}

export function choosePostureForAi(hand: TcgCard[]): Posture {
  const postures: Posture[] = ['A', 'B', 'C'];
  let best: Posture = 'A';
  let bestScore = -1;
  for (const p of postures) {
    let score = 0;
    for (const card of hand) {
      // card is considered available if no requires or matches posture
      if (!('requires' in (card as any)) || (card as any).requires == null || (card as any).requires === p) {
        score += 1;
        // small weight if final posture keeps you stationary (defense continuity)
        if ((card as any).final === p) score += 0.25;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

export function chooseCardForAiPredictive(
  ai: PlayerState,
  opponent: PlayerState,
  predictor: Predictor
): TcgCard | null {
  // Build available action options from hand
  const playable = ai.hand.filter((card) => canPlayCard(ai, card));
  const types = new Set<OpponentAction>();
  for (const c of playable) types.add(c.type as OpponentAction);
  if (types.size === 0) return ai.hand[0] ?? null;

  const { pick } = predictor.chooseAction({
    posture: postureCharToIndex(opponent.posture),
    breath: opponent.breath,
    myActionOptions: Array.from(types),
  });

  // choose specific card of that type
  if (pick === 'attack') {
    const target = opponent.posture;
    const best = playable.find((c) => c.type === 'attack' && (c as any).target === target);
    return best || playable.find((c) => c.type === 'attack') || playable[0] || null;
  }
  if (pick === 'defense') {
    const target = opponent.posture;
    const best = playable.find((c) => c.type === 'defense' && (c as any).target === target);
    return best || playable.find((c) => c.type === 'defense') || playable[0] || null;
  }
  if (pick === 'dodge') {
    const best = playable.find((c) => c.type === 'dodge' && (c as any).final && (c as any).final !== ai.posture);
    return best || playable.find((c) => c.type === 'dodge') || playable[0] || null;
  }
  // 'draw' chosen: return null to indicate no reveal (caller should interpret as pass/draw)
  return null;
}
