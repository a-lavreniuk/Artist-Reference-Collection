import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import ArcTopBar from './ArcTopBar';
import TopNavbar from './TopNavbar';
import MaintenanceBanner from './MaintenanceBanner';
import AppUpdateHost from './AppUpdateHost';
import PendingRestoreModal from './PendingRestoreModal';
import LibraryRelocatedHost from './LibraryRelocatedHost';
import ImportHost from '../import/ImportHost';
import AutoImportHost from '../import/AutoImportHost';
import NotificationHost from '../notifications/NotificationHost';
import ScreenshotHost from '../screenshot/ScreenshotHost';
import BugReportWidget from '../bug-report/BugReportWidget';
import { GalleryFilterProvider } from '../gallery/GalleryFilterContext';
import { GalleryMetaProvider } from '../../context/GalleryMetaContext';
import { initAppPreferencesRuntime } from '../../services/appPreferencesRuntime';
import { useUiThemeSync } from '../../hooks/useUiThemeSync';
import { applyGridSizeToDocument, readGridSize } from '../../layout/gridSizePreference';
import { applyTopbarCssVars } from './navbarLayout';
import { isLibraryConfigured } from '../../services/db';
import { GALLERY_FEED_SETTLED_EVENT } from '../gallery/galleryFeedSettled';
import CardSectionsShell from './CardSectionsShell';

export default function AppLayout() {
  useUiThemeSync();

  useEffect(() => {
    void initAppPreferencesRuntime();
  }, []);

  useEffect(() => {
    void (async () => {
      const ok = await isLibraryConfigured();
      if (!ok) return;

      let started = false;
      const startDuplicateScan = () => {
        if (started) return;
        started = true;
        void window.arc?.startDuplicateFileScan?.();
      };

      const onFeedSettled = () => {
        window.removeEventListener(GALLERY_FEED_SETTLED_EVENT, onFeedSettled);
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(startDuplicateScan, { timeout: 30000 });
        } else {
          window.setTimeout(startDuplicateScan, 30000);
        }
      };

      window.addEventListener(GALLERY_FEED_SETTLED_EVENT, onFeedSettled, { once: true });
      window.setTimeout(() => {
        window.removeEventListener(GALLERY_FEED_SETTLED_EVENT, onFeedSettled);
        startDuplicateScan();
      }, 120_000);
    })();
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.add('arc-navbar-page');
    body.setAttribute('data-elevation', 'default');
    body.setAttribute('data-typo-role', 'primary');
    body.setAttribute('data-typo-state', 'default');
    body.setAttribute('data-btn-size', 'l');
    body.setAttribute('data-input-size', 'l');
    applyGridSizeToDocument(readGridSize());
    applyTopbarCssVars();

    return () => {
      body.removeAttribute('data-grid-size');
      body.classList.remove('arc-navbar-page');
      body.removeAttribute('data-elevation');
      body.removeAttribute('data-typo-role');
      body.removeAttribute('data-typo-state');
      body.removeAttribute('data-btn-size');
      body.removeAttribute('data-input-size');
    };
  }, []);

  return (
    <GalleryFilterProvider>
    <GalleryMetaProvider>
    <NotificationHost>
    <ScreenshotHost>
    <ImportHost>
      <AutoImportHost>
      <main className="arc-navbar-shell">
        <MaintenanceBanner />
        <ArcTopBar />
        <TopNavbar />
        <div className="arc-app-outlet">
          <CardSectionsShell />
          <Outlet />
        </div>
        <PendingRestoreModal />
        <LibraryRelocatedHost />
        <AppUpdateHost />
        <BugReportWidget />
      </main>
      </AutoImportHost>
    </ImportHost>
    </ScreenshotHost>
    </NotificationHost>
    </GalleryMetaProvider>
    </GalleryFilterProvider>
  );
}
