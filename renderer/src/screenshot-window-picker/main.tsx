import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ScreenshotWindowPickerApp from './ScreenshotWindowPickerApp';
import '../styles/tokens.css';
import '../styles/screenshot-picker.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScreenshotWindowPickerApp />
  </StrictMode>
);
