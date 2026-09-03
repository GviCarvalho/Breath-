// DeckBuilderHtml.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { idxToCardStatic, ALPHABET, type TcgCard } from '@/engine';
import { getAllKatas } from '@/data/katas';
import { useAppState } from '@/store/appState';
import CardBrowser from './CardBrowser';
import { CardFront } from '@/components/game/ui3';
import CollectionView from './CollectionView';
import DragGhost, { type DragPayload, type FloatingCard } from './DragGhost';
import './deckbuilder.css';
import { useFlipList } from '@/lib/flip';
import { playSound } from '@/lib/sound';

// ====== tipos ======
type CollDeck = { id: string; name: string; seed: string };

// ====== constantes ======
const COLL_KEY = 'breath_deck_collection_v1';
const MAX_COPIES = 3;
const TOTAL_CARDS = 21;
const DRAG_THRESHOLD = 6;

// ====== helpers seed ======
const isValidV1 = (s?: string) => {
  if (!s || typeof s !== 'string') return false;
  const st = s.trim();
  if (!st.startsWith('v1.')) return false;
  const payload = st.slice(3);
  if (payload.length === 0) return false;
  for (const ch of payload) if (!ALPHABET.includes(ch)) return false;
  return true;
};
const charToIdx = (ch: string) => ALPHABET.indexOf(ch);
const idxToChar = (i: number) => ALPHABET[i % 64] ?? 'A';
const checksumFor = (arr: number[]) => arr.reduce((s, v) => s + (v % 64), 0) % 64;
const buildSeedV1FromIdx = (arr: number[]) =>
  arr.length === TOTAL_CARDS ? `v1.${arr.map(idxToChar).join('')}${idxToChar(checksumFor(arr))}` : null;
const makeSlotId = () => 'slot_' + Math.random().toString(36).slice(2, 9);

export default function DeckBuilderHtml() {
  const { setMode, setSeed, seed: appSeed, activeDeck, setActiveDeck, setArenaMode } = useAppState();

  // ====== estado principal ======
  const [tab, setTab] = useState<'builder' | 'collection' | 'store'>('collection');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const options = useMemo(() => Array.from({ length: 57 }, (_, i) => idxToCardStatic(i) as TcgCard), []);

  const [deckIdx, setDeckIdx] = useState<number[]>([]);
  // Stable IDs per slot so FLIP can track motion across reorders
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [deckName, setDeckName] = useState<string>('');
  const [collection, setCollection] = useState<CollDeck[]>([]);
  const [recentlyAddedIndex, setRecentlyAddedIndex] = useState<number | null>(null);
  const recentlyAddedTimerRef = useRef<number | null>(null);
  const [toggleSpinning, setToggleSpinning] = useState(false);
  const toggleSpinTimerRef = useRef<number | null>(null);

  // ====== coleção (localStorage) ======
  const cryptoId = () => 'd' + Math.random().toString(36).slice(2, 9);
  function loadCollection(): CollDeck[] {
    try {
      const raw = localStorage.getItem(COLL_KEY);
      if (!raw) {
        const defaults = getAllKatas();
        const base: CollDeck[] = [
          { id: cryptoId(), name: 'Kata do Iniciante', seed: 'v1.ERServ234ERServ234ERSB' },
          ...(defaults
            .filter(d => d.name.toLowerCase().includes('kata supremo'))
            .slice(0, 1)
            .map(d => ({ id: cryptoId(), name: d.name, seed: d.seed }))),
        ];
        localStorage.setItem(COLL_KEY, JSON.stringify(base));
        return base;
      }
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  function saveCollection(list: CollDeck[]) {
    try { localStorage.setItem(COLL_KEY, JSON.stringify(list)); } catch {}
    setCollection(list);
  }

  useEffect(() => { setCollection(loadCollection()); }, []);

  // load density preference
  useEffect(() => {
    try {
      const v = localStorage.getItem('deck_density');
      if (v === 'compact' || v === 'comfortable') setDensity(v);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('deck_density', density); } catch {}
  }, [density]);

  // ====== seed I/O ======
  const handleLoadSeed = (s: string) => {
    if (!isValidV1(s)) { window.alert('Seed inválida (esperado prefixo v1.)'); return; }
    try {
      const body = s.trim().slice(3);
      const payload = body.slice(0, -1);
      const arr: number[] = [];
      for (const ch of payload) {
        const k = charToIdx(ch);
        if (k < 0 || k > 56) throw new Error('char inválido: ' + ch);
        arr.push(k);
      }
      if (arr.length !== TOTAL_CARDS) throw new Error('seed precisa ter 21 cartas, veio ' + arr.length);
  setDeckIdx(arr);
  setSlotIds(Array.from({ length: arr.length }, () => makeSlotId()));
    } catch (e) { window.alert('Erro ao importar: ' + (e as any).message); }
  };
  useEffect(() => {
    if (appSeed && appSeed.trim().length > 0) {
      handleLoadSeed(appSeed);
      try { setSeed && setSeed(''); } catch {}
      setTab('builder');
    }
  }, [appSeed]);

  const exportSeed = () => {
    const s = buildSeedV1FromIdx(deckIdx);
    if (!s) { window.alert('Complete 21 cartas antes.'); return null; }
    navigator.clipboard?.writeText(s);
    return s;
  };
  const applyToGame = () => { const s = exportSeed(); if (s && setSeed) setSeed(s); try { setArenaMode && setArenaMode('local'); } catch {} setMode('arena' as any); };

  // ====== deck ops ======
  const deckCards: TcgCard[] = useMemo(
    () => deckIdx.map((idx, i) => ({ ...idxToCardStatic(idx), id: `b${i}` } as TcgCard)),
    [deckIdx]
  );
  // FLIP: animate deck list tiles when order/size changes
  const { setRef } = useFlipList(slotIds, { duration: 280, easing: 'cubic-bezier(.2,.9,.3,1)' });
  const countOf = (idx: number) => deckIdx.filter(i => i === idx).length;

  const canAdd = deckIdx.length < TOTAL_CARDS;

  const triggerJustAdded = (pos: number) => {
    if (recentlyAddedTimerRef.current) window.clearTimeout(recentlyAddedTimerRef.current);
    setRecentlyAddedIndex(pos);
    recentlyAddedTimerRef.current = window.setTimeout(() => setRecentlyAddedIndex(null), 700) as unknown as number;
  };

  const duplicateAt = (i: number) => {
    if (deckIdx.length >= TOTAL_CARDS) return;
    const idx = deckIdx[i];
    if (countOf(idx) >= MAX_COPIES) { window.alert(`Máx ${MAX_COPIES} cópias desta carta.`); return; }
    try { playSound('select', 0.5); } catch {}
    triggerJustAdded(i + 1);
    setDeckIdx((arr) => { const n = arr.slice(); n.splice(i + 1, 0, idx); return n; });
    setSlotIds((ids) => { const n = ids.slice(); n.splice(i + 1, 0, makeSlotId()); return n; });
  };

  // Removal plays a brief shrink-and-fade before actually leaving the deck
  // arrays, instead of just vanishing - looked up by the stable slotId (not
  // the index) at the moment the timeout fires, so removing two cards in
  // quick succession can't end up deleting the wrong one.
  const slotIdsRef = useRef<string[]>([]);
  useEffect(() => { slotIdsRef.current = slotIds; }, [slotIds]);
  const [removingSlotIds, setRemovingSlotIds] = useState<Set<string>>(new Set());
  const removeAt = (i: number) => {
    const slotId = slotIds[i];
    if (!slotId || removingSlotIds.has(slotId)) return;
    try { playSound('pass', 0.5); } catch {}
    setRemovingSlotIds((cur) => { const n = new Set(cur); n.add(slotId); return n; });
    window.setTimeout(() => {
      const idx = slotIdsRef.current.indexOf(slotId);
      setRemovingSlotIds((cur) => { const n = new Set(cur); n.delete(slotId); return n; });
      if (idx === -1) return;
      setDeckIdx((arr) => arr.filter((_, j) => j !== idx));
      setSlotIds((ids) => ids.filter((_, j) => j !== idx));
    }, 220);
  };
  const insertAt = (pos: number, val: number) => setDeckIdx((arr) => {
    if (arr.filter(i => i === val).length >= MAX_COPIES) return arr;
    const n = arr.slice(); n.splice(pos, 0, val); if (n.length > TOTAL_CARDS) n.length = TOTAL_CARDS; return n;
  });
  const insertSlotIdAt = (pos: number, id: string = makeSlotId()) => setSlotIds((ids) => { const n = ids.slice(); n.splice(pos, 0, id); if (n.length > TOTAL_CARDS) n.length = TOTAL_CARDS; return n; });
  const clearDeck = () => { setDeckIdx([]); setSlotIds([]); };
  const randomizeDeck = () => {
    const res: number[] = [];
    const counts: Record<number, number> = {};
    while (res.length < TOTAL_CARDS) {
      const k = Math.floor(Math.random() * 57);
      counts[k] = (counts[k] || 0) + 1;
      if (counts[k] > MAX_COPIES) continue;
      res.push(k);
    }
    setDeckIdx(res);
    setSlotIds(Array.from({ length: res.length }, () => makeSlotId()));
  };

  // ====== drag & drop (Pointer Events) ------------------------------------
  // Native HTML5 drag-and-drop is coarse (dragover fires in throttled
  // bursts, not per frame) and forces a hack to suppress the browser's own
  // ghost image. This drives the drag off raw pointer events instead: the
  // floating card is a real CardFront (same 3D tilt as everywhere else),
  // repositioned every pointermove, with a short WAAPI flight into its
  // landed slot on drop - the same "solid object, no squash" landing used
  // in the arena.
  const deckListRef = useRef<HTMLDivElement | null>(null);
  const [floating, setFloatingState] = useState<FloatingCard | null>(null);
  const floatingRef = useRef<FloatingCard | null>(null);
  const setFloating = (next: FloatingCard | null) => { floatingRef.current = next; setFloatingState(next); };

  const dragPendingRef = useRef<{
    payload: DragPayload; el: HTMLElement; pointerId: number;
    grabDx: number; grabDy: number; width: number; height: number;
    startX: number; startY: number; moved: boolean;
  } | null>(null);

  const computeInsertPos = (clientX: number, clientY: number): number | null => {
    const container = deckListRef.current;
    if (!container) return null;
    const containerRect = container.getBoundingClientRect();
    const PAD = 32;
    if (
      clientX < containerRect.left - PAD || clientX > containerRect.right + PAD ||
      clientY < containerRect.top - PAD || clientY > containerRect.bottom + PAD
    ) {
      return null;
    }
    const tiles = Array.from(container.querySelectorAll<HTMLElement>('[data-deck-tile]'));
    if (tiles.length === 0) return 0;
    let best: { dist: number; pos: number } | null = null;
    for (const el of tiles) {
      const idx = Number(el.dataset.deckTile);
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (!best || d < best.dist) {
        best = { dist: d, pos: clientX < cx ? idx : idx + 1 };
      }
    }
    return best ? Math.max(0, Math.min(deckIdx.length, best.pos)) : deckIdx.length;
  };

  const handleCardPointerDown = (e: React.PointerEvent, el: HTMLElement, payload: DragPayload) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const rect = el.getBoundingClientRect();
    dragPendingRef.current = {
      payload, el, pointerId: e.pointerId,
      grabDx: e.clientX - rect.left, grabDy: e.clientY - rect.top,
      width: rect.width, height: rect.height,
      startX: e.clientX, startY: e.clientY, moved: false,
    };
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    const pending = dragPendingRef.current;
    if (!pending) return;
    const dx = e.clientX - pending.startX;
    const dy = e.clientY - pending.startY;
    if (!pending.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      pending.moved = true;
      try { document.body.classList.add('is-dragging'); } catch {}
      try { playSound('cardWhoosh', 0.45); } catch {}
    }
    setFloating({
      phase: 'dragging',
      payload: pending.payload,
      x: e.clientX, y: e.clientY,
      grabDx: pending.grabDx, grabDy: pending.grabDy,
      width: pending.width, height: pending.height,
      insertPos: computeInsertPos(e.clientX, e.clientY),
    });
  };

  const handleCardPointerUp = (e: React.PointerEvent) => {
    const pending = dragPendingRef.current;
    dragPendingRef.current = null;
    if (!pending) return;
    try { pending.el.releasePointerCapture(pending.pointerId); } catch {}
    try { document.body.classList.remove('is-dragging'); } catch {}

    if (!pending.moved) {
      // A plain click/tap: still worth a quick flight into place instead of
      // teleporting straight into the list, so add-by-click reads the same
      // as add-by-drag rather than looking like the "real" animated path.
      if (pending.payload.kind === 'catalog') {
        const idx = pending.payload.idx;
        if (!canAdd) { window.alert('Deck cheio (21).'); setFloating(null); return; }
        if (countOf(idx) >= MAX_COPIES) { window.alert(`Máx ${MAX_COPIES} cópias desta carta.`); setFloating(null); return; }
        const pos = deckIdx.length;
        const newId = makeSlotId();
        const rect = pending.el.getBoundingClientRect();
        insertAt(pos, idx);
        insertSlotIdAt(pos, newId);
        triggerJustAdded(pos);
        try { playSound('cardWhoosh', 0.5); } catch {}
        setFloating({ phase: 'landing', payload: pending.payload, from: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }, targetSlotId: newId });
      } else {
        setFloating(null);
      }
      return;
    }

    const cur = floatingRef.current;
    const payload = pending.payload;
    if (!cur || cur.phase !== 'dragging' || cur.insertPos === null) {
      setFloating(null);
      return;
    }

    const insertPos = cur.insertPos;
    const from = { x: cur.x - cur.grabDx, y: cur.y - cur.grabDy, width: cur.width, height: cur.height };

    if (payload.kind === 'catalog') {
      if (deckIdx.length >= TOTAL_CARDS || countOf(payload.idx) >= MAX_COPIES) {
        setFloating(null);
        return;
      }
      const newId = makeSlotId();
      insertAt(insertPos, payload.idx);
      insertSlotIdAt(insertPos, newId);
      triggerJustAdded(insertPos);
      setFloating({ phase: 'landing', payload, from, targetSlotId: newId });
    } else {
      const fromIdx = payload.idx;
      const to = insertPos;
      if (to === fromIdx || to === fromIdx + 1) {
        setFloating(null); // dropped back roughly on itself
        return;
      }
      setDeckIdx((arr) => {
        const copy = arr.slice();
        const [val] = copy.splice(fromIdx, 1);
        let insertTo = to; if (insertTo > fromIdx) insertTo -= 1;
        copy.splice(insertTo, 0, val);
        return copy;
      });
      setSlotIds((ids) => {
        const copy = ids.slice();
        const [id] = copy.splice(fromIdx, 1);
        let insertTo = to; if (insertTo > fromIdx) insertTo -= 1;
        copy.splice(insertTo, 0, id);
        return copy;
      });
      setFloating({ phase: 'landing', payload, from, targetSlotId: payload.slotId });
    }
  };

  const handleCardPointerCancel = () => {
    dragPendingRef.current = null;
    try { document.body.classList.remove('is-dragging'); } catch {}
    setFloating(null);
  };

  const isDragSource = (kind: 'catalog' | 'deckslot', idx: number) => {
    const f = floating;
    return !!f && f.payload.kind === kind && f.payload.idx === idx;
  };

  // ====== coleção ops ======
  const loadFromCollection = (p: { name: string; seed: string }) => { setDeckName(p.name); handleLoadSeed(p.seed); setTab('builder'); };
  const deleteFromCollection = (name: string) => { if (!window.confirm(`Excluir "${name}"?`)) return; saveCollection(collection.filter((d) => d.name !== name)); };
  const renameInCollection = (oldName: string, newName: string) => {
    const n = (newName || '').trim(); if (!n) return;
    saveCollection(collection.map((d) => d.name === oldName ? { ...d, name: n } : d));
  };
  const saveToCollection = () => {
    const s = buildSeedV1FromIdx(deckIdx);
    if (!s) { window.alert('Complete 21 cartas antes.'); return; }
    const name = (deckName || '').trim() || `Deck ${new Date().toLocaleString()}`;
    const next = [{ id: cryptoId(), name, seed: s }, ...collection.filter((d) => d.name !== name)];
    saveCollection(next); window.alert('Salvo na coleção');
    setTab('collection');
  };
  const newDeckFromCollection = () => { setDeckIdx([]); setDeckName(''); setTab('builder'); };
  const importSeedToCollection = () => {
    const s = window.prompt('Cole a seed v1 para importar na coleção:');
    if (!s) return; if (!isValidV1(s)) { window.alert('Seed inválida'); return; }
    const name = window.prompt('Deck name') || `Deck ${new Date().toLocaleString()}`;
    saveCollection([{ id: cryptoId(), name, seed: s }, ...collection.filter((d) => d.name !== name)]);
  };
  const exportCollectionJSON = async () => { try { await navigator.clipboard.writeText(JSON.stringify(collection, null, 2)); window.alert('Coleção copiada'); } catch { window.alert('Falha ao copiar'); } };

  // ====== resumo + mini-gráfico ======
  const countByType = useMemo(() => {
    let a = 0, d = 0, g = 0;
    for (const i of deckIdx) {
      const t = idxToCardStatic(i).type;
      if (t === 'attack') a++; else if (t === 'defense') d++; else g++;
    }
    return { a, d, g };
  }, [deckIdx]);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cvs = chartRef.current; if (!cvs) return;
    const ctx = cvs.getContext('2d'); if (!ctx) return;
    const w = (cvs.width = cvs.clientWidth); const h = (cvs.height = 70);
    const total = Math.max(1, countByType.a + countByType.d + countByType.g);
    const bars = [countByType.a / total, countByType.d / total, countByType.g / total];
    ctx.clearRect(0, 0, w, h);
    const colors = ['#ff7f50', '#72d5ff', '#6ee7a1'];
    const gap = 10; const bw = (w - 4 * gap) / 3; let x = gap;
    bars.forEach((v, i) => {
      const bh = v * (h - 18);
      ctx.fillStyle = colors[i];
      ctx.fillRect(x, h - bh - 10, bw, bh);
      x += bw + gap;
    });
  }, [countByType]);

  // ====== render ======
  return (
    <>
    <div className="deckbuilder-theme db-wrap min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="db-header px-5 py-4 mb-4 flex items-center justify-between rounded-xl">
          <h2 className="db-display text-lg">Breath! · Decks</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab('collection')} className={`db-display text-xs px-4 py-1.5 rounded-full border-2 ${tab==='collection' ? 'bg-[#1a1b18] text-white border-[#1a1b18]' : 'bg-transparent text-[#6b6f64] border-black/15'}`}>Coleção</button>
            <button onClick={() => setTab('builder')} className={`db-display text-xs px-4 py-1.5 rounded-full border-2 ${tab==='builder' ? 'bg-[#1a1b18] text-white border-[#1a1b18]' : 'bg-transparent text-[#6b6f64] border-black/15'}`}>Builder</button>
          </div>
        </div>

        {tab === 'collection' ? (
          <div className="db-card db-content">
            <div className="toolbar flex items-center gap-2 mb-3">
              <button className="text-sm px-3 py-1 db-pill" onClick={newDeckFromCollection}>+ Novo Deck</button>
              <button className="text-sm px-3 py-1 db-pill" onClick={importSeedToCollection}>Import Seed → Coleção</button>
              <button className="text-sm px-3 py-1 db-pill" onClick={exportCollectionJSON}>Exportar JSON</button>
              {activeDeck ? (
                <span className="text-xs px-2 py-1 rounded border-2 bg-[#e6ecd6] border-[#7c9142]/50 text-[#5c6e2f] font-semibold">
                  Selecionado: {activeDeck.name}
                </span>
              ) : null}
            </div>
            <CollectionView
              presets={collection}
              onLoad={loadFromCollection}
              onDelete={deleteFromCollection}
              onRename={renameInCollection}
              onSelect={(p) => { setActiveDeck && setActiveDeck(p); }}
              activeDeck={activeDeck ?? null}
            />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {/* Catalog */}
            <div className="col-span-7 db-card">
                <div className="db-content" style={{ ['--card-width' as any]: density === 'compact' ? '120px' : '165px', ['--card-height' as any]: density === 'compact' ? '180px' : '240px' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="db-display text-sm">Catálogo</div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`ml-2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/5 border-2 border-black/15 text-[#1a1b18] hover:bg-black/10 ${toggleSpinning ? 'spin' : ''}`}
                        title={`Alternar densidade (atualmente ${density})`}
                        aria-label="Alternar densidade"
                        onClick={() => {
                          const next = density === 'compact' ? 'comfortable' : 'compact';
                          setDensity(next);
                          // spin animation on toggle
                          if (toggleSpinTimerRef.current) window.clearTimeout(toggleSpinTimerRef.current);
                          setToggleSpinning(true);
                          toggleSpinTimerRef.current = window.setTimeout(() => setToggleSpinning(false), 700) as unknown as number;
                        }}
                      >
                        {density === 'compact' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                            <rect x="3" y="3" width="7" height="7" fill="currentColor" />
                            <rect x="14" y="3" width="7" height="7" fill="currentColor" />
                            <rect x="3" y="14" width="7" height="7" fill="currentColor" />
                            <rect x="14" y="14" width="7" height="7" fill="currentColor" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                            <rect x="3" y="3" width="18" height="18" fill="currentColor" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <CardBrowser
                    options={options}
                    density={density}
                    onCardPointerDown={handleCardPointerDown}
                    onCardPointerMove={handleCardPointerMove}
                    onCardPointerUp={handleCardPointerUp}
                    onCardPointerCancel={handleCardPointerCancel}
                    isDragSource={(idx) => isDragSource('catalog', idx)}
                  />
                </div>
            </div>
            {/* Deck list + seed tools */}
            <div className="col-span-5 db-card">
              <div className="db-content">
                <h2 className="db-display text-sm mb-2">Deck List</h2>
                <div ref={deckListRef} className="grid grid-cols-3 gap-3 max-h-[56vh] overflow-auto db-scroll">
                  {deckCards.map((c, i) => (
                    <div
                      ref={setRef(slotIds[i] ?? `fallback_${i}`) as any}
                      key={slotIds[i] ?? `${c.id}-${i}`}
                      data-deck-tile={i}
                      data-slot-id={slotIds[i]}
                      className={`relative db-3d db-tilt ${recentlyAddedIndex === i ? 'just-added' : ''} ${removingSlotIds.has(slotIds[i]) ? 'is-removing' : ''} ${isDragSource('deckslot', i) ? 'dragging-source' : ''} ${(floating?.phase === 'dragging' && floating.insertPos === i ? 'drop-before ' : '') + (floating?.phase === 'dragging' && floating.insertPos === i + 1 ? 'drop-after ' : '')}`}
                      style={{ touchAction: 'none', width: 'var(--card-width, 165px)', height: 'var(--card-height, 240px)' }}
                      onPointerDown={(e) => {
                        if (e.button !== 0 && e.pointerType === 'mouse') return;
                        const el = e.currentTarget;
                        el.setPointerCapture(e.pointerId);
                        handleCardPointerDown(e, el, { kind: 'deckslot', idx: i, slotId: slotIds[i], card: c });
                      }}
                      onPointerMove={handleCardPointerMove}
                      onPointerUp={handleCardPointerUp}
                      onPointerCancel={handleCardPointerCancel}
                      onDragStart={(e) => e.preventDefault()}
                    >
                      <CardFront card={c} />
                      <div className="controls absolute right-1 bottom-1 flex gap-1">
                        <button className="text-xs px-2 py-0.5 db-pill" title="Duplicar" onPointerDown={(e) => e.stopPropagation()} onClick={() => duplicateAt(i)}>+</button>
                        <button className="text-xs px-2 py-0.5 db-pill" title="Remover" onPointerDown={(e) => e.stopPropagation()} onClick={() => removeAt(i)}>×</button>
                      </div>
                    </div>
                  ))}

                  {/* trailing zone: visual only - computeInsertPos already resolves
                      "past the last tile" to an append position on its own. */}
                  <div
                    className={`col-span-3 flex items-center justify-center p-2 rounded-md border border-dashed ${floating?.phase === 'dragging' && floating.insertPos === deckIdx.length ? 'drop-target' : 'border-transparent'}`}
                  >
                    <div className="text-xs text-[#6b6f64]">Arraste até aqui para adicionar ao final</div>
                  </div>
                </div>
                {deckIdx.length === 0 && (
                  <div className="empty mt-2 text-[#6b6f64] border-2 border-dashed border-black/15 rounded p-3">
                    No cards yet. Click the Catalog to add. (Max. 21)
                  </div>
                )}

                {/* Resumo + gráfico */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="db-pill text-center">Atk: {countByType.a}</div>
                  <div className="db-pill text-center">Def: {countByType.d}</div>
                  <div className="db-pill text-center">Dodge: {countByType.g}</div>
                </div>
                <canvas ref={chartRef} className="w-full h-[70px] mt-2 rounded border-2 border-black/10"></canvas>

                <div className="mt-3">
                  <div className="db-seedbox" title={buildSeedV1FromIdx(deckIdx) ?? ''}>
                    Seed v1: {buildSeedV1FromIdx(deckIdx) ?? `-  (faltam ${Math.max(0, TOTAL_CARDS - deckIdx.length)} carta(s))`}
                  </div>
                  <div className="toolbar flex items-center gap-2 mt-2">
                    <button className="text-sm px-3 py-1 db-pill" onClick={() => { const s = window.prompt('Cole a seed v1 para importar:'); if (s) handleLoadSeed(s); }}>Import Seed</button>
                    <button className="text-sm px-3 py-1 db-pill" onClick={clearDeck}>Clear</button>
                    <button className="text-sm px-3 py-1 db-pill" onClick={exportSeed}>Copy Seed</button>
                    <button className="text-sm px-3 py-1 db-pill" onClick={randomizeDeck}>Aleatório</button>
                    <button className="text-sm px-3 py-1 db-pill" onClick={() => { const s = exportSeed(); if (s) applyToGame(); }}>Apply to game</button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button className="text-sm px-3 py-1 db-pill" onClick={saveToCollection}>Salvar na Coleção</button>
                    <input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Deck name" className="px-2 py-1 rounded text-sm flex-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
    {floating && <DragGhost floating={floating} onLanded={() => { try { playSound('cardLand', 0.55); } catch {} setFloating(null); }} />}
    </>
  );
}
