import { describe, expect, it } from 'vitest';
import { MAX_BREATH, ATTACK_DAMAGE } from './constants';
import { canPlayCard, resolveRound } from './rules';
import type { PlayerState, TcgCard } from './types';

type CardOverrides = Partial<TcgCard>;

type PlayerOverrides = Partial<PlayerState>;

const mkCard = (type: TcgCard['type'], overrides: CardOverrides = {}): TcgCard => ({
  id: Math.random().toString(36).slice(2, 9),
  type,
  ...overrides,
});

const mkPlayer = (overrides: PlayerOverrides = {}): PlayerState => ({
  name: overrides.name ?? 'Player',
  posture: overrides.posture ?? 'A',
  breath: overrides.breath ?? MAX_BREATH,
  hand: overrides.hand ? overrides.hand.map((card) => ({ ...card })) : [],
  revealed: overrides.revealed ? { ...overrides.revealed } : null,
});

describe('canPlayCard', () => {
  it('requires matching posture and breath', () => {
    const attack = mkCard('attack', { requires: 'B' });
    const mismatch = mkPlayer({ posture: 'A' });
    expect(canPlayCard(mismatch, attack)).toBe(false);

    const lowBreath = mkPlayer({ posture: 'B', breath: 0 });
    expect(canPlayCard(lowBreath, attack)).toBe(false);

    const ok = mkPlayer({ posture: 'B' });
    expect(canPlayCard(ok, attack)).toBe(true);
  });
});

describe('resolveRound', () => {
  it('grants extra action on perfect block and consumes the extra card', () => {
    const atk = mkCard('attack', { requires: 'A', target: 'A', final: 'A' });
    const def = mkCard('defense', { requires: 'A', target: 'A', final: 'A' });
    const extra = mkCard('attack', { requires: 'A', target: 'A', final: 'A' });

    const p1 = mkPlayer({ name: 'P1', posture: 'A', hand: [], revealed: atk });
    const p2 = mkPlayer({ name: 'P2', posture: 'A', hand: [extra], revealed: def });

    const result = resolveRound(p1, p2, 0);

    expect(result.defeated).toBe('p1');
    expect(result.events).toContain('blocked_p2');
    expect(result.events).toContain('extra_p2');
    expect(result.events).toContain('defeat_p1');
    expect(result.consumedCards.p2).toHaveLength(2);
    expect(result.p2.hand).toHaveLength(0);
    expect(result.p1.breath).toBeLessThanOrEqual(0);
  });

  it('allows dodge to avoid damage and recover', () => {
    const atk = mkCard('attack', { requires: 'A', target: 'A', final: 'A' });
    const dodge = mkCard('dodge', { final: 'B', target: 'B' });

    const p1 = mkPlayer({ name: 'P1', posture: 'A', hand: [], revealed: atk });
    const p2 = mkPlayer({ name: 'P2', posture: 'A', hand: [], revealed: dodge });

    const result = resolveRound(p1, p2, 0);

    expect(result.defeated).toBeNull();
    expect(result.events).toContain('dodged_p2');
    expect(result.p2.posture).toBe('B');
    expect(result.p2.breath).toBe(MAX_BREATH);
  });

  it('applies damage when defense misses target', () => {
    const atk = mkCard('attack', { requires: 'A', target: 'A', final: 'A' });
    const wrongDef = mkCard('defense', { requires: 'A', target: 'B', final: 'A' });

    const p1 = mkPlayer({ name: 'P1', posture: 'A', hand: [], revealed: atk });
    const p2 = mkPlayer({ name: 'P2', posture: 'A', hand: [], revealed: wrongDef });

    const result = resolveRound(p1, p2, 0);

    expect(result.defeated).toBe('p2');
    expect(result.events).toContain('p1_hits');
    expect(result.events).toContain('defeat_p2');
    expect(result.p2.breath).toBeLessThanOrEqual(0);
    expect(result.nextPriorityOwner).toBe(1);
  });

  it('defeats player that spends the last point of breath', () => {
    const card = mkCard('dodge', { final: 'B' });
    const p1 = mkPlayer({ name: 'P1', posture: 'A', breath: 1, hand: [], revealed: card });
    const p2 = mkPlayer({ name: 'P2', posture: 'B', hand: [], revealed: mkCard('dodge', { final: 'C' }) });

    const result = resolveRound(p1, p2, 0);

    expect(result.defeated).toBe('p1');
    expect(result.events).toContain('defeat_p1');
    expect(result.p1.breath).toBeLessThanOrEqual(0);
  });
});
