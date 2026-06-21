export type ImportSourceFilesAction = 'ask' | 'trash';
export type ScreenshotFormat = 'png' | 'jpg' | 'webp';
export type AiModelTier = 'light' | 'heavy';
export type GalleryCollectionsSortMode = 'chrono' | 'count' | 'random';
export type UiThemePreference = 'dark' | 'light' | 'system';

export type NotificationPrefKey =
  | 'notifyScreenshotSaved'
  | 'notifyDuplicatesFound'
  | 'notifyAutoImport'
  | 'notifyFilesAdded';

export type AppPreferencesV1 = {
  version: 1;
  launchAtLogin: boolean;
  closeToTrayOnWindowClose: boolean;
  importSourceFilesAction: ImportSourceFilesAction;
  deleteCardsUseTrash: boolean;
  screenshotsEnabled: boolean;
  screenshotFormat: ScreenshotFormat;
  screenshotAskSaveLocation: boolean;
  screenshotPrefixName: boolean;
  screenshotRetina2x: boolean;
  notifyScreenshotSaved: boolean;
  notifyDuplicatesFound: boolean;
  notifyAutoImport: boolean;
  notifyFilesAdded: boolean;
  notifySoundEnabled: boolean;
  autoImportEnabled: boolean;
  autoImportFolderPath: string | null;
  autoImportSourceFilesAction: ImportSourceFilesAction;
  aiSemanticSearchEnabled: boolean;
  aiModelTier: AiModelTier;
  aiThreads: number;
  aiGpuLayers: number;
  aiMaxRamMb: number;
  aiResourcePreset: number;
  aiSearchStrictness: number;
  galleryCollectionsStripEnabled: boolean;
  galleryCollectionsSortMode: GalleryCollectionsSortMode;
  uiTheme: UiThemePreference;
};

export function defaultAppPreferences(): AppPreferencesV1 {
  return {
    version: 1,
    launchAtLogin: false,
    closeToTrayOnWindowClose: true,
    importSourceFilesAction: 'ask',
    deleteCardsUseTrash: true,
    screenshotsEnabled: true,
    screenshotFormat: 'webp',
    screenshotAskSaveLocation: false,
    screenshotPrefixName: false,
    screenshotRetina2x: false,
    notifyScreenshotSaved: true,
    notifyDuplicatesFound: true,
    notifyAutoImport: true,
    notifyFilesAdded: true,
    notifySoundEnabled: true,
    autoImportEnabled: false,
    autoImportFolderPath: null,
    autoImportSourceFilesAction: 'ask',
    aiSemanticSearchEnabled: false,
    aiModelTier: 'light',
    aiThreads: 4,
    aiGpuLayers: 0,
    aiMaxRamMb: 4096,
    aiResourcePreset: 50,
    aiSearchStrictness: 50,
    galleryCollectionsStripEnabled: true,
    galleryCollectionsSortMode: 'chrono',
    uiTheme: 'dark'
  };
}

function sanitizeGalleryCollectionsSortMode(raw: unknown): GalleryCollectionsSortMode {
  if (raw === 'count' || raw === 'random') return raw;
  return 'chrono';
}

function sanitizeImportAction(raw: unknown): ImportSourceFilesAction {
  return raw === 'trash' ? 'trash' : 'ask';
}

function sanitizeScreenshotFormat(raw: unknown): ScreenshotFormat {
  if (raw === 'png' || raw === 'jpg' || raw === 'webp') return raw;
  return 'webp';
}

function sanitizeUiTheme(raw: unknown): UiThemePreference {
  if (raw === 'light' || raw === 'system') return raw;
  return 'dark';
}

/** Дополняет ответ IPC дефолтами — важно для новых полей prefs после обновления. */
export function coerceAppPreferences(raw: Partial<AppPreferencesV1> | null | undefined): AppPreferencesV1 {
  const d = defaultAppPreferences();
  if (!raw) return d;

  return {
    ...d,
    ...raw,
    version: 1,
    importSourceFilesAction: sanitizeImportAction(raw.importSourceFilesAction ?? d.importSourceFilesAction),
    autoImportSourceFilesAction: sanitizeImportAction(
      raw.autoImportSourceFilesAction ?? d.autoImportSourceFilesAction
    ),
    screenshotFormat: sanitizeScreenshotFormat(raw.screenshotFormat ?? d.screenshotFormat),
    autoImportFolderPath:
      typeof raw.autoImportFolderPath === 'string' && raw.autoImportFolderPath.trim()
        ? raw.autoImportFolderPath.trim()
        : null,
    galleryCollectionsStripEnabled:
      typeof raw.galleryCollectionsStripEnabled === 'boolean'
        ? raw.galleryCollectionsStripEnabled
        : d.galleryCollectionsStripEnabled,
    galleryCollectionsSortMode: sanitizeGalleryCollectionsSortMode(
      raw.galleryCollectionsSortMode ?? d.galleryCollectionsSortMode
    ),
    uiTheme: sanitizeUiTheme(raw.uiTheme ?? d.uiTheme)
  };
}

export async function getAppPreferences(): Promise<AppPreferencesV1> {
  if (!window.arc?.getAppPreferences) {
    return defaultAppPreferences();
  }
  return window.arc.getAppPreferences();
}

export async function setAppPreferences(patch: Partial<AppPreferencesV1>): Promise<AppPreferencesV1> {
  if (!window.arc?.setAppPreferences) {
    throw new Error('App preferences IPC is unavailable');
  }
  return window.arc.setAppPreferences(patch);
}
