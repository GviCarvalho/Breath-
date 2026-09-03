import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getConfig } from '@/lib/config';
import type { ClientMessage, ServerMessage } from '@/protocol/messages';

export interface MatchInvite {
  matchId: string;
  fromUserId: string;
  fromName: string;
  receivedAt: number;
}

interface LobbyContextValue {
  invites: MatchInvite[];
  inviteFriend: (toUserId: string, matchId: string) => void;
  dismissInvite: (matchId: string) => void;
  inviteError: string | null;
}

const LobbyContext = createContext<LobbyContextValue | undefined>(undefined);

// A second, always-on WebSocket (separate from useMatchConnection's
// per-match one) kept open the whole time the user is logged in - not just
// while they're inside a match - so friend-invite pushes can reach them
// from the menu, deck builder, anywhere. The server authenticates it the
// same way as a match socket (JWT cookie read during the upgrade), so no
// handshake payload is needed here beyond just connecting.
export function LobbyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [invites, setInvites] = useState<MatchInvite[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;

    getConfig().then((config) => {
      if (cancelled || !config.SERVER_WS_URL) return;
      socket = new WebSocket(config.SERVER_WS_URL);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as ServerMessage;
          if (parsed.type === 'match_invite') {
            setInvites((cur) => [
              ...cur.filter((i) => i.matchId !== parsed.matchId),
              { matchId: parsed.matchId, fromUserId: parsed.fromUserId, fromName: parsed.fromName, receivedAt: Date.now() },
            ]);
          } else if (parsed.type === 'error') {
            setInviteError(parsed.message);
          }
        } catch {
          // ignore malformed frames
        }
      };
    });

    return () => {
      cancelled = true;
      socket?.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user]);

  const inviteFriend = useCallback((toUserId: string, matchId: string) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setInviteError('Conexao com o servidor indisponivel.');
      return;
    }
    setInviteError(null);
    const payload: ClientMessage = { type: 'invite_friend', toUserId, matchId };
    socket.send(JSON.stringify(payload));
  }, []);

  const dismissInvite = useCallback((matchId: string) => {
    setInvites((cur) => cur.filter((i) => i.matchId !== matchId));
  }, []);

  return (
    <LobbyContext.Provider value={{ invites, inviteFriend, dismissInvite, inviteError }}>
      {children}
    </LobbyContext.Provider>
  );
}

export function useLobby(): LobbyContextValue {
  const context = useContext(LobbyContext);
  if (!context) {
    throw new Error('useLobby must be used within LobbyProvider');
  }
  return context;
}
