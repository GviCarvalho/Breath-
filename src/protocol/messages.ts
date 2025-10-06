import type { Priority, ImpactKind, DefeatTag, TcgCard, PlayerState } from '../engine';

export type PlayerSlot = 'p1' | 'p2';
export type ParticipantRole = PlayerSlot | 'spectator';

export interface PlayerSnapshot {
  id: string | null;
  name: string;
  posture: PlayerState['posture'];
  breath: number;
  hand: TcgCard[];
  handCount: number;
  revealed: TcgCard | null;
}

export interface MatchSnapshot {
  matchId: string;
  priorityOwner: Priority;
  gameOver: DefeatTag;
  deckCount: number;
  discardCount: number;
  log: string[];
  players: Record<PlayerSlot, PlayerSnapshot>;
}

export interface MatchSummary {
  matchId: string;
  hostName: string;
  status: 'waiting' | 'full' | 'in_round' | 'finished';
  seats: Record<PlayerSlot, { occupied: boolean; name: string | null }>;
  spectators: number;
  gameOver: DefeatTag;
}

export type ClientMessage =
  | { type: 'create_match'; name?: string }
  | { type: 'join_match'; matchId: string; name?: string }
  | { type: 'spectate_match'; matchId: string; name?: string }
  | { type: 'list_matches' }
  | { type: 'play_card'; matchId: string; playerId: string; cardId: string }
  | { type: 'reset_match'; matchId: string; playerId: string }
  | { type: 'leave_match'; matchId: string; playerId?: string };

export type ServerMessage =
  | { type: 'match_created'; matchId: string; playerId: string; role: PlayerSlot; snapshot: MatchSnapshot }
  | { type: 'match_joined'; matchId: string; playerId: string; role: PlayerSlot; snapshot: MatchSnapshot }
  | { type: 'spectator_joined'; matchId: string; role: 'spectator'; snapshot: MatchSnapshot }
  | { type: 'state_update'; matchId: string; role: ParticipantRole; snapshot: MatchSnapshot; events: ImpactKind[]; logDelta: string[] }
  | { type: 'match_list'; matches: MatchSummary[] }
  | { type: 'opponent_joined'; name: string }
  | { type: 'opponent_left' }
  | { type: 'error'; message: string };

export function sanitizeSnapshot(snapshot: MatchSnapshot, role: ParticipantRole): MatchSnapshot {
  const copy: MatchSnapshot = {
    ...snapshot,
    players: {
      p1: {
        ...snapshot.players.p1,
        hand: [],
        revealed: snapshot.players.p1.revealed ? { ...snapshot.players.p1.revealed } : null,
      },
      p2: {
        ...snapshot.players.p2,
        hand: [],
        revealed: snapshot.players.p2.revealed ? { ...snapshot.players.p2.revealed } : null,
      },
    },
    log: [...snapshot.log],
  };

  if (role === 'spectator') {
    return copy;
  }

  const mine = copy.players[role];
  mine.hand = snapshot.players[role].hand.map((card) => ({ ...card }));
  return copy;
}
