import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary, registerGlobalErrorHandlers } from './components/error-boundary';
import { preloadArcNavbarIcons } from './components/layout/navbarIconHydrate';
import { runLoadingBootstrapReporter } from './loading/loadingBootstrapReporter';
import './styles/tokens.css';
import './styles/index.css';
import './styles/ui-kit.css';

import { ensureGsapSetup } from './motion/gsapSetup';

registerGlobalErrorHandlers();
preloadArcNavbarIcons();
ensureGsapSetup();
void runLoadingBootstrapReporter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </HashRouter>
  </StrictMode>
);
