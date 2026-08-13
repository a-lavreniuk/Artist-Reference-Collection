import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ColorEyedropperApp from './ColorEyedropperApp';
import '../styles/tokens.css';
import '../styles/screenshot-picker.css';

document.documentElement.setAttribute('data-theme', 'dark');
document.body.setAttribute('data-btn-size', 'm');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ColorEyedropperApp />
  </StrictMode>
);
