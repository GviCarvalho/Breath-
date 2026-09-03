import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobby } from '@/contexts/LobbyContext';
import '@/features/home/dojo-theme.css';

// Mounted once at the app root (see App.tsx) so a friend's match invite can
// reach the player from anywhere - menu, deck builder, wherever - not just
// while they happen to be on a matchmaking screen.
export default function InviteToast() {
  const { invites, dismissInvite } = useLobby();
  const navigate = useNavigate();

  if (invites.length === 0) return null;

  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 500, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {invites.map((invite) => (
        <div
          key={invite.matchId}
          className="dojo-panel"
          style={{ padding: '14px 16px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <p style={{ margin: 0, fontSize: 13 }}>
            <strong>{invite.fromName}</strong> te convidou para uma partida.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="dojo-btn dojo-btn-primary"
              style={{ width: 'auto', padding: '8px 14px' }}
              onClick={() => {
                dismissInvite(invite.matchId);
                navigate(`/match/${invite.matchId}`);
              }}
            >
              Entrar
            </button>
            <button
              className="dojo-btn dojo-btn-ghost"
              style={{ width: 'auto', padding: '8px 14px' }}
              onClick={() => dismissInvite(invite.matchId)}
            >
              Dispensar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
