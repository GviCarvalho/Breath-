// DeckEditor.tsx
import React from 'react';
import { CardFront } from '@/components/game/ui3';
import type { TcgCard } from '@/engine';

type DropPayload = { type: 'card' | 'slot'; idx: number };

export default function DeckEditor({
  deck, onSlotClick, onDropSlot, recentlyUpdated, selectedIdx
}: {
  deck: TcgCard[]; onSlotClick?: (i: number) => void;
  onDropSlot?: (targetIdx: number, payload: DropPayload) => void;
  recentlyUpdated?: number | null; selectedIdx?: number
}) {
  const [dragOverIdx, setDragOverIdx] = React.useState<number | null>(null);
  return (
    <div className="p-2">
      <div className="grid grid-cols-3 gap-4">
        {deck.map((card, i) => {
          const isOver = dragOverIdx === i;
          const justChanged = recentlyUpdated === i;
          const isSelected = selectedIdx === i;
          return (
            <div
              key={`${card.id}-${i}`}
              className={`border border-slate-700/40 rounded p-2 bg-[#0e1426] text-slate-200 flex flex-col items-center ${isOver ? 'slot-drag-over' : ''} ${justChanged ? 'slot-animate-change pop-anim' : ''} ${isSelected ? 'ring-2 ring-sky-300' : ''}`}
              draggable
              onDragStart={(e) => { try { e.dataTransfer.setData('text/plain', `slot:${i}`); e.dataTransfer.effectAllowed = 'move'; } catch {} }}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); e.dataTransfer.dropEffect = 'copy'; }}
              onDragLeave={() => setDragOverIdx((cur) => (cur === i ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverIdx(null);
                try {
                  const txt = e.dataTransfer.getData('text/plain');
                  if (!txt) return;
                  const [kind, idxStr] = txt.split(':');
                  const idx = Number(idxStr);
                  if (onDropSlot) onDropSlot(i, { type: kind === 'slot' ? 'slot' : 'card', idx });
                } catch {}
              }}
            >
              <div onClick={() => onSlotClick && onSlotClick(i)} className="cursor-pointer">
                <CardFront card={card} />
              </div>
              <div className="mt-2 text-xs text-slate-600">Slot {i + 1}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

