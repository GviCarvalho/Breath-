import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import '@/features/arena/arena.css';
import { type TcgCard, type ImpactKind, HAND_SIZE, MAX_BREATH } from '@/engine';
import { CardFront, CardBack } from './ui3';
import { setupResponsiveCards } from '@/lib/responsive';
import { playSound } from '@/lib/sound';

type Posture = 'A' | 'B' | 'C';
type Side = 'p1' | 'p2';

type Floater = { id: string; text: string; side: Side };

// A card physically travelling from a hand position to a table slot.
type Flight = {
  id: string;
  side: Side;
  card: TcgCard;
  from: DOMRect;
  to: DOMRect;
  // The opponent's hand is hidden, so their card flies in face-down and
  // flips to face-up mid-flight, landing already revealed. The player's
  // own card is already known to them, so it just flies face-up.
  flipMidair: boolean;
};

// Which slot flashes, and with what effect, for a given engine event.
function impactTarget(kind?: ImpactKind | null): { side: Side; kind: 'hit' | 'block' | 'dodge' } | null {
  switch (kind) {
    case 'p1_hits':
    case 'defeat_p2':
      return { side: 'p2', kind: 'hit' };
    case 'p2_hits':
    case 'defeat_p1':
      return { side: 'p1', kind: 'hit' };
    case 'blocked_p1':
      return { side: 'p1', kind: 'block' };
    case 'blocked_p2':
      return { side: 'p2', kind: 'block' };
    case 'dodged_p1':
      return { side: 'p1', kind: 'dodge' };
    case 'dodged_p2':
      return { side: 'p2', kind: 'dodge' };
    default:
      return null;
  }
}

// Which card on the table performs the action for a given engine event, and
// what it does: the attack card lunges toward its target, the defense card
// braces firm against the strike, the dodge card sidesteps out of the way.
function actingCard(kind?: ImpactKind | null): { side: Side; motion: 'lunge' | 'block' | 'dodge' } | null {
  switch (kind) {
    case 'p1_hits':
      return { side: 'p1', motion: 'lunge' };
    case 'p2_hits':
      return { side: 'p2', motion: 'lunge' };
    case 'blocked_p1':
      return { side: 'p1', motion: 'block' };
    case 'blocked_p2':
      return { side: 'p2', motion: 'block' };
    case 'dodged_p1':
      return { side: 'p1', motion: 'dodge' };
    case 'dodged_p2':
      return { side: 'p2', motion: 'dodge' };
    default:
      return null;
  }
}

function bannerTone(kind?: ImpactKind | null): string {
  switch (kind) {
    case 'p1_hits':
      return 'good';
    case 'p2_hits':
      return 'bad';
    case 'defeat_p1':
    case 'defeat_p2':
      return 'ko';
    default:
      return 'info';
  }
}

function floaterTone(text: string): string {
  if (text === 'BLOCK') return 'block';
  if (text === 'DODGE') return 'dodge';
  if (text === 'COUNTER') return 'counter';
  if (text === 'KO') return 'ko';
  return 'dmg';
}

// Flashes a CSS class on an element and forces a reflow first, so the
// animation restarts even if the same class was already applied a moment
// ago (React won't replay a keyframe animation just because a className
// prop happens to hold the same string again).
function replayClass(el: Element | null, cls: string) {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

export interface ArenaProps {
  p1: { name: string; posture: Posture; breath: number; hand: TcgCard[]; revealed?: TcgCard | null; committed?: boolean; facedownCount?: number };
  p2: { name: string; posture: Posture; breath: number; hand: TcgCard[]; revealed?: TcgCard | null; committed?: boolean; facedownCount?: number };
  p1Wins?: number;
  p2Wins?: number;
  deckP1Count: number;
  deckP2Count: number;
  priorityOwner: 0 | 1;
  log: string[];
  selectedIdx?: number | null;
  selectedP2Idx?: number | null;
  invalidIdx?: number | null;
  invalidP2Idx?: number | null;
  hoverCard?: TcgCard | null;
  extraPending?: 'none' | 'p1' | 'p2';
  decisionProgress?: number;
  waitingForOpponent?: boolean;
  showP1Facedown?: boolean;
  showP2Facedown?: boolean;
  impact?: ImpactKind;
  impactSeq?: number;
  banner?: string | null;
  floaters?: Floater[];
  p2IsCpu?: boolean;
  onToggleP2Cpu?: () => void;

  onClickP1Card?: (c: TcgCard, idx: number) => void;
  onClickP2Card?: (c: TcgCard, idx: number) => void;
  onClickSetP1Posture?: (p: Posture) => void;
  onClickSetP2Posture?: (p: Posture) => void; // Adiciona suporte para definir a postura do jogador 2
  onHoverCard?: (c: TcgCard | null) => void;
  onClickDraw?: () => void;
  onClickDrawP2?: () => void;
}

export default function ArenaPrototype({
  p1, p2, p1Wins = 0, p2Wins = 0, deckP1Count, deckP2Count, priorityOwner, log,
  selectedIdx, invalidIdx, selectedP2Idx, invalidP2Idx,
  onClickSetP1Posture, onClickP1Card, onClickP2Card, onHoverCard, hoverCard, onClickDraw, onClickDrawP2,
  extraPending = 'none', decisionProgress = 0, waitingForOpponent = false,
  impact = 'none', impactSeq = 0, banner = null, floaters = [],
  p2IsCpu, onToggleP2Cpu,
}: ArenaProps) {
  useEffect(() => {
    const cleanup = setupResponsiveCards();
    return () => cleanup();
  }, []);

  // The arena is a full-viewport HUD, so while it's mounted the page itself
  // shouldn't scroll and shouldn't show a flash of the app's default
  // background through any gap. This used to be baked into arena.css as a
  // global `body { overflow: hidden }` + forced html/body/#root background,
  // which "worked" but never got undone - once any page loaded arena.css
  // once, every other route was stuck with scrolling disabled for the rest
  // of the session. Applying and reverting it here ties it to the arena's
  // actual lifetime instead.
  useEffect(() => {
    const root = document.getElementById('root');
    const prev = {
      bodyOverflow: document.body.style.overflow,
      htmlBg: document.documentElement.style.background,
      bodyBg: document.body.style.background,
      rootBg: root?.style.background ?? '',
    };
    const bg = 'radial-gradient(1100px 600px at 50% -10%, #ffffff 0%, #f4f5f2 55%, #e3e5e0 100%)';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    if (root) root.style.background = bg;
    return () => {
      document.body.style.overflow = prev.bodyOverflow;
      document.documentElement.style.background = prev.htmlBg;
      document.body.style.background = prev.bodyBg;
      if (root) root.style.background = prev.rootBg;
    };
  }, []);

  const boardRef = useRef<HTMLElement | null>(null);
  const opHandRef = useRef<HTMLDivElement | null>(null);
  const slotTopRef = useRef<HTMLDivElement | null>(null);
  const slotBotRef = useRef<HTMLDivElement | null>(null);
  const fxTopRef = useRef<HTMLDivElement | null>(null);
  const fxBotRef = useRef<HTMLDivElement | null>(null);
  const tableCardTopRef = useRef<HTMLDivElement | null>(null);
  const tableCardBotRef = useRef<HTMLDivElement | null>(null);
  const crystalsTopRef = useRef<HTMLDivElement | null>(null);
  const crystalsBotRef = useRef<HTMLDivElement | null>(null);
  const postureTopRef = useRef<HTMLDivElement | null>(null);
  const postureBotRef = useRef<HTMLDivElement | null>(null);

  // ---- Hand -> table flight -------------------------------------------------
  // Every hand card keeps its live element registered here, so the instant a
  // card is confirmed and leaves the hand we already know exactly where it
  // was sitting on screen and can fly a copy of it from that spot to the
  // slot it lands in, instead of the card teleporting from one to the other.
  const p1HandElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const p1HandRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const setP1HandEl = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) p1HandElsRef.current.set(id, el);
    else p1HandElsRef.current.delete(id);
  }, []);

  const [flights, setFlights] = useState<Flight[]>([]);
  // What's actually resting on the table for each side right now. This is a
  // local snapshot taken the instant a flight lands, deliberately decoupled
  // from the engine's own `revealed` field - resolveRound() normalizes
  // `revealed` back to null as soon as it resolves the round (see
  // src/engine/rules.ts), often only a few hundred ms after the reveal, well
  // before the player has actually seen the card sit on the table. Tracking
  // our own snapshot means the table keeps showing what was played
  // regardless of how quickly the engine moves on.
  const [tableCard, setTableCard] = useState<{ p1: TcgCard | null; p2: TcgCard | null }>({ p1: null, p2: null });
  const prevRevealedId = useRef<{ p1: string | null; p2: string | null }>({ p1: null, p2: null });

  const landFlight = useCallback((flight: Flight) => {
    setFlights((cur) => cur.filter((f) => f.id !== flight.id));
    // Landing fires on its own ~460ms timer, decoupled from state - if the
    // round already resolved and moved on (revealed cycled back to null)
    // before this flight finished, applying it now would re-plant a stale
    // card on a table the next round already expects to be empty.
    if (prevRevealedId.current[flight.side] === flight.card.id) {
      setTableCard((cur) => ({ ...cur, [flight.side]: flight.card }));
      try { playSound('cardLand', 0.6); } catch {}
    }
  }, []);

  // A fresh deck (more cards than last seen) means a brand new game/series
  // started - clear any stale card left resting on the table from before.
  const prevDeckCounts = useRef({ d1: deckP1Count, d2: deckP2Count });
  useEffect(() => {
    if (deckP1Count > prevDeckCounts.current.d1) setTableCard((c) => ({ ...c, p1: null }));
    if (deckP2Count > prevDeckCounts.current.d2) setTableCard((c) => ({ ...c, p2: null }));
    prevDeckCounts.current = { d1: deckP1Count, d2: deckP2Count };
  }, [deckP1Count, deckP2Count]);

  // Detect a card that just became this round's revealed play, and launch it
  // from its last known hand position toward the slot it belongs to.
  useLayoutEffect(() => {
    const p1Id = p1?.revealed?.id ?? null;
    if (p1Id && p1Id !== prevRevealedId.current.p1) {
      const from = p1HandRectsRef.current.get(p1Id);
      const to = slotBotRef.current?.getBoundingClientRect();
      if (from && to && p1.revealed) {
        setFlights((cur) => [...cur, { id: `p1-${p1Id}-${Date.now()}`, side: 'p1', card: p1.revealed!, from, to, flipMidair: false }]);
        try { playSound('cardWhoosh', 0.5); } catch {}
      }
    } else if (!p1Id && prevRevealedId.current.p1) {
      // Round resolved and this side's reveal was cleared - drop whatever was
      // resting on the table so the next round starts from an empty slot
      // instead of showing last round's card until it gets overwritten.
      setTableCard((c) => ({ ...c, p1: null }));
    }

    const p2Id = p2?.revealed?.id ?? null;
    if (p2Id && p2Id !== prevRevealedId.current.p2) {
      const backEl = opHandRef.current?.querySelector('.back') as HTMLElement | null;
      const from = (backEl ?? opHandRef.current)?.getBoundingClientRect();
      const to = slotTopRef.current?.getBoundingClientRect();
      if (from && to && p2.revealed) {
        setFlights((cur) => [...cur, { id: `p2-${p2Id}-${Date.now()}`, side: 'p2', card: p2.revealed!, from, to, flipMidair: true }]);
        try { playSound('cardWhoosh', 0.5); } catch {}
      }
    } else if (!p2Id && prevRevealedId.current.p2) {
      setTableCard((c) => ({ ...c, p2: null }));
    }

    prevRevealedId.current = { p1: p1Id, p2: p2Id };
  }, [p1?.revealed?.id, p2?.revealed?.id]);

  // Keep a fresh position on file for every card currently sitting in the
  // player's hand, so it's ready the instant that card gets played.
  useLayoutEffect(() => {
    p1HandElsRef.current.forEach((el, id) => {
      if (el.isConnected) p1HandRectsRef.current.set(id, el.getBoundingClientRect());
    });
  }, [p1.hand]);

  // ---- Combat impact fx (hit/block/dodge burst + screen shake) --------------
  useEffect(() => {
    const target = impactTarget(impact);
    if (!target) return;
    const fxEl = target.side === 'p2' ? fxTopRef.current : fxBotRef.current;
    replayClass(fxEl, target.kind);
    if (target.kind === 'hit') replayClass(boardRef.current, 'hit-shake');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impact, impactSeq]);

  // ---- Card action animation: the card resting on the table performs the
  // move it just played - the attack card lunges toward the opponent's
  // slot, the defense card braces firm and shudders, the dodge card
  // sidesteps. Direction is derived from the real slot positions so it
  // always points the right way regardless of layout/responsive sizing.
  useEffect(() => {
    const acting = actingCard(impact);
    if (!acting) return;
    const cardEl = acting.side === 'p2' ? tableCardTopRef.current : tableCardBotRef.current;
    const slotTop = slotTopRef.current?.getBoundingClientRect();
    const slotBot = slotBotRef.current?.getBoundingClientRect();
    if (!cardEl || !slotTop || !slotBot) return;

    cardEl.getAnimations().forEach((a) => a.cancel());
    const dx = slotTop.left - slotBot.left;
    const dy = slotTop.top - slotBot.top;
    // p1 (bottom) advances toward the top slot; p2 (top) advances toward
    // the bottom slot - opposite ends of the same vector.
    const dir = acting.side === 'p1' ? 1 : -1;
    const towardX = dx * dir;
    const towardY = dy * dir;

    // The table-card is centered on its slot via a static `translate(-50%,-50%)`
    // inline style; composite:'add' layers this animation's transform on top
    // of that instead of replacing it, so the card keeps its centering.
    if (acting.motion === 'lunge') {
      cardEl.animate(
        [
          { transform: 'translate(0,0) rotate(0deg) scale(1)' },
          { transform: `translate(${towardX * 0.32}px, ${towardY * 0.32}px) rotate(${-6 * dir}deg) scale(1.05)`, offset: 0.42 },
          { transform: 'translate(0,0) rotate(0deg) scale(1)' },
        ],
        { duration: 340, easing: 'cubic-bezier(.3,.7,.4,1)', composite: 'add' }
      );
    } else if (acting.motion === 'block') {
      cardEl.animate(
        [
          { transform: 'translate(0,0)' },
          { transform: `translate(${towardX * 0.1}px, ${towardY * 0.1}px)`, offset: 0.22 },
          { transform: `translate(${-3 * dir}px, 0px)`, offset: 0.42 },
          { transform: `translate(${3 * dir}px, 0px)`, offset: 0.6 },
          { transform: `translate(${-1.5 * dir}px, 0px)`, offset: 0.78 },
          { transform: 'translate(0,0)' },
        ],
        { duration: 380, easing: 'ease-out', composite: 'add' }
      );
    } else if (acting.motion === 'dodge') {
      cardEl.animate(
        [
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(-16px,-5px) rotate(-8deg)', opacity: 0.5, offset: 0.3 },
          { transform: 'translate(15px,4px) rotate(6deg)', opacity: 0.85, offset: 0.58 },
          { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        ],
        { duration: 420, easing: 'ease-out', composite: 'add' }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impact, impactSeq]);

  // ---- Breath crystals: break/refill one token at a time -------------------
  // The crystal row is rendered from this LOCAL, lagging count rather than
  // p1.breath/p2.breath directly. If it read the prop straight, losing 2
  // breath at once would flip both crystals off in the same render - only
  // the last one would get the fancy break animation, while the other one
  // would just instantly snap dim, so multi-token changes looked like one
  // simultaneous flash instead of a "ta... ta" sequence. Holding a display
  // count back lets each token stay lit until it's its own turn to crack.
  const [displayBreath, setDisplayBreath] = useState({ p1: p1.breath, p2: p2.breath });
  const crystalTimeoutsRef = useRef<number[]>([]);
  const CRYSTAL_STAGGER_MS = 260;

  const runCrystalSequence = useCallback((
    container: HTMLDivElement | null,
    oldVal: number,
    newVal: number,
    side: Side
  ) => {
    if (!container || oldVal === newVal) return;
    const breaking = newVal < oldVal;
    const steps = Math.abs(newVal - oldVal);
    for (let n = 0; n < steps; n++) {
      const idx = breaking ? oldVal - 1 - n : oldVal + n;
      const handle = window.setTimeout(() => {
        const el = container.children[idx] as HTMLElement | undefined;
        if (el) replayClass(el, breaking ? 'breaking' : 'gaining');
        try { playSound(breaking ? 'crystalBreak' : 'breath', breaking ? 0.5 : 0.35); } catch {}
        setDisplayBreath((cur) => ({ ...cur, [side]: breaking ? idx : idx + 1 }));
      }, n * CRYSTAL_STAGGER_MS);
      crystalTimeoutsRef.current.push(handle);
    }
  }, []);

  const prevStats = useRef({ b1: p1.breath, b2: p2.breath, p1p: p1.posture, p2p: p2.posture });
  useEffect(() => {
    let playedPosture = false;

    if (p1.breath !== prevStats.current.b1 || p2.breath !== prevStats.current.b2) {
      crystalTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      crystalTimeoutsRef.current = [];
      runCrystalSequence(crystalsBotRef.current, prevStats.current.b1, p1.breath, 'p1');
      runCrystalSequence(crystalsTopRef.current, prevStats.current.b2, p2.breath, 'p2');
    }
    if (p1.posture !== prevStats.current.p1p) { replayClass(postureBotRef.current, 'pulse'); playedPosture = true; }
    if (p2.posture !== prevStats.current.p2p) { replayClass(postureTopRef.current, 'pulse'); playedPosture = true; }

    if (playedPosture) { try { playSound('posture', 0.4); } catch {} }

    prevStats.current = { b1: p1.breath, b2: p2.breath, p1p: p1.posture, p2p: p2.posture };
  }, [p1.breath, p2.breath, p1.posture, p2.posture, runCrystalSequence]);

  useEffect(() => () => { crystalTimeoutsRef.current.forEach((id) => window.clearTimeout(id)); }, []);

  const CardBackImg = new URL('../../Assets/art/cards/CardBack.png', import.meta.url).href;

  const DeckStack = React.memo(({ count, onClick, disabled, flipped = false }: { count: number; onClick?: () => void; disabled?: boolean; flipped?: boolean }) => {
    const cap = Math.min(count, 8);
    const items = new Array(cap).fill(0);
    return (
      <div
        onClick={() => (!disabled ? onClick?.() : undefined)}
        className="card"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
        }}
        style={{ position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, ['--raise' as any]: '0px', zIndex: 5, pointerEvents: 'auto' }}
        title={disabled ? 'Cannot draw now' : 'Draw a card'}
      >
        {items.map((_, i) => (
          <img
            key={i}
            src={CardBackImg}
            alt="deck card"
            style={{ position: 'absolute', inset: 0, transform: `translate(${i}px, ${-i}px)${flipped ? ' rotate(180deg)' : ''}` as any, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'calc(var(--card-width) * 0.07)', boxShadow: '0 8px 18px rgba(20,22,16,.28)', pointerEvents: 'none' }}
          />
        ))}
        <div style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(0,0,0,.6)', color: '#cfe0ff', padding: '4px 8px', borderRadius: 8, fontWeight: 700 }}>
          {count}
        </div>
      </div>
    );
  });

  return (
    <div className="breath-root">
      {/* Flight layer: fixed to the viewport, sits above everything, and is
          never a descendant of anything that could pick up a transform
          (the board shake in particular) which would otherwise hijack its
          fixed positioning mid-flight. */}
      {flights.map((f) => (
        <CardFlight key={f.id} flight={f} onDone={() => landFlight(f)} />
      ))}

      <div className="hud">

        {/* Top: Opponent */}
        <header className={"playerbar panel" + (extraPending === 'p2' ? ' counter-glow' : '')} style={{ gridColumn: '1', gridRow: '1' }}>
          <div className="avatar">CPU</div>
          <div>
            <div className="name">{p2.name || 'Opponent'}</div>
            <div className="meta">Priority: <strong id="prioTop">{priorityOwner === 1 ? 'Opponent' : '—'}</strong></div>
          </div>
          {onToggleP2Cpu && (
            <button
              className="btn"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={onToggleP2Cpu}
              title="Alternar entre IA e hot-seat"
            >
              {p2IsCpu ? 'CPU: ON' : 'CPU: OFF'}
            </button>
          )}
          <div className="spacer" />
          {extraPending === 'p2' && (
            <div className="counter-badge" title="Counter Window (opponent)">
              <span>Counter!</span>
              <div className="counter-bar"><div className="fill" style={{ width: `${Math.round(decisionProgress * 100)}%` }} /></div>
            </div>
          )}
          <div className="postures" id="postureTop" ref={postureTopRef}>
            <div className={'posture' + (p2.posture === 'A' ? ' active' : '')}>A</div>
            <div className={'posture' + (p2.posture === 'B' ? ' active' : '')}>B</div>
            <div className={'posture' + (p2.posture === 'C' ? ' active' : '')}>C</div>
          </div>
          <div className="crystals" id="crystalsTop" ref={crystalsTopRef}>
            {new Array(MAX_BREATH).fill(0).map((_, i) => (
              <div key={i} className={'crystal' + (i < displayBreath.p2 ? ' on' : '')} />
            ))}
          </div>
        </header>

        {/* Opponent hand (back) */}
        <div className="op-hand" ref={opHandRef}>
          {new Array(p2.facedownCount ?? Math.min(5, p2.hand?.length ?? 0)).fill(0).map((_, i) => (
            <div key={i} className="back" />
          ))}
        </div>

        {/* Center board */}
        <main className="board" ref={boardRef}>
          <div className="panel" style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', padding: '6px 10px', zIndex: 200, textAlign: 'center' }}>
            <strong>Score:</strong> {p1.name || 'You'} {p1Wins} x {p2Wins} {p2.name || 'Opponent'}
          </div>
          {banner && (
            <div className="impact-banner-wrap">
              <div key={impactSeq} className={`impact-banner tone-${bannerTone(impact)}`}>{banner}</div>
            </div>
          )}
          <div className="lane top">
            <div className={"slot" + (extraPending === 'p2' ? ' counter-open' : '')} id="slotTop" ref={slotTopRef}>
              <div className="fx" ref={fxTopRef} />
              <div className="floaters">
                {floaters.filter((f) => f.side === 'p2').map((f) => (
                  <div key={f.id} className={`floater ${floaterTone(f.text)}`}>{f.text}</div>
                ))}
              </div>
              {tableCard.p2 ? (
                <div
                  key={tableCard.p2.id}
                  ref={tableCardTopRef}
                  className="card table-card"
                  style={{ pointerEvents: 'auto', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 9 }}
                  onMouseEnter={() => onHoverCard?.(tableCard.p2!)}
                  onMouseLeave={() => onHoverCard?.(null)}
                >
                  <CardFront card={tableCard.p2} />
                </div>
              ) : p2.committed ? (
                <div
                  className="card table-card table-card-committed"
                  style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 9 }}
                >
                  <CardBack />
                </div>
              ) : null}
            </div>
          </div>
          <div className="lane bot">
            <div className={"slot active" + (extraPending === 'p1' ? ' counter-open' : '')} id="slotBot" ref={slotBotRef}>
              <div className="fx" ref={fxBotRef} />
              <div className="floaters">
                {floaters.filter((f) => f.side === 'p1').map((f) => (
                  <div key={f.id} className={`floater ${floaterTone(f.text)}`}>{f.text}</div>
                ))}
              </div>
              {tableCard.p1 ? (
                <div
                  key={tableCard.p1.id}
                  ref={tableCardBotRef}
                  className="card table-card"
                  style={{ pointerEvents: 'auto', position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 9 }}
                  onMouseEnter={() => onHoverCard?.(tableCard.p1!)}
                  onMouseLeave={() => onHoverCard?.(null)}
                >
                  <CardFront card={tableCard.p1} />
                </div>
              ) : p1.committed ? (
                <div
                  className="card table-card table-card-committed"
                  style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 9 }}
                >
                  <CardBack />
                </div>
              ) : null}
            </div>
          </div>

          {/* Corner deck slots in the central board (p2 top-right, p1 bottom-left) */}
          <div className="board-deck deck-topright">
            <div style={{ position: 'relative', width: 'calc(var(--card-width) * 0.9)', height: 'calc(var(--card-height) * 0.9)', pointerEvents: 'auto' }}>
              <DeckStack
                count={deckP2Count}
                onClick={onClickDrawP2}
                disabled={Boolean(p2.revealed) || deckP2Count === 0 || (p2.hand?.length ?? 0) >= HAND_SIZE}
                flipped
              />
            </div>
          </div>

          <div className="board-deck deck-bottomleft">
            <div style={{ position: 'relative', width: 'calc(var(--card-width) * 0.9)', height: 'calc(var(--card-height) * 0.9)', pointerEvents: 'auto' }}>
              <DeckStack
                count={deckP1Count}
                onClick={onClickDraw}
                disabled={Boolean(p1.revealed) || deckP1Count === 0 || (p1.hand?.length ?? 0) >= HAND_SIZE}
              />
            </div>
          </div>
        </main>

        {/* Bottom: Player */}
        <footer className={"playerbar panel" + (extraPending === 'p1' ? ' counter-glow' : '')} style={{ gridColumn: '1', gridRow: '3 / span 1', alignItems: 'flex-start', paddingBottom: 0 }}>
          <div className="avatar">YOU</div>
          <div>
            <div className="name">{p1.name || 'You'}</div>
            <div className="meta">Priority: <strong id="prioBot">{priorityOwner === 0 ? 'You' : '—'}</strong></div>
          </div>
          {extraPending === 'p1' && (
            <div className="counter-badge" title="Counter Window (you)">
              <span>Counter!</span>
              <div className="counter-bar"><div className="fill" style={{ width: `${Math.round(decisionProgress * 100)}%` }} /></div>
            </div>
          )}
          <div className="spacer" />
          <div className="postures" id="postureBot" ref={postureBotRef}>
            {(['A', 'B', 'C'] as Posture[]).map((p) => (
              <div key={p} className={'posture' + (p1.posture === p ? ' active' : '')} onClick={() => onClickSetP1Posture?.(p)}>
                {p}
              </div>
            ))}
          </div>
          <div className="crystals" id="crystalsBot" ref={crystalsBotRef}>
            {new Array(MAX_BREATH).fill(0).map((_, i) => (
              <div key={i} className={'crystal' + (i < displayBreath.p1 ? ' on' : '')} />
            ))}
          </div>
        </footer>

        {/* Player hand (fan) */}
        <section className="hand">
          {p1.hand.slice(0, 5).map((card, idx) => (
            <article
              key={`${card.id}-${idx}`}
              ref={setP1HandEl(card.id)}
              className={'card' + (selectedIdx === idx ? ' selected' : '') + (invalidIdx === idx ? ' shake' : '')}
              style={{ ['--rot' as any]: rotationForIndex(idx, Math.min(5, p1.hand.length)) }}
              onClick={() => onClickP1Card?.(card, idx)}
              onMouseEnter={() => onHoverCard?.(card)}
              onMouseLeave={() => onHoverCard?.(null)}
            >
              <CardFront card={card} />
            </article>
          ))}
        </section>

        {/* Log at right */}
        <aside className="log panel" id="log">
          <h3>{hoverCard ? 'Card Details' : 'Log'}</h3>
          {hoverCard ? (
            <div className="space-y-2 text-sm">
              <div>Type: <b>{hoverCard.type}</b></div>
              {'requires' in (hoverCard as any) && <div>Requires: <b>{(hoverCard as any).requires ?? '-'}</b></div>}
              {'target' in (hoverCard as any) && <div>Target: <b>{(hoverCard as any).target ?? '-'}</b></div>}
              {'final' in (hoverCard as any) && <div>Final: <b>{(hoverCard as any).final ?? '-'}</b></div>}
              <div className="mt-2 text-[13px] leading-snug bg-slate-900/40 rounded-md border border-slate-700/40 p-2">
                {hoverCard.type === 'attack' && (
                  <>
                    Targets <b>{(hoverCard as any).target ?? '—'}</b>. If there is no effective block/dodge, deal <b>2 damage</b>.
                  </>
                )}
                {hoverCard.type === 'defense' && (
                  <>
                    Blocks target <b>{(hoverCard as any).target ?? '-'}</b>. Grants <b>extra action</b> only if your current posture equals the attack's target when revealed.
                  </>
                )}
                {hoverCard.type === 'dodge' && (
                  <>
                    Switches to posture <b>{(hoverCard as any).final ?? '—'}</b>. If you leave the attack's target, avoid the damage.
                  </>
                )}
              </div>
              <div className="text-xs text-slate-400">Click the card to confirm play.</div>
            </div>
          ) : (
            <>
              {(log?.length ? log : ['Arena ready. Click once to select, twice to confirm.'])
                .slice(-20)
                .map((txt, i) => (
                  <div key={i} className="entry">{txt}</div>
                ))}
              <div style={{ height: 8 }} />
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Hand: {p1.hand.length}/{HAND_SIZE} • Deck: {deckP1Count} • Opponent deck: {deckP2Count}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

// A card in transit from a hand to a table slot. Position/rotation are
// driven directly through the Web Animations API against the captured
// start/end rects (both viewport coordinates from getBoundingClientRect),
// so the motion is exact regardless of responsive card sizing. Landing is a
// firm, weighted stop — no squash/stretch, cards stay rigid the whole way.
function CardFlight({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) { onDone(); return; }

    const dx = flight.to.left - flight.from.left;
    const dy = flight.to.top - flight.from.top;
    const arcLift = Math.max(64, Math.abs(dy) * 0.32);
    const launchTilt = flight.side === 'p1' ? -9 : 7;
    const duration = 460;

    const flightAnim = outer.animate(
      [
        { transform: `translate3d(0px,0px,0) rotate(${launchTilt}deg)`, offset: 0 },
        { transform: `translate3d(${dx * 0.52}px, ${dy * 0.52 - arcLift}px, 0) rotate(${launchTilt * 0.3}deg)`, offset: 0.5 },
        { transform: `translate3d(${dx}px, ${dy}px, 0) rotate(0deg)`, offset: 0.9 },
        // A tiny, purely translational settle - no scale involved, so the
        // card reads as a rigid object with a touch of weight, not rubber.
        { transform: `translate3d(${dx}px, ${dy + 3}px, 0) rotate(-0.6deg)`, offset: 0.96 },
        { transform: `translate3d(${dx}px, ${dy}px, 0) rotate(0deg)`, offset: 1 },
      ],
      { duration, easing: 'cubic-bezier(.22,.61,.34,1)', fill: 'forwards' }
    );

    let flipAnim: Animation | null = null;
    if (flight.flipMidair && flipRef.current) {
      flipAnim = flipRef.current.animate(
        [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }],
        { duration: duration * 0.48, delay: duration * 0.42, easing: 'ease-in-out', fill: 'forwards' }
      );
    }

    flightAnim.onfinish = () => onDone();
    return () => {
      flightAnim.cancel();
      flipAnim?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={outerRef}
      className="card-flight"
      style={{
        position: 'fixed',
        left: flight.from.left,
        top: flight.from.top,
        width: flight.from.width,
        height: flight.from.height,
      }}
    >
      {flight.flipMidair ? (
        <div className="card-flight-perspective">
          <div ref={flipRef} className="card-flight-flip">
            <div className="card-flight-face"><CardBack /></div>
            <div className="card-flight-face card-flight-face-back"><CardFront card={flight.card} /></div>
          </div>
        </div>
      ) : (
        <CardFront card={flight.card} />
      )}
    </div>
  );
}

function rotationForIndex(i: number, total: number) {
  const spread = Math.min(12, 18 - total * 2);
  const start = -spread * ((total - 1) / 2);
  return `${start + spread * i}deg`;
}
