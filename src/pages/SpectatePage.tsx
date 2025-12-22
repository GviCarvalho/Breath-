import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Game from '@/features/game/Game';

export default function SpectatePage() {
  const { matchId } = useParams<{ matchId: string }>();

  useEffect(() => {
    console.log('[SpectatePage] Spectating Match ID:', matchId);
  }, [matchId]);

  return <Game isLocal={false} />;
}
