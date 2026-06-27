import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import LoadingScreenApp from './LoadingScreenApp';
import '../styles/loading-screen.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoadingScreenApp />
  </StrictMode>
);
