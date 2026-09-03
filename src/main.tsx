import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AppStateProvider } from '@/store/appState';
import { AuthProvider } from '@/contexts/AuthContext';
import { LobbyProvider } from '@/contexts/LobbyContext';

// Use basename for GitHub Pages deployment
const basename = '/Breath-/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <LobbyProvider>
          <AppStateProvider>
            <App />
          </AppStateProvider>
        </LobbyProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
