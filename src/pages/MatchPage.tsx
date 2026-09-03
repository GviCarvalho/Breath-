import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMatchConnection } from '@/hooks/useMatchConnection';
import { useAppState } from '@/store/appState';
import Game from '@/features/game/Game';

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { activeDeck } = useAppState();
  const connection = useMatchConnection();
  const { joinMatch, status } = connection;
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    // Auth check is async (a GET /auth/me on mount) - on a fresh load or a
    // direct link, `user` starts out null while that's still in flight, so
    // bouncing on `!user` alone kicked out already-logged-in players before
    // the check had a chance to resolve. Wait for `loading` to settle first.
    if (loading) return;
    if (!user) {
      alert('Você precisa estar logado para entrar em uma sala.');
      navigate('/', { replace: true });
      return;
    }

    // Auto-join match when component mounts
    if (!hasJoined && status === 'idle' && matchId) {
      console.log('[MatchPage] Joining match:', matchId);
      joinMatch(matchId, user.displayName, activeDeck?.seed);
      setHasJoined(true);
    }
  }, [user, loading, navigate, joinMatch, status, hasJoined, matchId, activeDeck]);

  return <Game isLocal={false} connection={connection} />;
}
