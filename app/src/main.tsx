import '@fontsource-variable/noto-sans-jp';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles/index.css';

/**
 * Deep links under a nested deployment (e.g. /nihongo-dojo/v2/leccion/h-a): GitHub Pages only serves the root
 * 404.html, which redirects here as `/v2/?r=leccion/h-a`. Restore that path before the router mounts.
 */
const params = new URLSearchParams(window.location.search);
const restore = params.get('r');
if (restore !== null) {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  const clean = restore.replace(/^\/+/, '');
  window.history.replaceState(null, '', base + clean);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
