// CardBrowser.tsx
import React, { useMemo, useState, useRef } from 'react';
import { CardFront } from '@/components/game/ui3';
import type { TcgCard } from '@/engine';

type TypeFilter = 'all' | 'attack' | 'defense' | 'dodge';
type Posture = 'A' | 'B' | 'C';

export default function CardBrowser({ options, onAdd, density = 'comfortable', onDragPreviewStart, onDragPreviewEnd }: { options: TcgCard[]; onAdd?: (idx: number) => void; density?: 'comfortable' | 'compact'; onDragPreviewStart?: (card: TcgCard, e: React.DragEvent, offset?: { x: number; y: number }) => void; onDragPreviewEnd?: () => void }) {
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

  const dragRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // Ensure dragging-source class is removed even if dragend doesn't fire on the original element
  React.useEffect(() => {
    const onGlobalDragEnd = () => {
      try {
        for (const k of Object.keys(dragRefs.current)) {
          const el = dragRefs.current[Number(k)];
          if (el && el.classList.contains('dragging-source')) el.classList.remove('dragging-source');
        }
      } catch {}
    };
    window.addEventListener('dragend', onGlobalDragEnd);
    window.addEventListener('drop', onGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', onGlobalDragEnd);
      window.removeEventListener('drop', onGlobalDragEnd);
    };
  }, []);

  return (
    <div className="db-content">
      <div className="mb-2 flex flex-col gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards..." className="w-full text-sm px-2 py-1 border rounded" />
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
            ref={(el) => { dragRefs.current[idx] = el; }}
            className="db-3d db-tilt focus:outline-none"
            title="Click to add"
            draggable
            onDragStart={(e) => {
              try {
                  e.dataTransfer.setData('text/plain', `card:${idx}`);
                  e.dataTransfer.effectAllowed = 'copy';
                  const el = dragRefs.current[idx];
                  if (el) {
                    // add temporary class to dim the source while dragging
                    el.classList.add('dragging-source');
                    try { document.body.classList.add('is-dragging'); } catch {}
                    // suppress native drag image by using a transparent 1x1 image so we can show a
                    // custom React-driven preview that follows the cursor.
                    try {
                      const img = new Image();
                      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
                      if (typeof e.dataTransfer.setDragImage === 'function') {
                        e.dataTransfer.setDragImage(img, 0, 0);
                      }
                    } catch {}
                    // compute pointer offset inside element so preview can be anchored at the same spot
                    const r = el.getBoundingClientRect();
                    const offset = { x: Math.max(0, Math.min(el.clientWidth, e.clientX - r.left)), y: Math.max(0, Math.min(el.clientHeight, e.clientY - r.top)) };
                    // notify parent to show a floating preview anchored at offset
                    try { if (onDragPreviewStart) onDragPreviewStart(card, e, offset); } catch {}
                  } else {
                    try { if (onDragPreviewStart) onDragPreviewStart(card, e); } catch {}
                  }
              } catch {}
            }}
            onDragEnd={() => {
              try {
                  const el = dragRefs.current[idx];
                  if (el) el.classList.remove('dragging-source');
                  try { document.body.classList.remove('is-dragging'); } catch {}
                  try { if (onDragPreviewEnd) onDragPreviewEnd(); } catch {}
              } catch {}
            }}
            onClick={() => onAdd && onAdd(idx)}
          >
            <CardFront card={card} />
          </button>
        ))}
      </div>
    </div>
  );
}


