import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MainMenu from '@/pages/MainMenu';
import LoginPage from '@/pages/LoginPage';
import LocalGamePage from '@/pages/LocalGamePage';
import OnlineGamePage from '@/pages/OnlineGamePage';
import CasualLobbyPage from '@/pages/CasualLobbyPage';
import MatchPage from '@/pages/MatchPage';
import SpectatePage from '@/pages/SpectatePage';
import CollectionPage from '@/pages/CollectionPage';
import ExitToMenuButton from '@/components/layout/ExitToMenuButton';

const GUEST_MODE_KEY = 'breath_guest_mode';

// The login screen comes before the main menu the first time: no account
// and no explicit "jogar sem conta" yet means bounce to /login. Once either
// is true (logged in, or the guest flag is set), this stays out of the way.
function RequireEntry({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  let guestMode = false;
  try { guestMode = localStorage.getItem(GUEST_MODE_KEY) === '1'; } catch {}
  if (!user && !guestMode) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireEntry><MainMenu /></RequireEntry>} />
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
