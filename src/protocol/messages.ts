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
  committed: boolean;
  deckCount: number;
}

export interface MatchSnapshot {
  matchId: string;
  priorityOwner: Priority;
  gameOver: DefeatTag;
  discardCount: number;
  log: string[];
  players: Record<PlayerSlot, PlayerSnapshot>;
  extraPending: 'none' | PlayerSlot;
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
  | { type: 'create_match'; name?: string; deckSeed?: string }
  | { type: 'join_match'; matchId: string; name?: string; deckSeed?: string }
  | { type: 'spectate_match'; matchId: string; name?: string }
  | { type: 'list_matches' }
  | { type: 'play_card'; matchId: string; playerId: string; cardId: string }
  | { type: 'reset_match'; matchId: string; playerId: string }
  | { type: 'leave_match'; matchId: string; playerId?: string }
  | { type: 'invite_friend'; toUserId: string; matchId: string };

export type ServerMessage =
  | { type: 'match_created'; matchId: string; playerId: string; role: PlayerSlot; snapshot: MatchSnapshot }
  | { type: 'match_joined'; matchId: string; playerId: string; role: PlayerSlot; snapshot: MatchSnapshot }
  | { type: 'spectator_joined'; matchId: string; role: 'spectator'; snapshot: MatchSnapshot }
  | { type: 'state_update'; matchId: string; role: ParticipantRole; snapshot: MatchSnapshot; events: ImpactKind[]; logDelta: string[] }
  | { type: 'match_list'; matches: MatchSummary[] }
  | { type: 'opponent_joined'; name: string }
  | { type: 'opponent_left' }
  | { type: 'match_invite'; matchId: string; fromUserId: string; fromName: string }
  | { type: 'error'; message: string };

// A card only becomes visible to the OTHER side once both players have
// revealed one for this round (or window) - broadcastState fires the
// instant a single player confirms, well before their opponent has had a
// chance to react, so without this gate the second player could see the
// first player's actual card before choosing their own, defeating the
// simultaneous-reveal mechanic the whole game is built on. Each player
// (and any spectator) can always see their OWN revealed card immediately.
export function sanitizeSnapshot(snapshot: MatchSnapshot, role: ParticipantRole): MatchSnapshot {
  const bothRevealed = Boolean(snapshot.players.p1.revealed) && Boolean(snapshot.players.p2.revealed);
  const visible = (slot: PlayerSlot) => role === slot || bothRevealed;

  const copy: MatchSnapshot = {
    ...snapshot,
    players: {
      p1: {
        ...snapshot.players.p1,
        hand: [],
        revealed: visible('p1') && snapshot.players.p1.revealed ? { ...snapshot.players.p1.revealed } : null,
      },
      p2: {
        ...snapshot.players.p2,
        hand: [],
        revealed: visible('p2') && snapshot.players.p2.revealed ? { ...snapshot.players.p2.revealed } : null,
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
