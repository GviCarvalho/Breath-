# Breath! Networking Protocol

## Conexão
- Servidor WebSocket padrão: `ws://localhost:3001`.
- Todas as mensagens trafegam em JSON UTF-8 e possuem a propriedade `type`.
- **Autenticação**: O servidor lê o cookie `access_token` (JWT) durante o upgrade do WebSocket.
  - Jogadores (p1/p2) **precisam** estar autenticados.
  - Espectadores **não** precisam de autenticação.

## Autenticação HTTP

Antes de criar ou entrar em partidas, jogadores devem autenticar via OAuth:

### Endpoints de Autenticação
- `GET /auth/google` - Inicia fluxo OAuth do Google
- `GET /auth/google/callback` - Callback do Google OAuth
- `GET /auth/discord` - Inicia fluxo OAuth do Discord
- `GET /auth/discord/callback` - Callback do Discord OAuth
- `GET /auth/me` - Retorna informações do usuário autenticado
- `POST /auth/logout` - Remove cookie de autenticação

### Fluxo de Autenticação
1. Client redireciona para `/auth/google` ou `/auth/discord`
2. Usuário autoriza a aplicação no provedor OAuth
3. Servidor recebe callback, cria/atualiza usuário no banco
4. Servidor emite cookie `access_token` (JWT) com flags:
   - `HttpOnly`: Cookie não acessível via JavaScript
   - `Secure`: Apenas HTTPS (em produção)
   - `SameSite=None`: Permite cross-origin (em produção)
   - Validade: 7 dias
5. Client é redirecionado de volta com cookie válido

### Estrutura do JWT
```json
{
  "userId": "cuid",
  "provider": "google" | "discord",
  "displayName": "Nome do Usuário"
}
```

## Mensagens do Cliente
- `create_match` `{ type, name? }`
  - Cria nova partida e ocupa o slot P1.
  - **Requer autenticação**.
- `join_match` `{ type, matchId, name? }`
  - Entra em uma partida aberta (P1 ou P2, dependendo da vaga disponível).
  - **Requer autenticação**.
- `spectate_match` `{ type, matchId, name? }`
  - Entra como espectador (sem interações de jogo).
  - **Não requer autenticação**.
- `list_matches` `{ type }`
  - Solicita o lobby com partidas disponíveis.
- `play_card` `{ type, matchId, playerId, cardId }`
  - Envia a carta escolhida pelo jogador para a rodada atual.
  - O servidor valida usando `userId` do JWT (ignora `playerId` do client).
- `reset_match` `{ type, matchId, playerId }`
  - Reinicia a partida (embaralhando deck e distribuindo novas mãos).
- `leave_match` `{ type, matchId, playerId? }`
  - Sai da partida (o campo `playerId` é omitido por espectadores).

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
  hand: TcgCard[];      // apenas para quem está controlando o lado
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

Os snapshots enviados para cada participante são sanitizados pelo servidor:
- Jogadores recebem a própria mão completa em `hand`, enquanto o oponente possui apenas `handCount`.
- Espectadores recebem ambas as mãos ocultas (`hand` vazio), mas veem cartas reveladas e eventos.

## Fluxo Básico
1. Cliente envia `create_match` → servidor responde com `match_created` contendo `matchId` e `playerId`.
2. Outro jogador envia `join_match` → servidor responde com `match_joined` para o novo participante e `opponent_joined` para o anfitrião.
3. Espectadores podem entrar a qualquer momento com `spectate_match` → recebem `spectator_joined` e passam a ouvir `state_update`.
4. Jogadores enviam `play_card`. Assim que ambos revelam, o servidor aplica `resolveRound` e transmite `state_update` com a sequência de `events`.
5. Ao finalizar a rodada, cada lado compra automaticamente até 3 cartas. Se `gameOver` for diferente de `null`, ninguém pode jogar novas cartas até que `reset_match` seja chamado.
6. `leave_match` libera o slot correspondente (ou fecha a partida caso não reste nenhum jogador). Espectadores também devem enviar `leave_match` ou simplesmente encerrar a conexão.
7. O lobby (`list_matches`) pode ser consultado a qualquer momento para descobrir partidas abertas ou em andamento.

## Observações
- O servidor valida postura, custo e prioridade antes de aceitar um `play_card`.
- IDs de cartas são gerados no lado do servidor e permanecem consistentes durante toda a partida.
- O campo `events` em `state_update` descreve, em ordem, os efeitos que a camada de interface deve animar (`p1_hits`, `blocked_p2`, etc.).
- Mensagens de erro (`error`) não encerram a conexão: o cliente pode ajustar a ação e reenviar.
