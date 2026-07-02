import { initAppPreferencesRuntime } from '../services/appPreferencesRuntime';
import { isLibraryConfigured } from '../services/db';
import { ensureGalleryBootstrap, scheduleGalleryWarmup } from '../components/gallery/galleryBootstrap';
import { defaultGalleryFeedQuery } from '../components/gallery/galleryQuery';
import * as storage from '../services/storageClient';

export async function runLoadingBootstrapReporter(): Promise<void> {
  const arc = window.arc;
  if (!arc?.reportLoadingBootstrapProgress) return;

  try {
    arc.reportLoadingBootstrapProgress(58, 'Подготовка данных…');
    await initAppPreferencesRuntime();

    const libraryReady = await isLibraryConfigured();
    if (!libraryReady) {
      arc.reportLoadingBootstrapProgress(75, 'Подготовка интерфейса…');
      return;
    }

    arc.reportLoadingBootstrapProgress(62, 'Инициализация хранилища…');
    await storage.storageEnsureReady();

    arc.reportLoadingBootstrapProgress(68, 'Подготовка фильтров…');
    await Promise.all([
      storage.storageGalleryFilterStats({ libraryScope: 'all', selectedTagIds: [] }),
      storage.storageCountCards('all', 'all'),
      storage.storageCountCards('all', 'untagged'),
      storage.storageCountCards('all', 'trash')
    ]);

    arc.reportLoadingBootstrapProgress(78, 'Подготовка галереи…');
    await ensureGalleryBootstrap(defaultGalleryFeedQuery());
  } finally {
    await arc.reportLoadingBootstrapComplete?.();
    scheduleGalleryWarmup();
  }
}
