import React, { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { MAX_BREATH, type ImpactKind, type TcgCard } from '@/engine';

// Assets
const AttackImg = new URL('../../Assets/art/cards/Attack Card.png', import.meta.url).href;
const DefenseImg = new URL('../../Assets/art/cards/Defense Card.png', import.meta.url).href;
const DodgeAImg = new URL('../../Assets/art/cards/Dodge Card A.png', import.meta.url).href;
const DodgeBImg = new URL('../../Assets/art/cards/Dodge Card B.png', import.meta.url).href;
const DodgeCImg = new URL('../../Assets/art/cards/Dodge Card C.png', import.meta.url).href;
const CardBackImg = new URL('../../Assets/art/cards/CardBack.png', import.meta.url).href;
const DeckImg = new URL('../../Assets/art/cards/Deck.png', import.meta.url).href;

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

// Card
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
      : card.final === 'A'
      ? DodgeAImg
      : card.final === 'B'
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
  const reqBadge =
    isBadgeable && card.requires ? badgeFor(card.type === 'attack' ? 'ATKCard' : 'DEFCard', 'Pos', card.requires) : null;
  const finBadge =
    isBadgeable && card.final ? badgeFor(card.type === 'attack' ? 'ATKCard' : 'DEFCard', 'LastPos', card.final) : null;
  const tgtBadge =
    isBadgeable && card.target ? badgeFor(card.type === 'attack' ? 'ATKCard' : 'DEFCard', 'Pos', card.target) : null;

  const kindColor =
    card.type === 'attack' ? 'border-rose-400/40' : card.type === 'defense' ? 'border-sky-400/40' : 'border-emerald-400/40';
  const tagClass =
    card.type === 'attack'
      ? 'border-rose-400/50 text-rose-200'
      : card.type === 'defense'
      ? 'border-sky-400/50 text-sky-200'
      : 'border-emerald-400/50 text-emerald-200';

  const disabledCls = disabled ? 'opacity-60 grayscale-[40%] cursor-not-allowed' : 'cursor-pointer';
  const selectedGlow = selected ? 'drop-shadow-[0_0_12px_rgba(56,189,248,.45)] -translate-y-1' : '';

  if (facedown) {
    return (
      <div className={cn('rounded-xl border w-[165px] h-[240px] overflow-hidden bg-white', compact && 'w-20 h-28')}>
        <img src={CardBackImg} alt="card back" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(card)}
      className={cn(
        'relative rounded-xl border bg-gradient-to-b from-slate-800 to-slate-900 overflow-hidden w-[165px] h-[240px] transition-all',
        'shadow-xl hover:-translate-y-1 will-change-transform',
        disabledCls,
        selectedGlow,
        kindColor
      )}
    >
      <div className="h-16 flex items-center gap-3 px-3 border-b border-slate-600/40 bg-slate-800/60">
        <div className="grid place-items-center w-10 h-10 rounded-xl border border-cyan-400/50 bg-slate-900 text-cyan-200 font-bold shadow-[inset_0_0_12px_rgba(56,189,248,.35)]">
          1
        </div>
        <div className="font-bold text-slate-100">
          {card.type === 'attack' ? 'Ataque' : card.type === 'defense' ? 'Defesa' : 'Esquiva'}
        </div>
        <div className="ml-auto">
          {card.type !== 'dodge' && showBadges && (
            <div className="flex gap-1">
              {tgtBadge && <img src={tgtBadge} className="h-6 w-6" />}
              {reqBadge && <img src={reqBadge} className="h-6 w-6" />}
              {finBadge && <img src={finBadge} className="h-6 w-6" />}
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 top-16 h-36 overflow-hidden">
        <img src={imgSrc} className="w-full h-full object-cover opacity-95" />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3 space-y-2">
        <div className={cn('inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full border', tagClass, 'bg-slate-900/80')}>
          Cost: 1 breath
        </div>
        <div className="text-[13px] text-slate-200/90 leading-snug bg-slate-900/65 rounded-lg border border-slate-700/40 p-2">
          {card.type === 'attack' && (
            <>
              Targets <b>{card.target}</b>. If there is no effective block/dodge, deal <b>2 damage</b>.
            </>
          )}
          {card.type === 'defense' && (
            <>
              Blocks target <b>{card.target}</b>. If it blocks the correct attack, grants <b>extra action</b>.
            </>
          )}
          {card.type === 'dodge' && (
            <>
              Switches to posture <b>{card.final}</b>. If you leave the attack's target, avoid the damage.
            </>
          )}
        </div>
        <div className="flex items-center justify-between text-[12px] text-slate-300/80">
          <span>Req: {card.requires ?? '�'}</span>
          <span>Final: {card.final ?? '�'}</span>
        </div>
      </div>

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
    <div className="rounded-xl border w-[165px] h-[240px] overflow-hidden bg-white">
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
          'relative w-[165px] h-[240px] transition-transform duration-500 [transform-style:preserve-3d]',
          flipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]'
        )}
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
      return 'Você acerta!';
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
      return 'Ação extra!';
    case 'defeat_p1':
      return 'Você caiu!';
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




