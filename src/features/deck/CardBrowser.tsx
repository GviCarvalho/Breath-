// CardBrowser.tsx
import React, { useMemo, useState } from 'react';
import { CardFront } from '@/components/game/ui3';
import type { TcgCard } from '@/engine';
import type { DragPayload } from './DragGhost';

type TypeFilter = 'all' | 'attack' | 'defense' | 'dodge';
type Posture = 'A' | 'B' | 'C';

export default function CardBrowser({
  options, density = 'comfortable',
  onCardPointerDown, onCardPointerMove, onCardPointerUp, onCardPointerCancel, isDragSource,
}: {
  options: TcgCard[];
  density?: 'comfortable' | 'compact';
  // Click-to-add and drag-to-insert are both resolved by the parent: a
  // pointerup that never moved past the drag threshold is treated as a
  // click there, so this component doesn't need its own onClick/onAdd path.
  onCardPointerDown: (e: React.PointerEvent, el: HTMLElement, payload: DragPayload) => void;
  onCardPointerMove: (e: React.PointerEvent) => void;
  onCardPointerUp: (e: React.PointerEvent) => void;
  onCardPointerCancel: (e: React.PointerEvent) => void;
  isDragSource: (idx: number) => boolean;
}) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [req, setReq] = useState<Posture | 'any'>('any');
  const [tgt, setTgt] = useState<Posture | 'any'>('any');
  const [fin, setFin] = useState<Posture | 'any'>('any');

  const list = useMemo(() => options.map((card, idx) => ({ card, idx })), [options]);
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return list.filter(({ card }) => {
      if (type !== 'all' && card.type !== type) return false;
      if (req !== 'any' && (card as any).requires !== req) return false;
      if (tgt !== 'any' && (card as any).target !== tgt) return false;
      if (fin !== 'any' && (card as any).final !== fin) return false;
      if (!qq) return true;
      const s = `${card.type} ${(card as any).requires ?? ''} ${(card as any).target ?? ''} ${card.final ?? ''}`.toLowerCase();
      return s.includes(qq);
    });
  }, [list, q, type, req, tgt, fin]);

  const Pill = ({ active, onClick, children }: any) => (
    <button onClick={onClick} className={`text-xs px-2 py-0.5 rounded db-pill ${active ? 'active' : ''}`}>{children}</button>
  );

  const gridClass = density === 'compact'
    ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5'
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="db-content">
      <div className="mb-2 flex flex-col gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards..." className="w-full text-sm px-2 py-1 rounded" />
        <div className="flex items-center gap-2">
          <Pill active={type==='all'} onClick={() => setType('all')}>All</Pill>
          <Pill active={type==='attack'} onClick={() => setType('attack')}>Attack</Pill>
          <Pill active={type==='defense'} onClick={() => setType('defense')}>Defense</Pill>
          <Pill active={type==='dodge'} onClick={() => setType('dodge')}>Dodge</Pill>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Req:</span>
          {(['any','A','B','C'] as const).map((p) => <Pill key={`req-${p}`} active={req===p} onClick={() => setReq(p as any)}>{p}</Pill>)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Target:</span>
          {(['any','A','B','C'] as const).map((p) => <Pill key={`tgt-${p}`} active={tgt===p} onClick={() => setTgt(p as any)}>{p}</Pill>)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">Final:</span>
          {(['any','A','B','C'] as const).map((p) => <Pill key={`fin-${p}`} active={fin===p} onClick={() => setFin(p as any)}>{p}</Pill>)}
        </div>
      </div>

      <div className={`grid ${gridClass} gap-3 max-h-[56vh] overflow-auto db-scroll`}>
        {filtered.map(({ card, idx }) => (
          <button
            type="button"
            key={`${card.id}-${idx}`}
            className={`db-3d db-tilt focus:outline-none${isDragSource(idx) ? ' dragging-source' : ''}`}
            title="Click to add, or drag into the deck"
            style={{ touchAction: 'none', width: 'var(--card-width, 165px)', height: 'var(--card-height, 240px)' }}
            onPointerDown={(e) => {
              if (e.button !== 0 && e.pointerType === 'mouse') return;
              const el = e.currentTarget;
              el.setPointerCapture(e.pointerId);
              onCardPointerDown(e, el, { kind: 'catalog', idx, card });
            }}
            onPointerMove={onCardPointerMove}
            onPointerUp={onCardPointerUp}
            onPointerCancel={onCardPointerCancel}
            onDragStart={(e) => e.preventDefault()}
          >
            <CardFront card={card} />
          </button>
        ))}
      </div>
    </div>
  );
}
