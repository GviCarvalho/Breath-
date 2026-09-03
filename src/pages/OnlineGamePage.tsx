import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMatchConnection } from '@/hooks/useMatchConnection';
import { useAppState } from '@/store/appState';
import { useLobby } from '@/contexts/LobbyContext';
import { Button } from '@/components/ui/button';
import Game from '@/features/game/Game';

const CopyIcon = new URL('../Assets/icons/copy.svg', import.meta.url).href;

export default function OnlineGamePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteTo = searchParams.get('inviteTo');
  const { user, loading } = useAuth();
  const { activeDeck } = useAppState();
  const { inviteFriend } = useLobby();
  const connection = useMatchConnection();
  const { createMatch, status, matchId } = connection;
  const [hasCreated, setHasCreated] = useState(false);
  const [hasInvited, setHasInvited] = useState(false);

  useEffect(() => {
    // See MatchPage.tsx: `loading` must settle before trusting `!user`,
    // otherwise an already-logged-in player gets bounced on every fresh load.
    if (loading) return;
    if (!user) {
      alert('Você precisa estar logado para criar uma sala.');
      navigate('/', { replace: true });
      return;
    }

    // Auto-create match when component mounts
    if (!hasCreated && status === 'idle') {
      createMatch(user.displayName, activeDeck?.seed);
      setHasCreated(true);
    }
  }, [user, loading, navigate, createMatch, status, hasCreated, activeDeck]);

  // Arrived here via "Convidar" on the friends list (?inviteTo=<userId>) -
  // once the room actually exists, push the invite so the friend doesn't
  // have to be handed a code at all.
  useEffect(() => {
    if (!inviteTo || hasInvited || status !== 'waiting' || !matchId) return;
    inviteFriend(inviteTo, matchId);
    setHasInvited(true);
  }, [inviteTo, hasInvited, status, matchId, inviteFriend]);

  // Show match ID once created
  if (status === 'waiting' && matchId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-md w-full backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-white mb-4">Sala Criada!</h2>
          <p className="text-slate-300 mb-4">Compartilhe este código com seu oponente:</p>
          <div className="bg-black/30 rounded-lg p-4 mb-4">
            <code className="text-emerald-400 text-xl font-mono">{matchId}</code>
          </div>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(matchId);
              alert('Código copiado!');
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-500 mb-3 inline-flex items-center justify-center gap-2"
          >
            <img src={CopyIcon} alt="" className="w-5 h-5" /> Copiar Código
          </Button>
          <p className="text-sm text-slate-400 text-center">
            Aguardando oponente...
          </p>
          <Button
            onClick={() => navigate('/')}
            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 mt-4"
          >
            Voltar ao Menu
          </Button>
        </div>
      </div>
    );
  }

  return <Game isLocal={false} connection={connection} />;
}
