import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import '@/features/home/dojo-theme.css';

interface FriendSummary {
  friendshipId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface FriendsData {
  friendCode: string;
  friends: FriendSummary[];
  incomingRequests: FriendSummary[];
  outgoingRequests: FriendSummary[];
}

export default function FriendsPage() {
  const navigate = useNavigate();
  const { user, serverHttpUrl } = useAuth();
  const [data, setData] = useState<FriendsData | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!serverHttpUrl) return;
    try {
      const res = await fetch(`${serverHttpUrl}/friends`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Falha ao carregar amigos.');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar amigos.');
    }
  }, [serverHttpUrl]);

  useEffect(() => { load(); }, [load]);

  const call = useCallback(async (path: string, method: string, body?: unknown) => {
    if (!serverHttpUrl) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${serverHttpUrl}${path}`, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Algo deu errado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo deu errado.');
    } finally {
      setBusy(false);
    }
  }, [serverHttpUrl, load]);

  const handleAdd = () => {
    if (!code.trim()) return;
    call('/friends/request', 'POST', { code: code.trim() }).then(() => setCode(''));
  };

  const handleCopyCode = () => {
    if (!data?.friendCode) return;
    navigator.clipboard.writeText(data.friendCode);
  };

  if (!user) {
    return (
      <div className="dojo-theme">
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 20px 64px' }}>
          <p className="dojo-hint">Você precisa estar logado para ver seus amigos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dojo-theme">
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 20px 64px' }}>
        <h1 className="dojo-display dojo-combate-title" style={{ padding: '0 0 24px', textAlign: 'center' }}>Amigos</h1>

        <section className="dojo-panel">
          <div className="dojo-panel-body" style={{ paddingTop: 22 }}>
            {error && <p className="dojo-hint" style={{ color: 'var(--dojo-accent-dark)' }}>{error}</p>}

            <div className="dojo-field-row">
              <input className="dojo-input" value={data?.friendCode ?? '...'} readOnly />
              <button className="dojo-btn" style={{ width: 'auto', padding: '10px 18px' }} onClick={handleCopyCode}>
                Copiar
              </button>
            </div>
            <p className="dojo-hint">Compartilhe seu código para que outros jogadores te adicionem.</p>

            <div className="dojo-field-row">
              <input
                className="dojo-input"
                placeholder="Código de amigo"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={busy}
              />
              <button className="dojo-btn dojo-btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={handleAdd} disabled={busy}>
                Adicionar
              </button>
            </div>
          </div>
        </section>

        {data && data.incomingRequests.length > 0 && (
          <section className="dojo-panel" style={{ marginTop: 20 }}>
            <div className="dojo-panel-head">
              <h2 className="dojo-display dojo-panel-title">Pedidos recebidos</h2>
            </div>
            <div className="dojo-panel-body">
              {data.incomingRequests.map((r) => (
                <div key={r.friendshipId} className="dojo-field-row">
                  <span style={{ flex: 1 }}>{r.displayName}</span>
                  <button className="dojo-btn dojo-btn-primary" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy} onClick={() => call(`/friends/${r.friendshipId}/accept`, 'POST')}>
                    Aceitar
                  </button>
                  <button className="dojo-btn dojo-btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy} onClick={() => call(`/friends/${r.friendshipId}/decline`, 'POST')}>
                    Recusar
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {data && data.outgoingRequests.length > 0 && (
          <section className="dojo-panel" style={{ marginTop: 20 }}>
            <div className="dojo-panel-head">
              <h2 className="dojo-display dojo-panel-title">Pedidos enviados</h2>
            </div>
            <div className="dojo-panel-body">
              {data.outgoingRequests.map((r) => (
                <div key={r.friendshipId} className="dojo-field-row">
                  <span style={{ flex: 1 }}>{r.displayName}</span>
                  <button className="dojo-btn dojo-btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy} onClick={() => call(`/friends/${r.friendshipId}`, 'DELETE')}>
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="dojo-panel" style={{ marginTop: 20 }}>
          <div className="dojo-panel-head">
            <h2 className="dojo-display dojo-panel-title">Seus amigos</h2>
          </div>
          <div className="dojo-panel-body">
            {!data || data.friends.length === 0 ? (
              <p className="dojo-hint">Ainda sem amigos adicionados.</p>
            ) : (
              data.friends.map((f) => (
                <div key={f.friendshipId} className="dojo-field-row">
                  <span style={{ flex: 1 }}>{f.displayName}</span>
                  <button
                    className="dojo-btn dojo-btn-primary"
                    style={{ width: 'auto', padding: '8px 14px' }}
                    disabled={busy}
                    onClick={() => navigate(`/play/online?inviteTo=${f.userId}`)}
                  >
                    Convidar
                  </button>
                  <button className="dojo-btn dojo-btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} disabled={busy} onClick={() => call(`/friends/${f.friendshipId}`, 'DELETE')}>
                    Remover
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
