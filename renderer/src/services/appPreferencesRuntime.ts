import {
  coerceAppPreferences,
  defaultAppPreferences,
  getAppPreferences,
  setAppPreferences,
  type AppPreferencesV1,
  type OnboardingSetupStep,
  type GalleryCollectionsSortMode,
  type ScreenshotFormat,
  type UiThemePreference
} from './appPreferences';

let cache: AppPreferencesV1 | null = null;
let initPromise: Promise<AppPreferencesV1> | null = null;
let writeChain: Promise<AppPreferencesV1> = Promise.resolve(defaultAppPreferences());
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

function sanitizeScreenshotFormat(raw: unknown): ScreenshotFormat {
  if (raw === 'png' || raw === 'jpg' || raw === 'webp') return raw;
  return 'webp';
}

function sanitizeGalleryCollectionsSortMode(raw: unknown): GalleryCollectionsSortMode {
  if (raw === 'count' || raw === 'random') return raw;
  return 'chrono';
}

function sanitizeUiTheme(raw: unknown): UiThemePreference {
  if (raw === 'light' || raw === 'system') return raw;
  return 'dark';
}

function sanitizeOnboardingSetupStep(raw: unknown): OnboardingSetupStep {
  if (raw === 1 || raw === 2) return raw;
  return 0;
}

function normalizePatch(patch: Partial<AppPreferencesV1>): Partial<AppPreferencesV1> {
  const next: Partial<AppPreferencesV1> = {};

  if ('launchAtLogin' in patch && typeof patch.launchAtLogin === 'boolean') {
    next.launchAtLogin = patch.launchAtLogin;
  }
  if ('closeToTrayOnWindowClose' in patch && typeof patch.closeToTrayOnWindowClose === 'boolean') {
    next.closeToTrayOnWindowClose = patch.closeToTrayOnWindowClose;
  }
  if ('importSourceFilesAction' in patch) {
    next.importSourceFilesAction = patch.importSourceFilesAction;
  }
  if ('deleteCardsUseTrash' in patch && typeof patch.deleteCardsUseTrash === 'boolean') {
    next.deleteCardsUseTrash = patch.deleteCardsUseTrash;
  }
  if ('screenshotsEnabled' in patch && typeof patch.screenshotsEnabled === 'boolean') {
    next.screenshotsEnabled = patch.screenshotsEnabled;
  }
  if ('screenshotFormat' in patch) {
    next.screenshotFormat = sanitizeScreenshotFormat(patch.screenshotFormat);
  }
  if ('screenshotAskSaveLocation' in patch && typeof patch.screenshotAskSaveLocation === 'boolean') {
    next.screenshotAskSaveLocation = patch.screenshotAskSaveLocation;
  }
  if ('screenshotPrefixName' in patch && typeof patch.screenshotPrefixName === 'boolean') {
    next.screenshotPrefixName = patch.screenshotPrefixName;
  }
  if ('screenshotRetina2x' in patch && typeof patch.screenshotRetina2x === 'boolean') {
    next.screenshotRetina2x = patch.screenshotRetina2x;
  }
  if ('notifyScreenshotSaved' in patch && typeof patch.notifyScreenshotSaved === 'boolean') {
    next.notifyScreenshotSaved = patch.notifyScreenshotSaved;
  }
  if ('notifyDuplicatesFound' in patch && typeof patch.notifyDuplicatesFound === 'boolean') {
    next.notifyDuplicatesFound = patch.notifyDuplicatesFound;
  }
  if ('notifyAutoImport' in patch && typeof patch.notifyAutoImport === 'boolean') {
    next.notifyAutoImport = patch.notifyAutoImport;
  }
  if ('notifyFilesAdded' in patch && typeof patch.notifyFilesAdded === 'boolean') {
    next.notifyFilesAdded = patch.notifyFilesAdded;
  }
  if ('notifySoundEnabled' in patch && typeof patch.notifySoundEnabled === 'boolean') {
    next.notifySoundEnabled = patch.notifySoundEnabled;
  }
  if ('autoImportEnabled' in patch && typeof patch.autoImportEnabled === 'boolean') {
    next.autoImportEnabled = patch.autoImportEnabled;
  }
  if ('autoImportFolderPath' in patch) {
    if (typeof patch.autoImportFolderPath === 'string' && patch.autoImportFolderPath.trim()) {
      next.autoImportFolderPath = patch.autoImportFolderPath.trim();
    } else {
      next.autoImportFolderPath = null;
    }
  }
  if ('autoImportSourceFilesAction' in patch) {
    next.autoImportSourceFilesAction = patch.autoImportSourceFilesAction === 'trash' ? 'trash' : 'ask';
  }
  if ('aiSemanticSearchEnabled' in patch && typeof patch.aiSemanticSearchEnabled === 'boolean') {
    next.aiSemanticSearchEnabled = patch.aiSemanticSearchEnabled;
  }
  if ('aiModelTier' in patch) {
    if (patch.aiModelTier === 'heavy' || patch.aiModelTier === 'light') {
      next.aiModelTier = patch.aiModelTier;
    } else if (patch.aiModelTier === 'medium') {
      next.aiModelTier = 'heavy';
    }
  }
  if ('aiThreads' in patch && typeof patch.aiThreads === 'number') {
    next.aiThreads = Math.max(1, Math.min(32, Math.round(patch.aiThreads)));
  }
  if ('aiGpuLayers' in patch && typeof patch.aiGpuLayers === 'number') {
    next.aiGpuLayers = Math.max(0, Math.min(128, Math.round(patch.aiGpuLayers)));
  }
  if ('aiMaxRamMb' in patch && typeof patch.aiMaxRamMb === 'number') {
    next.aiMaxRamMb = Math.max(512, Math.min(65536, Math.round(patch.aiMaxRamMb)));
  }
  if ('aiResourcePreset' in patch && typeof patch.aiResourcePreset === 'number') {
    next.aiResourcePreset = Math.max(10, Math.min(100, Math.round(patch.aiResourcePreset)));
  }
  if ('aiSearchStrictness' in patch && typeof patch.aiSearchStrictness === 'number') {
    next.aiSearchStrictness = Math.max(0, Math.min(100, Math.round(patch.aiSearchStrictness / 5) * 5));
  }
  if ('galleryCollectionsStripEnabled' in patch && typeof patch.galleryCollectionsStripEnabled === 'boolean') {
    next.galleryCollectionsStripEnabled = patch.galleryCollectionsStripEnabled;
  }
  if ('galleryCollectionsSortMode' in patch) {
    next.galleryCollectionsSortMode = sanitizeGalleryCollectionsSortMode(patch.galleryCollectionsSortMode);
  }
  if ('uiTheme' in patch) {
    next.uiTheme = sanitizeUiTheme(patch.uiTheme);
  }
  if ('onboardingSetupCompleted' in patch && typeof patch.onboardingSetupCompleted === 'boolean') {
    next.onboardingSetupCompleted = patch.onboardingSetupCompleted;
  }
  if ('onboardingSetupStep' in patch) {
    next.onboardingSetupStep = sanitizeOnboardingSetupStep(patch.onboardingSetupStep);
  }

  return next;
}

function applyPatchLocal(current: AppPreferencesV1, patch: Partial<AppPreferencesV1>): AppPreferencesV1 {
  const next: AppPreferencesV1 = { ...current, version: 1 };

  if ('launchAtLogin' in patch && typeof patch.launchAtLogin === 'boolean') {
    next.launchAtLogin = patch.launchAtLogin;
  }
  if ('closeToTrayOnWindowClose' in patch && typeof patch.closeToTrayOnWindowClose === 'boolean') {
    next.closeToTrayOnWindowClose = patch.closeToTrayOnWindowClose;
  }
  if ('importSourceFilesAction' in patch) {
    next.importSourceFilesAction = patch.importSourceFilesAction === 'trash' ? 'trash' : 'ask';
  }
  if ('deleteCardsUseTrash' in patch && typeof patch.deleteCardsUseTrash === 'boolean') {
    next.deleteCardsUseTrash = patch.deleteCardsUseTrash;
  }
  if ('screenshotsEnabled' in patch && typeof patch.screenshotsEnabled === 'boolean') {
    next.screenshotsEnabled = patch.screenshotsEnabled;
  }
  if ('screenshotFormat' in patch) {
    next.screenshotFormat = sanitizeScreenshotFormat(patch.screenshotFormat);
  }
  if ('screenshotAskSaveLocation' in patch && typeof patch.screenshotAskSaveLocation === 'boolean') {
    next.screenshotAskSaveLocation = patch.screenshotAskSaveLocation;
  }
  if ('screenshotPrefixName' in patch && typeof patch.screenshotPrefixName === 'boolean') {
    next.screenshotPrefixName = patch.screenshotPrefixName;
  }
  if ('screenshotRetina2x' in patch && typeof patch.screenshotRetina2x === 'boolean') {
    next.screenshotRetina2x = patch.screenshotRetina2x;
  }
  if ('notifyScreenshotSaved' in patch && typeof patch.notifyScreenshotSaved === 'boolean') {
    next.notifyScreenshotSaved = patch.notifyScreenshotSaved;
  }
  if ('notifyDuplicatesFound' in patch && typeof patch.notifyDuplicatesFound === 'boolean') {
    next.notifyDuplicatesFound = patch.notifyDuplicatesFound;
  }
  if ('notifyAutoImport' in patch && typeof patch.notifyAutoImport === 'boolean') {
    next.notifyAutoImport = patch.notifyAutoImport;
  }
  if ('notifyFilesAdded' in patch && typeof patch.notifyFilesAdded === 'boolean') {
    next.notifyFilesAdded = patch.notifyFilesAdded;
  }
  if ('notifySoundEnabled' in patch && typeof patch.notifySoundEnabled === 'boolean') {
    next.notifySoundEnabled = patch.notifySoundEnabled;
  }
  if ('autoImportEnabled' in patch && typeof patch.autoImportEnabled === 'boolean') {
    next.autoImportEnabled = patch.autoImportEnabled;
  }
  if ('autoImportFolderPath' in patch) {
    if (typeof patch.autoImportFolderPath === 'string' && patch.autoImportFolderPath.trim()) {
      next.autoImportFolderPath = patch.autoImportFolderPath.trim();
    } else {
      next.autoImportFolderPath = null;
    }
  }
  if ('autoImportSourceFilesAction' in patch) {
    next.autoImportSourceFilesAction = patch.autoImportSourceFilesAction === 'trash' ? 'trash' : 'ask';
  }
  if ('aiSemanticSearchEnabled' in patch && typeof patch.aiSemanticSearchEnabled === 'boolean') {
    next.aiSemanticSearchEnabled = patch.aiSemanticSearchEnabled;
  }
  if ('aiModelTier' in patch) {
    if (patch.aiModelTier === 'heavy' || patch.aiModelTier === 'light') {
      next.aiModelTier = patch.aiModelTier;
    } else if (patch.aiModelTier === 'medium') {
      next.aiModelTier = 'heavy';
    }
  }
  if ('aiThreads' in patch && typeof patch.aiThreads === 'number') {
    next.aiThreads = Math.max(1, Math.min(32, Math.round(patch.aiThreads)));
  }
  if ('aiGpuLayers' in patch && typeof patch.aiGpuLayers === 'number') {
    next.aiGpuLayers = Math.max(0, Math.min(128, Math.round(patch.aiGpuLayers)));
  }
  if ('aiMaxRamMb' in patch && typeof patch.aiMaxRamMb === 'number') {
    next.aiMaxRamMb = Math.max(512, Math.min(65536, Math.round(patch.aiMaxRamMb)));
  }
  if ('aiResourcePreset' in patch && typeof patch.aiResourcePreset === 'number') {
    next.aiResourcePreset = Math.max(10, Math.min(100, Math.round(patch.aiResourcePreset)));
  }
  if ('aiSearchStrictness' in patch && typeof patch.aiSearchStrictness === 'number') {
    next.aiSearchStrictness = Math.max(0, Math.min(100, Math.round(patch.aiSearchStrictness / 5) * 5));
  }
  if ('galleryCollectionsStripEnabled' in patch && typeof patch.galleryCollectionsStripEnabled === 'boolean') {
    next.galleryCollectionsStripEnabled = patch.galleryCollectionsStripEnabled;
  }
  if ('galleryCollectionsSortMode' in patch) {
    next.galleryCollectionsSortMode = sanitizeGalleryCollectionsSortMode(patch.galleryCollectionsSortMode);
  }
  if ('uiTheme' in patch) {
    next.uiTheme = sanitizeUiTheme(patch.uiTheme);
  }
  if ('onboardingSetupCompleted' in patch && typeof patch.onboardingSetupCompleted === 'boolean') {
    next.onboardingSetupCompleted = patch.onboardingSetupCompleted;
  }
  if ('onboardingSetupStep' in patch) {
    next.onboardingSetupStep = sanitizeOnboardingSetupStep(patch.onboardingSetupStep);
  }

  return next;
}

export function applyAppPreferencesPatch(
  current: AppPreferencesV1,
  patch: Partial<AppPreferencesV1>
): AppPreferencesV1 {
  return applyPatchLocal(current, patch);
}

export async function initAppPreferencesRuntime(): Promise<AppPreferencesV1> {
  if (cache) return cache;
  if (!initPromise) {
    initPromise = getAppPreferences()
      .then((loaded) => {
        cache = coerceAppPreferences(loaded);
        notify();
        return cache;
      })
      .catch(() => {
        cache = defaultAppPreferences();
        notify();
        return cache;
      });
  }
  return initPromise;
}

export function isAppPreferencesCacheReady(): boolean {
  return cache !== null;
}

export function getAppPreferencesSync(): AppPreferencesV1 {
  return cache ? coerceAppPreferences(cache) : defaultAppPreferences();
}

export async function patchAppPreferences(patch: Partial<AppPreferencesV1>): Promise<AppPreferencesV1> {
  const normalized = normalizePatch(patch);
  if (Object.keys(normalized).length === 0) {
    return getAppPreferencesSync();
  }

  const run = async (): Promise<AppPreferencesV1> => {
    try {
      const next = coerceAppPreferences(await setAppPreferences(normalized));
      cache = next;
      notify();
      return next;
    } catch {
      const next = applyPatchLocal(getAppPreferencesSync(), normalized);
      cache = next;
      notify();
      return next;
    }
  };

  writeChain = writeChain.then(run, run);
  return writeChain;
}

export function subscribeAppPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
