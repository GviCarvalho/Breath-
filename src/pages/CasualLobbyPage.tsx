import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import '@/features/home/dojo-theme.css';

const SpectateIcon = new URL('../Assets/icons/spectate-dark.svg', import.meta.url).href;
const QuickMatchIcon = new URL('../Assets/icons/quickmatch-dark.svg', import.meta.url).href;
const CreateRoomIcon = new URL('../Assets/icons/create-room-dark.png', import.meta.url).href;

export default function CasualLobbyPage() {
  const navigate = useNavigate();
  const { user, serverConfigured } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [spectateCode, setSpectateCode] = useState('');

  const handleCreateRoom = () => {
    if (!serverConfigured) {
      alert('Servidor online não configurado. Configure o servidor em public/config.json para usar funcionalidades online.');
      return;
    }
    if (!user) {
      alert('Você precisa estar logado para criar uma sala.');
      return;
    }
    navigate('/play/online');
  };

  const handleJoinWithCode = () => {
    if (!serverConfigured) {
      alert('Servidor online não configurado. Configure o servidor em public/config.json para usar funcionalidades online.');
      return;
    }
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
    if (!serverConfigured) {
      alert('Servidor online não configurado. Configure o servidor em public/config.json para usar funcionalidades online.');
      return;
    }
    if (!spectateCode.trim()) {
      alert('Por favor, insira um código de sala para espectar.');
      return;
    }
    navigate(`/spectate/${spectateCode.trim()}`);
  };

  return (
    <div className="dojo-theme">
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 20px 64px' }}>
        <h1 className="dojo-display dojo-combate-title" style={{ padding: '0 0 24px', textAlign: 'center' }}>Casual</h1>

        <section className="dojo-panel">
          <div className="dojo-panel-body" style={{ paddingTop: 22 }}>
            <button className="dojo-btn dojo-btn-primary" onClick={handleCreateRoom} disabled={!serverConfigured}>
              <img src={CreateRoomIcon} alt="" style={{ filter: 'invert(1) brightness(1.8)' }} /> Criar Sala
            </button>
            {!user && serverConfigured && <p className="dojo-hint">* Requer login</p>}
            {!serverConfigured && <p className="dojo-hint">* Servidor não configurado</p>}

            <div className="dojo-field-row">
              <input
                className="dojo-input"
                placeholder="Código da sala"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                disabled={!serverConfigured}
              />
              <button className="dojo-btn" style={{ width: 'auto', padding: '10px 18px' }} onClick={handleJoinWithCode} disabled={!serverConfigured}>
                Entrar
              </button>
            </div>
            {!user && serverConfigured && <p className="dojo-hint">* Requer login para jogar</p>}

            <div className="dojo-field-row">
              <input
                className="dojo-input"
                placeholder="Código para espectar"
                value={spectateCode}
                onChange={(e) => setSpectateCode(e.target.value)}
                disabled={!serverConfigured}
              />
              <button className="dojo-btn" style={{ width: 'auto', padding: '10px 18px' }} onClick={handleSpectate} disabled={!serverConfigured}>
                <img src={SpectateIcon} alt="" /> Espectar
              </button>
            </div>
            {serverConfigured && <p className="dojo-hint">Sem necessidade de login</p>}

            <button className="dojo-btn" disabled>
              <img src={QuickMatchIcon} alt="" style={{ opacity: .55 }} /> Partida Rápida
              <span className="dojo-badge">Em breve</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
