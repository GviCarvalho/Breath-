import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Every screen past the main menu (local arena, online match, spectate,
// deck builder) renders standalone with no shared header, so there was
// simply no button anywhere to get back - the only way out was the
// browser's own back button. This is the one place that fixes it for
// every route at once instead of patching each page's own layout.
export default function ExitToMenuButton() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === '/') return null;

  return (
    <button
      onClick={() => navigate('/')}
      title="Voltar ao menu principal"
      style={{
        position: 'fixed',
        top: 10,
        left: 10,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,.14)',
        background: 'rgba(10,14,22,.82)',
        backdropFilter: 'blur(6px)',
        color: '#dde6ff',
        fontSize: 16,
        lineHeight: 1,
        cursor: 'pointer',
        boxShadow: '0 8px 20px rgba(0,0,0,.4)',
        transition: 'background .15s ease, width .15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(20,26,38,.92)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,14,22,.82)'; }}
    >
      <span aria-hidden="true">←</span>
    </button>
  );
}
