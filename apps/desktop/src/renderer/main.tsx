import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme.css';
import './styles.css';
import './desktop.css';

// The main process passes the window material and the Windows accent so the
// renderer matches the native chrome from the first paint.
const params = new URLSearchParams(window.location.search);
const root = document.documentElement;
root.dataset.material = params.get('material') === 'mica' ? 'mica' : 'solid';
root.dataset.platform = params.get('platform') ?? 'web';
const accent = params.get('accent');
const onAccent = params.get('onAccent');
if (accent && /^[0-9a-f]{6}$/i.test(accent)) root.style.setProperty('--accent', `#${accent}`);
if (onAccent && /^[0-9a-f]{6}$/i.test(onAccent)) root.style.setProperty('--on-accent', `#${onAccent}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
