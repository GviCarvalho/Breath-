# Breath! TCG Prototype

Protótipo do card game Breath!, construído com React + Vite para experimentos locais/online com autenticação OAuth e persistência em Postgres.

## GitHub Pages Deployment

The app is automatically deployed to GitHub Pages at:
**https://gvicarvalho.github.io/Breath-/**

Deployments happen automatically on every push to the `main` branch via GitHub Actions.

## Requisitos
- Node.js 18+
- Docker (opcional, para Postgres local)
- PostgreSQL 15+ (se não usar Docker)

## Instalação

```bash
npm install
```

## Configuração do Ambiente

1. Copie o arquivo de exemplo de variáveis de ambiente:
```bash
cp .env.example .env
```

2. Edite o arquivo `.env` e configure as variáveis necessárias:

### Banco de Dados (Postgres)

**Opção 1: Usando Docker (Recomendado)**
```bash
npm run docker:db
```
Isso iniciará um container Postgres com as configurações padrão do `.env.example`.

**Opção 2: Postgres Local**
- Instale PostgreSQL 15+
- Crie um banco de dados chamado `breath_db`
- Atualize a `DATABASE_URL` no `.env` com suas credenciais

### OAuth Configuration

Para habilitar autenticação, você precisa configurar aplicações OAuth:

#### Google OAuth
1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a API do Google+ 
4. Vá em "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure as origens autorizadas:
   - Desenvolvimento: `http://localhost:5173`
   - Produção: `https://gvicarvalho.github.io`
6. Configure os URIs de redirecionamento:
   - Desenvolvimento: `http://localhost:3001/auth/google/callback`
   - Produção: `https://seu-servidor.com/auth/google/callback`
7. Copie o Client ID e Client Secret para o `.env`

#### Discord OAuth
1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Clique em "New Application"
3. Vá em "OAuth2" no menu lateral
4. Configure os redirects:
   - Desenvolvimento: `http://localhost:3001/auth/discord/callback`
   - Produção: `https://seu-servidor.com/auth/discord/callback`
5. Copie o Client ID e Client Secret para o `.env`

### JWT Secret
Gere uma chave secreta forte para JWT:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Use o resultado no `.env` como `JWT_SECRET`.

## Setup do Banco de Dados

Após configurar a `DATABASE_URL`, execute:

```bash
# Gerar o Prisma Client
npm run db:generate

# Executar migrações
npm run db:migrate
```

## Scripts

- `npm run dev` – inicia o client em modo desenvolvimento (Vite).
- `npm run server` – sobe o servidor HTTP/WebSocket (auth + matchmaking).
- `npm run build` – gera build de produção do client.
- `npm test` – executa testes de regras da engine (Vitest).
- `npm run docker:db` – inicia Postgres via Docker Compose.
- `npm run db:generate` – gera o Prisma Client.
- `npm run db:migrate` – executa migrações do banco de dados.
- `npm run db:studio` – abre Prisma Studio para gerenciar o banco.

## Desenvolvimento Local

Para testar o modo online localmente você precisa rodar dois processos:

### Terminal 1: Servidor
```bash
npm run server
```
O servidor iniciará em `http://localhost:3001` com:
- HTTP endpoints de autenticação (`/auth/*`)
- WebSocket server para matchmaking e gameplay
- CORS configurado para `http://localhost:5173` e `https://gvicarvalho.github.io`

### Terminal 2: Client
```bash
npm run dev
```
O client Vite iniciará em `http://localhost:5173`

### Fluxo de Autenticação

1. Acesse `http://localhost:5173`
2. Clique em "Login with Google" ou "Login with Discord"
3. Complete o fluxo OAuth no provedor
4. Você será redirecionado de volta com um cookie httpOnly contendo o JWT
5. Use `/auth/me` para verificar o status de autenticação

## Arquitetura de Autenticação

### Cookie-based JWT
- Cookie `access_token` com flags `HttpOnly`, `Secure` (prod), `SameSite=None` (prod)
- JWT contém: `userId`, `provider`, `displayName`
- Validade: 7 dias

### WebSocket Autenticado
- Cookie é lido durante upgrade da conexão WebSocket
- Jogadores (p1/p2) **devem** estar autenticados
- Espectadores **não** precisam de autenticação
- `playerId` do client é ignorado para usuários autenticados

### CORS
- Development: `http://localhost:5173`
- Production: `https://gvicarvalho.github.io`
- Credentials habilitado para permitir cookies cross-origin

## Recursos

- Engine modular (`src/engine`) com regras aderentes ao manual e bateria de testes.
- Modo Local com possibilidade de AI ou hot-seat (dois jogadores compartilhando o mesmo dispositivo).
- Modo Online com:
  - Autenticação via Google ou Discord OAuth
  - Lobby com criação/entrada via match ID
  - Espectador (anônimo permitido)
  - Feedback em tempo real via WebSocket
- Protocolo documentado em [`docs/networking.md`](docs/networking.md).
- Persistência de usuários em PostgreSQL via Prisma.

## Estrutura do Projeto

```
├── src/
│   ├── engine/          # Lógica do jogo (regras, cartas, AI)
│   ├── protocol/        # Tipos e mensagens WebSocket
│   ├── components/      # Componentes React
│   └── ...
├── server/
│   ├── auth/            # Estratégias OAuth e rotas de autenticação
│   ├── lib/             # Utilitários (JWT, cookies, Prisma)
│   ├── middleware/      # Middlewares Express
│   └── index.ts         # Servidor HTTP + WebSocket integrado
├── prisma/
│   └── schema.prisma    # Schema do banco de dados
└── docs/
    └── networking.md    # Documentação do protocolo
```

## Limitações de Desenvolvimento Local

### HTTPS e Cookies Secure
Em desenvolvimento local (HTTP), o cookie não terá a flag `Secure`. Isso é aceitável para testes locais, mas em produção o servidor **deve** rodar em HTTPS.

### Cross-Origin Cookies
Para testar com o frontend deployado em GitHub Pages (`https://gvicarvalho.github.io`) apontando para seu servidor local, você precisará:
1. Usar HTTPS no servidor local (ex: ngrok, localtunnel)
2. Configurar `NODE_ENV=production` para habilitar `SameSite=None; Secure`

## Próximos passos

- Implementar persistência de partidas no banco.
- Adicionar histórico de partidas por usuário.
- Implementar ranking/leaderboard.
- Melhorar AI com heurísticas configuráveis.
- Adicionar replays ou modo espectador com histórico completo.
