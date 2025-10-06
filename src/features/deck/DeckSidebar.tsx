// DeckSidebar.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { CardFront } from '@/components/game/ui3';
import type { TcgCard } from '@/engine';

export default function DeckSidebar({
  deck, Presets, onSActionset, onApply, onExport, onLoadSeed, onLoActionset, onDeletePreset, onRenActionset
}: {
  deck: TcgCard[]; Presets: any[];
  onSActionset: (name?: string) => void; onApply: () => void; onExport: () => void;
  onLoadSeed?: (s: string) => void; onLoActionset?: (p: { name: string; seed: string }) => void;
  onDeletePreset?: (name: string) => void; onRenActionset?: (oldName: string, newName: string) => void;
}) {
  const [seedText, setSeedText] = React.useState('');
  const [hoveredPreset, setHoveredPreset] = React.useState<string | null>(null);

  const handleLoad = () => { if (!onLoadSeed) return; onLoadSeed(seedText.trim()); };
  const pasteFromClipboard = async () => { try { setSeedText(await navigator.clipboard.readText()); } catch {} };

  const attackCount = deck.filter((c) => c.type === 'attack').length;
  const defCount = deck.filter((c) => c.type === 'defense').length;
  const dodgeCount = deck.filter((c) => c.type === 'dodge').length;

  return (
    <div className="db-content text-slate-200">
      <h3 className="font-semibold mb-2">Ações</h3>
      <div className="space-y-2 mb-4">
        <div className="flex flex-col gap-2">
          <Button onClick={onExport} className="text-xs">Export seed (v1)</Button>
          <Button onClick={onApply} className="text-xs">Apply to game</Button>
          <Button onClick={() => {
            const name = window.prompt('Nome do preset (deixe em branco para gerar automaticamente)');
            onSActionset(name ?? undefined);
          }} className="text-xs">Save preset</Button>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-sm font-medium block mb-1">Load seed (v1)</label>
        <div className="flex gap-2">
          <input className="flex-1 px-2 py-1 border rounded text-sm bg-transparent text-slate-200" placeholder="v1...." value={seedText} onChange={(e) => setSeedText(e.target.value)} />
          <Button onClick={pasteFromClipboard}>Paste</Button>
          <Button onClick={handleLoad}>Load</Button>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-medium mb-2">Deck preview</h4>
        <div className="flex flex-wrap gap-2 p-2 border border-slate-700/40 rounded bg-transparent max-h-40 overflow-auto">
          {deck.map((c, i) => (
            <div key={`${c.id}-${i}`} className="transform scale-75 origin-top-left db-3d db-tilt">
              <CardFront card={c} />
            </div>
          ))}
        </div>
      </div>

      <h4 className="font-medium">Estatísticas</h4>
      <div className="text-sm text-slate-300 mb-2">Ataque: {attackCount}</div>
      <div className="text-sm text-slate-300 mb-2">Defesa: {defCount}</div>
      <div className="text-sm text-slate-300 mb-2">Esquiva: {dodgeCount}</div>

      <h4 className="font-medium mt-4">Presets</h4>
      <div className="space-y-2 mt-2">
        {Presets.map((p) => (
          <div
            key={p.name}
            className={`flex items-center justify-between p-1 border border-slate-700/40 rounded bg-transparent ${hoveredPreset === p.name ? 'ring-2 ring-sky-200' : ''}`}
            onMouseEnter={() => setHoveredPreset(p.name)}
            onMouseLeave={() => setHoveredPreset(null)}
            title={p.name}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium" title={p.name}>{p.name}</div>
              <div className="text-xs text-slate-400" title={p.seed}>{String(p.seed).slice(0, 12)}{String(p.seed).length > 12 ? '...' : ''}</div>
            </div>
            <div className="flex gap-1 ml-2">
              <button className="text-xs px-2 py-0.5 db-pill" onClick={() => onLoActionset && onLoActionset(p)} aria-label={`Load ${p.name}`}>Load</button>
              <button className="text-xs px-2 py-0.5 db-pill" onClick={() => navigator.clipboard?.writeText(p.seed)} aria-label={`Copiar ${p.name}`}>Copy</button>
              <button className="text-xs px-2 py-0.5 db-pill" onClick={() => {
                const newName = window.prompt('Novo nome do preset', p.name)?.trim();
                if (newName && onRenActionset) onRenActionset(p.name, newName);
              }} aria-label={`Renomear ${p.name}`}>Rename</button>
              <button className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded" onClick={() => onDeletePreset && onDeletePreset(p.name)} aria-label={`Deletar ${p.name}`}>Del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


