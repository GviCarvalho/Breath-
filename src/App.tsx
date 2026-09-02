import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MainMenu from '@/pages/MainMenu';
import LocalGamePage from '@/pages/LocalGamePage';
import OnlineGamePage from '@/pages/OnlineGamePage';
import CasualLobbyPage from '@/pages/CasualLobbyPage';
import MatchPage from '@/pages/MatchPage';
import SpectatePage from '@/pages/SpectatePage';
import CollectionPage from '@/pages/CollectionPage';
import ExitToMenuButton from '@/components/layout/ExitToMenuButton';

export default function App() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();

  // Handle OAuth callback
  useEffect(() => {
    const authStatus = searchParams.get('auth');
    const error = searchParams.get('error');

    if (authStatus === 'success') {
      // Refresh user data after successful login
      refreshUser();
      // Clean up URL
      navigate('/', { replace: true });
    } else if (error) {
      console.error('[Auth] Login error:', error);
      alert(`Erro ao fazer login: ${error}`);
      navigate('/', { replace: true });
    }
  }, [searchParams, navigate, refreshUser]);

  return (
    <>
      <ExitToMenuButton />
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/local" element={<LocalGamePage />} />
        <Route path="/play/casual" element={<CasualLobbyPage />} />
        <Route path="/play/online" element={<OnlineGamePage />} />
        <Route path="/match/:matchId" element={<MatchPage />} />
        <Route path="/spectate/:matchId" element={<SpectatePage />} />
        <Route path="/collection" element={<CollectionPage />} />
      </Routes>
    </>
  );
}
