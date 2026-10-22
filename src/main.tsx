import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { initTheme } from './theme';

// Spotify only accepts loopback-IP redirect URIs, and login state is stored per origin,
// so always run on 127.0.0.1 rather than localhost.
if (window.location.hostname === 'localhost') {
  const url = new URL(window.location.href);
  url.hostname = '127.0.0.1';
  window.location.replace(url);
}

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
