import { ATTACK_COST, ATTACK_DAMAGE, DEFENSE_COST, DODGE_COST, HAND_SIZE, INITIAL_HAND_SIZE, MAX_BREATH } from './constants';
import type { PlayerState, Priority, ResolveResult, TcgCard, ImpactKind, DefeatTag } from './types';
import { cloneCard, clonePlayer } from './utils';

const COST_BY_TYPE: Record<TcgCard['type'], number> = {
  attack: ATTACK_COST,
  defense: DEFENSE_COST,
  dodge: DODGE_COST,
};

export function costOf(card: TcgCard): number {
  return COST_BY_TYPE[card.type];
}

export function canPlayCard(state: PlayerState, card: TcgCard): boolean {
  const requirementOk = !card.requires || card.requires === state.posture;
  const breathOk = state.breath >= costOf(card);
  return requirementOk && breathOk;
}

// New helper: determine if a player has any available move right now
// A move is defined as either:
// - Being able to play at least one card in hand (meets posture requirement and has enough breath), or
// - Being able to draw a card (has space in hand and there are cards left in the deck)
export function hasAnyAvailableMove(state: PlayerState, deckCount: number): boolean {
  const canPlay = state.hand.some((c) => canPlayCard(state, c));
  const canDraw = state.hand.length < HAND_SIZE && deckCount > 0;
  return canPlay || canDraw;
}

function applyFinalPosture(player: PlayerState, card: TcgCard, log: string[]): void {
  if (card.final && card.final !== player.posture) {
    player.posture = card.final;
    log.push(`${player.name} switches to ${player.posture}.`);
  }
}

function markDefeat(current: DefeatTag, who: 'p1' | 'p2'): DefeatTag {
  if (current === null) return who;
  if (current === who) return current;
  return 'both';
}

function pushDefeatEvent(events: ImpactKind[], who: 'p1' | 'p2'): void {
  events.push(who === 'p1' ? 'defeat_p1' : 'defeat_p2');
}

function checkBreathAndMark(player: PlayerState, who: 'p1' | 'p2', events: ImpactKind[], log: string[], defeated: DefeatTag): DefeatTag {
  if (player.breath <= 0) {
    log.push(`${player.name} ran out of breath!`);
    pushDefeatEvent(events, who);
    return markDefeat(defeated, who);
  }
  return defeated;
}

function nonAggressiveStealsPriority(defender: PlayerState, attacker: PlayerState): boolean {
  const d = defender.revealed?.type;
  const a = attacker.revealed?.type;
  // Non-aggressive (defense or dodge) steals from aggressive (attack)
  return (d === 'defense' || d === 'dodge') && a === 'attack';
}

function removeFromHand(player: PlayerState, cardId: string): TcgCard | null {
  const index = player.hand.findIndex((card) => card.id === cardId);
  if (index === -1) return null;
  return player.hand.splice(index, 1)[0];
}

function handleDefeat(player: PlayerState, who: 'p1' | 'p2', events: ImpactKind[], log: string[], defeated: DefeatTag): DefeatTag {
  if (player.breath <= 0) {
    log.push(`${player.name} ran out of breath!`);
    events.push(who === 'p1' ? 'defeat_p1' : 'defeat_p2');
    return markDefeat(defeated, who);
  }
  return defeated;
}

export function resolveRound(p1: PlayerState, p2: PlayerState, priorityOwner: Priority): ResolveResult {
  if (!p1.revealed || !p2.revealed) {
    throw new Error('resolveRound requires both players to have revealed cards.');
  }

  const actors: Record<'p1', PlayerState> & Record<'p2', PlayerState> = {
    p1: clonePlayer(p1),
    p2: clonePlayer(p2),
  } as any;

  const events: ImpactKind[] = [];
  const log: string[] = [];
  const consumed = { p1: [] as TcgCard[], p2: [] as TcgCard[] };

  if (actors.p1.revealed) consumed.p1.push(cloneCard(actors.p1.revealed)!);
  if (actors.p2.revealed) consumed.p2.push(cloneCard(actors.p2.revealed)!);

  let defeated: DefeatTag = null;

  const order: Array<'p1' | 'p2'> = priorityOwner === 0 ? ['p1', 'p2'] : ['p2', 'p1'];
  let finalOrder = order.slice();
  if (nonAggressiveStealsPriority(actors.p1, actors.p2) && !nonAggressiveStealsPriority(actors.p2, actors.p1)) finalOrder = ['p1', 'p2'];
  else if (nonAggressiveStealsPriority(actors.p2, actors.p1) && !nonAggressiveStealsPriority(actors.p1, actors.p2)) finalOrder = ['p2', 'p1'];

  const perform = (who: 'p1' | 'p2', targetId: 'p1' | 'p2') => {
    const actor = actors[who];
    const target = actors[targetId];
    const card = actor.revealed!;

    const isFree = false; // round resolution never marks extra window here
    if (!isFree) {
      actor.breath -= costOf(card);
      log.push(`${actor.name} spends ${costOf(card)} (${card.type}).`);
    }

    if (card.type === 'attack') {
      if (target.posture !== card.target) {
        log.push(actor.name + ' attacks ' + card.target + ', but ' + target.name + ' is in posture ' + target.posture + '; attack fails.');
        applyFinalPosture(actor, card, log);
      } else {
        const targetDefends = target.revealed?.type === 'defense' && target.revealed.target === card.target;
        const targetDodges = target.revealed?.type === 'dodge' && target.revealed.final && target.revealed.final !== card.target;
        if (targetDefends) {
          log.push(`${target.name} blocks target ${card.target}.`);
          events.push(who === 'p1' ? 'blocked_p2' : 'blocked_p1');
        } else if (targetDodges) {
          log.push(`${target.name} dodges out of target ${card.target}.`);
          events.push(who === 'p1' ? 'dodged_p2' : 'dodged_p1');
        } else {
          target.breath -= ATTACK_DAMAGE;
          log.push(actor.name + ' hits ' + ATTACK_DAMAGE + ' on ' + target.name + '.');
          events.push(who === 'p1' ? 'p1_hits' : 'p2_hits');
          defeated = checkBreathAndMark(target, targetId, events, log, defeated);
        }
        applyFinalPosture(actor, card, log);
      }
  } else if (card.type === 'defense') {
      const oppAttackMatchesTarget = target.revealed?.type === 'attack' && target.revealed.target === card.target;
      if (oppAttackMatchesTarget) {
        log.push(`${actor.name} blocks successfully and gains an extra action!`);
        events.push(who === 'p1' ? 'extra_granted_p1' : 'extra_granted_p2');
      } else {
        log.push(actor.name + ' defends ' + card.target + ', but no matching attack.');
      }
      applyFinalPosture(actor, card, log);
    } else if (card.type === 'dodge') {
      applyFinalPosture(actor, card, log);
      if (target.revealed?.type === 'attack' && target.revealed.target === actor.posture) {
        log.push(actor.name + ' ends up in the attack target after dodge.');
      }
    }
  };

  for (const who of finalOrder) {
    if (defeated) break;
    const targetId = who === 'p1' ? 'p2' : 'p1';
    perform(who, targetId);
  }

  if (!defeated) {
    actors.p1.breath = Math.min(MAX_BREATH, actors.p1.breath + 1);
    actors.p2.breath = Math.min(MAX_BREATH, actors.p2.breath + 1);
    log.push('End of round: Both players +1 breath.');
  }

  const nextPriorityOwner: Priority = priorityOwner === 0 ? 1 : 0;

  // Remove consumed cards from hands
  if (consumed.p1.length > 0) {
    actors.p1.hand = actors.p1.hand.filter(card => !consumed.p1.some(c => c.id === card.id));
  }
  if (consumed.p2.length > 0) {
    actors.p2.hand = actors.p2.hand.filter(card => !consumed.p2.some(c => c.id === card.id));
  }

  const normalizedP1: PlayerState = { ...actors.p1, revealed: null };
  const normalizedP2: PlayerState = { ...actors.p2, revealed: null };

  return {
    p1: normalizedP1,
    p2: normalizedP2,
    events: events.length ? events : ['none'],
    log,
    nextPriorityOwner,
    defeated,
    consumedCards: { p1: consumed.p1, p2: consumed.p2 },
  };
}

export function initialHandSetup(deck: TcgCard[], initialSize: number = INITIAL_HAND_SIZE): { deck: TcgCard[]; p1Hand: TcgCard[]; p2Hand: TcgCard[] } {
  let workingDeck = deck.slice();
  const p1Hand: TcgCard[] = [];
  const p2Hand: TcgCard[] = [];
  for (let i = 0; i < initialSize; i++) {
    if (workingDeck.length) p1Hand.push(workingDeck.shift()!);
    if (workingDeck.length) p2Hand.push(workingDeck.shift()!);
  }
  return { deck: workingDeck, p1Hand, p2Hand };
}

export function resolveSingleAction(
  actorState: PlayerState,
  targetState: PlayerState,
  actorId: 'p1' | 'p2',
  options?: { free?: boolean }
) {
  const actor = clonePlayer(actorState);
  const target = clonePlayer(targetState);

  const events: ImpactKind[] = [];
  const log: string[] = [];
  const consumed = { p1: [] as TcgCard[], p2: [] as TcgCard[] };

  let defeated: DefeatTag = null;

  const who = actorId === 'p1' ? 'p1' : 'p2';
  const other = who === 'p1' ? 'p2' : 'p1';

  if (!actor.revealed) {
    log.push(`${actor.name} has no revealed card to resolve.`);
    return { actor, target, events, log, defeated, consumedCards: consumed };
  }

  consumed[who].push(cloneCard(actor.revealed)!);
  removeFromHand(actor, actor.revealed.id);

  const card = actor.revealed;
  const isFree = options?.free === true;
  if (!isFree) {
    actor.breath -= costOf(card);
    log.push(`${actor.name} spends ${costOf(card)} (${card.type}).`);
  } else {
    log.push(`${actor.name} performs a counter (free).`);
  }

  if (card.type === 'attack') {
    if (target.posture !== card.target) {
      log.push(actor.name + ' attacks ' + card.target + ', but ' + target.name + ' is in posture ' + target.posture + '; attack fails.');
      applyFinalPosture(actor, card, log);
    } else {
      const targetDefends = target.revealed?.type === 'defense' && target.revealed.target === card.target;
      const targetDodges = target.revealed?.type === 'dodge' && target.revealed.final && target.revealed.final !== card.target;
      if (targetDefends) {
        log.push(`${target.name} blocks target ${card.target}.`);
        events.push(who === 'p1' ? 'blocked_p2' : 'blocked_p1');
      } else if (targetDodges) {
        log.push(`${target.name} dodges out of target ${card.target}.`);
        events.push(who === 'p1' ? 'dodged_p2' : 'dodged_p1');
      } else {
        target.breath -= ATTACK_DAMAGE;
        log.push(actor.name + ' hits ' + ATTACK_DAMAGE + ' on ' + target.name + '.');
        events.push(who === 'p1' ? 'p1_hits' : 'p2_hits');
        defeated = checkBreathAndMark(target, other, events, log, defeated);
      }
      applyFinalPosture(actor, card, log);
    }
  } else if (card.type === 'defense') {
    const oppAttackMatchesTarget = target.revealed?.type === 'attack' && target.revealed.target === card.target;
    if (oppAttackMatchesTarget) {
      log.push(`${actor.name} blocks successfully and gains an extra action!`);
      events.push(who === 'p1' ? 'extra_granted_p1' : 'extra_granted_p2');
    } else {
      log.push(actor.name + ' defends ' + card.target + ', but no matching attack.');
    }
    applyFinalPosture(actor, card, log);
  } else if (card.type === 'dodge') {
    applyFinalPosture(actor, card, log);
    if (target.revealed?.type === 'attack' && target.revealed.target === actor.posture) {
      log.push(actor.name + ' ends up in the attack target after dodge.');
    }
  }

  defeated = checkBreathAndMark(actor, who, events, log, defeated);

  actor.revealed = null;

  return { actor, target, events, log, defeated, consumedCards: consumed };
}
