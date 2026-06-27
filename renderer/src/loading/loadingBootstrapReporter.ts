import { initAppPreferencesRuntime } from '../services/appPreferencesRuntime';
import { isLibraryConfigured } from '../services/db';
import { ensureGalleryBootstrap } from '../components/gallery/galleryBootstrap';
import { defaultGalleryFeedQuery } from '../components/gallery/galleryQuery';

export async function runLoadingBootstrapReporter(): Promise<void> {
  const arc = window.arc;
  if (!arc?.reportLoadingBootstrapProgress) return;

  try {
    arc.reportLoadingBootstrapProgress(58, 'Подготовка данных…');

    await initAppPreferencesRuntime();
    const libraryReady = await isLibraryConfigured();

    if (libraryReady) {
      arc.reportLoadingBootstrapProgress(75, 'Подготовка галереи…');
      await ensureGalleryBootstrap(defaultGalleryFeedQuery());
    } else {
      arc.reportLoadingBootstrapProgress(75, 'Подготовка интерфейса…');
    }
  } finally {
    await arc.reportLoadingBootstrapComplete?.();
  }
}
