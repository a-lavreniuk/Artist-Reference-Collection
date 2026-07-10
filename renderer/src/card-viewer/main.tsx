import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CardViewerApp from './CardViewerApp';
import { preloadArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import '../styles/tokens.css';
import '../styles/card-viewer.css';

preloadArcNavbarIcons();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CardViewerApp />
  </StrictMode>
);
