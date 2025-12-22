import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AppStateProvider } from '@/store/appState';
import { AuthProvider } from '@/contexts/AuthContext';

// Use basename for GitHub Pages deployment
const basename = import.meta.env.BASE_URL || '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
