import React, { useState } from 'react';
// import { cn } from '@/lib/utils';
import LocalGame from '@/features/local/LocalGame';
import OnlineGame from '@/features/online/OnlineGame';
import DeckBuilder from '@/features/deck/DeckBuilderHtml';
import Game from '@/features/game/Game'; // Importing the Game component
import Home from '@/features/home/Home';
import { useAppState } from '@/store/appState';
import AppSidebar from '@/components/layout/AppSidebar';

// type LocalModes = 'local' | 'online' | 'collection';

export default function App() {
  const { mode, arenaMode } = useAppState();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`min-h-screen mode-${mode}`}>
      <AppSidebar expanded={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
      <main className="flex-1">
        {mode === 'home' ? (
          <Home />
        ) : mode === 'arena' && arenaMode === 'local' ? (
          <Game isLocal />
        ) : mode === 'arena' && arenaMode === 'online' ? (
          <Game isLocal={false} />
        ) : mode === 'collection' ? (
          <DeckBuilder />
        ) : null}
      </main>
    </div>
  );
}
