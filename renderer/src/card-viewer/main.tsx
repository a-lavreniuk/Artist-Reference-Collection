import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CardViewerApp from './CardViewerApp';
import { ErrorBoundary } from '../components/error-boundary';
import { preloadArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import '../styles/tokens.css';
import '../styles/card-viewer.css';

preloadArcNavbarIcons();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CardViewerApp />
    </ErrorBoundary>
  </StrictMode>
);
