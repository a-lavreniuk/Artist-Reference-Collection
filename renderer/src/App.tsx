import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import CollectionsPage from './pages/CollectionsPage';
import GalleryCardEditRedirect from './pages/GalleryCardEditRedirect';
import GalleryPage from './pages/GalleryPage';
import BoardPage from './pages/BoardPage';
import MoodboardPage from './pages/MoodboardPage';
import OnboardingStubPage from './pages/OnboardingStubPage';
import SettingsLegacyRedirect from './pages/SettingsLegacyRedirect';
import SettingsSectionPage from './pages/SettingsSectionPage';
import TagsPage from './pages/TagsPage';
import UiKitPage from './ui-kit/UiKitPage';

export default function App() {
  return (
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
        <Route path="storage" element={<SettingsSectionPage panel="storage" />} />
        <Route path="statistics" element={<SettingsSectionPage panel="statistics" />} />
        <Route path="history" element={<SettingsSectionPage panel="history" />} />
        <Route path="duplicates" element={<SettingsSectionPage panel="duplicates" />} />
        <Route path="settings" element={<SettingsLegacyRedirect />} />
        <Route path="ui-kit" element={<UiKitPage />} />
        <Route path="add" element={<Navigate to="/gallery" replace />} />
      </Route>
      <Route path="/navbar" element={<Navigate to="/gallery" replace />} />
      <Route path="*" element={<Navigate to="/gallery" replace />} />
    </Routes>
  );
}
