import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BreathBar, CardBack, CardFront, FlipCard, bannerFor, floaterText } from '@/components/game/ui3';
import { useMatchConnection, type ConnectionStatus } from '@/hooks/useMatchConnection';
import type { ImpactKind, TcgCard } from '@/engine';
import type { PlayerSlot } from '@/protocol/messages';
import { useAppState } from '@/store/appState';

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: 'Disconnected',
  connecting: 'Connecting...',
  waiting: 'Waiting for opponent',
  in_match: 'Match in progress',
  spectating: 'Spectating',
  error: 'Connection error',
};

const impactMirror: Record<ImpactKind, ImpactKind> = {
  none: 'none',
  p1_hits: 'p2_hits',
  p2_hits: 'p1_hits',
  blocked_p1: 'blocked_p2',
  blocked_p2: 'blocked_p1',
  dodged_p1: 'dodged_p2',
  dodged_p2: 'dodged_p1',
  miss_p1: 'miss_p2',
  miss_p2: 'miss_p1',
  extra_p1: 'extra_p2',
  extra_p2: 'extra_p1',
  extra_granted_p1: 'extra_granted_p2',
  extra_granted_p2: 'extra_granted_p1',
  steal_p1: 'steal_p2',
  steal_p2: 'steal_p1',
  spend_p1: 'spend_p2',
  spend_p2: 'spend_p1',
  gain_p1: 'gain_p2',
  gain_p2: 'gain_p1',
  defeat_p1: 'defeat_p2',
  defeat_p2: 'defeat_p1',
};

function orientImpact(kind: ImpactKind, perspective: 'self' | 'opponent'): ImpactKind {
  if (perspective === 'self') return kind;
  return impactMirror[kind] ?? kind;
}

const STATUS_BADGE: Record<'waiting' | 'full' | 'in_round' | 'finished', string> = {
  waiting: 'Waiting',
  full: 'Full',
  in_round: 'In round',
  finished: 'Finished',
};

export default function OnlineGame() {
  const { playerName, setPlayerName, lastMatchId, setLastMatchId } = useAppState();
  const [nameInput, setNameInput] = useState(playerName);
  const [joinId, setJoinId] = useState(lastMatchId ?? '');
  const [copied, setCopied] = useState(false);
  const [bottomFloaters, setBottomFloaters] = useState<{ id: string; text: string }[]>([]);
  const [topFloaters, setTopFloaters] = useState<{ id: string; text: string }[]>([]);
  const [impact, setImpact] = useState<ImpactKind>('none');
  const [banner, setBanner] = useState<string | null>(null);
  const [bottomFlipped, setBottomFlipped] = useState(false);
  const [topFlipped, setTopFlipped] = useState(false);

  const {
    status,
    error,
    matchId,
    playerId,
    role,
    snapshot,
    events,
    matchList,
    createMatch,
    joinMatch,
    spectateMatch,
    refreshMatchList,
    playCard,
    resetMatch,
    leaveMatch,
    clearError,
    setMatchList,
  } = useMatchConnection();

  const timeoutRefs = useRef<number[]>([]);
  const logEntries = snapshot?.log ?? [];

  const effectiveRole = useMemo(() => {
    if (role === 'p1' || role === 'p2' || role === 'spectator') return role;
    if (!snapshot || !playerId) return role ?? null;
    if (snapshot.players.p1.id === playerId) return 'p1';
    if (snapshot.players.p2.id === playerId) return 'p2';
    return role ?? null;
  }, [role, snapshot, playerId]);

  const bottomSlot: PlayerSlot = effectiveRole === 'p2' ? 'p2' : 'p1';
  const topSlot: PlayerSlot = bottomSlot === 'p1' ? 'p2' : 'p1';
  const bottomPlayer = snapshot?.players[bottomSlot] ?? null;
  const topPlayer = snapshot?.players[topSlot] ?? null;

  const pushFloater = (target: 'self' | 'opponent', text: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    if (target === 'self') setBottomFloaters((arr) => [...arr, { id, text }]);
    else setTopFloaters((arr) => [...arr, { id, text }]);
    const handle = window.setTimeout(() => {
      if (target === 'self') setBottomFloaters((arr) => arr.filter((f) => f.id !== id));
      else setTopFloaters((arr) => arr.filter((f) => f.id !== id));
    }, 900);
    timeoutRefs.current.push(handle);
  };

  useEffect(() => {
    setNameInput(playerName);
  }, [playerName]);

  useEffect(() => {
    if (matchId) {
      setLastMatchId(matchId);
    }
  }, [matchId, setLastMatchId]);

  useEffect(() => {
    if (status === 'idle') {
      setJoinId(lastMatchId ?? '');
    }
  }, [status, lastMatchId, matchId]);

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((id) => window.clearTimeout(id));
      timeoutRefs.current = [];
    };
  }, []);

  useEffect(() => {
    if (!snapshot) {
      setBottomFlipped(false);
      setTopFlipped(false);
      return;
    }
    setBottomFlipped(Boolean(bottomPlayer?.revealed));
    setTopFlipped(Boolean(topPlayer?.revealed));
  }, [snapshot, bottomPlayer?.revealed?.id, topPlayer?.revealed?.id]);

  useEffect(() => {
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
    if (!events || events.length === 0) {
      setImpact('none');
      setBanner(null);
      setBottomFloaters([]);
      setTopFloaters([]);
      return;
    }

    const oriented = events.map((kind) => (effectiveRole === 'p2' ? orientImpact(kind, 'opponent') : kind));
    if (oriented.length === 1 && oriented[0] === 'none') {
      setImpact('none');
      setBanner(null);
      return;
    }

    let cursor = 0;
    oriented.forEach((kind) => {
      const handle = window.setTimeout(() => {
        setImpact(kind);
        setBanner(bannerFor(kind));
        const selfFloater = floaterText(kind, 'p1');
        if (selfFloater) pushFloater('self', selfFloater);
        const oppFloater = floaterText(kind, 'p2');
        if (oppFloater) pushFloater('opponent', oppFloater);
      }, cursor);
      timeoutRefs.current.push(handle);
      cursor += 450;
    });

    const clearHandle = window.setTimeout(() => {
      setBanner(null);
      setImpact('none');
      setBottomFloaters([]);
      setTopFloaters([]);
    }, cursor + 350);
    timeoutRefs.current.push(clearHandle);
  }, [events, role]);

  useEffect(() => {
    if (status === 'idle') {
      refreshMatchList().catch(() => {});
    }
  }, [status, refreshMatchList]);

  const handlePlay = (card: TcgCard) => {
    if (!snapshot) return;
    if (snapshot.gameOver) return;
    if (effectiveRole !== 'p1' && effectiveRole !== 'p2') return;
    const me = snapshot.players[effectiveRole];
    if (me.revealed) return;
    playCard(card.id);
  };

  const handleCreate = (evt: React.FormEvent) => {
    evt.preventDefault();
    setPlayerName(nameInput.trim());
    createMatch(nameInput.trim() || undefined);
  };

  const handleJoin = (evt: React.FormEvent) => {
    evt.preventDefault();
    if (!joinId.trim()) return;
    setPlayerName(nameInput.trim());
    joinMatch(joinId.trim(), nameInput.trim() || undefined);
  };

  const handleSpectate = (id: string) => {
    spectateMatch(id, nameInput.trim() || undefined);
  };

  const statusLabel = STATUS_LABEL[status];
  const isInMatch = status === 'in_match' || status === 'spectating' || status === 'waiting';

  const gameOverLabel = snapshot?.gameOver
    ? snapshot.gameOver === 'both'
      ? 'Ambos ficaram sem f�lego'
      : snapshot.gameOver === role
      ? 'You ficou sem f�lego'
      : 'Opponent caiu'
    : null;

  const canJoinSummary = (summary: typeof matchList[number]) => summary.status === 'waiting';

  const copyMatchId = async () => {
    if (!matchId) return;
    try {
      await navigator.clipboard.writeText(matchId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.warn('copy failed', err);
    }
  };

  const clearFloaters = () => {
    setBottomFloaters([]);
    setTopFloaters([]);
  };

  useEffect(() => {
    if (!isInMatch) {
      clearFloaters();
    }
  }, [isInMatch]);

  const createLocalMatch = () => {
    const matchId = `local-${Date.now()}`;
    const match = {
      id: matchId,
      players: {
        p1: { id: 'player1', name: playerName || 'Player 1' },
        p2: { id: 'player2', name: 'CPU' },
      },
      status: 'waiting',
    };
    localStorage.setItem('localMatch', JSON.stringify(match));
    setLastMatchId(matchId);
  };

  const getLocalMatchList = () => {
    const match = localStorage.getItem('localMatch');
    return match ? [JSON.parse(match)] : [];
  };

  useEffect(() => {
    if (status === 'idle') {
      const localMatches = getLocalMatchList();
      refreshMatchList().then(() => {
        const updatedMatches = [...matchList, ...localMatches];
        setMatchList(updatedMatches);
      });
    }
  }, [status, matchList]);

  return (
    <div className="min-h-screen playmat p-6 flex flex-col items-center gap-4">
      <header className="w-full max-w-5xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Breath! Online</h1>
          <div className="text-sm text-slate-600">{statusLabel}</div>
        </div>
        {error && (
          <div className="flex items-center justify-between gap-4 border border-red-300 bg-red-100 text-red-800 px-3 py-2 rounded">
            <span>{error}</span>
            <Button onClick={clearError} className="bg-red-600 hover:bg-red-500">
              Fechar
            </Button>
          </div>
        )}
      </header>

      {!isInMatch && (
        <section className="w-full max-w-5xl flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/80 border rounded-lg p-4 shadow-sm">
            <form className="flex flex-col gap-3" onSubmit={handleCreate}>
              <h2 className="font-semibold">Criar partida</h2>
              <label className="text-sm text-slate-600">
                Seu nome
                <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Opcional" className="mt-1" />
              </label>
              <Button type="submit">Criar partida</Button>
            </form>
            <form className="flex flex-col gap-3" onSubmit={handleJoin}>
              <h2 className="font-semibold">Entrar em partida</h2>
              <label className="text-sm text-slate-600">
                Match ID
                <Input value={joinId} onChange={(e) => setJoinId(e.target.value)} required className="mt-1" />
              </label>
              <Button type="submit">Entrar</Button>
            </form>
          </div>

          <div className="bg-white/80 border rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Partidas dispon�veis</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{matchList.length} partidas</span>
                <Button onClick={() => refreshMatchList().catch(() => {})} className="bg-slate-200 text-slate-700 hover:bg-slate-300">
                  Atualizar
                </Button>
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-2">Match</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Jogadores</th>
                    <th className="py-2 pr-2">Espectadores</th>
                    <th className="py-2 pr-2 text-right">A��es</th>
                  </tr>
                </thead>
                <tbody>
                  {matchList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-slate-500">
                        Nenhuma partida encontrada. Crie uma nova ou atualize a lista.
                      </td>
                    </tr>
                  )}
                  {matchList.map((summary) => (
                    <tr key={summary.matchId} className="border-t">
                      <td className="py-2 pr-2 font-mono text-xs">{summary.matchId}</td>
                      <td className="py-2 pr-2 capitalize">{STATUS_BADGE[summary.status]}</td>
                      <td className="py-2 pr-2">
                        {summary.seats.p1.name ?? 'Open'} / {summary.seats.p2.name ?? 'Open'}
                      </td>
                      <td className="py-2 pr-2">{summary.spectators}</td>
                      <td className="py-2 pr-0 text-right space-x-2">
                        <Button
                          onClick={() => {
                            setJoinId(summary.matchId);
                            setPlayerName(nameInput.trim());
                            handleSpectate(summary.matchId);
                          }}
                          className="bg-slate-200 text-slate-700 hover:bg-slate-300"
                        >
                          Assistir
                        </Button>
                        <Button
                          onClick={() => {
                            setJoinId(summary.matchId);
                            setPlayerName(nameInput.trim());
                            joinMatch(summary.matchId, nameInput.trim() || undefined);
                          }}
                          className="bg-emerald-500 hover:bg-emerald-400"
                          disabled={!canJoinSummary(summary)}
                        >
                          Entrar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {isInMatch && snapshot && (
        <div className="w-full max-w-5xl flex-1 flex flex-col gap-6">
          <div className="flex items-center justify-between border border-slate-200 bg-white/80 px-4 py-2 rounded-lg text-sm">
            <div>
              <strong>Match ID:</strong> {matchId}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={copyMatchId} className="bg-slate-200 text-slate-700 hover:bg-slate-300">
                {copied ? 'Copiado!' : 'Copiar ID'}
              </Button>
              {role !== 'spectator' && (
                <Button onClick={resetMatch} className="bg-transparent text-sm underline-offset-4 hover:underline">
                  Reset
                </Button>
              )}
              <Button onClick={leaveMatch} className="bg-slate-200 text-slate-700 hover:bg-slate-300">
                Sair
              </Button>
            </div>
          </div>
          {gameOverLabel && (
            <div className="border border-amber-300 bg-amber-100 text-amber-900 px-4 py-2 rounded text-sm">
              {gameOverLabel}
            </div>
          )}
          {snapshot?.gameOver && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
                <h3 className="text-lg font-semibold mb-2">Fim de partida</h3>
                <p className="mb-4">{gameOverLabel}</p>
                <div className="flex justify-end gap-3">
                  <Button onClick={leaveMatch} className="bg-slate-200 text-slate-700 hover:bg-slate-300">Sair</Button>
                  {role !== 'spectator' && (
                    <Button onClick={resetMatch} className="bg-emerald-500 hover:bg-emerald-400">Reiniciar</Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {gameOverLabel && (
            <div className="border border-amber-300 bg-amber-100 text-amber-900 px-4 py-2 rounded text-sm">
              {gameOverLabel}
            </div>
          )}

          <div className="flex flex-col items-center">
            <h2 className="font-semibold flex items-center gap-2">
              {topPlayer?.name ?? 'Opponent'} {snapshot.priorityOwner === (bottomSlot === 'p1' ? 1 : 0) && <Badge>Priority</Badge>}
            </h2>
            <BreathBar value={topPlayer?.breath ?? 0} />
            <p className="text-sm">Posture: {topPlayer?.posture ?? '-'}</p>
            <div className="flex gap-2 mt-2">
              {Array.from({ length: topPlayer?.handCount ?? 0 }).map((_, idx) => (
                <CardBack key={`opp-${idx}`} />
              ))}
            </div>
          </div>

          <div className="relative flex justify-center items-center gap-12 py-12 arena-ring">
            <div className={cn('transition-all duration-300', (impact === 'p1_hits' || impact === 'extra_p1') && 'translate-x-6')}>
              {bottomPlayer?.revealed ? (
                <div
                  className={cn(
                    'relative',
                    (impact === 'p2_hits' || impact === 'extra_p2') && 'opacity-80 blur-[1px] animate-shake',
                    impact === 'dodged_p1' && 'dash-right',
                    impact === 'defeat_p1' && 'opacity-50',
                  )}
                >
                  <FlipCard flipped={bottomFlipped} back={<CardBack />} front={<CardFront card={bottomPlayer.revealed} />} />
                  <div className="absolute -top-3 -left-3 space-y-1">
                    {bottomFloaters.map((floater) => (
                      <div key={floater.id} className="text-xs font-bold bg-white/90 border rounded px-2 py-0.5 animate-bounce shadow">
                        {floater.text}
                      </div>
                    ))}
                  </div>
                  {impact === 'blocked_p1' && <div className="absolute inset-0 rounded-xl border-2 border-blue-400/80 animate-ping" />}
                </div>
              ) : (
                <div className="w-24 h-36 border rounded-xl bg-slate-200" />
              )}
            </div>

            {banner && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 text-xs banner px-2 py-1 rounded">{banner}</div>
            )}

            <div className={cn('transition-all duration-300', (impact === 'p2_hits' || impact === 'extra_p2') && '-translate-x-6')}>
              {topPlayer?.revealed ? (
                <div
                  className={cn(
                    'relative',
                    (impact === 'p1_hits' || impact === 'extra_p1') && 'opacity-80 blur-[1px] animate-shake',
                    impact === 'dodged_p2' && 'dash-left',
                    impact === 'defeat_p2' && 'opacity-50',
                  )}
                >
                  <FlipCard flipped={topFlipped} back={<CardBack />} front={<CardFront card={topPlayer.revealed} />} />
                  <div className="absolute -top-3 -right-3 space-y-1 items-end">
                    {topFloaters.map((floater) => (
                      <div key={floater.id} className="text-xs font-bold bg-white/90 border rounded px-2 py-0.5 animate-bounce shadow">
                        {floater.text}
                      </div>
                    ))}
                  </div>
                  {impact === 'blocked_p2' && <div className="absolute inset-0 rounded-xl border-2 border-blue-400/80 animate-ping" />}
                </div>
              ) : (
                <div className="w-24 h-36 border rounded-xl bg-slate-200" />
              )}
            </div>
          </div>

          <div className="flex flex-col items-center">
            <h2 className="font-semibold flex items-center gap-2">
              {bottomPlayer?.name ?? 'You'} {snapshot.priorityOwner === (bottomSlot === 'p1' ? 0 : 1) && <Badge>Priority</Badge>}
            </h2>
            <BreathBar value={bottomPlayer?.breath ?? 0} />
            <p className="text-sm">Posture: {bottomPlayer?.posture ?? '-'}</p>
            <div className="flex gap-3 mt-2">
              {(bottomPlayer?.hand ?? []).map((card) => (
                <button
                  key={card.id}
                  onClick={() => handlePlay(card)}
                  disabled={status !== 'in_match' || Boolean(bottomPlayer?.revealed) || Boolean(snapshot.gameOver) || role === 'spectator'}
                  className="focus:outline-none transition hover:-translate-y-2 disabled:opacity-60"
                >
                  <CardFront card={card} />
                </button>
              ))}
            </div>
          </div>

          <div className="w-full border rounded-lg bg-white shadow-sm p-4">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Deck: {snapshot.deckCount}</span>
              <span>Discard: {snapshot.discardCount}</span>
              <span>Recent events: {logEntries.length}</span>
            </div>
          </div>

          <div className="w-full border rounded-lg bg-white shadow-sm p-4">
            <h2 className="font-semibold mb-2">Log</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm max-h-56 overflow-auto">
              {logEntries.map((entry, index) => (
                <li key={`${index}-${entry}`}>{entry}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}














