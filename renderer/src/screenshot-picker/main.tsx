import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ScreenshotPickerApp from './ScreenshotPickerApp';
import '../styles/tokens.css';
import '../styles/screenshot-picker.css';

document.body.setAttribute('data-btn-size', 's');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScreenshotPickerApp />
  </StrictMode>
);
