// CollectionView.tsx
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CardFront } from '@/components/game/ui3';
import { makeDeck, type TcgCard } from '@/engine';

export interface Preset { name: string; seed: string }

type DeckStats = { atk: number; def: number; dodge: number; total: number };

function useDeckPreview(seed: string) {
  let cards: TcgCard[] = [];
  try { cards = makeDeck(seed).slice(0, 3); } catch {}
  let stats: DeckStats = { atk: 0, def: 0, dodge: 0, total: 0 };
  try {
    const full = makeDeck(seed);
    stats = full.reduce((acc, c) => {
      if (c.type === 'attack') acc.atk++;
      else if (c.type === 'defense') acc.def++;
      else acc.dodge++;
      acc.total++;
      return acc;
    }, { atk: 0, def: 0, dodge: 0, total: 0 });
  } catch {}
  return { cards, stats };
}

/** Barra competitiva: as camadas são posicionadas absolutos.
 *  Ordenamos por porcentagem desc; a maior fica por cima (z-index) e visualmente “vence”.
 */
function StatBarCompetitive({ stats }: { stats: DeckStats }) {
  const total = Math.max(1, stats.total);
  const segs = [
    { key: 'atk', p: (stats.atk / total) * 100, color: '#ff7f50' },
    { key: 'def', p: (stats.def / total) * 100, color: '#72d5ff' },
    { key: 'dodge', p: (stats.dodge / total) * 100, color: '#6ee7a1' },
  ];

  // Render segments side-by-side (no overlap) so they always fill the full width.
  let leftAcc = 0;
  return (
    <div className="relative mt-2 h-2 w-full rounded overflow-hidden border border-white/10 bg-white/5">
      {segs.map((s, i) => {
        const left = leftAcc;
        leftAcc += s.p;
        return (
          <div
            key={s.key}
            className="absolute top-0 h-full"
            style={{
              left: `${left}%`,
              width: `${s.p}%`,
              background: s.color,
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)',
            }}
            title={`${s.key}: ${Math.round(s.p)}%`}
          />
        );
      })}
    </div>
  );
}

function Kebab({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 grid place-items-center rounded bg-white/6 border border-white/10 text-slate-100 shadow-sm hover:bg-white/12"
      title="Mais ações"
    >
      ⋮
    </button>
  );
}

function DeckCard({
  preset,
  onLoad,
  onSelect,
  onDuplicate,
  onCopy,
  onDelete,
  onRename,
  isActive,
}: {
  preset: Preset;
  onLoad: (p: Preset) => void;
  onSelect?: (p: Preset) => void;
  onDuplicate: (p: Preset) => void;
  onCopy: (seed: string) => void;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  isActive?: boolean;
}) {
  const { cards, stats } = useDeckPreview(preset.seed);
  const [menuOpen, setMenuOpen] = useState(false);
  const meatRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuClosing, setMenuClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(preset.name);
  const [confirmDel, setConfirmDel] = useState(false);

  const hue = (preset.seed.charCodeAt(6) || 83) % 360;
  const bg = `linear-gradient(180deg,hsla(${hue},70%,55%,.85),hsla(${(hue+40)%360},60%,35%,.85))`;

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      const tgt = ev.target as Node | null;
      if (!tgt) return;
      if (meatRef.current && meatRef.current.contains(tgt)) return;
      if (menuRef.current && menuRef.current.contains(tgt)) return;
      // clicked outside
      setMenuClosing(true);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => { setMenuOpen(false); setMenuPos(null); setMenuClosing(false); }, 160) as unknown as number;
    };
    const onEsc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { setMenuOpen(false); setMenuPos(null); } };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    // when menu mounts, focus first actionable item
    if (menuRef.current) {
      // small timeout to ensure element is in DOM
      window.setTimeout(() => {
        try { (menuRef.current!.querySelector('button[role="menuitem"]') as HTMLElement | null)?.focus(); } catch {}
      }, 20);
    }
    // mark meatball as expanded
    try { if (meatRef.current) meatRef.current.setAttribute('aria-expanded', 'true'); } catch {}
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      // when menu unmounts, return focus to meatball button
      try { if (meatRef.current) { meatRef.current.focus(); meatRef.current.setAttribute('aria-expanded', 'false'); } } catch {}
    };
  }, [menuOpen]);

  return (
    <div className={`rounded-xl overflow-hidden border ${isActive ? 'border-emerald-400/60 ring-1 ring-emerald-300/40' : 'border-white/10'} bg-[#0f1424] shadow-lg hover:shadow-xl transition-shadow`}>
      {/* banner */}
      <div className="relative h-28 w-full" style={{ background: bg }}>
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_-10%,white,transparent_60%)]" />
        <div className="absolute bottom-2 left-2 flex gap-2">
          {cards.length > 0 ? (
            cards.map((c, i) => (
              <div key={`${c.id}-${i}`} className="w-14 drop-shadow-md rotate-[-2deg] first:rotate-0 translate-y-[2px]">
                <CardFront card={c} />
              </div>
            ))
          ) : (
            <div className="px-2 py-1 text-xs rounded bg-black/30 border border-white/10 text-white/70">
              Prévia indisponível
            </div>
          )}
        </div>
      </div>

      {/* info */}
      <div className="px-3 pt-3 pb-3">
        <div className="min-w-0 flex items-start justify-between gap-2">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="px-2 py-1 text-sm bg-transparent border border-white/15 rounded text-slate-200 flex-1"
                placeholder="New name"
              />
              <button className="text-xs px-2 py-1 db-pill" onClick={() => { const n = (newName || '').trim(); if (n) onRename(preset.name, n); setRenaming(false); }}>Save</button>
              <button className="text-xs px-2 py-1 db-pill" onClick={() => { setRenaming(false); setNewName(preset.name); }}>Cancel</button>
            </div>
          ) : (
            <>
              <div className="font-semibold truncate" title={preset.name}>{preset.name}</div>
              <div className="text-xs text-slate-400 truncate" title={preset.seed}>{preset.seed}</div>
            </>
          )}
          {isActive && !renaming ? (
            <span className="ml-auto shrink-0 text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-200" title="Active deck">
              Selected
            </span>
          ) : null}
        </div>

        {/* chips */}
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">Seed v1</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">21 cartas</span>
        </div>

        {/* contadores + barra competitiva */}
        <div className="mt-2 flex items-center gap-2 text-[11px]">
          <span className="px-1.5 py-0.5 rounded bg-[#ff7f50]/15 border border-[#ff7f50]/30 text-[#ffb39a]">Atk {stats.atk}</span>
          <span className="px-1.5 py-0.5 rounded bg-[#72d5ff]/15 border border-[#72d5ff]/30 text-[#c6eaff]">Def {stats.def}</span>
          <span className="px-1.5 py-0.5 rounded bg-[#6ee7a1]/15 border border-[#6ee7a1]/30 text-[#c8ffd7]">Dodge {stats.dodge}</span>
        </div>
        <StatBarCompetitive stats={stats} />

        {confirmDel && (
          <div className="mt-2 text-xs flex items-center justify-between gap-2 p-2 rounded border border-red-400/30 bg-red-900/10 text-red-200">
            <span>Delete “{preset.name}”?</span>
            <div className="flex gap-2">
              <button className="px-2 py-0.5 rounded bg-red-500/20 border border-red-400/40" onClick={() => { onDelete(preset.name); setConfirmDel(false); }}>Delete</button>
              <button className="px-2 py-0.5 rounded db-pill" onClick={() => setConfirmDel(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* ação: Select deck + meatball kebab */
        }
        <div className="mt-3 flex items-center justify-end gap-2">
          <div className="relative inline-flex items-center">
            <button
              className={`text-xs px-3 py-1 rounded border ${isActive ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' : 'bg-white/10 border-white/15 hover:bg-white/15'}`}
              onClick={() => (onSelect ? onSelect(preset) : onLoad(preset))}
            >
              {isActive ? 'Selected' : 'Select deck'}
            </button>

            <button
              ref={meatRef}
              onClick={(e) => {
                e.stopPropagation();
                if (!menuOpen) {
                  const r = meatRef.current?.getBoundingClientRect();
                  if (r) {
                    const width = 176; // same as w-44
                    const left = Math.max(8, r.right - width);
                    const top = r.bottom + 8;
                    setMenuPos({ left, top });
                  }
                  setMenuClosing(false);
                  setMenuOpen(true);
                } else {
                  // start closing animation
                  setMenuClosing(true);
                  if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
                  closeTimerRef.current = window.setTimeout(() => {
                    setMenuOpen(false);
                    setMenuPos(null);
                    setMenuClosing(false);
                  }, 160) as unknown as number;
                }
              }}
              className="ml-2 -mr-1 w-8 h-8 grid place-items-center rounded-full bg-white/6 text-slate-100 shadow-sm hover:bg-white/12"
              title="Mais ações"
              aria-label={`Mais ações para ${preset.name}`}
            >
              ⋮
            </button>
          </div>
        </div>

        {/* render menu as a portal so it is not clipped by card container */}
        {menuOpen && menuPos && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={menuRef}
                role="menu"
                aria-label={`Ações para ${preset.name}`}
                className={"rounded-md border border-white/10 bg-[#0d1222] shadow-xl text-slate-200 portal-menu " + (menuClosing ? 'exit' : 'enter')}
                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 176 }}
                onMouseLeave={() => {
                  // animate out then unmount
                  setMenuClosing(true);
                  if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
                  closeTimerRef.current = window.setTimeout(() => {
                    setMenuOpen(false);
                    setMenuPos(null);
                    setMenuClosing(false);
                  }, 160) as unknown as number;
                }}
                onKeyDown={(ev: React.KeyboardEvent) => {
                  const items = Array.from(menuRef.current?.querySelectorAll('button[role="menuitem"]') || []) as HTMLElement[];
                  if (items.length === 0) return;
                  const idx = items.indexOf(document.activeElement as HTMLElement);
                  if (ev.key === 'ArrowDown') {
                    ev.preventDefault();
                    const next = items[(idx + 1) % items.length]; next.focus();
                  } else if (ev.key === 'ArrowUp') {
                    ev.preventDefault();
                    const prev = items[(idx - 1 + items.length) % items.length]; prev.focus();
                  } else if (ev.key === 'Home') {
                    ev.preventDefault(); items[0].focus();
                  } else if (ev.key === 'End') {
                    ev.preventDefault(); items[items.length - 1].focus();
                  }
                }}
              >
                <button role="menuitem" tabIndex={-1} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => { onLoad(preset); setMenuOpen(false); }}>Open in Builder</button>
                <button role="menuitem" tabIndex={-1} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => { onDuplicate(preset); setMenuOpen(false); }}>Duplicate</button>
                <button role="menuitem" tabIndex={-1} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => { onCopy(preset.seed); setMenuOpen(false); }}>Copy seed</button>
                <button role="menuitem" tabIndex={-1} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => { setRenaming(true); setMenuOpen(false); setNewName(preset.name); }}>Renomear</button>
                <button role="menuitem" tabIndex={-1} className="w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-red-500/10" onClick={() => { setConfirmDel(true); setMenuOpen(false); }}>Delete</button>
              </div>,
              document.body
            )
          : null}
    </div>
  </div>
  );
}

export default function CollectionView({
  presets,
  onLoad,
  onDelete,
  onRename,
  onSelect,
  activeDeck,
}: {
  presets: Preset[];
  onLoad?: (p: Preset) => void;
  onDelete?: (name: string) => void;
  onRename?: (oldName: string, newName: string) => void;
  onSelect?: (p: Preset) => void;
  activeDeck?: Preset | null;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return presets;
    return presets.filter((p) => p.name.toLowerCase().includes(qq) || p.seed.toLowerCase().includes(qq));
  }, [q, presets]);

  const handleDuplicate = (p: Preset) => {
    const name = `${p.name} (cópia)`;
    onRename?.(p.name, name);
  };

  return (
    <div className="db-card db-content">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-lg">My Decks</h3>
          <div className="text-sm text-slate-400">{presets.length} total</div>
        </div>

        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search decks by name or seed…"
            className="px-3 py-1.5 border border-white/10 rounded bg-transparent text-sm text-slate-200 w-64"
          />
          <button className="px-3 py-1.5 rounded bg-white/6 border border-white/10 text-sm text-slate-100 hover:bg-white/10">Create deck</button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p) => (
          <DeckCard
            key={p.name}
            preset={p}
            onLoad={(x) => onLoad?.(x)}
            onSelect={(x) => onSelect?.(x)}
            onDuplicate={(x) => handleDuplicate(x)}
            onCopy={(s) => navigator.clipboard?.writeText(s)}
            onDelete={(name) => onDelete?.(name)}
            onRename={(a, b) => onRename?.(a, b)}
            isActive={Boolean(activeDeck && activeDeck.name === p.name && activeDeck.seed === p.seed)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-6 p-6 text-sm text-slate-400 border border-dashed border-white/10 rounded text-center db-empty-cta">
          <div className="mb-2">Nenhum deck encontrado.</div>
          <div className="flex items-center justify-center gap-2">
            <button className="px-3 py-1.5 rounded bg-white/6 border border-white/10 text-sm text-slate-100 hover:bg-white/10">Create your first deck</button>
          </div>
        </div>
      )}
    </div>
  );
}


