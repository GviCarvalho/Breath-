import React from 'react';
import Game from '@/features/game/Game';

export default function LocalGamePage() {
  return <Game isLocal={true} />;
}
