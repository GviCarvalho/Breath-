<<<<<<< HEAD
# Breath-
=======
# Breath! TCG Prototype

Prot�tipo do card game **Breath!**, constru�do com React + Vite para experimentos locais/online.

# Breath-

Protótipo do card game Breath!, construído com React + Vite para experimentos locais/online.

## Requisitos
- Node.js 18+

## Instalação
```bash
npm install
```

## Scripts
- `npm run dev` – inicia o client em modo desenvolvimento (Vite).
- `npm run server` – sobe o servidor WebSocket (matchmaking/lobby).
- `npm run build` – gera build de produção do client.
- `npm test` – executa testes de regras da engine (Vitest).

Para testar o modo online localmente você precisa rodar dois processos:
1. `npm run server`
2. `npm run dev`

## Recursos
- Engine modular (`src/engine`) com regras aderentes ao manual e bateria de testes.
- Modo Local com possibilidade de AI ou hot-seat (dois jogadores compartilhando o mesmo dispositivo).
- Modo Online com lobby, criação/entrada via match ID, espectador e feedback em tempo real.
- Protocolo documentado em [`docs/networking.md`](docs/networking.md).

## Próximos passos
- Implementar persistência/telemetria de partidas.
- Melhorar AI com heurísticas configuráveis.
- Adicionar replays ou modo espectador com histórico completo.
