import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { preloadArcNavbarIcons } from './components/layout/navbarIconHydrate';
import './styles/tokens.css';
import './styles/index.css';
import './styles/ui-kit.css';

preloadArcNavbarIcons();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
