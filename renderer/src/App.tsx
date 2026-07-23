import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import OnboardingGate from './components/onboarding/OnboardingGate';
import AppLayout from './components/layout/AppLayout';
import CardSectionRoute from './components/layout/CardSectionRoute';
import GalleryCardEditRedirect from './pages/GalleryCardEditRedirect';
import SettingsPage from './pages/SettingsPage';
import SettingsNavbarPanelPage from './pages/SettingsNavbarPanelPage';
import TagsPage from './pages/TagsPage';
import DuplicatesPage from './pages/DuplicatesPage';
import { useArcMoodboardLibraryDiag } from './debug/diagHook';

const BoardPage = lazy(() => import('./pages/BoardPage'));
const UiKitPage = lazy(() => import('./ui-kit/UiKitPage'));
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
const SettingsIntegrityPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsIntegrityPanel }))
);
const SettingsAutoImportPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsAutoImportPanel }))
);
const SettingsBrowserExtensionPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsBrowserExtensionPanel }))
);
const SettingsMcpServerPanel = lazy(() =>
  import('./pages/settings/panels/SettingsMcpServerPanel')
);
const SettingsAiSearchPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsAiSearchPanel }))
);
const SettingsAutoTagPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({ default: m.SettingsAutoTagPanel }))
);
const SettingsVideoPlaybackPanel = lazy(() =>
  import('./pages/settings/panels/settingsProductPanels').then((m) => ({
    default: m.SettingsVideoPlaybackPanelRoute
  }))
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
  useArcMoodboardLibraryDiag();

  return (
    <OnboardingGate>
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/gallery" replace />} />
          <Route path="gallery" element={<CardSectionRoute />} />
          <Route path="gallery/:cardId/edit" element={<GalleryCardEditRedirect />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="collections" element={<CardSectionRoute />} />
          <Route path="collections/:collectionId" element={<CardSectionRoute />} />
          <Route path="moodboard" element={<CardSectionRoute />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="statistics" element={<SettingsNavbarPanelPage panel="statistics" />} />
          <Route path="history" element={<SettingsNavbarPanelPage panel="history" />} />
          <Route path="duplicates" element={<DuplicatesPage />} />
          <Route path="settings" element={<SettingsPage />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<SettingsGeneralPanel />} />
            <Route path="screenshots" element={<SettingsScreenshotsPanel />} />
            <Route path="video-playback" element={<SettingsVideoPlaybackPanel />} />
            <Route path="notifications" element={<SettingsNotificationsPanel />} />
            <Route path="shortcuts" element={<SettingsShortcutsPanel />} />
            <Route path="library" element={<SettingsLibraryPanel />} />
            <Route path="integrity" element={<SettingsIntegrityPanel />} />
            <Route path="auto-import" element={<SettingsAutoImportPanel />} />
            <Route path="browser-extension" element={<SettingsBrowserExtensionPanel />} />
            <Route path="mcp-server" element={<SettingsMcpServerPanel />} />
            <Route path="ai-search" element={<SettingsAiSearchPanel />} />
            <Route path="auto-tag" element={<SettingsAutoTagPanel />} />
            <Route path="updates" element={<SettingsUpdatesPanel />} />
          </Route>
          <Route path="ui-kit" element={<UiKitPage />} />
          <Route path="add" element={<Navigate to="/gallery" replace />} />
        </Route>
        <Route path="/navbar" element={<Navigate to="/gallery" replace />} />
        <Route path="*" element={<Navigate to="/gallery" replace />} />
      </Routes>
    </Suspense>
    </OnboardingGate>
  );
}
