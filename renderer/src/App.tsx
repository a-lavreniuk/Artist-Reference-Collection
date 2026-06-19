import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import CollectionsPage from './pages/CollectionsPage';
import GalleryCardEditRedirect from './pages/GalleryCardEditRedirect';
import GalleryPage from './pages/GalleryPage';
import MoodboardPage from './pages/MoodboardPage';
import OnboardingStubPage from './pages/OnboardingStubPage';
import SettingsPage from './pages/SettingsPage';
import SettingsNavbarPanelPage from './pages/SettingsNavbarPanelPage';
import TagsPage from './pages/TagsPage';

const BoardPage = lazy(() => import('./pages/BoardPage'));
const UiKitPage = lazy(() => import('./ui-kit/UiKitPage'));
const SettingsUiKitPanel = lazy(() => import('./pages/settings/panels/SettingsUiKitPanel'));
const SettingsGeneralPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsGeneralPanel }))
);
const SettingsScreenshotsPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({
    default: m.SettingsScreenshotsPanelRoute
  }))
);
const SettingsNotificationsPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({
    default: m.SettingsNotificationsPanelRoute
  }))
);
const SettingsShortcutsPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsShortcutsPanel }))
);
const SettingsLibraryPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsLibraryPanel }))
);
const SettingsBackupPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsBackupPanel }))
);
const SettingsIntegrityPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsIntegrityPanel }))
);
const SettingsAutoImportPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsAutoImportPanel }))
);
const SettingsAiSearchPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsAiSearchPanel }))
);
const SettingsUpdatesPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsUpdatesPanel }))
);

function RouteFallback() {
  return (
    <div className="arc-gallery-boot panel elevation-default" role="status" aria-live="polite">
      <span className="loader" aria-hidden="true" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/gallery" replace />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="gallery/:cardId/edit" element={<GalleryCardEditRedirect />} />
          <Route path="onboarding" element={<OnboardingStubPage />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/:collectionId" element={<CollectionsPage />} />
          <Route path="moodboard" element={<MoodboardPage />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="statistics" element={<SettingsNavbarPanelPage panel="statistics" />} />
          <Route path="history" element={<SettingsNavbarPanelPage panel="history" />} />
          <Route path="duplicates" element={<SettingsNavbarPanelPage panel="duplicates" />} />
          <Route path="settings" element={<SettingsPage />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="ui-kit" element={<SettingsUiKitPanel />} />
            <Route path="general" element={<SettingsGeneralPanel />} />
            <Route path="screenshots" element={<SettingsScreenshotsPanel />} />
            <Route path="notifications" element={<SettingsNotificationsPanel />} />
            <Route path="shortcuts" element={<SettingsShortcutsPanel />} />
            <Route path="library" element={<SettingsLibraryPanel />} />
            <Route path="backup" element={<SettingsBackupPanel />} />
            <Route path="integrity" element={<SettingsIntegrityPanel />} />
            <Route path="auto-import" element={<SettingsAutoImportPanel />} />
            <Route path="ai-search" element={<SettingsAiSearchPanel />} />
            <Route path="updates" element={<SettingsUpdatesPanel />} />
          </Route>
          <Route path="ui-kit" element={<UiKitPage />} />
          <Route path="add" element={<Navigate to="/gallery" replace />} />
        </Route>
        <Route path="/navbar" element={<Navigate to="/gallery" replace />} />
        <Route path="*" element={<Navigate to="/gallery" replace />} />
      </Routes>
    </Suspense>
  );
}
