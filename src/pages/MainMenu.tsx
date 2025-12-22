import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function MainMenu() {
  const navigate = useNavigate();
  const { user, loading, login, logout } = useAuth();
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [gameMode, setGameMode] = useState<'casual' | 'ranked'>('casual');
  const [roomCode, setRoomCode] = useState('');
  const [spectateCode, setSpectateCode] = useState('');

  const TokenImg = new URL('../Assets/art/tokens/Carved Green Yin-Yang Token.png', import.meta.url).href;

  const handleCreateRoom = () => {
    if (!user) {
      alert('Você precisa estar logado para criar uma sala.');
      return;
    }
    // Navigate to online game and trigger room creation
    navigate('/play/online');
  };

  const handleJoinWithCode = () => {
    if (!user) {
      alert('Você precisa estar logado para entrar em uma sala como jogador.');
      return;
    }
    if (!roomCode.trim()) {
      alert('Por favor, insira um código de sala.');
      return;
    }
    navigate(`/match/${roomCode.trim()}`);
  };

  const handleSpectate = () => {
    if (!spectateCode.trim()) {
      alert('Por favor, insira um código de sala para espectar.');
      return;
    }
    navigate(`/spectate/${spectateCode.trim()}`);
  };

  const handlePlayLocal = () => {
    navigate('/local');
  };

  const handlePlayHotSeat = () => {
    navigate('/local?mode=hotseat');
  };

  const handleOpenCollection = () => {
    navigate('/collection');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-900/50">
              <img src={TokenImg} alt="Breath Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-white">Breath!</h1>
          </div>

          {/* Auth Area */}
          <div className="flex items-center gap-3">
            {loading ? (
              <div className="text-slate-400 text-sm">Carregando...</div>
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-white">{user.displayName}</div>
                  <div className="text-xs text-slate-400">{user.provider}</div>
                </div>
                <Button 
                  onClick={() => logout()}
                  className="bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5 text-sm"
                >
                  Sair
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Button
                  onClick={() => setShowLoginMenu(!showLoginMenu)}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  Entrar
                </Button>
                {showLoginMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50">
                    <button
                      onClick={() => {
                        login('google');
                        setShowLoginMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left text-white hover:bg-white/10 flex items-center gap-3 rounded-t-lg"
                    >
                      <span>🔷</span>
                      <span>Google</span>
                    </button>
                    <button
                      onClick={() => {
                        login('discord');
                        setShowLoginMenu(false);
                      }}
                      className="w-full px-4 py-3 text-left text-white hover:bg-white/10 flex items-center gap-3 rounded-b-lg"
                    >
                      <span>💬</span>
                      <span>Discord</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Play Online Card */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4">Jogar Online</h2>
            
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-lg">
              <button
                onClick={() => setGameMode('casual')}
                className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                  gameMode === 'casual'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Casual
              </button>
              <button
                onClick={() => setGameMode('ranked')}
                className={`flex-1 px-4 py-2 rounded-md transition-colors relative ${
                  gameMode === 'ranked'
                    ? 'bg-purple-600/50 text-white cursor-not-allowed'
                    : 'text-slate-400 hover:text-slate-300 cursor-not-allowed'
                }`}
                disabled
              >
                Ranqueada
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                  Em breve
                </span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Create Room */}
              <div>
                <Button
                  onClick={handleCreateRoom}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                  disabled={gameMode === 'ranked'}
                >
                  🎮 Criar Sala
                </Button>
                {!user && (
                  <p className="text-xs text-slate-400 mt-1">* Requer login</p>
                )}
              </div>

              {/* Join with Code */}
              <div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Código da sala"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    disabled={gameMode === 'ranked'}
                  />
                  <Button
                    onClick={handleJoinWithCode}
                    className="bg-sky-600 hover:bg-sky-500"
                    disabled={gameMode === 'ranked'}
                  >
                    Entrar
                  </Button>
                </div>
                {!user && (
                  <p className="text-xs text-slate-400 mt-1">* Requer login para jogar</p>
                )}
              </div>

              {/* Spectate */}
              <div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Código para espectar"
                    value={spectateCode}
                    onChange={(e) => setSpectateCode(e.target.value)}
                    className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                    disabled={gameMode === 'ranked'}
                  />
                  <Button
                    onClick={handleSpectate}
                    className="bg-white/5 border border-white/10 hover:bg-white/10"
                    disabled={gameMode === 'ranked'}
                  >
                    👁️ Espectar
                  </Button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Sem necessidade de login</p>
              </div>

              {/* Quick Match - Disabled */}
              <div className="relative">
                <Button
                  className="w-full bg-white/5 text-slate-500 cursor-not-allowed"
                  disabled
                >
                  ⚡ Partida Rápida
                </Button>
                <span className="absolute top-1/2 right-4 -translate-y-1/2 bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full font-semibold">
                  Em breve
                </span>
              </div>
            </div>
          </section>

          {/* Play Local Card */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4">Jogar Local</h2>
            <div className="space-y-4">
              <Button
                onClick={handlePlayLocal}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white"
              >
                🤖 Vs IA
              </Button>
              <Button
                onClick={handlePlayHotSeat}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                👥 Hot-seat (2 jogadores)
              </Button>
              <Button
                onClick={handleOpenCollection}
                className="w-full bg-slate-600 hover:bg-slate-500 text-white"
              >
                🃏 Gerenciar Decks
              </Button>
            </div>
          </section>

          {/* Ranking Card */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4">Ranking</h2>
            <div className="space-y-3">
              <div className="relative">
                <Button
                  className="w-full bg-white/5 text-slate-500 cursor-not-allowed"
                  disabled
                >
                  🏆 Leaderboard Global
                </Button>
                <span className="absolute top-1/2 right-4 -translate-y-1/2 bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full font-semibold">
                  Em breve
                </span>
              </div>
              <p className="text-sm text-slate-400">
                O ranking global estará disponível quando o modo ranqueado for lançado.
              </p>
            </div>
          </section>

          {/* Rules/Help Card */}
          <section className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
            <h2 className="text-xl font-semibold text-white mb-4">Regras & Ajuda</h2>
            <div className="space-y-3">
              <Button
                onClick={() => window.open('/ManualBreath.txt', '_blank')}
                className="w-full bg-slate-600 hover:bg-slate-500 text-white"
              >
                📖 Manual do Jogo
              </Button>
              <p className="text-sm text-slate-400">
                Aprenda as regras, mecânicas e estratégias do Breath!
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
