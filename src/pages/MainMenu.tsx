import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import '@/features/home/dojo-theme.css';

export default function MainMenu() {
  const navigate = useNavigate();
  const { user, loading, logout, serverConfigured } = useAuth();

  const TokenImg = new URL('../Assets/art/tokens/Carved Green Yin-Yang Token.png', import.meta.url).href;
  const WarningIcon = new URL('../Assets/icons/warning-dark.png', import.meta.url).href;
  const VsAiIcon = new URL('../Assets/icons/vs-ai-dark.png', import.meta.url).href;
  const DeckIcon = new URL('../Assets/icons/deck-dark.svg', import.meta.url).href;
  const LeaderboardIcon = new URL('../Assets/icons/leaderboard-dark.svg', import.meta.url).href;
  const ManualIcon = new URL('../Assets/icons/manual-dark.svg', import.meta.url).href;

  const handlePlayLocal = () => navigate('/local');
  const handleOpenCollection = () => navigate('/collection');

  return (
    <div className="dojo-theme">
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px 64px' }}>
        {/* ---- Header ---- */}
        <header className="dojo-header">
          <div className="dojo-header-corner">
            {loading ? (
              <span style={{ fontSize: 13, color: 'var(--dojo-muted)' }}>Carregando...</span>
            ) : user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{user.displayName}</div>
                  <div style={{ fontSize: 11, color: 'var(--dojo-muted)' }}>{user.provider}</div>
                </div>
                <button className="dojo-btn dojo-btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => navigate('/friends')}>
                  Amigos
                </button>
                <button className="dojo-btn dojo-btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => logout()}>
                  Sair
                </button>
              </div>
            ) : null}
          </div>

          <div className="dojo-hero">
            <div className="dojo-logo-token">
              <img src={TokenImg} alt="Breath!" />
            </div>
            <h1 className="dojo-display dojo-title">Breath!</h1>
          </div>
        </header>

        {/* ---- Server warning ---- */}
        {!serverConfigured && (
          <div className="dojo-panel" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, borderColor: 'var(--dojo-accent-dark)' }}>
            <img src={WarningIcon} alt="" style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Servidor online não configurado</p>
              <p style={{ fontSize: 12, color: 'var(--dojo-muted)', margin: '2px 0 0' }}>
                Login e salas online estão desabilitados. Configure <code>public/config.json</code> com a URL do servidor para habilitar.
              </p>
            </div>
          </div>
        )}

        {/* ---- Combate ---- */}
        <section className="dojo-panel">
          <h2 className="dojo-display dojo-combate-title">Combate</h2>
          <div className="dojo-mode-grid">
            <button
              className="dojo-mode-btn"
              onClick={() => navigate('/play/casual')}
              disabled={!serverConfigured}
            >
              Casual
            </button>
            <button className="dojo-mode-btn is-muted" disabled>
              Ranqueada
              <span className="dojo-badge">Em breve</span>
            </button>
          </div>
        </section>

        {/* ---- Dojo (local) + Técnicas (decks/manual) ---- */}
        <div className="dojo-grid-2" style={{ marginTop: 20 }}>
          <section className="dojo-panel dojo-tatami">
            <div className="dojo-panel-head">
              <h2 className="dojo-display dojo-panel-title">Dojo</h2>
              <p className="dojo-panel-sub">treino local, sem internet</p>
            </div>
            <div className="dojo-panel-body">
              <button className="dojo-btn" onClick={handlePlayLocal}>
                <img src={VsAiIcon} alt="" /> Vs IA
              </button>
            </div>
          </section>

          <section className="dojo-panel dojo-locker">
            <div className="dojo-panel-head">
              <h2 className="dojo-display dojo-panel-title">Técnicas</h2>
              <p className="dojo-panel-sub">seus decks e como jogar</p>
            </div>
            <div className="dojo-panel-body">
              <button className="dojo-btn" onClick={handleOpenCollection}>
                <img src={DeckIcon} alt="" /> Seus Decks
              </button>
              <button className="dojo-btn" disabled>
                Treinamento <span className="dojo-badge">Em breve</span>
              </button>
              <button className="dojo-btn" onClick={() => window.open('/ManualBreath.txt', '_blank')}>
                <img src={ManualIcon} alt="" /> Aprender
              </button>
            </div>
          </section>
        </div>

        {/* ---- Circuito (ranking) ---- */}
        <div className="dojo-circuito">
          <div className="dojo-circuito-title dojo-display" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
            <img src={LeaderboardIcon} alt="" style={{ width: 18, height: 18, opacity: .6 }} />
            Circuito
            <span className="dojo-badge">Em breve</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--dojo-muted)', maxWidth: 420 }}>
            O ranking global estará disponível quando o modo ranqueado for lançado.
          </p>
        </div>
      </div>
    </div>
  );
}
