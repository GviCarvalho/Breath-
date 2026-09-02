import React, { useMemo, useState } from 'react';
import { useAppState } from '@/store/appState';
import { CardFront } from '@/components/game/ui3';
import { makeDeck, type TcgCard } from '@/engine';

function useDeckPreview(seed?: string | null) {
  if (!seed) return { cards: [] as TcgCard[] };
  try { return { cards: makeDeck(seed).slice(0, 3) }; } catch { return { cards: [] as TcgCard[] }; }
}

export default function Home() {
  const { playerName, setPlayerName, activeDeck, setSeed, setMode, setArenaMode, lanHost, setLanHost } = useAppState();
  const [name, setName] = useState(playerName);
  const [hostInput, setHostInput] = useState(lanHost || 'localhost:3001');
  const { cards } = useDeckPreview(activeDeck?.seed);

  const TokenImg = new URL('../../Assets/art/tokens/Carved Green Yin-Yang Token.png', import.meta.url).href;

  const onPlayLocal = () => { setArenaMode && setArenaMode('local'); setMode('arena'); };
  const onPlayOnline = () => { 
    if (setLanHost) setLanHost(hostInput);
    setArenaMode && setArenaMode('online'); 
    setMode('arena'); 
  };
  const goCollection = () => setMode('collection');
  const editActive = () => { if (activeDeck?.seed && setSeed) setSeed(activeDeck.seed); setMode('collection'); };

  return (
    <div className="min-h-screen p-8">
      <header className="max-w-6xl mx-auto flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-900/10">
          <img src={TokenImg} alt="token" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-xl font-semibold cursor-pointer" onClick={() => setMode('home')}>Breath</h1>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setPlayerName(name)}
            placeholder="Seu nome"
            className="px-3 py-1.5 border border-white/10 bg-transparent rounded text-sm text-slate-200 w-56"
          />
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold mb-4">Jogar</h2>
            <div className="flex flex-wrap items-center gap-3">
              <button className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white" onClick={onPlayLocal}>Jogar vs CPU</button>
              <button className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white" onClick={onPlayOnline}>Jogar Multiplayer (LAN)</button>
              <button className="px-4 py-2 rounded bg-white/10 hover:bg-white/15 border border-white/15" onClick={goCollection}>Coleção</button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="font-semibold mb-2">Configuração de Rede (LAN)</h2>
            <p className="text-xs text-slate-400 mb-4">Para jogar com um amigo na mesma rede, insira o endereço IP do computador que está rodando o servidor (ex: 192.168.1.10:3001).</p>
            <div className="flex items-center gap-2">
              <input
                value={hostInput}
                onChange={(e) => setHostInput(e.target.value)}
                placeholder="Endereço do Host (ex: localhost:3001)"
                className="flex-1 px-3 py-1.5 border border-white/10 bg-transparent rounded text-sm text-slate-200"
              />
            </div>
          </div>
        </section>

        <aside className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="font-semibold mb-3">Deck ativo</h2>
          {!activeDeck ? (
            <div className="text-sm text-slate-300">
              Nenhum deck selecionado. Vá para a Coleção para escolher ou criar um deck.
              <div className="mt-3"><button className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 border border-white/15" onClick={goCollection}>Ir para Coleção</button></div>
            </div>
          ) : (
            <div>
              <div className="text-sm text-slate-300">{activeDeck.name}</div>
              <div className="text-xs text-slate-500 truncate" title={activeDeck.seed}>{activeDeck.seed}</div>
              <div className="flex gap-2 mt-3">
                {cards.map((c, i) => (
                  <div key={`${c.id}-${i}`} className="w-16">
                    <CardFront card={c} />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white" onClick={onPlayLocal}>Jogar com este deck</button>
                <button className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 border border-white/15" onClick={editActive}>Editar no Builder</button>
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
