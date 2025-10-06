import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import {
  makeDeck,
  initialHandSetup,
  resolveRound,
  resolveSingleAction,
  refillHand,
  canPlayCard,
  MAX_BREATH,
  type PlayerState,
  type Priority,
  type TcgCard,
  type DefeatTag,
  type ImpactKind,
} from '../src/engine';
import {
  type ClientMessage,
  type ServerMessage,
  type MatchSnapshot,
  type PlayerSlot,
  type ParticipantRole,
  type MatchSummary,
  sanitizeSnapshot,
} from '../src/protocol/messages';

const PORT = Number(process.env.PORT ?? 3001);

interface MatchPlayer {
  id: string | null;
  socket: WebSocket | null;
  state: PlayerState;
}

interface SpectatorInfo {
  name?: string;
  socket: WebSocket;
}

interface MatchRecord {
  id: string;
  deck: TcgCard[];
  discard: TcgCard[];
  priorityOwner: Priority;
  log: string[];
  gameOver: DefeatTag;
  createdAt: number;
  players: Record<PlayerSlot, MatchPlayer>;
  spectators: Map<WebSocket, SpectatorInfo>;
  extraPending?: 'none' | 'p1' | 'p2';
}

interface ConnectionInfo {
  matchId: string;
  role: ParticipantRole;
  playerId?: string;
  name?: string;
}

const matches = new Map<string, MatchRecord>();
const connections = new Map<WebSocket, ConnectionInfo>();

function logServer(message: string, extra: Record<string, unknown> = {}) {
  console.log(`[server] ${message}`, extra);
}

function send(socket: WebSocket, payload: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function createMatchRecord(name?: string): MatchRecord {
  const deck = makeDeck();
  const { deck: rest, p1Hand, p2Hand } = initialHandSetup(deck);
  const p1: PlayerState = {
    name: name ?? 'Jogador 1',
    posture: 'A',
    breath: MAX_BREATH,
    hand: p1Hand,
    revealed: null,
  };
  const p2: PlayerState = {
    name: 'Aguardando',
    posture: 'B',
    breath: MAX_BREATH,
    hand: p2Hand,
    revealed: null,
  };
  return {
    id: randomUUID().slice(0, 8),
    deck: rest,
    discard: [],
    priorityOwner: 0,
    log: [],
    gameOver: null,
    createdAt: Date.now(),
    players: {
      p1: { id: null, socket: null, state: p1 },
      p2: { id: null, socket: null, state: p2 },
    },
    spectators: new Map(),
    extraPending: 'none',
  };
}

function toSnapshot(match: MatchRecord): MatchSnapshot {
  return {
    matchId: match.id,
    priorityOwner: match.priorityOwner,
    gameOver: match.gameOver,
    deckCount: match.deck.length,
    discardCount: match.discard.length,
    log: [...match.log],
    players: {
      p1: {
        id: match.players.p1.id,
        name: match.players.p1.state.name,
        posture: match.players.p1.state.posture,
        breath: match.players.p1.state.breath,
        hand: match.players.p1.state.hand.map((card) => ({ ...card })),
        handCount: match.players.p1.state.hand.length,
        revealed: match.players.p1.state.revealed ? { ...match.players.p1.state.revealed } : null,
      },
      p2: {
        id: match.players.p2.id,
        name: match.players.p2.state.name,
        posture: match.players.p2.state.posture,
        breath: match.players.p2.state.breath,
        hand: match.players.p2.state.hand.map((card) => ({ ...card })),
        handCount: match.players.p2.state.hand.length,
        revealed: match.players.p2.state.revealed ? { ...match.players.p2.state.revealed } : null,
      },
    },
  };
}

function toSummary(match: MatchRecord): MatchSummary {
  const seats = {
    p1: { occupied: Boolean(match.players.p1.id), name: match.players.p1.id ? match.players.p1.state.name : null },
    p2: { occupied: Boolean(match.players.p2.id), name: match.players.p2.id ? match.players.p2.state.name : null },
  };
  let status: MatchSummary['status'];
  if (match.gameOver) status = 'finished';
  else if (!seats.p1.occupied || !seats.p2.occupied) status = 'waiting';
  else if (match.players.p1.state.revealed || match.players.p2.state.revealed) status = 'in_round';
  else status = 'full';
  return {
    matchId: match.id,
    hostName: match.players.p1.state.name,
    status,
    seats,
    spectators: match.spectators.size,
    gameOver: match.gameOver,
  };
}

function broadcastState(match: MatchRecord, events: ImpactKind[], logDelta: string[]) {
  const snapshot = toSnapshot(match);
  const p1Socket = match.players.p1.socket;
  const p2Socket = match.players.p2.socket;
  if (p1Socket) {
    const snap = sanitizeSnapshot(snapshot, 'p1');
    send(p1Socket, { type: 'state_update', matchId: match.id, role: 'p1', snapshot: snap, events, logDelta });
  }
  if (p2Socket) {
    const snap = sanitizeSnapshot(snapshot, 'p2');
    send(p2Socket, { type: 'state_update', matchId: match.id, role: 'p2', snapshot: snap, events, logDelta });
  }
  for (const [specSocket] of match.spectators) {
    const snap = sanitizeSnapshot(snapshot, 'spectator');
    send(specSocket, { type: 'state_update', matchId: match.id, role: 'spectator', snapshot: snap, events, logDelta });
  }
}

function resetMatchState(match: MatchRecord) {
  const deck = makeDeck();
  const { deck: rest, p1Hand, p2Hand } = initialHandSetup(deck);
  match.deck = rest;
  match.discard = [];
  match.priorityOwner = 0;
  match.log = [];
  match.gameOver = null;
  match.extraPending = 'none';
  match.players.p1.state = {
    ...match.players.p1.state,
    posture: 'A',
    breath: MAX_BREATH,
    hand: p1Hand,
    revealed: null,
  };
  match.players.p2.state = {
    ...match.players.p2.state,
    posture: 'B',
    breath: MAX_BREATH,
    hand: p2Hand,
    revealed: null,
  };
}

function handleListMatches(socket: WebSocket) {
  const summaries = Array.from(matches.values())
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(toSummary);
  send(socket, { type: 'match_list', matches: summaries });
}

function handleCreateMatch(socket: WebSocket, message: Extract<ClientMessage, { type: 'create_match' }>) {
  const match = createMatchRecord(message.name);
  const playerId = randomUUID();
  match.players.p1.id = playerId;
  match.players.p1.socket = socket;
  match.players.p1.state.name = message.name ?? match.players.p1.state.name;
  matches.set(match.id, match);
  connections.set(socket, { matchId: match.id, role: 'p1', playerId, name: match.players.p1.state.name });

  const snapshot = sanitizeSnapshot(toSnapshot(match), 'p1');
  send(socket, { type: 'match_created', matchId: match.id, playerId, role: 'p1', snapshot });
  logServer('match_created', { matchId: match.id, playerId });
}

function handleJoinMatch(socket: WebSocket, message: Extract<ClientMessage, { type: 'join_match' }>) {
  const match = matches.get(message.matchId);
  if (!match) {
    send(socket, { type: 'error', message: 'Partida inexistente.' });
    return;
  }

  const availableSlot: PlayerSlot | null = !match.players.p1.id ? 'p1' : !match.players.p2.id ? 'p2' : null;
  if (!availableSlot) {
    send(socket, { type: 'error', message: 'Partida ja esta cheia.' });
    return;
  }

  const playerId = randomUUID();
  const player = match.players[availableSlot];
  player.id = playerId;
  player.socket = socket;
  player.state.name = message.name ?? (availableSlot === 'p1' ? 'Jogador 1' : 'Jogador 2');
  connections.set(socket, { matchId: match.id, role: availableSlot, playerId, name: player.state.name });

  if (match.players.p1.id && match.players.p2.id) {
    resetMatchState(match);
  }

  const snapshot = sanitizeSnapshot(toSnapshot(match), availableSlot);
  if (availableSlot === 'p1') {
    match.players.p2.state.name = match.players.p2.id ? match.players.p2.state.name : 'Aguardando';
  }

  send(socket, { type: 'match_joined', matchId: match.id, playerId, role: availableSlot, snapshot });

  const otherSlot: PlayerSlot = availableSlot === 'p1' ? 'p2' : 'p1';
  const opponent = match.players[otherSlot];
  if (opponent.socket) {
    send(opponent.socket, { type: 'opponent_joined', name: player.state.name });
  }

  broadcastState(match, ['none'], []);
  logServer('player_joined', { matchId: match.id, role: availableSlot, playerId });
}

function handleSpectateMatch(socket: WebSocket, message: Extract<ClientMessage, { type: 'spectate_match' }>) {
  const match = matches.get(message.matchId);
  if (!match) {
    send(socket, { type: 'error', message: 'Partida inexistente.' });
    return;
  }
  const info: ConnectionInfo = { matchId: match.id, role: 'spectator', name: message.name?.trim() || undefined };
  connections.set(socket, info);
  match.spectators.set(socket, { socket, name: info.name });

  const snapshot = sanitizeSnapshot(toSnapshot(match), 'spectator');
  send(socket, { type: 'spectator_joined', matchId: match.id, role: 'spectator', snapshot });
  logServer('spectator_joined', { matchId: match.id, name: info.name });
}

function handlePlayCard(socket: WebSocket, info: ConnectionInfo, message: Extract<ClientMessage, { type: 'play_card' }>) {
  const match = matches.get(info.matchId);
  if (!match) {
    send(socket, { type: 'error', message: 'Partida nao encontrada.' });
    return;
  }
  if (info.role === 'spectator') {
    send(socket, { type: 'error', message: 'Espectadores nao podem jogar cartas.' });
    return;
  }
  if (match.gameOver) {
    send(socket, { type: 'error', message: 'Partida encerrada. Solicite reset.' });
    return;
  }

  const slot = match.players[info.role];
  const opponentSlot = match.players[info.role === 'p1' ? 'p2' : 'p1'];
  if (slot.id !== info.playerId) {
    send(socket, { type: 'error', message: 'Identificador invalido.' });
    return;
  }
  if (slot.state.revealed) {
    send(socket, { type: 'error', message: 'Carta ja selecionada nesta rodada.' });
    return;
  }

  const idx = slot.state.hand.findIndex((card) => card.id === message.cardId);
  if (idx === -1) {
    send(socket, { type: 'error', message: 'Carta nao esta na mao.' });
    return;
  }
  const card = slot.state.hand[idx];
  if (!canPlayCard(slot.state, card)) {
    send(socket, { type: 'error', message: 'Requisitos ou folego insuficiente.' });
    return;
  }

  // Extra action window: only the granted player may act; resolve immediately without opponent reaction
  if (match.extraPending && match.extraPending !== 'none') {
    if (info.role !== match.extraPending) {
      send(socket, { type: 'error', message: 'Nao e sua janela de contra-ataque.' });
      return;
    }

    // consume from hand for the extra
    slot.state.hand.splice(idx, 1);
    const tempActor: PlayerState = { ...slot.state, revealed: { ...card } };
    const tempTarget: PlayerState = { ...opponentSlot.state };

    const { actor, target, events, log: logDelta, defeated, consumedCards } = resolveSingleAction(
      tempActor,
      tempTarget,
      info.role as 'p1' | 'p2',
      { free: true }
    );

    // Apply results
    match.players[info.role].state = { ...actor };
    match.players[info.role === 'p1' ? 'p2' : 'p1'].state = { ...target };
    match.discard.push(...consumedCards.p1.map((c: TcgCard) => ({ ...c })), ...consumedCards.p2.map((c: TcgCard) => ({ ...c })));
    match.log = [...logDelta, ...match.log];
    match.gameOver = defeated;

    if (defeated) {
      match.extraPending = 'none';
      broadcastState(match, events, logDelta);
      return;
    }

    const anotherExtra = events.some((k) => k === 'extra_granted_p1' || k === 'extra_granted_p2');
    if (anotherExtra) {
      match.extraPending = events.includes('extra_granted_p1') ? 'p1' : 'p2';
      broadcastState(match, events, logDelta);
      return;
    }

    // End of round after extra window: refill hands
    match.extraPending = 'none';
    const refillP1 = refillHand(match.players.p1.state.hand, match.deck);
    match.players.p1.state.hand = refillP1.hand;
    match.deck = refillP1.deck;
    const refillP2 = refillHand(match.players.p2.state.hand, match.deck);
    match.players.p2.state.hand = refillP2.hand;
    match.deck = refillP2.deck;

    broadcastState(match, events, logDelta);
    return;
  }

  // Normal flow: set revealed and if both revealed, resolve the round
  slot.state.hand.splice(idx, 1);
  slot.state.revealed = { ...card };

  broadcastState(match, ['none'], []);

  if (slot.state.revealed && opponentSlot.state.revealed) {
    const result = resolveRound(match.players.p1.state, match.players.p2.state, match.priorityOwner);
    match.priorityOwner = result.nextPriorityOwner;
    match.gameOver = result.defeated;
    match.players.p1.state = { ...result.p1 };
    match.players.p2.state = { ...result.p2 };
    match.discard.push(...result.consumedCards.p1.map((c) => ({ ...c })), ...result.consumedCards.p2.map((c) => ({ ...c })));
    match.log = [...result.log, ...match.log];

    const hasExtra = result.events.some((k) => k === 'extra_granted_p1' || k === 'extra_granted_p2');

    if (!result.defeated && !hasExtra) {
      const refillP1 = refillHand(match.players.p1.state.hand, match.deck);
      match.players.p1.state.hand = refillP1.hand;
      match.deck = refillP1.deck;
      const refillP2 = refillHand(match.players.p2.state.hand, match.deck);
      match.players.p2.state.hand = refillP2.hand;
      match.deck = refillP2.deck;
      match.extraPending = 'none';
    } else if (hasExtra) {
      match.extraPending = result.events.includes('extra_granted_p1') ? 'p1' : 'p2';
    }

    broadcastState(match, result.events, result.log);
  }
}

function handleResetMatch(info: ConnectionInfo) {
  if (info.role === 'spectator') return;
  const match = matches.get(info.matchId);
  if (!match) return;
  resetMatchState(match);
  broadcastState(match, ['none'], []);
  logServer('match_reset', { matchId: match.id });
}

function handleLeave(socket: WebSocket, info: ConnectionInfo | undefined) {
  if (!info) return;
  const match = matches.get(info.matchId);
  if (!match) {
    connections.delete(socket);
    return;
  }

  if (info.role === 'spectator') {
    match.spectators.delete(socket);
    connections.delete(socket);
    logServer('spectator_left', { matchId: match.id, name: info.name });
    broadcastState(match, ['none'], []);
    return;
  }

  const slot = match.players[info.role];
  slot.id = null;
  slot.socket = null;
  slot.state.name = 'Aguardando';
  slot.state.hand = [];
  slot.state.revealed = null;
  slot.state.posture = info.role === 'p1' ? 'A' : 'B';
  slot.state.breath = MAX_BREATH;

  const opponentSlot = match.players[info.role === 'p1' ? 'p2' : 'p1'];
  if (opponentSlot.socket) {
    send(opponentSlot.socket, { type: 'opponent_left' });
    resetMatchState(match);
    match.extraPending = 'none';
    broadcastState(match, ['none'], []);
  } else {
    for (const [specSocket] of match.spectators) {
      send(specSocket, { type: 'error', message: 'Partida encerrada.' });
      connections.delete(specSocket);
      specSocket.close();
    }
    match.spectators.clear();
    matches.delete(match.id);
  }

  connections.delete(socket);
  logServer('player_left', { matchId: match.id, role: info.role });
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(raw.toString()) as ClientMessage;
    } catch (error) {
      send(socket, { type: 'error', message: 'Formato invalido.' });
      return;
    }

    const info = connections.get(socket);

    switch (parsed.type) {
      case 'create_match':
        handleCreateMatch(socket, parsed);
        break;
      case 'join_match':
        handleJoinMatch(socket, parsed);
        break;
      case 'spectate_match':
        handleSpectateMatch(socket, parsed);
        break;
      case 'list_matches':
        handleListMatches(socket);
        break;
      case 'play_card':
        if (!info) {
          send(socket, { type: 'error', message: 'Nao vinculado a nenhuma partida.' });
          return;
        }
        handlePlayCard(socket, info, parsed);
        break;
      case 'reset_match':
        if (!info) return;
        handleResetMatch(info);
        break;
      case 'leave_match':
        handleLeave(socket, info);
        break;
      default:
        send(socket, { type: 'error', message: 'Mensagem desconhecida.' });
    }
  });

  socket.on('close', () => {
    const info = connections.get(socket);
    handleLeave(socket, info);
  });
});

logServer('listening', { port: PORT });
