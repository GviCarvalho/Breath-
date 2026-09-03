import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMatchConnection } from '@/hooks/useMatchConnection';
import Game from '@/features/game/Game';

export default function SpectatePage() {
  const { matchId } = useParams<{ matchId: string }>();
  const connection = useMatchConnection();
  const { spectateMatch, status } = connection;
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    // Auto-spectate match when component mounts
    // No login required for spectating
    if (!hasJoined && status === 'idle' && matchId) {
      console.log('[SpectatePage] Spectating Match ID:', matchId);
      spectateMatch(matchId, 'Spectator');
      setHasJoined(true);
    }
  }, [spectateMatch, status, hasJoined, matchId]);

  return <Game isLocal={false} connection={connection} />;
}
