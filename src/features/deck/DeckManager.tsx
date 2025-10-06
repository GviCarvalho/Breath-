import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardFront } from '@/components/game/ui3';
import { ALPHABET, idxToCardStatic, makeDeck, type TcgCard } from '@/engine';
import { PRESET_KEY, seedPresetsIfNeeded, type Preset as KataPreset, getAllKatas } from '@/data/katas';
import { useAppState } from '@/store/appState';

type Preset = { name: string; seed: string };

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((p) => p && typeof p.name === 'string' && typeof p.seed === 'string');
  } catch {}
  return [];
}

function savePresets(arr: Preset[]) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(arr)); } catch {}
}

function isValidV1(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const st = s.trim();
  if (!st.startsWith('v1.')) return false;
  const payload = st.slice(3);
  if (payload.length === 0) return false;
  for (const ch of payload) if (!ALPHABET.includes(ch)) return false;
  return true;
}

function previewFromSeed(seed: string): TcgCard[] {
  try {
    return makeDeck(seed).slice(0, 3);
  } catch {
    // fallback: three basic cards
    return [idxToCardStatic(0), idxToCardStatic(1), idxToCardStatic(2)];
  }
}

export default function DeckManager() {
  const { setMode, setSeed, activeDeck, setActiveDeck, setArenaMode } = useAppState();
  const [presets, setPresets] = useState<Preset[]>(() => seedPresetsIfNeeded(loadPresets()));
  const [filter, setFilter] = useState('');

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter((p) => p.name.toLowerCase().includes(q) || p.seed.toLowerCase().includes(q));
  }, [filter, presets]);

  const addFromSeed = () => {
    const s = window.prompt('Cole a seed (v1...)');
    if (!s) return;
    if (!isValidV1(s)) { window.alert('Seed inválida (esperado prefixo v1.)'); return; }
    const name = window.prompt('Deck name') || `Deck ${new Date().toLocaleString()}`;
    const next = [{ name, seed: s.trim() }, ...presets.filter((p) => p.name !== name)];
    setPresets(next);
  };

  const exportAll = async () => {
    const payload = JSON.stringify(presets, null, 2);
    try { await navigator.clipboard.writeText(payload); window.alert('JSON copiado para a área de transferência'); } catch (e) {
      window.alert('Falha ao copiar. Veja o console.');
      console.warn('exportAll copy failed', e);
    }
  };

  const importAll = () => {
    const txt = window.prompt('Cole o JSON com os decks');
    if (!txt) return;
    try {
      const arr = JSON.parse(txt);
      if (!Array.isArray(arr)) throw new Error('Formato inválido');
      const cleaned: Preset[] = arr
        .filter((p) => p && typeof p.name === 'string' && typeof p.seed === 'string')
        .map((p) => ({ name: p.name, seed: p.seed }));
      // merge, favorando os importados por nome
      const dedup = new Map<string, Preset>();
      presets.forEach((p) => dedup.set(p.name, p));
      cleaned.forEach((p) => dedup.set(p.name, p));
      setPresets(Array.from(dedup.values()));
    } catch (e) {
      window.alert('JSON inválido');
    }
  };

  const setActive = (p: Preset) => {
    if (setActiveDeck) setActiveDeck(p);
  };

  const playLocal = (p: Preset) => {
    if (setActiveDeck) setActiveDeck(p);
    if (setSeed) setSeed(p.seed);
    try { setArenaMode && setArenaMode('local'); } catch {}
    setMode('arena' as any);
  };

  const editInBuilder = (p: Preset) => {
    if (setSeed) setSeed(p.seed);
    setMode('collection');
  };

  const duplicate = (p: Preset) => {
    const base = `${p.name} (cópia)`;
    let final = base;
    let i = 2;
    const names = new Set(presets.map((x) => x.name));
    while (names.has(final)) { final = `${base} ${i++}`; }
    setPresets([{ name: final, seed: p.seed }, ...presets]);
  };

  const rename = (p: Preset) => {
    const n = window.prompt('Novo Deck name', p.name)?.trim();
    if (!n) return;
    setPresets(presets.map((x) => (x.name === p.name ? { ...x, name: n } : x)));
    if (activeDeck?.name === p.name && setActiveDeck) setActiveDeck({ name: n, seed: p.seed });
  };

  const remove = (p: Preset) => {
    const ok = window.confirm(`Delete "${p.name}"?`);
    if (!ok) return;
    setPresets(presets.filter((x) => x.name !== p.name));
    if (activeDeck?.name === p.name && setActiveDeck) setActiveDeck(null);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">My Decks</h2>
        <div className="flex gap-2">
          {/* Optional: quick add beginner kata if missing */}
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search..." className="px-2 py-1 border rounded text-sm" />
          <Button onClick={() => setMode('collection')} className="text-sm">Create New</Button>
          <Button onClick={addFromSeed} className="text-sm">Import Seed</Button>
          <Button onClick={exportAll} className="text-sm">Export JSON</Button>
          <Button onClick={importAll} className="text-sm">Import JSON</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filtered.map((p) => {
          const preview = previewFromSeed(p.seed);
          const isActive = activeDeck?.name === p.name && activeDeck?.seed === p.seed;
          return (
            <div key={p.name} className={`flex items-center justify-between p-2 border rounded bg-white ${isActive ? 'ring-2 ring-sky-300' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex gap-1">
                  {preview.map((c, i) => (
                    <div key={`${c.id}-${i}`} className="transform scale-75 origin-left">
                      <CardFront card={c} />
                    </div>
                  ))}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate" title={p.name}>{p.name}</div>
                  <div className="text-xs text-slate-500 truncate" title={p.seed}>{p.seed}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="text-xs px-2 py-0.5 bg-slate-100 rounded" onClick={() => setActive(p)}>Activate</button>
                <button className="text-xs px-2 py-0.5 bg-slate-100 rounded" onClick={() => playLocal(p)}>Play Local</button>
                <button className="text-xs px-2 py-0.5 bg-slate-100 rounded" onClick={() => editInBuilder(p)}>Edit</button>
                <button className="text-xs px-2 py-0.5 bg-slate-100 rounded" onClick={() => duplicate(p)}>Duplicate</button>
                <button className="text-xs px-2 py-0.5 bg-slate-100 rounded" onClick={() => rename(p)}>Rename</button>
                <button className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded" onClick={() => remove(p)}>Delete</button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-sm text-slate-600">No decks found.</div>
        )}
      </div>
    </div>
  );
}


