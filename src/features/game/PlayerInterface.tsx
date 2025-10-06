import React from 'react';
import { TcgCard } from '@/engine';

type Posture = 'A' | 'B' | 'C';

type PlayerInterfaceProps = {
  player: {
    name: string;
    posture: Posture;
    hand: TcgCard[];
    breath: number;
  };
  onPlayCard: (card: TcgCard) => void;
  onSetPosture: (posture: Posture) => void;
  selectedCard?: TcgCard | null;
};

export default function PlayerInterface({ player, onPlayCard, onSetPosture, selectedCard }: PlayerInterfaceProps) {
  return (
    <div>
      <h2>{player.name}</h2>
      <div>Breath: {player.breath}</div>
      <div>
        Posture:
        {['A', 'B', 'C'].map((posture) => (
          <button
            key={posture}
            onClick={() => onSetPosture(posture as Posture)}
            disabled={player.posture === posture}
          >
            {posture}
          </button>
        ))}
      </div>
      <div>
        Hand:
        {player.hand.map((card) => (
          <button key={card.id} onClick={() => onPlayCard(card)} disabled={selectedCard !== null}>
            {card.type} {selectedCard?.id === card.id ? '(Selected)' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}