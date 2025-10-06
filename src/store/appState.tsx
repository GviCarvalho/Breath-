import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Mode = 'home' | 'local' | 'online' | 'collection' | 'arena';

type ArenaMode = 'local' | 'online' | null;

interface PersistedState {
  mode: Mode;
  playerName: string;
  lastMatchId?: string | null;
  seed?: string;
  activeDeck?: { name: string; seed: string } | null;
  arenaMode?: ArenaMode;
}

interface AppStateContextValue extends PersistedState {
  setMode: (mode: Mode) => void;
  setPlayerName: (name: string) => void;
  setLastMatchId: (id: string | null) => void;
  seed?: string;
  setSeed?: (s: string) => void;
  setActiveDeck?: (d: { name: string; seed: string } | null) => void;
  setArenaMode?: (m: ArenaMode) => void;
}

const STORAGE_KEY = 'breath-app-state-v1';
const DEFAULT_STATE: PersistedState = { mode: 'home', playerName: '', lastMatchId: null, seed: '', activeDeck: null, arenaMode: 'local' };

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

function loadInitialState(): PersistedState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_STATE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      // map legacy modes ('deck','decks') to unified 'collection'
      const legacy = (parsed.mode as any);
  let mappedMode: Mode = 'home';
      let mappedArenaMode: ArenaMode | undefined = parsed.arenaMode;
      if (legacy === 'deck' || legacy === 'decks') {
        mappedMode = 'collection';
      } else if (legacy === 'local' || legacy === 'online') {
        // migrate to arena with sub-mode preserved
        mappedMode = 'arena';
        mappedArenaMode = legacy;
      } else {
        mappedMode = (legacy as Mode) ?? 'home';
      }
      return {
        mode: mappedMode,
        playerName: parsed.playerName ?? '',
        lastMatchId: parsed.lastMatchId ?? null,
        seed: parsed.seed ?? '',
        activeDeck: parsed.activeDeck ?? null,
        arenaMode: (mappedArenaMode === 'local' || mappedArenaMode === 'online') ? mappedArenaMode : 'local',
      };
    }
  } catch (err) {
    console.warn('[app-state] unable to load persisted state', err);
  }
  return DEFAULT_STATE;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const initial = loadInitialState();
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [playerName, setPlayerName] = useState<string>(initial.playerName);
  const [lastMatchId, setLastMatchId] = useState<string | null>(initial.lastMatchId ?? null);
  const [seed, setSeed] = useState<string>(initial.seed ?? '');
  const [activeDeck, setActiveDeck] = useState<{ name: string; seed: string } | null>(initial.activeDeck ?? null);
  const [arenaMode, setArenaMode] = useState<ArenaMode>(initial.arenaMode ?? 'local');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const payload: PersistedState = { mode, playerName, lastMatchId, seed, activeDeck, arenaMode };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[app-state] unable to persist state', err);
    }
  }, [mode, playerName, lastMatchId, seed, activeDeck, arenaMode]);

  const value = useMemo<AppStateContextValue>(
    () => ({ mode, playerName, lastMatchId, seed, activeDeck, arenaMode, setArenaMode, setActiveDeck, setSeed, setMode, setPlayerName, setLastMatchId }),
    [mode, playerName, lastMatchId, seed, activeDeck, arenaMode]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
