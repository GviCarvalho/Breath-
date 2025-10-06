import React, { useEffect, useRef } from 'react';
import { TcgCard, PlayerState, Posture } from '@/engine/types';
import PlayerInterface from './PlayerInterface';
import { canPlayCard } from '@/engine';
import { HAND_SIZE } from '@/engine/constants';

type CpuPlayerProps = {
  player: PlayerState;
  onPlayCard: (card: TcgCard) => void;
  onSetPosture: (posture: Posture) => void;
  onDraw?: () => void;
  onPass?: () => void;
  selectedCard?: TcgCard | null;
  debugUI?: boolean; // quando true, renderiza o painel visual para debug
};

export default function CpuPlayer({ player, onPlayCard, onSetPosture, onDraw, onPass, selectedCard, debugUI = false }: CpuPlayerProps) {
  const thinkingRef = useRef(false);

  // Função para decidir a ação do CPU
  const decideAction = () => {
    // 1. Tenta jogar uma carta válida
    const playableCards = player.hand.filter((card) => canPlayCard(player, card));
    if (playableCards.length > 0) {
      // Estratégia simples: joga a primeira carta jogável
      return () => {
        onPlayCard(playableCards[0]);
      };
    }

    // 2. Se não puder jogar, tenta comprar se a mão não estiver cheia
    if (player.hand.length < HAND_SIZE && onDraw) {
      return () => {
        onDraw();
      };
    }

    // 3. Se não puder jogar nem comprar, passa
    return () => {
      onPass?.();
    };
  };

  // Loop de decisão: quando não há carta selecionada, pensa e age; após draw/pass, redecide
  useEffect(() => {
    if (selectedCard) return; // já confirmou uma carta para a rodada
    if (thinkingRef.current) return;
    thinkingRef.current = true;
    const action = decideAction();
    const timer = setTimeout(() => {
      try { action(); } finally { thinkingRef.current = false; }
    }, 700);
    return () => { clearTimeout(timer); thinkingRef.current = false; };
  }, [player.hand, player.posture, player.breath, selectedCard]);

  // Headless por padrão: não renderiza UI; se debugUI=true, mostra o painel visual
  if (!debugUI) return null;
  return (
    <div style={{ pointerEvents: 'none', opacity: 0.7 }}>
      <PlayerInterface
        player={player}
        onPlayCard={onPlayCard}
        onSetPosture={onSetPosture}
        selectedCard={selectedCard}
      />
    </div>
  );
}