import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMatchConnection } from '@/hooks/useMatchConnection';
import Game from '@/features/game/Game';

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { joinMatch, status } = useMatchConnection();
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user) {
      alert('Você precisa estar logado para entrar em uma sala.');
      navigate('/', { replace: true });
      return;
    }

    // Auto-join match when component mounts
    if (!hasJoined && status === 'idle' && matchId) {
      console.log('[MatchPage] Joining match:', matchId);
      joinMatch(matchId, user.displayName);
      setHasJoined(true);
    }
  }, [user, navigate, joinMatch, status, hasJoined, matchId]);

  return <Game isLocal={false} />;
}
