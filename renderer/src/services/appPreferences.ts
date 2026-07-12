import type { McpToolsEnabledMap } from '@arc-main-shared/mcpToolCatalog';
import { defaultMcpToolsEnabled, sanitizeMcpToolsEnabled } from '@arc-main-shared/mcpToolCatalog';

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

export type OnboardingSetupStep = 0 | 1 | 2;

export type OnboardingTourStep = number;

export type AppPreferencesV1 = {
  version: 1;
  onboardingSetupCompleted: boolean;
  onboardingSetupStep: OnboardingSetupStep;
  onboardingTourCompleted: boolean;
  onboardingTourStep: OnboardingTourStep;
  launchAtLogin: boolean;
  launchAtLoginHidden: boolean;
  closeToTrayOnWindowClose: boolean;
  importSourceFilesAction: ImportSourceFilesAction;
  deleteCardsUseTrash: boolean;
  screenshotsEnabled: boolean;
  screenshotFormat: ScreenshotFormat;
  screenshotAskSaveLocation: boolean;
  screenshotRetina2x: boolean;
  notifyScreenshotSaved: boolean;
  notifyDuplicatesFound: boolean;
  notifyAutoImport: boolean;
  notifyFilesAdded: boolean;
  notifySoundEnabled: boolean;
  autoImportEnabled: boolean;
  autoImportFolderPath: string | null;
  autoImportSourceFilesAction: ImportSourceFilesAction;
  importApiEnabled: boolean;
  importApiPrefixEnabled: boolean;
  importApiPrefixText: string;
  mcpServerEnabled: boolean;
  mcpToolsEnabled: McpToolsEnabledMap;
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
  videoAutoplay: boolean;
};

function sanitizeOnboardingSetupStep(raw: unknown): OnboardingSetupStep {
  if (raw === 1 || raw === 2) return raw;
  return 0;
}

function sanitizeOnboardingTourStep(raw: unknown, maxStep = 16): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  const n = Math.round(raw);
  return Math.max(0, Math.min(maxStep, n));
}

export function defaultAppPreferences(): AppPreferencesV1 {
  return {
    version: 1,
    onboardingSetupCompleted: false,
    onboardingSetupStep: 0,
    onboardingTourCompleted: false,
    onboardingTourStep: 0,
    launchAtLogin: false,
    launchAtLoginHidden: false,
    closeToTrayOnWindowClose: true,
    importSourceFilesAction: 'ask',
    deleteCardsUseTrash: true,
    screenshotsEnabled: true,
    screenshotFormat: 'webp',
    screenshotAskSaveLocation: false,
    screenshotRetina2x: false,
    notifyScreenshotSaved: true,
    notifyDuplicatesFound: true,
    notifyAutoImport: true,
    notifyFilesAdded: true,
    notifySoundEnabled: true,
    autoImportEnabled: false,
    autoImportFolderPath: null,
    autoImportSourceFilesAction: 'ask',
    importApiEnabled: true,
    importApiPrefixEnabled: false,
    importApiPrefixText: '',
    mcpServerEnabled: false,
    mcpToolsEnabled: defaultMcpToolsEnabled(),
    aiSemanticSearchEnabled: false,
    aiModelTier: 'light',
    aiThreads: 4,
    aiGpuLayers: 0,
    aiMaxRamMb: 4096,
    aiResourcePreset: 50,
    aiSearchStrictness: 50,
    galleryCollectionsStripEnabled: true,
    galleryCollectionsSortMode: 'chrono',
    uiTheme: 'dark',
    videoAutoplay: true
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
    uiTheme: sanitizeUiTheme(raw.uiTheme ?? d.uiTheme),
    onboardingSetupCompleted:
      typeof raw.onboardingSetupCompleted === 'boolean'
        ? raw.onboardingSetupCompleted
        : d.onboardingSetupCompleted,
    onboardingSetupStep: sanitizeOnboardingSetupStep(raw.onboardingSetupStep ?? d.onboardingSetupStep),
    onboardingTourCompleted:
      typeof raw.onboardingTourCompleted === 'boolean'
        ? raw.onboardingTourCompleted
        : d.onboardingTourCompleted,
    onboardingTourStep: sanitizeOnboardingTourStep(raw.onboardingTourStep ?? d.onboardingTourStep),
    importApiEnabled:
      typeof raw.importApiEnabled === 'boolean' ? raw.importApiEnabled : d.importApiEnabled,
    importApiPrefixEnabled:
      typeof raw.importApiPrefixEnabled === 'boolean' ? raw.importApiPrefixEnabled : d.importApiPrefixEnabled,
    importApiPrefixText:
      typeof raw.importApiPrefixText === 'string' ? raw.importApiPrefixText.trim().slice(0, 64) : d.importApiPrefixText,
    mcpServerEnabled:
      typeof raw.mcpServerEnabled === 'boolean' ? raw.mcpServerEnabled : d.mcpServerEnabled,
    mcpToolsEnabled: sanitizeMcpToolsEnabled(raw.mcpToolsEnabled ?? d.mcpToolsEnabled),
    videoAutoplay: typeof raw.videoAutoplay === 'boolean' ? raw.videoAutoplay : d.videoAutoplay
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
