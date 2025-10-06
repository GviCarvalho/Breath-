# Breath! Networking Protocol

## Conex�o
- Servidor WebSocket padr�o: `ws://localhost:3001`.
- Todas as mensagens trafegam em JSON UTF-8 e possuem a propriedade `type`.

## Mensagens do Cliente
- `create_match` `{ type, name? }`
  - Cria nova partida e ocupa o slot P1.
- `join_match` `{ type, matchId, name? }`
  - Entra em uma partida aberta (P1 ou P2, dependendo da vaga dispon�vel).
- `spectate_match` `{ type, matchId, name? }`
  - Entra como espectador (sem intera��es de jogo).
- `list_matches` `{ type }`
  - Solicita o lobby com partidas dispon�veis.
- `play_card` `{ type, matchId, playerId, cardId }`
  - Envia a carta escolhida pelo jogador para a rodada atual.
- `reset_match` `{ type, matchId, playerId }`
  - Reinicia a partida (embaralhando deck e distribuindo novas m�os).
- `leave_match` `{ type, matchId, playerId? }`
  - Sai da partida (o campo `playerId` � omitido por espectadores).

## Mensagens do Servidor
- `match_created` `{ type, matchId, playerId, role, snapshot }`
- `match_joined` `{ type, matchId, playerId, role, snapshot }`
- `spectator_joined` `{ type, matchId, role: 'spectator', snapshot }`
- `state_update` `{ type, matchId, role, snapshot, events, logDelta }`
- `match_list` `{ type, matches: MatchSummary[] }`
- `opponent_joined` `{ type, name }`
- `opponent_left` `{ type }`
- `error` `{ type, message }`

## Estruturas
```ts
interface PlayerSnapshot {
  id: string | null;
  name: string;
  posture: Posture;
  breath: number;
  hand: TcgCard[];      // apenas para quem est� controlando o lado
  handCount: number;
  revealed: TcgCard | null;
}

interface MatchSnapshot {
  matchId: string;
  priorityOwner: Priority;
  gameOver: DefeatTag;
  deckCount: number;
  discardCount: number;
  log: string[];        // log completo (mais recente primeiro)
  players: { p1: PlayerSnapshot; p2: PlayerSnapshot };
}

interface MatchSummary {
  matchId: string;
  hostName: string;
  status: 'waiting' | 'full' | 'in_round' | 'finished';
  seats: {
    p1: { occupied: boolean; name: string | null };
    p2: { occupied: boolean; name: string | null };
  };
  spectators: number;
  gameOver: DefeatTag;
}
```

Os snapshots enviados para cada participante s�o sanitizados pelo servidor:
- Jogadores recebem a pr�pria m�o completa em `hand`, enquanto o oponente possui apenas `handCount`.
- Espectadores recebem ambas as m�os ocultas (`hand` vazio), mas veem cartas reveladas e eventos.

## Fluxo B�sico
1. Cliente envia `create_match` ? servidor responde com `match_created` contendo `matchId` e `playerId`.
2. Outro jogador envia `join_match` ? servidor responde com `match_joined` para o novo participante e `opponent_joined` para o anfitri�o.
3. Espectadores podem entrar a qualquer momento com `spectate_match` ? recebem `spectator_joined` e passam a ouvir `state_update`.
4. Jogadores enviam `play_card`. Assim que ambos revelam, o servidor aplica `resolveRound` e transmite `state_update` com a sequ�ncia de `events`.
5. Ao finalizar a rodada, cada lado compra automaticamente at� 3 cartas. Se `gameOver` for diferente de `null`, ningu�m pode jogar novas cartas at� que `reset_match` seja chamado.
6. `leave_match` libera o slot correspondente (ou fecha a partida caso n�o reste nenhum jogador). Espectadores tamb�m devem enviar `leave_match` ou simplesmente encerrar a conex�o.
7. O lobby (`list_matches`) pode ser consultado a qualquer momento para descobrir partidas abertas ou em andamento.

## Observa��es
- O servidor valida postura, custo e prioridade antes de aceitar um `play_card`.
- IDs de cartas s�o gerados no lado do servidor e permanecem consistentes durante toda a partida.
- O campo `events` em `state_update` descreve, em ordem, os efeitos que a camada de interface deve animar (`p1_hits`, `blocked_p2`, etc.).
- Mensagens de erro (`error`) n�o encerram a conex�o: o cliente pode ajustar a a��o e reenviar.
