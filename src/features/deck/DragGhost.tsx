// DragGhost.tsx
// The floating card shown while dragging a card in the deck builder. Unlike
// the old native-HTML5-drag preview (a flat static image chasing a coarse
// dragover event), this IS a real CardFront - so it keeps the same 3D tilt
// used everywhere else - and it's driven by raw pointermove coordinates
// (smooth, every frame) instead of the browser's own throttled drag events.
// On drop it hands off into a short WAAPI flight into the card's landed
// slot, mirroring the no-squash "solid object" landing used in the arena.
import React, { useEffect, useRef } from 'react';
import { CardFront } from '@/components/game/ui3';
import type { TcgCard } from '@/engine';

export type DragPayload =
  | { kind: 'catalog'; idx: number; card: TcgCard }
  | { kind: 'deckslot'; idx: number; slotId: string; card: TcgCard };

export type FloatingCard =
  | {
      phase: 'dragging';
      payload: DragPayload;
      x: number;
      y: number;
      grabDx: number;
      grabDy: number;
      width: number;
      height: number;
      insertPos: number | null;
    }
  | {
      phase: 'landing';
      payload: DragPayload;
      from: { x: number; y: number; width: number; height: number };
      targetSlotId: string;
    };

export default function DragGhost({ floating, onLanded }: { floating: FloatingCard; onLanded: () => void }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const lastMoveRef = useRef<{ x: number; y: number } | null>(null);

  // Live-follow the pointer while actively dragging.
  useEffect(() => {
    if (floating.phase !== 'dragging') return;
    const el = outerRef.current;
    if (!el) return;
    el.style.left = `${floating.x - floating.grabDx}px`;
    el.style.top = `${floating.y - floating.grabDy}px`;
  }, [floating]);

  // Tilt driven by the drag's own motion (not a fixed hover point) - a card
  // whisked sideways tips against the direction of travel, like it has
  // real weight, then settles once the pointer holds still.
  useEffect(() => {
    if (floating.phase !== 'dragging') return;
    const el = outerRef.current?.querySelector('.tcg-card') as HTMLElement | null;
    if (!el) return;
    const last = lastMoveRef.current ?? { x: floating.x, y: floating.y };
    const dx = floating.x - last.x;
    const dy = floating.y - last.y;
    lastMoveRef.current = { x: floating.x, y: floating.y };
    const tiltY = Math.max(-16, Math.min(16, dx * 1.1));
    const tiltX = Math.max(-16, Math.min(16, -dy * 1.1));
    el.style.setProperty('--tiltX', `${tiltX}deg`);
    el.style.setProperty('--tiltY', `${tiltY}deg`);
  }, [floating]);

  // Landing: a short flight from wherever the pointer let go to the real
  // DOM rect of the slot the card actually landed in, then hand off to the
  // (by-then-rendered) real tile underneath.
  useEffect(() => {
    if (floating.phase !== 'landing') return;
    const outer = outerRef.current;
    if (!outer) { onLanded(); return; }
    const from = floating.from;
    const targetEl = document.querySelector(`[data-slot-id="${floating.targetSlotId}"]`) as HTMLElement | null;
    const to = targetEl ? targetEl.getBoundingClientRect() : { left: from.x, top: from.y, width: from.width, height: from.height };

    outer.style.left = `${from.x}px`;
    outer.style.top = `${from.y}px`;
    outer.style.width = `${from.width}px`;
    outer.style.height = `${from.height}px`;

    const dx = to.left - from.x;
    const dy = to.top - from.y;
    const scaleX = from.width ? to.width / from.width : 1;
    const scaleY = from.height ? to.height / from.height : 1;

    const anim = outer.animate(
      [
        { transform: 'translate(0px,0px) scale(1,1)' },
        { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})` },
      ],
      { duration: 260, easing: 'cubic-bezier(.22,.61,.34,1)', fill: 'forwards' }
    );
    anim.onfinish = () => onLanded();
    return () => anim.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floating.phase === 'landing' ? floating.targetSlotId : null]);

  const width = floating.phase === 'dragging' ? floating.width : floating.from.width;
  const height = floating.phase === 'dragging' ? floating.height : floating.from.height;
  const left = floating.phase === 'dragging' ? floating.x - floating.grabDx : floating.from.x;
  const top = floating.phase === 'dragging' ? floating.y - floating.grabDy : floating.from.y;

  return (
    <div
      ref={outerRef}
      className={`deck-drag-ghost${floating.phase === 'dragging' ? ' is-dragging-card' : ' is-landing'}`}
      style={{
        position: 'fixed', left, top, width, height, zIndex: 9999, pointerEvents: 'none',
        ['--card-width' as any]: `${width}px`, ['--card-height' as any]: `${height}px`,
      }}
    >
      <CardFront card={floating.payload.card} />
    </div>
  );
}
