// DeckBuilderHtml.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { idxToCardStatic, ALPHABET, type TcgCard } from '@/engine';
import { getAllKatas } from '@/data/katas';
import { useAppState } from '@/store/appState';
import CardBrowser from './CardBrowser';
import { CardFront } from '@/components/game/ui3';
import CollectionView from './CollectionView';
import './deckbuilder.css';

// ====== tipos ======
type CollDeck = { id: string; name: string; seed: string };

// ====== constantes ======
const COLL_KEY = 'breath_deck_collection_v1';
const MAX_COPIES = 3;
const TOTAL_CARDS = 21;

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

export default function DeckBuilderHtml() {
  const { setMode, setSeed, seed: appSeed, activeDeck, setActiveDeck, setArenaMode } = useAppState();

  // ====== estado principal ======
  const [tab, setTab] = useState<'builder' | 'collection' | 'store'>('collection');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const options = useMemo(() => Array.from({ length: 57 }, (_, i) => idxToCardStatic(i) as TcgCard), []);

  const [deckIdx, setDeckIdx] = useState<number[]>([]);
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
  const countOf = (idx: number) => deckIdx.filter(i => i === idx).length;

  const canAdd = deckIdx.length < TOTAL_CARDS;
  const addToDeck = (idx: number) => {
    if (!canAdd) { window.alert('Deck cheio (21).'); return; }
    if (countOf(idx) >= MAX_COPIES) { window.alert(`Máx ${MAX_COPIES} cópias desta carta.`); return; }
    setDeckIdx((arr) => {
      const pos = arr.length;
      const next = [...arr, idx];
      // mark recently added slot for animation
      if (recentlyAddedTimerRef.current) window.clearTimeout(recentlyAddedTimerRef.current);
      setRecentlyAddedIndex(pos);
      recentlyAddedTimerRef.current = window.setTimeout(() => setRecentlyAddedIndex(null), 700) as unknown as number;
      return next;
    });
  };
  const duplicateAt = (i: number) => {
    if (deckIdx.length >= TOTAL_CARDS) return;
    const idx = deckIdx[i];
    if (countOf(idx) >= MAX_COPIES) { window.alert(`Máx ${MAX_COPIES} cópias desta carta.`); return; }
    setDeckIdx((arr) => { const n = arr.slice(); n.splice(i + 1, 0, idx); return n; });
  };
  const removeAt = (i: number) => setDeckIdx((arr) => arr.filter((_, j) => j !== i));
  const swapSlots = (a: number, b: number) => setDeckIdx((arr) => { const n = arr.slice(); const t = n[a]; n[a] = n[b]; n[b] = t; return n; });
  const insertAt = (pos: number, val: number) => setDeckIdx((arr) => {
    if (arr.filter(i => i === val).length >= MAX_COPIES) return arr;
    const n = arr.slice(); n.splice(pos, 0, val); if (n.length > TOTAL_CARDS) n.length = TOTAL_CARDS; return n;
  });
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // drag preview state: when user starts dragging a card from the catalog we
  // show a floating CardFront that follows the cursor to emulate "holding" it.
  const [previewCard, setPreviewCard] = useState<TcgCard | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const previewOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const previewTimerRef = useRef<number | null>(null);

  const onDragPreviewStart = (card: TcgCard, e: React.DragEvent, offset?: { x: number; y: number }) => {
    setPreviewCard(card);
    previewOffsetRef.current = offset ?? null;

    const computePos = (cx: number, cy: number) => {
      if (!previewOffsetRef.current) return { x: cx + 12, y: cy + 12 };
      return { x: cx - previewOffsetRef.current.x + 12, y: cy - previewOffsetRef.current.y + 12 };
    };
    setPreviewPos(computePos(e.clientX, e.clientY));

    const onDocDrag = (ev: DragEvent) => {
      try { ev.preventDefault(); if ((ev as any).dataTransfer) (ev as any).dataTransfer.dropEffect = 'copy'; } catch {}
      setPreviewPos(computePos(ev.clientX, ev.clientY));
    };
    document.addEventListener('dragover', onDocDrag);

    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      document.removeEventListener('dragover', onDocDrag);
    }, 60000) as unknown as number;

    (onDragPreviewStart as any)._listener = onDocDrag;
  };

  const onDragPreviewEnd = () => {
    setPreviewCard(null);
    setPreviewPos(null);
    previewOffsetRef.current = null;

    try {
      const l = (onDragPreviewStart as any)._listener as ((ev: DragEvent) => void) | undefined;
      if (l) document.removeEventListener('dragover', l);
    } catch {}

    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  };
  const clearDeck = () => setDeckIdx([]);
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
        <div className="db-header px-4 py-3 mb-4 flex items-center justify-between rounded-xl">
          <h2 className="text-sm font-semibold text-slate-200 tracking-wide">Breath! • Decks</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab('collection')} className={`text-xs px-3 py-1 rounded-full ${tab==='collection' ? 'bg-white/10 text-white border border-white/20' : 'bg-transparent text-slate-300 border border-white/10'}`}>Coleção</button>
            <button onClick={() => setTab('builder')} className={`text-xs px-3 py-1 rounded-full ${tab==='builder' ? 'bg-white/10 text-white border border-white/20' : 'bg-transparent text-slate-300 border border-white/10'}`}>Builder</button>
            
          </div>
        </div>

        {tab === 'collection' ? (
          <div className="db-card db-content">
            <div className="toolbar flex items-center gap-2 mb-3">
              <button className="text-sm px-3 py-1 db-pill" onClick={newDeckFromCollection}>+ Novo Deck</button>
              <button className="text-sm px-3 py-1 db-pill" onClick={importSeedToCollection}>Import Seed → Coleção</button>
              <button className="text-sm px-3 py-1 db-pill" onClick={exportCollectionJSON}>Exportar JSON</button>
              {activeDeck ? (
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 border border-emerald-400/30 text-emerald-200">
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
                    <div className="text-sm font-medium text-slate-200">Catálogo</div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`ml-2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/6 text-slate-100 hover:bg-white/12 ${toggleSpinning ? 'spin' : ''}`}
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
                  <CardBrowser options={options} onAdd={(idx) => addToDeck(idx)} density={density} onDragPreviewStart={onDragPreviewStart} onDragPreviewEnd={onDragPreviewEnd} />
                </div>
            </div>
            {/* Deck list + seed tools */}
            <div className="col-span-5 db-card">
              <div className="db-content">
                <h2 className="font-medium mb-2">Deck List</h2>
                <div className="grid grid-cols-3 gap-3 max-h-[56vh] overflow-auto db-scroll">
                  {deckCards.map((c, i) => (
                    <div
                      key={`${c.id}-${i}`}
                      className={`relative db-3d db-tilt ${dragOverIndex === i ? 'drop-target' : ''} ${recentlyAddedIndex === i ? 'just-added' : ''}`}
                      draggable
                      onDragStart={(e) => { try { e.dataTransfer.setData('text/plain', `deckslot:${i}`); e.dataTransfer.effectAllowed = 'move'; try { document.body.classList.add('is-dragging'); } catch {} } catch {} }}
                      onDragEnter={() => setDragOverIndex(i)}
                      onDragLeave={() => setDragOverIndex((cur) => (cur === i ? null : cur))}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverIndex(i); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        try {
                          const txt = e.dataTransfer.getData('text/plain');
                          if (!txt) return;
                          const [kind, idxStr] = txt.split(':');
                          const n = Number(idxStr);
                          if (kind === 'deckslot' && Number.isFinite(n)) swapSlots(i, n);
                          else if (kind === 'card' && Number.isFinite(n)) insertAt(i + 1, n);
                        } catch {}
                        try { document.body.classList.remove('is-dragging'); } catch {}
                        setDragOverIndex(null);
                      }}
                    >
                      <CardFront card={c} />
                      <div className="controls absolute right-1 bottom-1 flex gap-1">
                        <button className="text-xs px-2 py-0.5 db-pill" title="Duplicar" onClick={() => duplicateAt(i)}>+</button>
                        <button className="text-xs px-2 py-0.5 db-pill" title="Remover" onClick={() => removeAt(i)}>×</button>
                      </div>
                    </div>
                  ))}

                  {/* trailing drop zone - allows dropping to append at the end */}
                  <div
                    className={`col-span-3 flex items-center justify-center p-2 rounded-md border border-dashed ${dragOverIndex === deckIdx.length ? 'drop-target' : 'border-transparent'}`}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOverIndex(deckIdx.length); }}
                    onDragEnter={() => setDragOverIndex(deckIdx.length)}
                    onDragLeave={() => setDragOverIndex((cur) => (cur === deckIdx.length ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault();
                      try {
                        const txt = e.dataTransfer.getData('text/plain');
                        if (!txt) return;
                        const [kind, idxStr] = txt.split(':');
                        const n = Number(idxStr);
                        if (kind === 'card' && Number.isFinite(n)) insertAt(deckIdx.length, n);
                        else if (kind === 'deckslot' && Number.isFinite(n)) {
                          // move a slot to the end
                          setDeckIdx((arr) => {
                            const copy = arr.slice();
                            if (n < 0 || n >= copy.length) return copy;
                            const [val] = copy.splice(n, 1);
                            copy.push(val);
                            return copy;
                          });
                        }
                      } catch {}
                      setDragOverIndex(null);
                    }}
                  >
                    <div className="text-xs text-slate-400">Drop here to append</div>
                  </div>
                </div>
                {deckIdx.length === 0 && (
                  <div className="empty mt-2 text-slate-400 border border-dashed border-slate-700/40 rounded p-3">
                    No cards yet. Click the Catalog to add. (Max. 21)
                  </div>
                )}

                {/* Resumo + gráfico */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="db-pill text-center">Atk: {countByType.a}</div>
                  <div className="db-pill text-center">Def: {countByType.d}</div>
                  <div className="db-pill text-center">Dodge: {countByType.g}</div>
                </div>
                <canvas ref={chartRef} className="w-full h-[70px] mt-2 rounded border border-white/10"></canvas>

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
                    <input value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="Deck name" className="px-2 py-1 border rounded text-sm bg-transparent text-slate-200 flex-1" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
    {/* floating drag preview portal appended to body via absolute positioning */}
    {previewCard && previewPos && typeof document !== 'undefined' ? (
      // render directly into document.body so it's not clipped; keep minimal markup
      (() => {
        try {
          const el = document.body;
          const container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.left = '0';
          container.style.top = '0';
          container.style.pointerEvents = 'none';
          container.style.zIndex = '9999';
          container.className = 'deck-drag-preview-root';
          // set transform via inline style on inner wrapper to follow cursor
          const inner = document.createElement('div');
          inner.style.position = 'absolute';
          inner.style.left = `${previewPos.x}px`;
          inner.style.top = `${previewPos.y}px`;
          inner.style.width = density === 'compact' ? '120px' : '165px';
          inner.style.pointerEvents = 'none';
          inner.className = 'deck-drag-preview-inner db-3d db-tilt';
          container.appendChild(inner);
          // attach container once
          if (!document.querySelector('.deck-drag-preview-root')) document.body.appendChild(container);
          // ensure the inner gets updated on each render
          const root = document.querySelector('.deck-drag-preview-root');
          if (root) {
            const i = root.querySelector('.deck-drag-preview-inner') as HTMLDivElement | null;
            if (i) {
              i.style.left = `${previewPos.x}px`;
              i.style.top = `${previewPos.y}px`;
              i.style.width = density === 'compact' ? '120px' : '165px';
              // render a lightweight CardFront into this inner using React portal
            }
          }
        } catch {}
        return (
          <div style={{ position: 'fixed', left: 0, top: 0, pointerEvents: 'none', zIndex: 9999 }}>
            <div style={{ position: 'absolute', left: previewPos.x, top: previewPos.y, width: density === 'compact' ? 120 : 165, pointerEvents: 'none', transform: 'translate(-8px, -8px) scale(1.02)', boxShadow: '0 30px 60px rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', gap: 6 }} className="db-3d db-tilt">
              <div style={{ transform: 'translateY(6px) rotate(-6deg)', width: 28, height: 28 }} aria-hidden>
                {/* small hand icon to imply holding */}
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 12c0-1.1.9-2 2-2h1v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V9a2 2 0 0 0-2-2h-1" stroke="#fff" strokeOpacity="0.92" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 6v2" stroke="#fff" strokeOpacity="0.92" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ pointerEvents: 'none' }}>
                <CardFront card={previewCard} />
              </div>
            </div>
          </div>
        );
      })()
    ) : null}
    </>
  );
}


