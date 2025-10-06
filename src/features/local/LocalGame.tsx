import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import ArenaPrototype from '@/components/game/ArenaPrototype';
import {
  makeDeck,
  initialHandSetup,
  resolveRound,
  canPlayCard,
  refillHand,
  drawCards,
  MAX_BREATH,
  INITIAL_HAND_SIZE,
  HAND_SIZE,
  type TcgCard,
  type PlayerState,
  type Priority,
  type ImpactKind,
  type DefeatTag,
} from '@/engine';
import { resolveSingleAction, choosePostureForAi, createPredictor, postureCharToIndex, chooseCardForAiPredictive, chooseCardForAi } from '@/engine';
import { BreathBar, CardFront, CardBack, FlipCard, bannerFor, floaterText } from '@/components/game/ui3';
import { playSound } from '@/lib/sound';
import { useAppState } from '@/store/appState';
import { getAllKatas } from '@/data/katas';

type UiPlayerState = PlayerState & { facedownCount?: number };
type ImpactSide = 'p1' | 'p2';

declare global {
  interface Window { __breath_hotseat_hint?: boolean; }
}

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

export default function LocalGame() {
  const { playerName, mode: appMode, seed: appSeed, setSeed: setAppSeed, activeDeck } = useAppState();
  const initialGame = useMemo(() => {
    const katas = getAllKatas();
    const aiSeed = katas.length ? katas[Math.floor(Math.random() * katas.length)].seed : undefined;
    return buildInitialGame(playerName || 'You', 'Opponent', activeDeck?.seed, aiSeed);
  }, [playerName, activeDeck?.seed]);

  const [deckP1, setDeckP1] = useState<TcgCard[]>(() => initialGame.deckP1.slice());
  const [deckP2, setDeckP2] = useState<TcgCard[]>(() => initialGame.deckP2.slice());
  const [discard, setDiscard] = useState<TcgCard[]>([]);
  const [aiEnabled, setAiEnabled] = useState(true);

  const [p1, setP1] = useState<UiPlayerState>(() => ({ ...initialGame.p1, hand: initialGame.p1.hand.slice(), facedownCount: initialGame.p1.hand.length }));
  const [p2, setP2] = useState<UiPlayerState>(() => ({ ...initialGame.p2, hand: initialGame.p2.hand.slice(), facedownCount: initialGame.p2.hand.length }));

  const [log, setLog] = useState<string[]>([]);
  const [priorityOwner, setPriorityOwner] = useState<Priority>(() => (Math.random() < 0.5 ? 0 : 1) as Priority);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedP2Idx, setSelectedP2Idx] = useState<number | null>(null);
  const [p1Flipped, setP1Flipped] = useState(false);
  const [p2Flipped, setP2Flipped] = useState(false);
  const [impact, setImpact] = useState<ImpactKind>('none');
  const [animBanner, setAnimBanner] = useState<string | null>(null);
  const [p1Floaters, setP1Floaters] = useState<{ id: string; text: string }[]>([]);
  const [p2Floaters, setP2Floaters] = useState<{ id: string; text: string }[]>([]);
  const [gameOver, setGameOver] = useState<DefeatTag>(null);
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);
  const [hoverCard, setHoverCard] = useState<TcgCard | null>(null);
  const [extraPending, setExtraPending] = useState<'none' | 'p1' | 'p2'>('none');
  const [p1Passed, setP1Passed] = useState(false);
  const [p2Passed, setP2Passed] = useState(false);
  const [p1PostureChosen, setP1PostureChosen] = useState(false);
  const [p2PostureChosen, setP2PostureChosen] = useState(false);

  const DISABLE_TIMERS = true; // set true to disable auto timeouts for testing
  const DECISION_WINDOW_MS = 15000;
  const [decisionDeadline, setDecisionDeadline] = useState<number | null>(null);
  const [decisionProgress, setDecisionProgress] = useState<number>(1);

  const predictorRef = useRef<ReturnType<typeof createPredictor> | null>(null);
  if (!predictorRef.current) predictorRef.current = createPredictor();

    // Selection auto-cancel timers
  const p1SelectTimer = useRef<number | null>(null);
  const p2SelectTimer = useRef<number | null>(null);
  const resetTimer = (timerRef: React.MutableRefObject<number | null>, callback: () => void, delay: number) => {
    if (DISABLE_TIMERS) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(callback, delay) as unknown as number;
  };
  const resetSelectionTimer = () => resetTimer(p1SelectTimer, () => setSelectedIdx(null), 3500);
  const resetP2SelectionTimer = () => resetTimer(p2SelectTimer, () => setSelectedP2Idx(null), 3500);
  const p1DecisionTimer = useRef<number | null>(null);
  const p2DecisionTimer = useRef<number | null>(null);
  const extraDecisionTimer = useRef<number | null>(null);

  const clearRoundDecisionTimers = () => {
    if (p1DecisionTimer.current) { window.clearTimeout(p1DecisionTimer.current); p1DecisionTimer.current = null; }
    if (p2DecisionTimer.current) { window.clearTimeout(p2DecisionTimer.current); p2DecisionTimer.current = null; }
  };
  const clearExtraDecisionTimer = () => {
    if (extraDecisionTimer.current) { window.clearTimeout(extraDecisionTimer.current); extraDecisionTimer.current = null; }
  };

  const pushFloater = (side: ImpactSide, text: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    if (side === 'p1') setP1Floaters((arr) => [...arr, { id, text }]);
    else setP2Floaters((arr) => [...arr, { id, text }]);
    window.setTimeout(() => {
      if (side === 'p1') setP1Floaters((arr) => arr.filter((f) => f.id !== id));
      else setP2Floaters((arr) => arr.filter((f) => f.id !== id));
    }, 900);
  };
  const attachFloaters = (kind: ImpactKind) => {
    const f1 = floaterText(kind, 'p1');
    const f2 = floaterText(kind, 'p2');
    if (f1) pushFloater('p1', f1);
    if (f2) pushFloater('p2', f2);
  };

  
  

  const clickP1Card = (card: TcgCard, idx: number) => {
    if (!p1PostureChosen) setP1PostureChosen(true); if (!p2PostureChosen) setP2PostureChosen(true);
    if (gameOver) return;
    if (extraPending !== 'none' && extraPending !== 'p1') return;
    if (p1.revealed && extraPending !== 'p1') return;
    if (p1Passed) return;

    if (extraPending === 'p1') {
      const requiresOk = !card.requires || card.requires === p1.posture;
      if (!requiresOk) { setSelectedIdx(idx); try { playSound('select'); } catch {} return; }
      playExtraAction(card, 'p1'); return;
    }

    if (selectedIdx === idx) {
      if (!canPlayCard(p1, card)) { try { playSound('select'); } catch {} return; }
      setSelectedIdx(null);
      setP1((state) => {
        const hand = state.hand.slice();
        if (idx >= 0 && idx < hand.length) hand.splice(idx, 1);
        return { ...state, revealed: card, hand };
      });
      try { playSound('play'); } catch {}
      setP1Flipped(false); setP2Flipped(false); setImpact('none'); setAnimBanner(null);
      try { predictorRef.current?.observe({ posture: postureCharToIndex(p1.posture), breath: p1.breath, action: card.type as any }); } catch {}
      if (aiEnabled && !p2.revealed) {
        const choice = chooseCardForAiPredictive(p2, p1, predictorRef.current!);
        if (choice) {
          setP2((state) => ({ ...state, revealed: choice, hand: state.hand.filter((c) => c.id !== choice.id), facedownCount: Math.max(0, (state.facedownCount ?? state.hand.length) - 1) }));
        } else {
          if (deckP2.length > 0 && p2.hand.length < HAND_SIZE) drawOneP2(); else setP2Passed(true);
        }
      }
      resetSelectionTimer();
    } else {
      setSelectedIdx(idx);
      try { playSound('select'); } catch {}
      resetSelectionTimer();
    }
  };

  const clickP2Card = (card: TcgCard, idx: number) => {
    if (gameOver || aiEnabled) return;
    if (!p1PostureChosen) setP1PostureChosen(true); if (!p2PostureChosen) setP2PostureChosen(true);
    if (extraPending !== 'none' && extraPending !== 'p2') return;
    if (p2.revealed && extraPending !== 'p2') return;

    if (extraPending === 'p2') {
      const requiresOk = !card.requires || card.requires === p2.posture;
      if (!requiresOk) { setSelectedP2Idx(idx); return; }
      playExtraAction(card, 'p2'); return;
    }

    if (selectedP2Idx === idx) {
      if (!canPlayCard(p2, card)) { setSelectedP2Idx(idx); return; }
      setSelectedP2Idx(null);
      setP2((state) => {
        const hand = state.hand.slice();
        if (idx >= 0 && idx < hand.length) hand.splice(idx, 1);
        return { ...state, revealed: card, hand };
      });
      setP2Flipped(false); setImpact('none'); setAnimBanner(null);
      resetP2SelectionTimer();
    } else {
      setSelectedP2Idx(idx);
      resetP2SelectionTimer();
    }
  };

  
  // Drag-and-drop play for P1
  const dropP1Card = (cardId: string) => {
    const card = p1.hand.find((c) => c.id === cardId);
    if (!card) return;
    if (!p1PostureChosen) setP1PostureChosen(true); if (!p2PostureChosen) setP2PostureChosen(true);
    if (gameOver) return;
    if (extraPending !== 'none' && extraPending !== 'p1') return;
    if (p1.revealed && extraPending !== 'p1') return;
    if (p1Passed) return;

    if (extraPending === 'p1') {
      const requiresOk = !card.requires || card.requires === p1.posture;
      if (!requiresOk) { try { playSound('select'); } catch {} return; }
      playExtraAction(card, 'p1');
      return;
    }

    if (!canPlayCard(p1, card)) { try { playSound('select'); } catch {} return; }
    setSelectedIdx(null);
    setP1((state) => ({ ...state, revealed: card, hand: state.hand.filter((c) => c.id !== card.id) }));
    try { playSound('play'); } catch {}
    setP1Flipped(false); setP2Flipped(false); setImpact('none'); setAnimBanner(null);
    try { predictorRef.current?.observe({ posture: postureCharToIndex(p1.posture), breath: p1.breath, action: card.type as any }); } catch {}
    if (aiEnabled && !p2.revealed) {
      const choice = chooseCardForAiPredictive(p2, p1, predictorRef.current!);
        if (choice) {
          setP2((state) => ({ ...state, revealed: choice, hand: state.hand.filter((c) => c.id !== choice.id), facedownCount: Math.max(0, (state.facedownCount ?? state.hand.length) - 1) }));
        } else {
          if (deckP2.length > 0 && p2.hand.length < HAND_SIZE) drawOneP2(); else setP2Passed(true);
        }
      }
    resetSelectionTimer();
  };const resolveRoundFlow = () => {
    if (gameOver) return;
    if (!p1PostureChosen) setP1PostureChosen(true); if (!p2PostureChosen) setP2PostureChosen(true);
    if (!p1.revealed || !p2.revealed) return;

    const attackerFirst: 'p1' | 'p2' | 'simul' =
      p1.revealed.type === 'attack' && p2.revealed.type !== 'attack'
        ? 'p1'
        : p2.revealed.type === 'attack' && p1.revealed.type !== 'attack'
        ? 'p2'
        : 'simul';

    if (attackerFirst === 'p1') { setP1Flipped(true); window.setTimeout(() => setP2Flipped(true), 150); }
    else if (attackerFirst === 'p2') { setP2Flipped(true); window.setTimeout(() => setP1Flipped(true), 150); }
    else { setP1Flipped(true); setP2Flipped(true); }

    window.setTimeout(() => {
      const result = resolveRound(p1, p2, priorityOwner);
      let workingDeckP1 = deckP1.slice();
      let workingDeckP2 = deckP2.slice();
      let nextP1: UiPlayerState = { ...result.p1, facedownCount: result.p1.hand.length };
      let nextP2: UiPlayerState = { ...result.p2, facedownCount: result.p2.hand.length };

      const hasExtra = result.events.some((k) => k === 'extra_granted_p1' || k === 'extra_granted_p2');

      if (!result.defeated && !hasExtra) {
        const p1Draw = refillHand(nextP1.hand, workingDeckP1, 3);
        workingDeckP1 = p1Draw.deck; nextP1 = { ...nextP1, hand: p1Draw.hand, facedownCount: p1Draw.hand.length };
        const p2Draw = refillHand(nextP2.hand, workingDeckP2, 3);
        workingDeckP2 = p2Draw.deck; nextP2 = { ...nextP2, hand: p2Draw.hand, facedownCount: p2Draw.hand.length };
      }

      const consumeDuration = 450;
      let timeCursor = 0;
      result.events.forEach((kind) => {
        window.setTimeout(() => {
          setImpact(kind);
          setAnimBanner(bannerFor(kind));
          attachFloaters(kind);
          try {
            if (kind === 'p1_hits' || kind === 'p2_hits' || kind === 'extra_p1' || kind === 'extra_p2') playSound('atk');
            else if (kind === 'blocked_p1' || kind === 'blocked_p2') playSound('def');
            else if (kind === 'dodged_p1' || kind === 'dodged_p2') playSound('dodge');
          } catch {}
        }, timeCursor);
        timeCursor += consumeDuration;
      });

      window.setTimeout(() => {
        setAnimBanner(null);
        setImpact('none');
        setDiscard((d) => [...d, ...result.consumedCards.p1, ...result.consumedCards.p2]);
        setLog((entries) => [...result.log, ...entries]);
        setDeckP1(workingDeckP1);
        setDeckP2(workingDeckP2);
        setP1({ ...nextP1, facedownCount: nextP1.hand.length });
        setP2({ ...nextP2, facedownCount: nextP2.hand.length });
        setP1Flipped(false);
        setP2Flipped(false);
        setPriorityOwner(result.nextPriorityOwner);
        setSelectedP2Idx(null);
        setP1Passed(false);
        setP2Passed(false);
        if (result.defeated) { setGameOver(result.defeated); }

        if (hasExtra && !result.defeated) {
          const who = result.events.includes('extra_granted_p1') ? 'p1' : 'p2';
          setExtraPending(who);
          if (who === 'p2' && aiEnabled) {
            const choice = chooseCardForAiPredictive(nextP2, nextP1, predictorRef.current!);
            if (choice) playExtraAction(choice, 'p2');
          }
        }
      }, timeCursor + 350);
    }, 650);
  };

  // Single action (extra or lone reveal)
  const playExtraAction = (card: TcgCard, actorId: 'p1' | 'p2') => {
    if (gameOver || extraPending === 'none') return;

    const actorState = actorId === 'p1' ? p1 : p2;
    const targetState = actorId === 'p1' ? p2 : p1;
    const tempActor = { ...actorState, revealed: card } as PlayerState;

    if (actorId === 'p1') { try { predictorRef.current?.observe({ posture: postureCharToIndex(p1.posture), breath: p1.breath, action: card.type as any }); } catch {} }

    // Show the extra card on the table immediately (visual clarity)
    if (actorId === 'p1') {
      setP1((s) => ({ ...s, revealed: card, hand: s.hand.filter((c) => c.id !== card.id) }));
    } else {
      setP2((s) => ({ ...s, revealed: card, hand: s.hand.filter((c) => c.id !== card.id) }));
    }

    const res = resolveSingleAction(tempActor, targetState, actorId, { free: true });

    let timeCursor = 0;
    const consumeDuration = 450;
    res.events.forEach((kind) => {
      window.setTimeout(() => {
        setImpact(kind);
        setAnimBanner(bannerFor(kind));
        attachFloaters(kind);
        try {
          if (kind === 'p1_hits' || kind === 'p2_hits' || kind === 'extra_p1' || kind === 'extra_p2') playSound('atk');
          else if (kind === 'blocked_p1' || kind === 'blocked_p2') playSound('def');
          else if (kind === 'dodged_p1' || kind === 'dodged_p2') playSound('dodge');
        } catch {}
      }, timeCursor);
      timeCursor += consumeDuration;
    });

    window.setTimeout(() => {
      setAnimBanner(null);
      setImpact('none');
      setDiscard((d) => [...d, ...res.consumedCards.p1, ...res.consumedCards.p2]);
      setLog((entries) => [...res.log, ...entries]);

      if (actorId === 'p1') { setP1({ ...res.actor, facedownCount: res.actor.hand.length }); setP2({ ...res.target, facedownCount: res.target.hand.length }); }
      else { setP2({ ...res.actor, facedownCount: res.actor.hand.length }); setP1({ ...res.target, facedownCount: res.target.hand.length }); }

      if (res.defeated) { setGameOver(res.defeated); setExtraPending('none'); return; }

      const anotherExtra = res.events.some((k) => k === 'extra_granted_p1' || k === 'extra_granted_p2');
      if (anotherExtra) {
        const who = res.events.includes('extra_granted_p1') ? 'p1' : 'p2';
        setExtraPending(who);
        if (who === 'p2' && aiEnabled) {
          const choice = chooseCardForAi(p2, p1);
          if (choice) playExtraAction(choice, 'p2');
        }
        return;
      }

      let workingDeckP1 = deckP1.slice();
      let workingDeckP2 = deckP2.slice();
      let nextP1: UiPlayerState = actorId === 'p1' ? { ...res.actor, facedownCount: res.actor.hand.length } : { ...res.target, facedownCount: res.target.hand.length };
      let nextP2: UiPlayerState = actorId === 'p1' ? { ...res.target, facedownCount: res.target.hand.length } : { ...res.actor, facedownCount: res.actor.hand.length };
      if (!res.defeated) {
        const p1Draw = refillHand(nextP1.hand, workingDeckP1, 3);
        workingDeckP1 = p1Draw.deck; nextP1 = { ...nextP1, hand: p1Draw.hand, facedownCount: p1Draw.hand.length };
        const p2Draw = refillHand(nextP2.hand, workingDeckP2, 3);
        workingDeckP2 = p2Draw.deck; nextP2 = { ...nextP2, hand: p2Draw.hand, facedownCount: p2Draw.hand.length };
      }
      setDeckP1(workingDeckP1); setDeckP2(workingDeckP2);
      setP1({ ...nextP1, facedownCount: nextP1.hand.length });
      setP2({ ...nextP2, facedownCount: nextP2.hand.length });
      setExtraPending('none'); setP1Passed(false); setP2Passed(false);
    }, timeCursor + 250);
  };

  const drawOne = () => {
    // (opcional) UI de compra – não usamos na arena protótipo
    if (gameOver || p1.revealed || p1Passed) return;
    if (p1.hand.length >= HAND_SIZE || deckP1.length === 0) return;
    const { deck: newDeckP1, drawn } = drawCards(deckP1, 1);
    const card = drawn[0]; if (!card) return;
    setDeckP1(newDeckP1);
    const updatedP1: UiPlayerState = { ...p1, hand: [...p1.hand, card], facedownCount: (p1.facedownCount ?? p1.hand.length) + 1 };
    setP1(updatedP1);
    try { playSound('pass'); } catch {}
    setP1Passed(true);
  };

  const drawOneP2 = () => {
    if (gameOver || p2.revealed || p2Passed) return;
    if (p2.hand.length >= HAND_SIZE || deckP2.length === 0) return;
    const { deck: newDeckP2, drawn } = drawCards(deckP2, 1);
    const card = drawn[0]; if (!card) return;
    setDeckP2(newDeckP2);
    const updatedP2: UiPlayerState = { ...p2, hand: [...p2.hand, card], facedownCount: (p2.facedownCount ?? p2.hand.length) + 1 };
    setP2(updatedP2);
    try { playSound("pass"); } catch {}
    setP2Passed(true);
  };

  // If player draws or passes, let AI act immediately (play/draw/pass)
  useEffect(() => {
    if (!aiEnabled || gameOver) return;
    if (extraPending !== 'none') return;
    // Ensure both have posture chosen before acting
    if (!p1PostureChosen) setP1PostureChosen(true);
    if (!p2PostureChosen) setP2PostureChosen(true);
    // Only react when P1 has taken a non-reveal action and P2 hasn't acted yet
    if (p1Passed && !p1.revealed && !p2.revealed && !p2Passed) {
      const choice = chooseCardForAiPredictive(p2, p1, predictorRef.current!);
      if (choice) {
        setP2((state) => ({
          ...state,
          revealed: choice,
          hand: state.hand.filter((c) => c.id !== choice.id),
          facedownCount: Math.max(0, (state.facedownCount ?? state.hand.length) - 1),
        }));
      } else {
        if (deckP2.length > 0 && p2.hand.length < HAND_SIZE) drawOneP2();
        else setP2Passed(true);
      }
    }
  }, [aiEnabled, gameOver, extraPending, p1Passed, p1.revealed?.id, p2.revealed?.id, p2Passed, deckP2.length, p2.hand.length, p1PostureChosen, p2PostureChosen]);

  const applySeed = (s: string) => {
    const built1 = makeDeck(s || undefined);
    const katas = getAllKatas();
    const aiSeed = aiEnabled && katas.length ? katas[Math.floor(Math.random() * katas.length)].seed : undefined;
    const built2 = makeDeck(aiSeed || undefined);
    const p1Deal = drawCards(built1, INITIAL_HAND_SIZE);
    const p2Deal = drawCards(built2, INITIAL_HAND_SIZE);
    setDeckP1(p1Deal.deck.slice());
    setDeckP2(p2Deal.deck.slice());
    setDiscard([]);
    setP1({ name: playerName || 'You', posture: 'A', breath: MAX_BREATH, hand: p1Deal.drawn.slice(), revealed: null, facedownCount: p1Deal.drawn.length });
    setP2({ name: 'Opponent', posture: 'B', breath: MAX_BREATH, hand: p2Deal.drawn.slice(), revealed: null, facedownCount: p2Deal.drawn.length });
    setLog([]); setPriorityOwner((Math.random() < 0.5 ? 0 : 1) as Priority);
    setSelectedIdx(null); setSelectedP2Idx(null);
    setP1Flipped(false); setP2Flipped(false); setImpact('none'); setAnimBanner(null);
    setP1Floaters([]); setP2Floaters([]); setGameOver(null); setShowGameOverModal(false);
    setP1Passed(false); setP2Passed(false); setExtraPending('none');
    setP1PostureChosen(false); setP2PostureChosen(false);
    try { predictorRef.current?.reset(null); } catch {}
  };

  // timers/efeitos
  useEffect(() => {
    if (appMode === 'local' && appSeed && appSeed.trim().length > 0) {
      applySeed(appSeed); try { setAppSeed && setAppSeed(''); } catch {}
    }
  }, [appMode, appSeed]);

  useEffect(() => {
    if (!aiEnabled) return;
    if (p2PostureChosen) return;
    if (!p2 || !Array.isArray(p2.hand) || p2.hand.length === 0) return;
    const pos = choosePostureForAi(p2.hand);
    setP2((s) => ({ ...s, posture: pos }));
    setP2PostureChosen(true);
    setLog((entries) => [`${p2.name} chooses ${pos}.`, ...entries]);
  }, [aiEnabled, p2.hand.length, p2PostureChosen]);

  useEffect(() => { if (gameOver) setShowGameOverModal(true); }, [gameOver]);
  useEffect(() => {
    if (!gameOver) return;
    if (gameOver === 'p1') setP2Wins((w) => w + 1);
    else if (gameOver === 'p2') setP1Wins((w) => w + 1);
    else if (gameOver === 'both') { setP1Wins((w) => w + 1); setP2Wins((w) => w + 1); }
  }, [gameOver]);

  const handleAiToggle = (value: boolean) => { setAiEnabled(value); resetMatch(); if (!value && typeof window !== 'undefined' && !window.__breath_hotseat_hint) window.__breath_hotseat_hint = true; };

  const resetMatch = () => {
    const katas = getAllKatas();
    const aiSeed = aiEnabled && katas.length ? katas[Math.floor(Math.random() * katas.length)].seed : undefined;
    const fresh = buildInitialGame(playerName || 'You', 'Opponent', activeDeck?.seed, aiSeed);
    setDeckP1(fresh.deckP1.slice());
    setDeckP2(fresh.deckP2.slice());
    setDiscard([]);
    setP1({ ...fresh.p1, hand: fresh.p1.hand.slice(), facedownCount: fresh.p1.hand.length });
    setP2({ ...fresh.p2, hand: fresh.p2.hand.slice(), facedownCount: fresh.p2.hand.length });
    setLog([]); setSelectedIdx(null); setSelectedP2Idx(null);
    setP1Flipped(false); setP2Flipped(false); setImpact('none'); setAnimBanner(null);
    setP1Floaters([]); setP2Floaters([]); setGameOver(null); setShowGameOverModal(false);
    setP1Passed(false); setP2Passed(false); setP1PostureChosen(false); setP2PostureChosen(false);
  };

  const startGame = () => {
    setP1({
      name: playerName || 'Player 1',
      posture: 'A',
      breath: MAX_BREATH,
      hand: initialGame.p1.hand.slice(),
      revealed: null,
    });
    setP2({
      name: p2.name || 'CPU',
      posture: 'B',
      breath: MAX_BREATH,
      hand: initialGame.p2.hand.slice(),
      revealed: null,
    });
    setDeckP1(initialGame.deckP1.slice());
    setDeckP2(initialGame.deckP2.slice());
    setLog([]);
    setPriorityOwner(Math.random() < 0.5 ? 0 : 1);
  };

  // janela de decisão
  useEffect(() => {
    if (gameOver) { clearRoundDecisionTimers(); return; }
    if (extraPending !== 'none') { clearRoundDecisionTimers(); return; }
    if (!p1PostureChosen || !p2PostureChosen) { clearRoundDecisionTimers(); return; }
    clearRoundDecisionTimers();
    if (DISABLE_TIMERS) { setDecisionDeadline(null); return; }
    if (decisionDeadline == null && !p1.revealed && !p1Passed) {
      p1DecisionTimer.current = window.setTimeout(() => { setP1Passed(true); setLog((entries) => ['Timeout: you passed.', ...entries]); }, DECISION_WINDOW_MS) as unknown as number;
    }
    if (decisionDeadline == null && !p2.revealed && !p2Passed) {
      p2DecisionTimer.current = window.setTimeout(() => { setP2Passed(true); setLog((entries) => ['Timeout: opponent passed.', ...entries]); }, DECISION_WINDOW_MS) as unknown as number;
    }
    if (decisionDeadline == null) setDecisionDeadline(Date.now() + DECISION_WINDOW_MS);
    return () => clearRoundDecisionTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1.revealed?.id, p2.revealed?.id, extraPending, p1Passed, p2Passed, priorityOwner, gameOver]);

  // extra timer
  useEffect(() => {
    if (gameOver) { clearExtraDecisionTimer(); return; }
    clearExtraDecisionTimer();
    if (!p1PostureChosen || !p2PostureChosen) { clearExtraDecisionTimer(); return; }
    if (DISABLE_TIMERS) { if (extraPending === 'p1' || extraPending === 'p2') { setDecisionDeadline(null); setDecisionProgress(1); } return () => {}; }
    if (extraPending === 'p1' || extraPending === 'p2') {
      extraDecisionTimer.current = window.setTimeout(() => { finishExtraWithoutAction(); }, DECISION_WINDOW_MS) as unknown as number;
      setDecisionDeadline(Date.now() + DECISION_WINDOW_MS);
      setDecisionProgress(1);
    }
    return () => clearExtraDecisionTimer();
  }, [extraPending, gameOver, p1PostureChosen, p2PostureChosen]);

  // resolver quando ambos revelam
  useEffect(() => {
    if (gameOver) return;
    if (extraPending !== 'none') return;
    if (!p1PostureChosen) setP1PostureChosen(true); if (!p2PostureChosen) setP2PostureChosen(true);
    if (p1.revealed && p2.revealed) {
      clearRoundDecisionTimers();
      setDecisionDeadline(null);
      resolveRoundFlow();
    }
  }, [p1.revealed?.id, p2.revealed?.id, extraPending, gameOver, p1PostureChosen, p2PostureChosen]);

  // ambos passam
  useEffect(() => {
    if (gameOver || extraPending !== 'none' || !p1PostureChosen || !p2PostureChosen) return;
    if (p1.revealed || p2.revealed) return;
    if (p1Passed && p2Passed) {
      if (priorityOwner === 0) setP2((s) => ({ ...s, breath: Math.min(MAX_BREATH, s.breath + 1) }));
      else setP1((s) => ({ ...s, breath: Math.min(MAX_BREATH, s.breath + 1) }));
      let workingDeckP1 = deckP1.slice();
      let workingDeckP2 = deckP2.slice();
      setP1((cur) => {
        if (cur.hand.length >= 3) return cur;
        const d = refillHand(cur.hand, workingDeckP1, 3);
        workingDeckP1 = d.deck;
        return { ...cur, hand: d.hand, facedownCount: d.hand.length };
      });
      setP2((cur) => {
        if (cur.hand.length >= 3) return cur;
        const d = refillHand(cur.hand, workingDeckP2, 3);
        workingDeckP2 = d.deck;
        return { ...cur, hand: d.hand, facedownCount: d.hand.length };
      });
      setDeckP1(workingDeckP1);
      setDeckP2(workingDeckP2);
      setP1Passed(false); setP2Passed(false);
      setLog((entries) => ['Ambos passaram.', ...entries]);
    }
  }, [p1Passed, p2Passed, p1.revealed?.id, p2.revealed?.id, extraPending, priorityOwner, gameOver, p1PostureChosen, p2PostureChosen]);

  // um revela e o outro passa
  useEffect(() => {
    if (gameOver || extraPending !== 'none' || !p1PostureChosen || !p2PostureChosen) return;
    const actorId: 'p1' | 'p2' | null = p1Passed && p2.revealed && !p1.revealed ? 'p2' : p2Passed && p1.revealed && !p2.revealed ? 'p1' : null;
    if (!actorId) return;

    clearRoundDecisionTimers();
    setDecisionDeadline(null);
    const actor = actorId === 'p1' ? p1 : p2;
    const target = actorId === 'p1' ? p2 : p1;
    if (!actor.revealed) return;

    const tempActor = { ...actor, revealed: actor.revealed } as PlayerState;
    const res = resolveSingleAction(tempActor, target, actorId);

    let timeCursor = 0;
    const consumeDuration = 450;
    res.events.forEach((kind) => {
      window.setTimeout(() => {
        setImpact(kind);
        setAnimBanner(bannerFor(kind));
        attachFloaters(kind);
        try {
          if (kind === 'p1_hits' || kind === 'p2_hits' || kind === 'extra_p1' || kind === 'extra_p2') playSound('atk');
          else if (kind === 'blocked_p1' || kind === 'blocked_p2') playSound('def');
          else if (kind === 'dodged_p1' || kind === 'dodged_p2') playSound('dodge');
        } catch {}
      }, timeCursor);
      timeCursor += consumeDuration;
    });

    window.setTimeout(() => {
      setAnimBanner(null); setImpact('none');
      setDiscard((d) => [...d, ...res.consumedCards.p1, ...res.consumedCards.p2]);
      setLog((entries) => [...res.log, ...entries]);

      if (actorId === 'p1') { setP1({ ...res.actor, facedownCount: res.actor.hand.length }); setP2({ ...res.target, facedownCount: res.target.hand.length }); }
      else { setP2({ ...res.actor, facedownCount: res.actor.hand.length }); setP1({ ...res.target, facedownCount: res.target.hand.length }); }

      if (res.defeated) { setGameOver(res.defeated); setP1Passed(false); setP2Passed(false); return; }

      const anotherExtra = res.events.some((k) => k === 'extra_granted_p1' || k === 'extra_granted_p2');
      if (anotherExtra) {
        const who = res.events.includes('extra_granted_p1') ? 'p1' : 'p2';
        setExtraPending(who);
        if (who === 'p2' && aiEnabled) {
          const choice = chooseCardForAiPredictive(p2, p1, predictorRef.current!);
          if (choice) playExtraAction(choice, 'p2');
        }
        return;
      }

      if (priorityOwner === 0) setP2((s) => ({ ...s, breath: Math.min(MAX_BREATH, s.breath + 1) }));
      else setP1((s) => ({ ...s, breath: Math.min(MAX_BREATH, s.breath + 1) }));

      let workingDeckP1 = deckP1.slice();
      let workingDeckP2 = deckP2.slice();
      setP1((cur) => {
        if (cur.hand.length >= 3) return cur;
        const d = refillHand(cur.hand, workingDeckP1, 3);
        workingDeckP1 = d.deck;
        return { ...cur, hand: d.hand, facedownCount: d.hand.length };
      });
      setP2((cur) => {
        if (cur.hand.length >= 3) return cur;
        const d = refillHand(cur.hand, workingDeckP2, 3);
        workingDeckP2 = d.deck;
        return { ...cur, hand: d.hand, facedownCount: d.hand.length };
      });
      setDeckP1(workingDeckP1);
      setDeckP2(workingDeckP2);
      setP1Passed(false); setP2Passed(false);
    }, timeCursor + 250);
  }, [p1Passed, p2Passed, p1.revealed?.id, p2.revealed?.id, extraPending, priorityOwner, gameOver, p1PostureChosen, p2PostureChosen]);

  const finishExtraWithoutAction = () => {
    if (extraPending === 'none' || gameOver) return;
    let workingDeckP1 = deckP1.slice();
    let workingDeckP2 = deckP2.slice();
    setP1((cur) => {
      if (cur.hand.length >= 3) return { ...cur, facedownCount: cur.hand.length };
      const d = refillHand(cur.hand, workingDeckP1, 3);
      workingDeckP1 = d.deck;
      return { ...cur, hand: d.hand, facedownCount: d.hand.length };
    });
    setP2((cur) => {
      if (cur.hand.length >= 3) return { ...cur, facedownCount: cur.hand.length };
      const d = refillHand(cur.hand, workingDeckP2, 3);
      workingDeckP2 = d.deck;
      return { ...cur, hand: d.hand, facedownCount: d.hand.length };
    });
    setDeckP1(workingDeckP1); setDeckP2(workingDeckP2);
    setExtraPending('none'); setP1Passed(false); setP2Passed(false);
    setLog((entries) => ['Extra action timed out; turn continues.', ...entries]);
  };

  // countdown tick
  useEffect(() => {
    if (DISABLE_TIMERS) { setDecisionProgress(extraPending !== 'none' ? 1 : 0); return; }
    if (!decisionDeadline) { setDecisionProgress(0); return; }
    const id = window.setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, decisionDeadline - now);
      const prog = Math.min(1, left / DECISION_WINDOW_MS);
      setDecisionProgress(prog);
      if (left === 0) {
        window.clearInterval(id);
        setDecisionDeadline(null);
        // timeout -> deixa a própria lógica de "pass"/resolução cuidar
      }
    }, 100) as unknown as number;
    return () => window.clearInterval(id);
  }, [decisionDeadline, extraPending]);

  const gameStatus = () => {
    if (gameOver === 'p1') return 'You ran out of breath';
    if (gameOver === 'p2') return 'Opponent fell';
    if (gameOver === 'both') return 'Ambos ficam sem fôlego';
    return null;
  };

  useEffect(() => {
    // se ambos revelarem, resolve; se ambos passarem, já tratamos no efeito próprio
    if (p1.revealed && p2.revealed) resolveRoundFlow();
  }, [p1.revealed?.id, p2.revealed?.id]);

  useEffect(() => {
    if (!p2.name) {
      setP2({
        name: 'CPU',
        posture: 'B',
        breath: MAX_BREATH,
        hand: [],
        revealed: null,
      });
    }
  }, [p2.name]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center w-full px-6 py-4">
        <h1 className="text-2xl font-bold text-white">Breath! Arena</h1>
        <div className="flex items-center gap-3 text-white">
          <Button onClick={resetMatch} className="bg-white/10 hover:bg-white/20">Reset</Button>
          <div className="flex items-center gap-2">
            <span>{aiEnabled ? 'AI' : 'Hot-seat'}</span>
            <Switch checked={aiEnabled} onCheckedChange={handleAiToggle} />
          </div>
        </div>
      </header>

      <ArenaPrototype
        p1={p1}
        p2={p2}
        deckP1Count={deckP1.length}
        deckP2Count={deckP2.length}
        priorityOwner={priorityOwner}
        log={log}
        extraPending={extraPending}
        decisionProgress={decisionProgress}
        selectedIdx={selectedIdx}
        selectedP2Idx={selectedP2Idx}
        hoverCard={hoverCard}
        onHoverCard={(c) => setHoverCard(c)}
        onClickP1Card={clickP1Card}
        onClickP2Card={clickP2Card}
        onClickDraw={drawOne}
        onClickDrawP2={!aiEnabled ? drawOneP2 : undefined}
        onClickSetP1Posture={(post) => {
          setP1((cur) => ({ ...cur, posture: post }));
          if (!p1PostureChosen) setP1PostureChosen(true);
          setLog((entries) => [`You choose ${post}.`, ...entries]);
        }}
      />

      {/* Modal de Match Over */}
      {showGameOverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Match Over</h3>
            <p className="mb-2">{gameStatus()}</p>
            <div className="mb-4 text-sm">Score (Bo3): You {p1Wins} x {p2Wins} Opponent</div>
            <div className="flex justify-end gap-3">
              <Button onClick={() => setShowGameOverModal(false)} className="bg-slate-200 text-slate-700 hover:bg-slate-300">
                Close
              </Button>
              {Math.max(p1Wins, p2Wins) < 2 ? (
                <Button onClick={() => { setShowGameOverModal(false); resetMatch(); }} className="bg-emerald-500 hover:bg-emerald-400">
                  Next Game
                </Button>
              ) : (
                <Button onClick={() => { setP1Wins(0); setP2Wins(0); setShowGameOverModal(false); resetMatch(); }} className="bg-emerald-600 hover:bg-emerald-500">
                  Restart Series
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <h1>Local Game</h1>
        <div>
          <h2>{p1.name} vs {p2.name}</h2>
          <button onClick={startGame} className="btn bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md">Start Game</button>
          {/* Renderização do jogo */}
        </div>
      </div>
    </div>
  ) ;
}









