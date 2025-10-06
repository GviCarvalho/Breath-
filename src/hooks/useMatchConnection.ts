import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImpactKind } from '@/engine';
import type {
  ClientMessage,
  ServerMessage,
  MatchSnapshot,
  ParticipantRole,
  MatchSummary,
} from '@/protocol/messages';

const rawEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
const DEFAULT_WS_URL = (rawEnv?.VITE_SERVER_URL as string | undefined) ?? 'ws://localhost:3001';

export type ConnectionStatus = 'idle' | 'connecting' | 'waiting' | 'in_match' | 'spectating' | 'error';

interface UseMatchConnectionResult {
  status: ConnectionStatus;
  error: string | null;
  matchId: string | null;
  playerId: string | null;
  role: ParticipantRole | null;
  snapshot: MatchSnapshot | null;
  events: ImpactKind[];
  logDelta: string[];
  matchList: MatchSummary[];
  setMatchList?: (arr: MatchSummary[]) => void;
  createMatch: (name?: string) => void;
  joinMatch: (matchId: string, name?: string) => void;
  spectateMatch: (matchId: string, name?: string) => void;
  refreshMatchList: () => Promise<void>;
  playCard: (cardId: string) => void;
  resetMatch: () => void;
  leaveMatch: () => void;
  clearError: () => void;
}

export function useMatchConnection(serverUrl: string = DEFAULT_WS_URL): UseMatchConnectionResult {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [role, setRole] = useState<ParticipantRole | null>(null);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [events, setEvents] = useState<ImpactKind[]>(['none']);
  const [logDelta, setLogDelta] = useState<string[]>([]);
  const [matchList, setMatchList] = useState<MatchSummary[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<ClientMessage | null>(null);

  const cleanup = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    pendingRef.current = null;
    setStatus('idle');
    setMatchId(null);
    setPlayerId(null);
    setRole(null);
    setSnapshot(null);
    setEvents(['none']);
    setLogDelta([]);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const applyStateUpdate = useCallback((newRole: ParticipantRole, newSnapshot: MatchSnapshot, newEvents: ImpactKind[], newLogDelta: string[]) => {
    setRole(newRole);
    setSnapshot(newSnapshot);
    setEvents(newEvents);
    setLogDelta(newLogDelta);
    if (newRole === 'spectator') {
      setStatus('spectating');
    } else {
      setStatus('in_match');
    }
  }, []);

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'match_created':
          setStatus('waiting');
          setMatchId(msg.matchId);
          setPlayerId(msg.playerId);
          setRole(msg.role);
          setSnapshot(msg.snapshot);
          setEvents(['none']);
          setLogDelta([]);
          break;
        case 'match_joined':
          setMatchId(msg.matchId);
          setPlayerId(msg.playerId);
          setRole(msg.role);
          setSnapshot(msg.snapshot);
          setEvents(['none']);
          setLogDelta([]);
          setStatus('in_match');
          break;
        case 'spectator_joined':
          setMatchId(msg.matchId);
          setPlayerId(null);
          setRole('spectator');
          setSnapshot(msg.snapshot);
          setEvents(['none']);
          setLogDelta([]);
          setStatus('spectating');
          break;
        case 'state_update':
          applyStateUpdate(msg.role, msg.snapshot, msg.events, msg.logDelta);
          break;
        case 'match_list':
          setMatchList(msg.matches);
          break;
        case 'opponent_joined':
          setStatus((prev) => (prev === 'spectating' ? prev : 'in_match'));
          break;
        case 'opponent_left':
          setStatus((prev) => (prev === 'spectating' ? prev : 'waiting'));
          break;
        case 'error':
          setError(msg.message);
          setStatus('error');
          break;
        default:
          setError('Mensagem desconhecida do servidor.');
          setStatus('error');
      }
    },
    [applyStateUpdate]
  );

  const connect = useCallback(
    (message: ClientMessage) => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setError(null);
      setStatus('connecting');
      pendingRef.current = message;
      const socket = new WebSocket(serverUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (pendingRef.current) {
          socket.send(JSON.stringify(pendingRef.current));
          pendingRef.current = null;
        }
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as ServerMessage;
          handleServerMessage(parsed);
        } catch (err) {
          setError('Falha ao interpretar resposta do servidor.');
          setStatus('error');
        }
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
          setStatus('idle');
          setRole(null);
          setMatchId(null);
          setPlayerId(null);
        }
      };

      socket.onerror = () => {
        setError('Erro de transporte com o servidor.');
        setStatus('error');
      };
    },
    [handleServerMessage, serverUrl]
  );

  const createMatch = useCallback((name?: string) => {
    connect({ type: 'create_match', name });
  }, [connect]);

  const joinMatch = useCallback((id: string, name?: string) => {
    connect({ type: 'join_match', matchId: id, name });
  }, [connect]);

  const spectateMatch = useCallback((id: string, name?: string) => {
    connect({ type: 'spectate_match', matchId: id, name });
  }, [connect]);

  const ensureSocket = useCallback(() => socketRef.current !== null && socketRef.current.readyState === WebSocket.OPEN, []);

  const playCard = useCallback(
    (cardId: string) => {
      if (!ensureSocket()) return;
      if (!matchId || !playerId) return;
      socketRef.current!.send(
        JSON.stringify(({ type: 'play_card', matchId, playerId, cardId } satisfies ClientMessage))
      );
    },
    [ensureSocket, matchId, playerId]
  );

  const resetMatch = useCallback(() => {
    if (!ensureSocket() || !matchId || !playerId) return;
    socketRef.current!.send(
      JSON.stringify(({ type: 'reset_match', matchId, playerId } satisfies ClientMessage))
    );
  }, [ensureSocket, matchId, playerId]);

  const leaveMatch = useCallback(() => {
    if (ensureSocket() && matchId) {
      const payload: ClientMessage = role === 'spectator'
        ? { type: 'leave_match', matchId }
        : { type: 'leave_match', matchId, playerId: playerId ?? undefined };
      socketRef.current!.send(JSON.stringify(payload));
    }
    cleanup();
  }, [cleanup, ensureSocket, matchId, playerId, role]);

  const refreshMatchList = useCallback(async () => {
    return await new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(serverUrl);
        ws.onopen = () => {
          const payload: ClientMessage = { type: 'list_matches' };
          ws.send(JSON.stringify(payload));
        };
        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data as string) as ServerMessage;
            if (parsed.type === 'match_list') {
              setMatchList(parsed.matches);
              resolve();
              ws.close();
            }
          } catch (err) {
            ws.close();
            reject(err as Error);
          }
        };
        ws.onerror = () => {
          ws.close();
          reject(new Error('Erro ao consultar partidas.'));
        };
      } catch (err) {
        reject(err as Error);
      }
    });
  }, [serverUrl]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    refreshMatchList().catch(() => {
      /* sil�ncio: erro exposto via promise */
    });
  }, [refreshMatchList]);

  return {
    status,
    error,
    matchId,
    playerId,
    role,
    snapshot,
    events,
    logDelta,
    matchList,
    setMatchList,
    createMatch,
    joinMatch,
    spectateMatch,
    refreshMatchList,
    playCard,
    resetMatch,
    leaveMatch,
    clearError,
  };
}
