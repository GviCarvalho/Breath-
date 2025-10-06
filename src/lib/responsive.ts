// Função para calcular e definir tamanhos responsivos
export function setupResponsiveCards() {
    const updateSizes = () => {
        const root = document.documentElement;

        // Pega as dimensões da área de jogo (hud). Se não existir, tenta a raiz .breath-root
        let container = document.querySelector('.hud') as HTMLElement | null;
        if (!container) container = document.querySelector('.breath-root') as HTMLElement | null;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const gameWidth = rect.width || window.innerWidth;
        const gameHeight = rect.height || window.innerHeight;

        // Resolução base para comparação (design reference)
        const BASE_W = 1920;
        const BASE_H = 1080;

        // Calcula fatores individuais
        const scaleW = gameWidth / BASE_W;
        const scaleH = gameHeight / BASE_H;

                    // Use the geometric mean so both width and height influence scale
                    let scale = Math.sqrt(scaleW * scaleH);

                    // If the viewport is very wide (ultrawide), avoid exploding the scale.
                    // For ultrawide monitors (aspect ratio > 2), cap the scale to a near-default value
                    // so the layout stays similar to the previous comfortable ultrawide sizing.
                    const aspect = gameWidth / Math.max(1, gameHeight);
                        if (aspect > 2.0) {
                            // Reverter para scale base (1.0) em ultrawide para manter o visual anterior
                            scale = Math.min(scale, 1.0);
                        }

        // Limites para evitar que fique muito pequeno ou enorme (mais permissivo que antes)
        const MIN_SCALE = 0.65;
        const MAX_SCALE = 1.8;
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

        // Valores base (para scale = 1) — ajuste fino: escolhi valores médios confortáveis
        const BASE_CARD_W = 140; // px at scale=1
        const CARD_ASPECT = 1.45; // height = width * aspect

        // Calcula tamanho da carta baseado no scale, com limites absolutos para segurança
        const computedCardW = Math.round(Math.max(80, Math.min(220, BASE_CARD_W * scale)));
        let computedCardH = Math.round(computedCardW * CARD_ASPECT);

        // Garante que altura da carta não ultrapasse uma porcentagem da área de jogo
        const maxCardH = Math.max(120, Math.floor(gameHeight * 0.32));
        if (computedCardH > maxCardH) {
            computedCardH = maxCardH;
        }

        // Ajustes de espaçamento proporcionais
        const cardGap = Math.max(8, Math.round(computedCardW * 0.08)); // 8%
        const laneGap = Math.max(24, Math.round(computedCardW * 0.5)); // 50%
        const cardRaise = Math.max(12, Math.round(computedCardW * 0.18));

        // Aplica as variáveis no :root
        root.style.setProperty('--ui-scale', String(scale));
        root.style.setProperty('--card-width', `${computedCardW}px`);
        root.style.setProperty('--card-height', `${computedCardH}px`);
        root.style.setProperty('--card-gap', `${cardGap}px`);
        root.style.setProperty('--lane-gap', `${laneGap}px`);
        root.style.setProperty('--card-raise', `${cardRaise}px`);
                // deck fallback offsets (in case elements are not yet in DOM)
                const deckHOffset = Math.max(24, Math.min(180, Math.round(computedCardW * 0.5)));
                const fallbackX = `${deckHOffset}px`;
                const fallbackY = `20px`;

                // Compute precise translations so that a value of 0px === deck center at board center.
                // We'll compute per-deck translations: bottom moves to mirrored position relative to board center,
                // and top will be placed as the mirror of bottom (so it's symmetric around the board center).
                const boardEl = document.querySelector('.board') as HTMLElement | null;
                const bottomDeckEl = document.querySelector('.deck-wrap.deck-bottom') as HTMLElement | null;
                const topDeckEl = document.querySelector('.deck-wrap.deck-top') as HTMLElement | null;

                if (boardEl && bottomDeckEl) {
                    const bRect = boardEl.getBoundingClientRect();
                    const boardCenterX = Math.round(bRect.left + bRect.width / 2);
                    const boardCenterY = Math.round(bRect.top + bRect.height / 2);

                    const bottomRect = bottomDeckEl.getBoundingClientRect();
                    const bottomCenterX = Math.round(bottomRect.left + bottomRect.width / 2);
                    const bottomCenterY = Math.round(bottomRect.top + bottomRect.height / 2);

                    // Vector from board center to bottom deck center
                    const vBottomX = bottomCenterX - boardCenterX;
                    const vBottomY = bottomCenterY - boardCenterY;

                    // We want CSS vars such that 0 means 'center of board'.
                    // To move the bottom deck so its center equals board center, translation should be -vBottom.
                    const bottomTranslateX = -vBottomX; // boardCenter - bottomCenter
                    const bottomTranslateY = -vBottomY;

                    root.style.setProperty('--deck-bottom-translate-x', `${bottomTranslateX}px`);
                    root.style.setProperty('--deck-bottom-translate-y', `${bottomTranslateY}px`);

                    // For the top deck: target mirrored position across board center.
                    if (topDeckEl) {
                        const topRect = topDeckEl.getBoundingClientRect();
                        const topCenterX = Math.round(topRect.left + topRect.width / 2);
                        const topCenterY = Math.round(topRect.top + topRect.height / 2);

                        // mirrored center (relative to board center): C - vBottom = C - (bottomCenter - C) = 2*C - bottomCenter
                        const mirroredTopCenterX = boardCenterX - vBottomX;
                        const mirroredTopCenterY = boardCenterY - vBottomY;

                        const topTranslateX = mirroredTopCenterX - topCenterX;
                        const topTranslateY = mirroredTopCenterY - topCenterY;

                        root.style.setProperty('--deck-top-translate-x', `${topTranslateX}px`);
                        root.style.setProperty('--deck-top-translate-y', `${topTranslateY}px`);
                    } else {
                        // If top deck missing, mirror bottom translation as a reasonable default
                        root.style.setProperty('--deck-top-translate-x', `${-bottomTranslateX}px`);
                        root.style.setProperty('--deck-top-translate-y', `${-bottomTranslateY}px`);
                    }
                } else {
                    // Fallback defaults
                    root.style.setProperty('--deck-bottom-translate-x', fallbackX);
                    root.style.setProperty('--deck-bottom-translate-y', fallbackY);
                    root.style.setProperty('--deck-top-translate-x', `calc(${fallbackX} * -1)`);
                    root.style.setProperty('--deck-top-translate-y', `calc(${fallbackY} * -1)`);
                }
    };

    // Debounce simples para resize
    let raf = 0;
    const onResize = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => updateSizes());
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    // Calibra ao montar
    updateSizes();

    // Retorna cleanup
    return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
        if (raf) cancelAnimationFrame(raf);
    };
}