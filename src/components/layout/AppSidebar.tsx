import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '@/store/appState';

type Props = {
  expanded: boolean;
  onToggle: () => void;
};

export default function AppSidebar({ expanded, onToggle }: Props) {
  const { mode, setMode, arenaMode, setArenaMode } = useAppState();

  // Local hovered state so the sidebar expands when the user hovers over it
  // without changing the parent's `expanded` (pinned) state.
  const [hovered, setHovered] = useState(false);
  const isExpanded = expanded || hovered;
  const width = isExpanded ? 220 : 56;

  // Assets used as icons in the sidebar
  const TokenImg = new URL('../../Assets/art/tokens/Carved Green Yin-Yang Token.png', import.meta.url).href;
  const AttackImg = new URL('../../Assets/art/cards/Attack Card.png', import.meta.url).href;
  const DefenseImg = new URL('../../Assets/art/cards/Defense Card.png', import.meta.url).href;
  const DodgeAImg = new URL('../../Assets/art/cards/Dodge Card A.png', import.meta.url).href;
  const DodgeBImg = new URL('../../Assets/art/cards/Dodge Card B.png', import.meta.url).href;
  const CardBackImg = new URL('../../Assets/art/cards/CardBack.png', import.meta.url).href;

  return (
    <aside
      className="fixed left-7 top-7 bottom-7 z-50 text-slate-100 panel"
      style={{ width, transition: 'width 180ms cubic-bezier(.2,.9,.2,1)' }}
      aria-label="Navegação"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="h-14 flex items-center px-2 border-b border-slate-800/60">
        {/* Toggle button removed as requested */}

  {/* Persistent token icon (visible even when collapsed). Center when collapsed */}
  <div className={isExpanded ? 'ml-2 flex items-center' : 'flex-1 flex items-center justify-center'}>
          <div className="w-8 h-8 rounded-md overflow-hidden bg-slate-900/10">
            <img
              src={TokenImg}
              alt="token"
              className="w-full h-full object-contain block"
              onError={(e) => {
                // hide broken image to avoid showing a white placeholder line
                const t = e.target as HTMLImageElement;
                t.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Title: animate opacity/translate for smooth entrance */}
        {isExpanded && (
          <button
            onClick={() => setMode('home' as any)}
            className={'ml-2 text-sm font-semibold tracking-wide transition-all duration-150 opacity-100 translate-x-0 hover:underline'}
            aria-hidden={!isExpanded}
            title="Ir para Home"
          >
            Breath
          </button>
        )}
      </div>

      {/* Nav: always present so children can animate in/out. Use aria-hidden when collapsed. */}
      <nav className="mt-2" aria-hidden={!isExpanded}>
        {/* Arena with kebab to choose sub-mode (now first) */}
        <ArenaNavWithMenu
          isExpanded={isExpanded}
          current={mode === 'arena'}
          arenaMode={arenaMode}
          onOpen={() => { setMode('arena' as any); }}
          onPick={(m) => { setArenaMode?.(m); setMode('arena' as any); }}
          AttackImg={AttackImg}
        />

        {/* Collection */}
        <button
          onClick={() => setMode('collection' as any)}
          aria-label="Collection"
          className={'w-full flex items-center py-2 hover:bg-white/10 transition-colors ' + (isExpanded ? 'gap-3 pl-3 pr-3 text-left' : 'justify-center px-0') + (mode === 'collection' ? ' bg-white/10' : '')}
          aria-current={mode === 'collection' ? 'page' : undefined}
          title="Collection"
        >
          <div className={"shrink-0 flex items-center justify-center relative " + (isExpanded ? 'w-7 h-7' : 'w-5 h-5') }>
            {isExpanded ? (
              <>
                <img src={CardBackImg} alt="cb1" className="absolute left-0 top-0 w-6 h-7 object-cover rounded-sm border border-white/10" />
                <img src={CardBackImg} alt="cb2" className="absolute left-1 top-1 w-6 h-7 object-cover rounded-sm border border-white/10 opacity-90" />
                <img src={CardBackImg} alt="cb3" className="absolute left-2 top-2 w-6 h-7 object-cover rounded-sm border border-white/10 opacity-80" />
              </>
            ) : (
              <img src={CardBackImg} alt="cb" className="w-5 h-5 object-cover rounded-sm border border-white/10" />
            )}
          </div>
          {isExpanded ? (<span className={'text-sm transition-all duration-150 opacity-100 translate-x-0'}>Collection</span>) : null}
        </button>
      </nav>
    </aside>
  );

}

function ArenaNavWithMenu({ isExpanded, current, arenaMode, onOpen, onPick, AttackImg }: {
  isExpanded: boolean;
  current: boolean;
  arenaMode: 'local' | 'online' | null | undefined;
  onOpen: () => void;
  onPick: (m: 'local' | 'online') => void;
  AttackImg: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <div className={'relative ' + (current ? 'bg-white/10' : '')}>
      <button
        onClick={() => { onOpen(); }}
        aria-label="Arena"
        className={'w-full flex items-center py-2 hover:bg-white/10 transition-colors ' + (isExpanded ? 'gap-3 pl-3 pr-1 text-left' : 'justify-center px-0')}
        title="Arena"
      >
        <div className={"shrink-0 flex items-center justify-center relative " + (isExpanded ? 'w-7 h-7' : 'w-5 h-5') }>
          <img src={AttackImg} alt="arena" className="w-5 h-5 object-cover rounded-sm border border-white/10" />
        </div>
        {isExpanded ? (
          <span className={'flex-1 text-sm transition-all duration-150 opacity-100 translate-x-0'}>
            Arena
            {arenaMode ? <span className="ml-2 text-xs text-slate-400">({arenaMode})</span> : null}
          </span>
        ) : null}
        {isExpanded ? (
          <button
            ref={btnRef}
            onClick={(e) => {
              e.stopPropagation();
              if (!open) {
                const r = btnRef.current?.getBoundingClientRect();
                if (r) setPos({ left: r.right - 160, top: r.bottom + 6 });
                setOpen(true);
              } else {
                setOpen(false);
              }
            }}
            className="ml-auto w-7 h-7 grid place-items-center rounded hover:bg-white/10"
            title="Escolher modo da Arena"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            ⋮
          </button>
        ) : null}
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute z-10 w-40 rounded-md border border-white/10 bg-[#0d1222] shadow-xl text-slate-200"
          style={{ left: pos.left, top: pos.top, position: 'fixed' }}
        >
          <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-white/5" onClick={() => { onPick('local'); setOpen(false); }}>Local</button>
          <button role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-white/5" onClick={() => { onPick('online'); setOpen(false); }}>Online</button>
        </div>
      )}
    </div>
  );
}
