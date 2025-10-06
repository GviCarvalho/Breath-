import React, { ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { MAX_BREATH, type ImpactKind, type TcgCard, type Posture } from '@/engine';
import { ALPHABET, cardToIdxStatic } from '@/engine';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - vite raw import for text files
import mappingText from '../../../docs/kata_cards_mapping.txt?raw';

// Assets
const AttackImg = new URL('../../Assets/art/cards/Attack Card.png', import.meta.url).href;
const DefenseImg = new URL('../../Assets/art/cards/Defense Card.png', import.meta.url).href;
const DodgeAImg = new URL('../../Assets/art/cards/Dodge Card A.png', import.meta.url).href;
const DodgeBImg = new URL('../../Assets/art/cards/Dodge Card B.png', import.meta.url).href;
const DodgeCImg = new URL('../../Assets/art/cards/Dodge Card C.png', import.meta.url).href;
const CardBackImg = new URL('../../Assets/art/cards/CardBack.png', import.meta.url).href;
const DeckImg = new URL('../../Assets/art/cards/Deck.png', import.meta.url).href;

// Helpers
const pIdx = (p?: Posture) => (p === 'A' ? 0 : p === 'B' ? 1 : 2);

// Dynamic name map from docs/kata_cards_mapping.txt
const CARD_NAME_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  try {
    const lines = (mappingText || '').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const key = line[0];
      if (!ALPHABET.includes(key)) continue;
      // Split by straight or curly apostrophes and take the last piece
      const parts = line.split(/['’]/g);
      let tail = parts.length > 1 ? parts[parts.length - 1].trim() : '';
      const paren = tail.indexOf('(');
      const name = (paren >= 0 ? tail.slice(0, paren) : tail).trim();
      if (name) map[key] = name;
    }
  } catch {}
  return map;
})();

function getCardName(card: TcgCard): string {
  try {
    const idx = cardToIdxStatic(card);
    if (idx !== null && idx >= 0) {
      const key = ALPHABET[idx % ALPHABET.length];
      const mapped = CARD_NAME_MAP[key];
      if (mapped) return mapped;
      return `CARD ${key}`; // unique fallback
    }
  } catch {}
  return 'CARD';
}

// HUD / Breath bar
export function BreathBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / MAX_BREATH) * 100)));
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {new Array(MAX_BREATH).fill(0).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-3 w-5 rounded-md border',
              i < value
                ? 'bg-cyan-300/70 border-cyan-400 shadow-[0_0_10px_rgba(56,189,248,.45)]'
                : 'bg-slate-800 border-slate-600'
            )}
          />
        ))}
      </div>
      <div className="w-24">
        <Progress value={pct} className="[&>div]:bg-cyan-400" />
      </div>
    </div>
  );
}

// Card visual
export function Card({
  card,
  selected,
  facedown,
  onClick,
  disabled,
  compact,
  showBadges = true,
}: {
  card: TcgCard;
  selected?: boolean;
  facedown?: boolean;
  compact?: boolean;
  disabled?: boolean;
  showBadges?: boolean;
  onClick?: (c: TcgCard) => void;
}) {
  const imgSrc =
    card.type === 'attack'
      ? AttackImg
      : card.type === 'defense'
      ? DefenseImg
      : (card.final as Posture) === 'A'
      ? DodgeAImg
      : (card.final as Posture) === 'B'
      ? DodgeBImg
      : DodgeCImg;

  const badgeFor = (prefix: 'ATKCard' | 'DEFCard', kind: 'Pos' | 'LastPos', posture?: string) => {
    if (!posture) return null;
    try {
      const name = `${prefix}${kind}${posture}.png`;
      return new URL(`../../Assets/art/badges/${name}`, import.meta.url).href;
    } catch {
      return null;
    }
  };

  const isBadgeable = card.type === 'attack' || card.type === 'defense';
  const reqBadge = isBadgeable && (card as any).requires ? badgeFor(card.type === 'attack' ? 'ATKCard' : 'DEFCard', 'Pos', (card as any).requires) : null;
  const finBadge = isBadgeable && (card as any).final ? badgeFor(card.type === 'attack' ? 'ATKCard' : 'DEFCard', 'LastPos', (card as any).final) : null;
  const tgtBadge = isBadgeable && (card as any).target ? badgeFor(card.type === 'attack' ? 'ATKCard' : 'DEFCard', 'Pos', (card as any).target) : null;

  const kindColor = card.type === 'attack' ? 'border-rose-400/40' : card.type === 'defense' ? 'border-sky-400/40' : 'border-emerald-400/40';
  const disabledCls = disabled ? 'opacity-60 grayscale-[40%] cursor-not-allowed' : 'cursor-pointer';
  const selectedGlow = selected ? 'drop-shadow-[0_0_12px_rgba(56,189,248,.45)] -translate-y-1' : '';

  if (facedown) {
    return (
      <div className={cn('rounded-xl border w-full h-full overflow-hidden bg-white', compact && 'w-20 h-28')}>
        <img src={CardBackImg} alt="card back" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(card)}
      className={cn(
        'tcg-card relative rounded-xl border bg-slate-900 overflow-hidden w-full h-full transition-all',
        'shadow-xl hover:-translate-y-1 will-change-transform',
        disabledCls,
        selectedGlow,
        kindColor
      )}
      // fallback to CSS vars when parent does not set size
      style={{ width: 'var(--card-width, 165px)', height: 'var(--card-height, 240px)' }}
    >
      {/* Use the card art image itself and keep the full art visible inside the card
          object-contain preserves the whole artwork so badges/titles remain readable
          while the parent .card (in CSS) controls the actual visible size via --card-width/height */}
  <img src={imgSrc} className="card-art absolute inset-0 w-full h-full object-contain bg-[var(--card)]" />

      {/* Name at top center (no box, no wrap, black font) */}
      {/* Title: scale with card width so it stays proportional on different card sizes */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-10 font-semibold tracking-wide whitespace-nowrap font-card-name"
        style={{ top: 'calc(var(--card-height) * 0.04)', fontSize: 'calc(var(--card-width) * 0.14)', color: 'black', textShadow: '0 2px 6px rgba(255,255,255,.12)' }}
      >
        {getCardName(card)}
      </div>

      {/* Badges bottom-center for attack/defense only: req, tgt, fin */}
      {showBadges && (card.type === 'attack' || card.type === 'defense') && (
        <div className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-1" style={{ bottom: 'calc(var(--card-height) * 0.1)' }}>
          {reqBadge && (
            <img
              src={reqBadge}
              alt="requires"
              style={{ width: 'calc(var(--card-width) * 0.14)', height: 'auto', maxHeight: 'calc(var(--card-height) * 0.14)', borderRadius: '6px', objectFit: 'contain' }}
            />
          )}
          {tgtBadge && (
            <img
              src={tgtBadge}
              alt="target"
              style={{ width: 'calc(var(--card-width) * 0.14)', height: 'auto', maxHeight: 'calc(var(--card-height) * 0.14)', borderRadius: '6px', objectFit: 'contain' }}
            />
          )}
          {finBadge && (
            <img
              src={finBadge}
              alt="final"
              style={{ width: 'calc(var(--card-width) * 0.14)', height: 'auto', maxHeight: 'calc(var(--card-height) * 0.14)', borderRadius: '6px', objectFit: 'contain' }}
            />
          )}
        </div>
      )}

      <div
        className={cn(
          'absolute inset-0 pointer-events-none rounded-xl ring-2 ring-cyan-300/0 transition-all',
          selected && 'ring-cyan-300/50'
        )}
      />
    </div>
  );
}

export function CardBack() {
  return (
    <div className="rounded-xl border w-full h-full overflow-hidden bg-white" style={{ width: 'var(--card-width, 165px)', height: 'var(--card-height, 240px)' }}>
      <img src={CardBackImg} alt="card back" className="w-full h-full object-cover" />
    </div>
  );
}

export function CardFront({ card }: { card: TcgCard }) {
  return <Card card={card} />;
}

export function FlipCard({ flipped, front, back }: { flipped: boolean; front: ReactNode; back: ReactNode }) {
  return (
    <div className="[perspective:800px]">
      <div
        className={cn(
          'relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]',
          flipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'
        )}
        style={{ width: 'var(--card-width, 165px)', height: 'var(--card-height, 240px)' }}
      >
        <div className="absolute inset-0 [backface-visibility:hidden]">{back}</div>
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">{front}</div>
      </div>
    </div>
  );
}

export function bannerFor(kind: ImpactKind): string | null {
  switch (kind) {
    case 'p1_hits':
      return 'Voce acerta!';
    case 'p2_hits':
      return 'Oponente acerta!';
    case 'blocked_p2':
    case 'blocked_p1':
      return 'Bloqueio!';
    case 'dodged_p2':
    case 'dodged_p1':
      return 'Esquivou!';
    case 'extra_granted_p1':
    case 'extra_granted_p2':
      return 'Acao extra!';
    case 'defeat_p1':
      return 'Voce caiu!';
    case 'defeat_p2':
      return 'Oponente caiu!';
    default:
      return null;
  }
}

export function floaterText(kind: ImpactKind, side: 'p1' | 'p2'): string | null {
  if (kind === 'p1_hits' && side === 'p2') return '-2';
  if (kind === 'p2_hits' && side === 'p1') return '-2';
  if (kind === 'extra_p1' && side === 'p2') return '-2';
  if (kind === 'extra_p2' && side === 'p1') return '-2';
  if (kind === 'blocked_p1' && side === 'p2') return 'BLOCK';
  if (kind === 'blocked_p2' && side === 'p1') return 'BLOCK';
  if (kind === 'dodged_p1' && side === 'p2') return 'DODGE';
  if (kind === 'dodged_p2' && side === 'p1') return 'DODGE';
  if (kind === 'extra_granted_p1' && side === 'p1') return 'COUNTER';
  if (kind === 'extra_granted_p2' && side === 'p2') return 'COUNTER';
  if (kind === 'defeat_p1' && side === 'p1') return 'KO';
  if (kind === 'defeat_p2' && side === 'p2') return 'KO';
  return null;
}

export function DeckPicto({ count }: { count: number }) {
  return (
    <div className="relative rounded-lg border bg-white/70 w-16 h-24 overflow-hidden">
      <img src={DeckImg} alt="deck" className="w-full h-full object-cover" />
      <div className="absolute -bottom-2 -right-2 bg-slate-900 text-cyan-200 text-xs font-bold px-2 py-1 rounded shadow">
        {count}
      </div>
    </div>
  );
}
