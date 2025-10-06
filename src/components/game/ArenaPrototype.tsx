import React, { useEffect, useRef, useState } from 'react';
import '@/features/arena/arena.css';
import { type TcgCard, HAND_SIZE, MAX_BREATH } from '@/engine';
import { CardFront, FlipCard, CardBack } from './ui3';
import { setupResponsiveCards } from '@/lib/responsive';

type Posture = 'A' | 'B' | 'C';

export interface ArenaProps {
  p1: { name: string; posture: Posture; breath: number; hand: TcgCard[]; revealed?: TcgCard | null; facedownCount?: number };
  p2: { name: string; posture: Posture; breath: number; hand: TcgCard[]; revealed?: TcgCard | null; facedownCount?: number };
  p1Wins?: number;
  p2Wins?: number;
  deckP1Count: number;
  deckP2Count: number;
  priorityOwner: 0 | 1;
  log: string[];
  selectedIdx?: number | null;
  selectedP2Idx?: number | null;
  invalidIdx?: number | null;
  invalidP2Idx?: number | null;
  hoverCard?: TcgCard | null;
  extraPending?: 'none' | 'p1' | 'p2';
  decisionProgress?: number;
  waitingForOpponent?: boolean;
  showP1Facedown?: boolean;
  showP2Facedown?: boolean;

  onClickP1Card?: (c: TcgCard, idx: number) => void;
  onClickP2Card?: (c: TcgCard, idx: number) => void;
  onClickSetP1Posture?: (p: Posture) => void;
  onClickSetP2Posture?: (p: Posture) => void; // Adiciona suporte para definir a postura do jogador 2
  onHoverCard?: (c: TcgCard | null) => void;
  onClickDraw?: () => void;
  onClickDrawP2?: () => void;
}

export default function ArenaPrototype({
  p1, p2, p1Wins = 0, p2Wins = 0, deckP1Count, deckP2Count, priorityOwner, log,
  selectedIdx, invalidIdx, selectedP2Idx, invalidP2Idx,
  onClickSetP1Posture, onClickP1Card, onClickP2Card, onHoverCard, hoverCard, onClickDraw, onClickDrawP2,
  extraPending = 'none', decisionProgress = 0, waitingForOpponent = false, showP1Facedown = false, showP2Facedown = false,
}: ArenaProps) {
  // Inicializa o sistema responsivo
  useEffect(() => {
    const cleanup = setupResponsiveCards();
    return () => cleanup();
  }, []);
  const CardBackImg = new URL('../../Assets/art/cards/CardBack.png', import.meta.url).href;

  const DeckStack = React.memo(({ count, onClick, disabled, flipped = false }: { count: number; onClick?: () => void; disabled?: boolean; flipped?: boolean }) => {
    const cap = Math.min(count, 8);
    const items = new Array(cap).fill(0);
    return (
      <div
        onClick={() => (!disabled ? onClick?.() : undefined)}
        className="card"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
        }}
        style={{ position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, ['--raise' as any]: '0px', zIndex: 5, pointerEvents: 'auto' }}
        title={disabled ? 'Cannot draw now' : 'Draw a card'}
      >
        {items.map((_, i) => (
          <img
            key={i}
            src={CardBackImg}
            alt="deck card"
            style={{ position: 'absolute', inset: 0, transform: `translate(${i}px, ${-i}px)${flipped ? ' rotate(180deg)' : ''}` as any, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'calc(var(--card-width) * 0.07)', pointerEvents: 'none' }}
          />
        ))}
        <div style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(0,0,0,.6)', color: '#cfe0ff', padding: '4px 8px', borderRadius: 8, fontWeight: 700 }}>
          {count}
        </div>
      </div>
    );
  });

  // Piles: keep last played cards stacked with slight random offsets
  type PileItem = { key: string; card: TcgCard; rot: number; dx: number; dy: number };
  const [p1Pile, setP1Pile] = useState<PileItem[]>([]);
  const [p2Pile, setP2Pile] = useState<PileItem[]>([]);

  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  const updatePile = (revealed: TcgCard | undefined, setPile: React.Dispatch<React.SetStateAction<PileItem[]>>, rand: (min: number, max: number) => number) => {
    if (revealed) {
      const it: PileItem = { key: `${revealed.id}-${Date.now()}`, card: revealed, rot: rand(-10, 10), dx: rand(-8, 8), dy: rand(-6, 10) };
      setPile((arr) => [...arr.slice(-2), it]);
    }
  };

  useEffect(() => updatePile(p1?.revealed, setP1Pile, rand), [p1?.revealed?.id]);
  useEffect(() => updatePile(p2?.revealed, setP2Pile, rand), [p2?.revealed?.id]);
  // Heuristic: clear piles on deck reset (deck count increases)
  const prevCounts = useRef({ d1: deckP1Count, d2: deckP2Count });
  useEffect(() => {
    if (deckP1Count > prevCounts.current.d1) setP1Pile([]);
    if (deckP2Count > prevCounts.current.d2) setP2Pile([]);
    prevCounts.current = { d1: deckP1Count, d2: deckP2Count };
  }, [deckP1Count, deckP2Count]);

  return (
    <div className="breath-root">
      <div className="hud">

        {/* Top: Opponent */}
        <header className={"playerbar panel" + (extraPending === 'p2' ? ' counter-glow' : '')} style={{ gridColumn: '1', gridRow: '1' }}>
          <div className="avatar">CPU</div>
          <div>
            <div className="name">{p2.name || 'Opponent'}</div>
            <div className="meta">Priority: <strong id="prioTop">{priorityOwner === 1 ? 'Opponent' : '—'}</strong></div>
          </div>
          {/* Opponent deck moved to top margin near hand */}
          <div className="spacer" />
          {extraPending === 'p2' && (
            <div className="counter-badge" title="Counter Window (opponent)">
              <span>Counter!</span>
              <div className="counter-bar"><div className="fill" style={{ width: `${Math.round(decisionProgress * 100)}%` }} /></div>
            </div>
          )}
          {/* opponent top deck removed (now shown on board corner) */}
          <div className="postures" id="postureTop">
            <div className={'posture' + (p2.posture === 'A' ? ' active' : '')}>A</div>
            <div className={'posture' + (p2.posture === 'B' ? ' active' : '')}>B</div>
            <div className={'posture' + (p2.posture === 'C' ? ' active' : '')}>C</div>
          </div>
          <div className="crystals" id="crystalsTop">
            {new Array(MAX_BREATH).fill(0).map((_, i) => (
              <div key={i} className={'crystal' + (i < p2.breath ? ' on' : '')} />
            ))}
          </div>
        </header>

        {/* Opponent hand (back) */}
        <div className="op-hand">
          {new Array(p2.facedownCount ?? Math.min(5, p2.hand?.length ?? 0)).fill(0).map((_, i) => (
            <div key={i} className="back" />
          ))}
        </div>

        {/* Center board */}
        <main className="board">
          {/* Scoreboard overlay */}
          <div className="panel" style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', padding: '6px 10px', zIndex: 200, textAlign: 'center' }}>
            <strong>Score:</strong> {p1.name || 'You'} {p1Wins} x {p2Wins} {p2.name || 'Opponent'}
          </div>
          <div className="lane top">
            <div className={"slot" + (extraPending === 'p2' ? ' counter-open' : '')} id="slotTop">
              <div className="fx" />
              {(showP2Facedown || p2?.revealed) && (
                <div
                  className="card"
                  style={{
                    pointerEvents: 'auto',
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 9,
                  }}
                  onMouseEnter={() => p2?.revealed && onHoverCard?.(p2.revealed)}
                  onMouseLeave={() => onHoverCard?.(null)}
                >
                  <FlipCard
                    flipped={Boolean(p2?.revealed)}
                    back={<CardBack />}
                    front={p2?.revealed ? <CardFront card={p2.revealed!} /> : <div />}
                  />
                </div>
              )}
              {p2Pile.map((it, i) => (
                <div
                  key={it.key}
                  className="card pile-drop"
                  style={{
                    pointerEvents: 'auto',
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${it.dx}px), calc(-50% + ${it.dy}px)) rotate(${it.rot}deg)` as any,
                    zIndex: 10 + i,
                  }}
                  onMouseEnter={() => onHoverCard?.(it.card)}
                  onMouseLeave={() => onHoverCard?.(null)}
                >
                  <div className="pile-fall">
                    <CardFront card={it.card} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lane bot">
            <div className={"slot active" + (extraPending === 'p1' ? ' counter-open' : '')} id="slotBot">
              <div className="fx" />
              {(showP1Facedown || p1?.revealed) && (
                <div
                  className="card"
                  style={{
                    pointerEvents: 'auto',
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 9,
                  }}
                  onMouseEnter={() => p1?.revealed && onHoverCard?.(p1.revealed)}
                  onMouseLeave={() => onHoverCard?.(null)}
                >
                  <FlipCard
                    flipped={Boolean(p1?.revealed)}
                    back={<CardBack />}
                    front={p1?.revealed ? <CardFront card={p1.revealed!} /> : <div />}
                  />
                </div>
              )}
              {p1Pile.map((it, i) => (
                <div
                  key={it.key}
                  className="card pile-drop"
                  style={{
                    pointerEvents: 'auto',
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${it.dx}px), calc(-50% + ${it.dy}px)) rotate(${it.rot}deg)` as any,
                    zIndex: 10 + i,
                  }}
                  onMouseEnter={() => onHoverCard?.(it.card)}
                  onMouseLeave={() => onHoverCard?.(null)}
                >
                  <div className="pile-fall">
                    <CardFront card={it.card} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Corner deck slots in the central board (p2 top-right, p1 bottom-left) */}
          <div className="board-deck deck-topright">
            <div style={{ position: 'relative', width: 'calc(var(--card-width) * 0.9)', height: 'calc(var(--card-height) * 0.9)', pointerEvents: 'auto' }}>
              <DeckStack
                count={deckP2Count}
                onClick={onClickDrawP2}
                disabled={Boolean(p2.revealed) || deckP2Count === 0 || (p2.hand?.length ?? 0) >= HAND_SIZE}
                flipped
              />
            </div>
          </div>

          <div className="board-deck deck-bottomleft">
            <div style={{ position: 'relative', width: 'calc(var(--card-width) * 0.9)', height: 'calc(var(--card-height) * 0.9)', pointerEvents: 'auto' }}>
              <DeckStack
                count={deckP1Count}
                onClick={onClickDraw}
                disabled={Boolean(p1.revealed) || deckP1Count === 0 || (p1.hand?.length ?? 0) >= HAND_SIZE}
              />
            </div>
          </div>
        </main>

        {/* Bottom: Player */}
        <footer className={"playerbar panel" + (extraPending === 'p1' ? ' counter-glow' : '')} style={{ gridColumn: '1', gridRow: '3 / span 1', alignItems: 'flex-start', paddingBottom: 0 }}>
          <div className="avatar">YOU</div>
          <div>
            <div className="name">{p1.name || 'You'}</div>
            <div className="meta">Priority: <strong id="prioBot">{priorityOwner === 0 ? 'You' : '—'}</strong></div>
          </div>
          {extraPending === 'p1' && (
            <div className="counter-badge" title="Counter Window (you)">
              <span>Counter!</span>
              <div className="counter-bar"><div className="fill" style={{ width: `${Math.round(decisionProgress * 100)}%` }} /></div>
            </div>
          )}
          {/* player bottom deck removed (now shown on board corner) */}
          <div className="spacer" />
          <div className="postures" id="postureBot">
            {(['A', 'B', 'C'] as Posture[]).map((p) => (
              <div key={p} className={'posture' + (p1.posture === p ? ' active' : '')} onClick={() => onClickSetP1Posture?.(p)}>
                {p}
              </div>
            ))}
          </div>
          <div className="crystals" id="crystalsBot">
            {new Array(MAX_BREATH).fill(0).map((_, i) => (
              <div key={i} className={'crystal' + (i < p1.breath ? ' on' : '')} />
            ))}
          </div>
          {/* Waiting badge removed in favor of facedown-on-board flip UX */}
        </footer>

        {/* Player hand (fan) */}
        <section className="hand">
          {p1.hand.slice(0, 5).map((card, idx) => (
            <article
              key={`${card.id}-${idx}`}
              className={'card' + (selectedIdx === idx ? ' selected' : '') + (invalidIdx === idx ? ' shake' : '')}
              style={{ ['--rot' as any]: rotationForIndex(idx, Math.min(5, p1.hand.length)) }}
              onClick={() => onClickP1Card?.(card, idx)}
              onMouseEnter={() => onHoverCard?.(card)}
              onMouseLeave={() => onHoverCard?.(null)}
            >
              <CardFront card={card} />
            </article>
          ))}
        </section>

        {/* Log at right */}
        <aside className="log panel" id="log">
          <h3>{hoverCard ? 'Card Details' : 'Log'}</h3>
          {hoverCard ? (
            <div className="space-y-2 text-sm">
              <div>Type: <b>{hoverCard.type}</b></div>
              {'requires' in (hoverCard as any) && <div>Requires: <b>{(hoverCard as any).requires ?? '-'}</b></div>}
              {'target' in (hoverCard as any) && <div>Target: <b>{(hoverCard as any).target ?? '-'}</b></div>}
              {'final' in (hoverCard as any) && <div>Final: <b>{(hoverCard as any).final ?? '-'}</b></div>}
              <div className="mt-2 text-[13px] leading-snug bg-slate-900/40 rounded-md border border-slate-700/40 p-2">
                {hoverCard.type === 'attack' && (
                  <>
                    Targets <b>{(hoverCard as any).target ?? '—'}</b>. If there is no effective block/dodge, deal <b>2 damage</b>.
                  </>
                )}
                {hoverCard.type === 'defense' && (
                  <>
                    Blocks target <b>{(hoverCard as any).target ?? '-'}</b>. Grants <b>extra action</b> only if your current posture equals the attack's target when revealed.
                  </>
                )}
                {hoverCard.type === 'dodge' && (
                  <>
                    Switches to posture <b>{(hoverCard as any).final ?? '—'}</b>. If you leave the attack's target, avoid the damage.
                  </>
                )}
              </div>
              <div className="text-xs text-slate-400">Click the card to confirm play.</div>
            </div>
          ) : (
            <>
              {(log?.length ? log : ['Arena ready. Click once to select, twice to confirm.'])
                .slice(-20)
                .map((txt, i) => (
                  <div key={i} className="entry">{txt}</div>
                ))}
              <div style={{ height: 8 }} />
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Hand: {p1.hand.length}/{HAND_SIZE} • Deck: {deckP1Count} • Opponent deck: {deckP2Count}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function rotationForIndex(i: number, total: number) {
  const spread = Math.min(12, 18 - total * 2);
  const start = -spread * ((total - 1) / 2);
  return `${start + spread * i}deg`;
}

