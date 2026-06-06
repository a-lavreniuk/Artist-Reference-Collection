import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import TopNavbar from './TopNavbar';
import MaintenanceBanner from './MaintenanceBanner';
import AppUpdateHost from './AppUpdateHost';
import PendingRestoreModal from './PendingRestoreModal';
import ImportHost from '../import/ImportHost';
import { ensureGalleryBootstrap, scheduleGalleryWarmup } from '../gallery/galleryBootstrap';
import { isLibraryConfigured } from '../../services/db';

export default function AppLayout() {
  useEffect(() => {
    void (async () => {
      const ok = await isLibraryConfigured();
      if (!ok) return;
      await ensureGalleryBootstrap();
      scheduleGalleryWarmup();
    })();
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.add('arc-navbar-page');
    body.setAttribute('data-elevation', 'default');
    body.setAttribute('data-typo-role', 'primary');
    body.setAttribute('data-typo-tone', 'white');
    body.setAttribute('data-typo-state', 'default');
    body.setAttribute('data-btn-size', 'l');
    body.setAttribute('data-input-size', 'l');

    return () => {
      body.classList.remove('arc-navbar-page');
      body.removeAttribute('data-elevation');
      body.removeAttribute('data-typo-role');
      body.removeAttribute('data-typo-tone');
      body.removeAttribute('data-typo-state');
      body.removeAttribute('data-btn-size');
      body.removeAttribute('data-input-size');
    };
  }, []);

  return (
    <ImportHost>
      <main className="arc-navbar-shell">
        <MaintenanceBanner />
        <TopNavbar />
        <div className="arc-app-outlet">
          <Outlet />
        </div>
        <PendingRestoreModal />
        <AppUpdateHost />
      </main>
    </ImportHost>
  );
}
