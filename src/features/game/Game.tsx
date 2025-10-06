import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BreathBar, CardBack, CardFront, FlipCard, bannerFor, floaterText } from '@/components/game/ui3';
import { useMatchConnection } from '@/hooks/useMatchConnection';
import { makeDeck, initialHandSetup, resolveRound, canPlayCard, hasAnyAvailableMove, refillHand, drawCards, MAX_BREATH, INITIAL_HAND_SIZE, HAND_SIZE as ENGINE_HAND_SIZE, type TcgCard, type PlayerState, type Priority, type ImpactKind, type DefeatTag } from '@/engine';
import { playSound } from '@/lib/sound';
import { resolveSingleAction, choosePostureForAi, createPredictor, postureCharToIndex, chooseCardForAiPredictive, chooseCardForAi } from '@/engine';
import { getAllKatas } from '@/data/katas';
import CpuPlayer from './CpuPlayer';
import ArenaPrototype from '@/components/game/ArenaPrototype';
import { useAppState } from '@/store/appState';
import PlayerInterface from './PlayerInterface';
import { Posture } from '../../engine/types'; // Adiciona a importação do tipo Posture
import { CpuPlayerState } from '@/engine/types';

const HAND_SIZE = ENGINE_HAND_SIZE; // Resolve o conflito de nome

export default function Game({ isLocal }: { isLocal: boolean }) {
  const { playerName, setPlayerName, lastMatchId, setLastMatchId, activeDeck } = useAppState();
  const [impact, setImpact] = useState<ImpactKind>('none');
  const [banner, setBanner] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<{ id: string; text: string }[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState<DefeatTag>(null);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);

  const {
    status,
    snapshot,
    events,
    playCard: playCardConnection,
    refreshMatchList,
    matchList,
  } = useMatchConnection();

  const timeoutRefs = useRef<number[]>([]);

  type SfxKey = 'select' | 'play' | 'pass' | 'atk' | 'def' | 'dodge';
  const sfxForImpact = (kind: ImpactKind): SfxKey | null => {
    switch (kind) {
      case 'p1_hits':
      case 'p2_hits':
        return 'atk';
      case 'blocked_p1':
      case 'blocked_p2':
      case 'extra_granted_p1':
      case 'extra_granted_p2':
        return 'def';
      case 'dodged_p1':
      case 'dodged_p2':
        return 'dodge';
      case 'defeat_p1':
      case 'defeat_p2':
        return 'atk';
      default:
        return null;
    }
  };

  const handleFloater = (text: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setFloaters((arr) => [...arr, { id, text }]);
    const handle = window.setTimeout(() => {
      setFloaters((arr) => arr.filter((f) => f.id !== id));
    }, 900);
    timeoutRefs.current.push(handle);
  };

  useEffect(() => {
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
    if (!events || events.length === 0) {
      setImpact('none');
      setBanner(null);
      setFloaters([]);
      return;
    }

    let cursor = 0;
    events.forEach((kind) => {
      const handle = window.setTimeout(() => {
        setImpact(kind);
        setBanner(bannerFor(kind));
        try { const s = sfxForImpact(kind); if (s) playSound(s, 0.85); } catch {}
        const floater = floaterText(kind, 'p1');
        if (floater) handleFloater(floater);
      }, cursor);
      timeoutRefs.current.push(handle);
      cursor += 450;
    });

    const clearHandle = window.setTimeout(() => {
      setBanner(null);
      setImpact('none');
      setFloaters([]);
    }, cursor + 350);
    timeoutRefs.current.push(clearHandle);
  }, [events]);

  // Slots de jogadores
  const [player1, setPlayer1] = useState({ name: 'Player 1', isCPU: false, hand: [] as TcgCard[] });
  const [player2, setPlayer2] = useState<CpuPlayerState>({
    name: 'Player 2',
    isCPU: true,
    hand: [],
    posture: 'A',
    breath: 10,
    revealed: null,
  });

  // Ajuste simples: se não houver nome, define padrão
  useEffect(() => {
    if (!player1.name) setPlayer1({ name: 'Player 1', isCPU: false, hand: [] });
    if (!player2.name) setPlayer2({ name: 'CPU', isCPU: true, hand: [], posture: 'A', breath: 10, revealed: null });
  }, []);



  // A lógica de decisão da CPU fica exclusivamente dentro do componente CpuPlayer

  useEffect(() => {
    if (events.length > 0) {
      events.forEach((event) => {
        setImpact(event);
        setBanner(`Event: ${event}`);
      });
    }
  }, [events]);

  const createLocalMatch = () => {
    const matchId = `local-${Date.now()}`;
    const match = {
      id: matchId,
      players: {
        p1: { id: 'player1', name: player1.name || 'Player 1' },
        p2: { id: 'player2', name: player2.name || 'CPU' },
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
        console.log('Local matches:', localMatches);
      });
    }
  }, [status]);

  // Função para construir o estado inicial do jogo
  function buildInitialGame(playerName: string, opponentName: string, p1Seed?: string, p2Seed?: string) {
    const deck1 = makeDeck(p1Seed || undefined);
    const deck2 = makeDeck(p2Seed || undefined);
    const p1Draw = drawCards(deck1, INITIAL_HAND_SIZE);
    const p2Draw = drawCards(deck2, INITIAL_HAND_SIZE);
    return {
      deckP1: p1Draw.deck,
      deckP2: p2Draw.deck,
      p1: { name: playerName, posture: 'A', breath: MAX_BREATH, hand: p1Draw.drawn, revealed: null } as PlayerState,
      p2: { name: opponentName, posture: 'B', breath: MAX_BREATH, hand: p2Draw.drawn, revealed: null } as PlayerState,
    };
  }

  const initialGame = useMemo(() => {
    const katas = getAllKatas();
    const aiSeed = katas.length ? katas[Math.floor(Math.random() * katas.length)].seed : undefined;
    const p1Seed = activeDeck?.seed || undefined;
    return buildInitialGame(player1.name || 'Player 1', player2.name || 'CPU', p1Seed, aiSeed);
  }, [player1.name, player2.name, activeDeck?.seed]);

  const [deckP1, setDeckP1] = useState<TcgCard[]>(() => initialGame.deckP1.slice());
  const [deckP2, setDeckP2] = useState<TcgCard[]>(() => initialGame.deckP2.slice());
  const [discard, setDiscard] = useState<TcgCard[]>([]);
  const [p1, setP1] = useState<PlayerState>(() => ({ ...initialGame.p1, hand: initialGame.p1.hand.slice() }));
  const [p2, setP2] = useState<PlayerState>(() => ({ ...initialGame.p2, hand: initialGame.p2.hand.slice() }));
  const [priorityOwner, setPriorityOwner] = useState<Priority>(0);
  const [p1SelectedCard, setP1SelectedCard] = useState<TcgCard | null>(null);
  const [p2SelectedCard, setP2SelectedCard] = useState<TcgCard | null>(null);
  const [extraPending, setExtraPending] = useState<'none' | 'p1' | 'p2'>('none');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedP2Idx, setSelectedP2Idx] = useState<number | null>(null);
  const p1SelectTimer = useRef<number | null>(null);
  const p2SelectTimer = useRef<number | null>(null);
  const [invalidIdx, setInvalidIdx] = useState<number | null>(null);
  const [invalidP2Idx, setInvalidP2Idx] = useState<number | null>(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [showP1Facedown, setShowP1Facedown] = useState(false);
  const [showP2Facedown, setShowP2Facedown] = useState(false);
  const [p1Passed, setP1Passed] = useState(false);
  const [p2Passed, setP2Passed] = useState(false);
  const [hoverCard, setHoverCard] = useState<TcgCard | null>(null);

  const handlePassTurn = (player: 'player1' | 'player2') => {
    try { playSound('pass', 0.8); } catch {}
    setBanner(`${player} passed the turn.`);
    if (player === 'player1') setP1Passed(true); else setP2Passed(true);

    // If opponent has already confirmed a card (single reveal), resolve immediately as a single-action round
    if (extraPending === 'none') {
      if (player === 'player2' && p1SelectedCard && !p2SelectedCard) {
        resolveSingleWhenOtherPasses('p1');
        return;
      }
      if (player === 'player1' && p2SelectedCard && !p1SelectedCard) {
        resolveSingleWhenOtherPasses('p2');
        return;
      }
    }

    // Otherwise just flip priority for now (future: both-pass logic)
    setPriorityOwner(prev => (prev === 0 ? 1 : 0));
  };

  // Resolve a single-action when one side confirmed and the other passed (not an extra window)
  const resolveSingleWhenOtherPasses = (actor: 'p1' | 'p2') => {
    // Safety: require a selected card from the actor
    const selected = actor === 'p1' ? p1SelectedCard : p2SelectedCard;
    if (!selected) return;

    // Visually reveal and remove from hand
    if (actor === 'p1') {
      setP1((s) => ({ ...s, revealed: selected, hand: s.hand.filter((c) => c.id !== selected.id) }));
      setShowP1Facedown(false);
    } else {
      setP2((s) => ({ ...s, revealed: selected, hand: s.hand.filter((c) => c.id !== selected.id) }));
      setShowP2Facedown(false);
    }
    setWaitingForOpponent(false);

    const actorState = actor === 'p1' ? { ...p1, revealed: selected } : { ...p2, revealed: selected };
    const targetState = actor === 'p1' ? p2 : p1;
    const res = resolveSingleAction(actorState, targetState, actor, { free: false });

    // Timeline of events
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
    let cursor = 0;
    const step = 450;
    const oriented: ImpactKind[] = res.events.length ? res.events : ['none' as ImpactKind];
    oriented.forEach((kind) => {
      const h = window.setTimeout(() => {
        setImpact(kind);
        setBanner(bannerFor(kind));
        try { const s = sfxForImpact(kind); if (s) playSound(s, 0.85); } catch {}
        const floater = floaterText(kind, 'p1');
        if (floater) handleFloater(floater);
      }, cursor);
      timeoutRefs.current.push(h);
      cursor += step;
    });
    const endHandle = window.setTimeout(() => {
      setImpact('none'); setBanner(null); setFloaters([]);
    }, cursor + 350);
    timeoutRefs.current.push(endHandle);

    // Apply results at end
    const finalizeHandle = window.setTimeout(() => {
      if (actor === 'p1') { setP1(res.actor); setP2(res.target); }
      else { setP2(res.actor); setP1(res.target); }
      setDiscard((d) => [...d, ...res.consumedCards.p1, ...res.consumedCards.p2]);
      setLog((entries) => [...res.log, ...entries]);

      // Clear selected states
      setP1SelectedCard(null);
      setP2SelectedCard(null);
      setSelectedIdx(null);
      setSelectedP2Idx(null);
      setP1Passed(false);
      setP2Passed(false);

      if (res.defeated) {
        setExtraPending('none');
        setGameOver(res.defeated);
        setShowGameOverModal(true);
        return;
      }

      const anotherExtra = res.events.some((k) => k === 'extra_granted_p1' || k === 'extra_granted_p2');
      if (anotherExtra) {
        const who = res.events.includes('extra_granted_p1') ? 'p1' : 'p2';
        setExtraPending(who);
      } else {
        setExtraPending('none');
        // refill both hands deterministically from res state
        const p1NextState = actor === 'p1' ? res.actor : res.target;
        const p2NextState = actor === 'p1' ? res.target : res.actor;
        const p1Refill = refillHand(p1NextState.hand, deckP1.slice(), HAND_SIZE);
        const p2Refill = refillHand(p2NextState.hand, deckP2.slice(), HAND_SIZE);
        setDeckP1(p1Refill.deck);
        setDeckP2(p2Refill.deck);
        setP1({ ...p1NextState, hand: p1Refill.hand, revealed: null });
        setP2({ ...p2NextState, hand: p2Refill.hand, revealed: null });
        // switch priority like end of round
        setPriorityOwner(prev => (prev === 0 ? 1 : 0));

        // After refills, evaluate no-move defeat condition deterministically
        const p1NoMoves = !hasAnyAvailableMove({ ...p1NextState, hand: p1Refill.hand }, p1Refill.deck.length);
        const p2NoMoves = !hasAnyAvailableMove({ ...p2NextState, hand: p2Refill.hand }, p2Refill.deck.length);
        if (p1NoMoves || p2NoMoves) {
          const loser: DefeatTag = p1NoMoves && p2NoMoves ? 'both' : p1NoMoves ? 'p1' : 'p2';
          setGameOver(loser);
          setShowGameOverModal(true);
          setLog((entries) => [
            ...(loser === 'both'
              ? ['Both players have no available moves. Double defeat.']
              : [(loser === 'p1' ? p1NextState.name : p2NextState.name) + ' has no available moves and loses.']
            ),
            ...entries,
          ]);
        }
      }
    }, cursor + 350);
    timeoutRefs.current.push(finalizeHandle);
  };

  // Função para selecionar uma carta (Classic mode)
  const clearTimer = (ref: React.MutableRefObject<number | null>) => {
    if (ref.current) { window.clearTimeout(ref.current); ref.current = null; }
  };

  const scheduleClear = (ref: React.MutableRefObject<number | null>, cb: () => void, ms: number) => {
    clearTimer(ref);
    ref.current = window.setTimeout(cb, ms) as unknown as number;
  };

  const confirmSelection = (player: 'player1' | 'player2', card: TcgCard): boolean => {
    // Janela de extra: exige apenas posture requirement (free)
    if (extraPending !== 'none') {
      const who = extraPending;
      const isActorP1 = who === 'p1';
      if ((player === 'player1' && isActorP1) || (player === 'player2' && !isActorP1)) {
        const current = player === 'player1' ? p1 : p2;
        const requiresOk = !card.requires || card.requires === current.posture;
        if (!requiresOk) {
          setBanner(`${current.name} cannot counter: wrong posture (current: ${current.posture}, required: ${card.requires}).`);
          // feedback visual (shake) na mão do ator, se for P1
          if (player === 'player1') {
            const idx = p1.hand.findIndex((c) => c.id === card.id);
            if (idx !== -1) { setInvalidIdx(idx); window.setTimeout(() => setInvalidIdx(null), 400); }
          }
          return false;
        }
  try { playSound('play', 0.85); } catch {}
  playExtraAction(card, who);
        if (player === 'player1') setSelectedIdx(null); else setSelectedP2Idx(null);
        return true;
      }
    }

    const currentPlayer = player === 'player1' ? p1 : p2;
    if (!canPlayCard(currentPlayer, card)) {
      const wrongPosture = Boolean(card.requires) && card.requires !== currentPlayer.posture;
      if (player === 'player1') {
        const idx = p1.hand.findIndex((c) => c.id === card.id);
        if (idx !== -1) { setInvalidIdx(idx); window.setTimeout(() => setInvalidIdx(null), 400); }
      } else {
        const idx = p2.hand.findIndex((c) => c.id === card.id);
        if (idx !== -1) { setInvalidP2Idx(idx); window.setTimeout(() => setInvalidP2Idx(null), 400); }
      }
      const reason = !card.requires || card.requires === currentPlayer.posture ? 'Not enough breath' : `Wrong posture (current: ${currentPlayer.posture}, required: ${card.requires})`;
      setBanner(`${currentPlayer.name} cannot play ${card.type} card. ${reason}.`);
      return false;
    }
    if (player === 'player1') {
      setP1SelectedCard(card);
      setWaitingForOpponent(true);
      setShowP1Facedown(true);
      setLog((entries) => [`${currentPlayer.name} confirmed ${card.type}.`, ...entries]);
    } else {
      setP2SelectedCard(card);
      setShowP2Facedown(true);
    }
    try { playSound('play', 0.85); } catch {}
    setBanner(`${currentPlayer.name} selected ${card.type}.`);
    return true;
  };

  const handlePlayCard = (card: TcgCard, player: 'player1' | 'player2') => {
    const currentPlayer = player === 'player1' ? p1 : p2;

    // Janela de extra: ação gratuita (ignora breath, só respeita postura requerida)
    if (extraPending !== 'none') {
      const who = extraPending;
      const isActorP1 = who === 'p1';
      if ((player === 'player1' && isActorP1) || (player === 'player2' && !isActorP1)) {
        const requiresOk = !card.requires || card.requires === currentPlayer.posture;
        if (!requiresOk) {
          setBanner(`${currentPlayer.name} cannot counter: wrong posture (current: ${currentPlayer.posture}, required: ${card.requires}).`);
          return;
        }
        playExtraAction(card, who);
        return;
      } else {
        // Não é a sua janela de extra: treme a carta e ignora
        if (player === 'player1') {
          const idx = p1.hand.findIndex((c) => c.id === card.id);
          if (idx !== -1) { setInvalidIdx(idx); window.setTimeout(() => setInvalidIdx(null), 400); }
        } else {
          const idx = p2.hand.findIndex((c) => c.id === card.id);
          if (idx !== -1) { setInvalidP2Idx(idx); window.setTimeout(() => setInvalidP2Idx(null), 400); }
        }
        setBanner('Counter window: aguarde o oponente ou reaja quando for a sua vez.');
        return;
      }
    }

    // CPU confirma imediatamente; humano usa 2-cliques
    const isCpu = player === 'player2' && player2.isCPU;
    if (isCpu) {
      confirmSelection(player, card);
      return;
    }

    // Humano: 1º clique destaca, 2º confirma (com opção de cancelar antes do oponente confirmar)
    if (player === 'player1') {
      const idx = p1.hand.findIndex((c) => c.id === card.id);
      if (idx === -1) return;
      // Se já confirmou esta carta e o oponente ainda não confirmou, permitir cancelar ao clicar novamente
      if (p1SelectedCard && p1SelectedCard.id === card.id && !p2SelectedCard && extraPending === 'none') {
        setP1SelectedCard(null);
        setWaitingForOpponent(false);
        setShowP1Facedown(false);
        setBanner('Selection canceled.');
        return;
      }
      if (selectedIdx === idx) {
        const ok = confirmSelection('player1', card);
        if (ok) { clearTimer(p1SelectTimer); }
      } else {
        setSelectedIdx(idx);
        try { playSound('select', 0.7); } catch {}
        scheduleClear(p1SelectTimer, () => setSelectedIdx(null), 3500);
      }
    } else {
      const idx = p2.hand.findIndex((c) => c.id === card.id);
      if (idx === -1) return;
      if (selectedP2Idx === idx) {
        const ok = confirmSelection('player2', card);
        if (ok) { clearTimer(p2SelectTimer); }
      } else {
        setSelectedP2Idx(idx);
        try { playSound('select', 0.7); } catch {}
        scheduleClear(p2SelectTimer, () => setSelectedP2Idx(null), 3500);
      }
    }
  };

  const handleResolveRound = () => {
    if (!p1SelectedCard || !p2SelectedCard) {
      setBanner('Both players must select a card to resolve the round.');
      return;
    }

    // Set revealed cards
    const nextP1 = { ...p1, revealed: p1SelectedCard };
    const nextP2 = { ...p2, revealed: p2SelectedCard };

    const result = resolveRound(nextP1, nextP2, priorityOwner);
    setP1(result.p1);
    setP2(result.p2);
    setPriorityOwner(result.nextPriorityOwner);

    // Timeline de eventos (animações e banners)
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
    let cursor = 0;
    const step = 450;
  const oriented: ImpactKind[] = result.events.length ? result.events : ['none' as ImpactKind];
    oriented.forEach((kind) => {
      const h = window.setTimeout(() => {
        setImpact(kind);
        setBanner(bannerFor(kind));
        try { const s = sfxForImpact(kind); if (s) playSound(s, 0.85); } catch {}
        const floater = floaterText(kind, 'p1');
        if (floater) handleFloater(floater);
      }, cursor);
      timeoutRefs.current.push(h);
      cursor += step;
    });
    const clearHandle = window.setTimeout(() => {
      setImpact('none');
      setBanner(null);
      setFloaters([]);
    }, cursor + 350);
    timeoutRefs.current.push(clearHandle);

    // Ao final da timeline, aplicar descarte/log/refill e decidir extra
    const finalizeHandle = window.setTimeout(() => {
      // descarte e log
      setLog((entries) => [...result.log, ...entries]);
      setDiscard((d) => [...d, ...result.consumedCards.p1, ...result.consumedCards.p2]);

      // extra window
      const hasExtra = result.events.some((k) => k === 'extra_granted_p1' || k === 'extra_granted_p2');
      if (hasExtra && !result.defeated) {
        const who = result.events.includes('extra_granted_p1') ? 'p1' : 'p2';
        setExtraPending(who);
      } else {
        setExtraPending('none');
        // refill mãos se ninguém caiu
        if (!result.defeated) {
          // Compute refills synchronously and apply
          const p1Refill = refillHand(result.p1.hand, deckP1.slice(), HAND_SIZE);
          const p2Refill = refillHand(result.p2.hand, deckP2.slice(), HAND_SIZE);
          setDeckP1(p1Refill.deck);
          setDeckP2(p2Refill.deck);
          setP1({ ...result.p1, hand: p1Refill.hand });
          setP2({ ...result.p2, hand: p2Refill.hand });

          // After refills, check no-move defeat condition deterministically
          const p1NoMoves = !hasAnyAvailableMove({ ...result.p1, hand: p1Refill.hand }, p1Refill.deck.length);
          const p2NoMoves = !hasAnyAvailableMove({ ...result.p2, hand: p2Refill.hand }, p2Refill.deck.length);
          if (p1NoMoves || p2NoMoves) {
            const loser: DefeatTag = p1NoMoves && p2NoMoves ? 'both' : p1NoMoves ? 'p1' : 'p2';
            setGameOver(loser);
            setShowGameOverModal(true);
            setLog((entries) => [
              ...(loser === 'both'
                ? ['Both players have no available moves. Double defeat.']
                : [(loser === 'p1' ? result.p1.name : result.p2.name) + ' has no available moves and loses.']
              ),
              ...entries,
            ]);
          }
        }
      }

      // derrota -> finalizar partida
      if (result.defeated) {
        setGameOver(result.defeated);
        setShowGameOverModal(true);
      }
    }, cursor + 350);
    timeoutRefs.current.push(finalizeHandle);

    // Clear selected cards
    setP1SelectedCard(null);
    setP2SelectedCard(null);
  };

  // Quando ambos selecionarem, primeiro revela simultaneamente na mesa e depois resolve a rodada
  useEffect(() => {
    if (!p1SelectedCard || !p2SelectedCard) return;
    if (extraPending !== 'none') return;

    const needReveal =
      !p1.revealed || p1.revealed.id !== p1SelectedCard.id ||
      !p2.revealed || p2.revealed.id !== p2SelectedCard.id;

    if (needReveal) {
      // Revela simultaneamente e remove das mãos
      setP1((s) => ({ ...s, revealed: p1SelectedCard, hand: s.hand.filter((c) => c.id !== p1SelectedCard.id) }));
      setP2((s) => ({ ...s, revealed: p2SelectedCard, hand: s.hand.filter((c) => c.id !== p2SelectedCard.id) }));
      // Limpa o destaque visual ao revelar
      setSelectedIdx(null);
      setSelectedP2Idx(null);
      setWaitingForOpponent(false);
      setShowP1Facedown(false);
      setShowP2Facedown(false);
      const t = window.setTimeout(() => handleResolveRound(), 500);
      timeoutRefs.current.push(t);
    } else {
      setWaitingForOpponent(false);
      handleResolveRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1SelectedCard?.id, p2SelectedCard?.id, extraPending]);

  // Executa uma ação extra (counter) usando resolveSingleAction (free: true)
  const playExtraAction = (card: TcgCard, actor: 'p1' | 'p2') => {
    const actorState = actor === 'p1' ? p1 : p2;
    const targetState = actor === 'p1' ? p2 : p1;
    const tempActor = { ...actorState, revealed: card } as PlayerState;

    // Remover a carta da mão visualmente do ator
    if (actor === 'p1') setP1((s) => ({ ...s, hand: s.hand.filter((c) => c.id !== card.id), revealed: card }));
    else setP2((s) => ({ ...s, hand: s.hand.filter((c) => c.id !== card.id), revealed: card }));

    const res = resolveSingleAction(tempActor, targetState, actor, { free: true });

    // Timeline de eventos
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
    let cursor = 0;
    const step = 450;
  const oriented: ImpactKind[] = res.events.length ? res.events : ['none' as ImpactKind];
    oriented.forEach((kind) => {
      const h = window.setTimeout(() => {
        setImpact(kind);
        setBanner(bannerFor(kind));
        try { const s = sfxForImpact(kind); if (s) playSound(s, 0.85); } catch {}
        const floater = floaterText(kind, 'p1');
        if (floater) handleFloater(floater);
      }, cursor);
      timeoutRefs.current.push(h);
      cursor += step;
    });
    const endHandle = window.setTimeout(() => {
      setImpact('none'); setBanner(null); setFloaters([]);
    }, cursor + 350);
    timeoutRefs.current.push(endHandle);

    // Ao final: aplicar estados, descarte, log e decidir próximo passo
    const finalizeHandle = window.setTimeout(() => {
      // Aplicar estados retornados
      if (actor === 'p1') { setP1(res.actor); setP2(res.target); }
      else { setP2(res.actor); setP1(res.target); }
      // descarte e log
      setDiscard((d) => [...d, ...res.consumedCards.p1, ...res.consumedCards.p2]);
      setLog((entries) => [...res.log, ...entries]);

      const anotherExtra = res.events.some((k) => k === 'extra_granted_p1' || k === 'extra_granted_p2');
      if (res.defeated) {
        setExtraPending('none');
        setGameOver(res.defeated);
        setShowGameOverModal(true);
        return;
      }
      if (anotherExtra) {
        const who = res.events.includes('extra_granted_p1') ? 'p1' : 'p2';
        setExtraPending(who);
      } else {
        setExtraPending('none');
        // refill mãos após encerrar cadeia de extra
        setP1((cur) => {
          const draw = refillHand(cur.hand, deckP1.slice(), HAND_SIZE);
          setDeckP1(draw.deck);
          return { ...cur, hand: draw.hand, revealed: null };
        });
        setP2((cur) => {
          const draw = refillHand(cur.hand, deckP2.slice(), HAND_SIZE);
          setDeckP2(draw.deck);
          return { ...cur, hand: draw.hand, revealed: null };
        });
        // After refills, check for no-move defeat using latest state
        const h = window.setTimeout(() => {
          const p1NoMoves = !hasAnyAvailableMove(p1, deckP1.length);
          const p2NoMoves = !hasAnyAvailableMove(p2, deckP2.length);
          if (p1NoMoves || p2NoMoves) {
            const loser: DefeatTag = p1NoMoves && p2NoMoves ? 'both' : p1NoMoves ? 'p1' : 'p2';
            setGameOver(loser);
            setShowGameOverModal(true);
            setLog((entries) => [
              ...(loser === 'both'
                ? ['Both players have no available moves. Double defeat.']
                : [(loser === 'p1' ? p1.name : p2.name) + ' has no available moves and loses.']
              ),
              ...entries,
            ]);
          }
        }, 0);
        timeoutRefs.current.push(h);
      }
    }, cursor + 350);
    timeoutRefs.current.push(finalizeHandle);
  };

  // Atualizar placar Bo3 quando a partida termina
  useEffect(() => {
    if (!gameOver) return;
    if (gameOver === 'p1') setP2Wins((w) => w + 1);
    else if (gameOver === 'p2') setP1Wins((w) => w + 1);
    else if (gameOver === 'both') { setP1Wins((w) => w + 1); setP2Wins((w) => w + 1); }
  }, [gameOver]);

  const resetToNewGame = () => {
    // recriar baralhos e mãos iniciais
    const katas = getAllKatas();
    const aiSeed = katas.length ? katas[Math.floor(Math.random() * katas.length)].seed : undefined;
    const p1Seed = activeDeck?.seed || undefined;
    const fresh = buildInitialGame(player1.name || 'Player 1', player2.name || 'CPU', p1Seed, aiSeed);
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
    setDeckP1(fresh.deckP1.slice());
    setDeckP2(fresh.deckP2.slice());
    setDiscard([]);
    setP1({ ...fresh.p1, hand: fresh.p1.hand.slice(), revealed: null });
    setP2({ ...fresh.p2, hand: fresh.p2.hand.slice(), revealed: null });
    setPriorityOwner((Math.random() < 0.5 ? 0 : 1) as Priority);
    setP1SelectedCard(null); setP2SelectedCard(null);
    setSelectedIdx(null); setSelectedP2Idx(null);
    setWaitingForOpponent(false);
    setP1Passed(false); setP2Passed(false);
    setShowP1Facedown(false); setShowP2Facedown(false);
    setImpact('none'); setBanner(null); setFloaters([]);
    setLog([]);
    setExtraPending('none');
    setGameOver(null); setShowGameOverModal(false);
  };

  const restartSeries = () => {
    setP1Wins(0); setP2Wins(0);
    resetToNewGame();
  };

  const gameOverLabel = () => {
    if (!gameOver) return null;
    if (gameOver === 'both') return 'Ambos ficaram sem fôlego';
    if (gameOver === 'p1') return `${p1.name} ficou sem fôlego`;
    return `${p2.name} ficou sem fôlego`;
  };

  // CPU joga automaticamente a extra quando for o turno de extra
  useEffect(() => {
    if (extraPending === 'p2' && player2.isCPU) {
      const playable = p2.hand.find((c) => !c.requires || c.requires === p2.posture);
      if (playable) {
        playExtraAction(playable, 'p2');
      } else {
        // se não houver carta adequada, encerra janela de extra
        setExtraPending('none');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraPending, p2.hand.length, p2.posture]);

  const handleDrawCard = (player: 'player1' | 'player2') => {
    const playerState = player === 'player1' ? p1 : p2;
    const playerDeck = player === 'player1' ? deckP1 : deckP2;
    const setPlayerState = player === 'player1' ? setP1 : setP2;
    const setPlayerDeck = player === 'player1' ? setDeckP1 : setDeckP2;

    // If opponent already confirmed (no extra), drawing counts as a pass to avoid stalls
    const opponentHasPending = extraPending === 'none' && (
      (player === 'player1' && !!p2SelectedCard && !p1SelectedCard) ||
      (player === 'player2' && !!p1SelectedCard && !p2SelectedCard)
    );
    if (opponentHasPending) {
      handlePassTurn(player);
      return;
    }

    if (playerState.hand.length >= HAND_SIZE) {
      setBanner(`${playerState.name} cannot draw more cards. Hand is full.`);
      return;
    }

    const { drawn, deck } = drawCards(playerDeck, 1);
    if (drawn.length > 0) {
      setPlayerState(prev => ({ ...prev, hand: [...prev.hand, ...drawn] }));
      setPlayerDeck(deck);
      try { playSound('select', 0.6); } catch {}
      setBanner(`${playerState.name} drew a card.`);
    } else {
      try { playSound('pass', 0.7); } catch {}
      setBanner(`${playerState.name} has no cards left to draw.`);
      // If cannot draw and also cannot play anything, it's an immediate defeat
      const noPlayable = !playerState.hand.some((c) => canPlayCard(playerState, c));
      if (noPlayable) {
        const loser: DefeatTag = player === 'player1' ? 'p1' : 'p2';
        setGameOver(loser);
        setShowGameOverModal(true);
        setLog((entries) => [
          `${playerState.name} has no available moves (no draw, no playable cards). Defeat.`,
          ...entries,
        ]);
      }
    }
  };

  const handleSetPosture = (posture: 'A' | 'B' | 'C', player: 'player1' | 'player2') => {
    // Block posture change if opponent has already confirmed and we're awaiting this player's action (no extra)
    const opponentHasPending = extraPending === 'none' && (
      (player === 'player1' && !!p2SelectedCard && !p1SelectedCard) ||
      (player === 'player2' && !!p1SelectedCard && !p2SelectedCard)
    );
    if (opponentHasPending) {
      setBanner('Confirm or pass before changing posture.');
      return;
    }
    if (player === 'player1') {
      setP1((prev) => ({ ...prev, posture }));
    } else {
      setP2((prev) => ({ ...prev, posture }));
    }
  };

  useEffect(() => {
    if (isLocal) {
      setPlayer2((prev) => ({ ...prev, isCPU: true }));
    } else {
      setPlayer2((prev) => ({ ...prev, isCPU: false }));
    }
  }, [isLocal]);

  // Renderização
  return (
    <div>
      <h1>Arena Central</h1>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <button
          onClick={() => setPlayer2((prev) => ({ ...prev, isCPU: !prev.isCPU }))}
          className="btn bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md"
        >
          {player2.isCPU ? 'Disable CPU' : 'Enable CPU'}
        </button>
      </div>
      <ArenaPrototype
        p1={{ ...p1, facedownCount: p1.hand.length }}
        p2={{ ...p2, facedownCount: p2.hand.length }}
        p1Wins={p1Wins}
        p2Wins={p2Wins}
        deckP1Count={deckP1.length}
        deckP2Count={deckP2.length}
        priorityOwner={priorityOwner}
        log={log}
        extraPending={extraPending}
        selectedIdx={selectedIdx}
        selectedP2Idx={selectedP2Idx}
        invalidIdx={invalidIdx}
        invalidP2Idx={invalidP2Idx}
        hoverCard={hoverCard}
        waitingForOpponent={waitingForOpponent}
        showP1Facedown={showP1Facedown}
        showP2Facedown={showP2Facedown}
        onClickP1Card={(card) => handlePlayCard(card, 'player1')}
        onClickP2Card={(card) => handlePlayCard(card, 'player2')}
        onHoverCard={setHoverCard}
        onClickSetP1Posture={(posture) => handleSetPosture(posture, 'player1')}
        onClickSetP2Posture={(posture) => handleSetPosture(posture, 'player2')}
        onClickDraw={() => handleDrawCard('player1')}
        onClickDrawP2={() => handleDrawCard('player2')}
      />
      {showGameOverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Match Over</h3>
            <p className="mb-2">{gameOverLabel()}</p>
            <div className="mb-4 text-sm">Score (Bo3): {p1.name} {p1Wins} x {p2Wins} {p2.name}</div>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setShowGameOverModal(false)} className="bg-slate-200 text-slate-700 hover:bg-slate-300">
                Close
              </Button>
              {Math.max(p1Wins, p2Wins) < 2 ? (
                <Button onClick={() => { setShowGameOverModal(false); resetToNewGame(); }} className="bg-emerald-500 hover:bg-emerald-400">
                  Next Game
                </Button>
              ) : (
                <Button onClick={() => { restartSeries(); setShowGameOverModal(false); }} className="bg-emerald-600 hover:bg-emerald-500">
                  Restart Series
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      <div>
        <PlayerInterface
          player={p1}
          onPlayCard={(card) => handlePlayCard(card, 'player1')}
          onSetPosture={(posture) => handleSetPosture(posture, 'player1')}
          selectedCard={p1SelectedCard}
        />
        {player2.isCPU ? (
          <CpuPlayer
            player={p2}
            onPlayCard={(card) => handlePlayCard(card, 'player2')}
            onSetPosture={(posture) => handleSetPosture(posture, 'player2')}
            onDraw={() => handleDrawCard('player2')}
            onPass={() => handlePassTurn('player2')}
            selectedCard={p2SelectedCard}
          />
        ) : (
          <PlayerInterface
            player={p2}
            onPlayCard={(card) => handlePlayCard(card, 'player2')}
            onSetPosture={(posture) => handleSetPosture(posture, 'player2')}
            selectedCard={p2SelectedCard}
          />
        )}
        <button onClick={handleResolveRound} disabled={!p1SelectedCard || !p2SelectedCard}>
          Resolver Rodada
        </button>
      </div>
    </div>
  );
}