import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import '@/features/home/dojo-theme.css';

const GUEST_MODE_KEY = 'breath_guest_mode';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, login, loginWithEmail, registerWithEmail, serverConfigured } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const TokenImg = new URL('../Assets/art/tokens/Carved Green Yin-Yang Token.png', import.meta.url).href;
  const GoogleIcon = new URL('../Assets/icons/google.svg', import.meta.url).href;
  const DiscordIcon = new URL('../Assets/icons/discord.svg', import.meta.url).href;
  const WarningIcon = new URL('../Assets/icons/warning-dark.png', import.meta.url).href;

  // Already signed in (or came back here by mistake) - just continue.
  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [loading, user, navigate]);

  const handleSkip = () => {
    try { localStorage.setItem(GUEST_MODE_KEY, '1'); } catch {}
    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (tab === 'signup' && password !== confirmPassword) {
      setFormError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setFormError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setSubmitting(true);
    try {
      if (tab === 'signup') {
        await registerWithEmail(email.trim(), password, displayName.trim() || email.trim());
      } else {
        await loginWithEmail(email.trim(), password);
      }
      navigate('/');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Algo deu errado.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dojo-theme">
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 20px 64px' }}>
        <header className="dojo-header" style={{ padding: '64px 20px 24px' }}>
          <div className="dojo-hero">
            <div className="dojo-logo-token">
              <img src={TokenImg} alt="Breath!" />
            </div>
            <h1 className="dojo-display dojo-title" style={{ fontSize: 'clamp(40px, 9vw, 64px)' }}>Breath!</h1>
          </div>
        </header>

        {!serverConfigured && (
          <div className="dojo-panel" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, borderColor: 'var(--dojo-accent-dark)' }}>
            <img src={WarningIcon} alt="" style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>Servidor online não configurado</p>
              <p style={{ fontSize: 12, color: 'var(--dojo-muted)', margin: '2px 0 0' }}>
                Login está indisponível por enquanto. Você ainda pode jogar sem conta.
              </p>
            </div>
          </div>
        )}

        <section className="dojo-panel" style={{ padding: '22px 24px 26px' }}>
          <div className="dojo-authtabs">
            <button
              type="button"
              className={`dojo-authtab${tab === 'login' ? ' is-active' : ''}`}
              onClick={() => { setTab('login'); setFormError(null); }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`dojo-authtab${tab === 'signup' ? ' is-active' : ''}`}
              onClick={() => { setTab('signup'); setFormError(null); }}
            >
              Criar Conta
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tab === 'signup' && (
              <input
                className="dojo-input"
                placeholder="Nome de exibição"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!serverConfigured}
              />
            )}
            <input
              className="dojo-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!serverConfigured}
            />
            <input
              className="dojo-input"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!serverConfigured}
            />
            {tab === 'signup' && (
              <input
                className="dojo-input"
                type="password"
                placeholder="Confirmar senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={!serverConfigured}
              />
            )}

            {formError && <p style={{ fontSize: 12, color: '#c23b4f', margin: 0 }}>{formError}</p>}

            <button
              type="submit"
              className="dojo-btn dojo-btn-primary"
              disabled={!serverConfigured || submitting}
            >
              {submitting ? 'Aguarde...' : tab === 'login' ? 'Entrar' : 'Criar Conta'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--dojo-border-soft)' }} />
            <span style={{ fontSize: 11, color: 'var(--dojo-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: 'var(--dojo-border-soft)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="dojo-btn" onClick={() => login('google')} disabled={!serverConfigured}>
              <img src={GoogleIcon} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} /> Entrar com Google
            </button>
            <button className="dojo-btn" onClick={() => login('discord')} disabled={!serverConfigured}>
              <img src={DiscordIcon} alt="" style={{ width: 20, height: 20 }} /> Entrar com Discord
            </button>
          </div>
        </section>

        <button
          className="dojo-btn dojo-btn-ghost"
          style={{ marginTop: 16 }}
          onClick={handleSkip}
        >
          Jogar sem conta
        </button>
      </div>
    </div>
  );
}
