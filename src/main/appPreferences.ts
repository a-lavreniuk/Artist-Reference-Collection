import { app, ipcMain } from 'electron';
import fs from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

import { applyLaunchAtLogin, shouldStartHiddenInTrayFromLaunch } from './launchAtLogin';
import { registerScreenshotShortcut } from './screenshotShortcut';
import {
  defaultMcpToolsEnabled,
  mergeMcpToolsEnabled,
  sanitizeMcpToolsEnabled,
  type McpToolsEnabledMap
} from './shared/mcpToolCatalog';

export type ImportSourceFilesAction = 'ask' | 'trash';
export type ScreenshotFormat = 'png' | 'jpg' | 'webp';
export type AiModelTier = 'light' | 'heavy';
export type GalleryCollectionsSortMode = 'chrono' | 'count' | 'random';
export type UiThemePreference = 'dark' | 'light' | 'system';

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

const FILENAME = 'arc-app-preferences.json';

let cached: AppPreferencesV1 | null = null;
let ipcRegistered = false;

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

function prefsPath(): string {
  return path.join(app.getPath('userData'), FILENAME);
}

function sanitizeImportAction(raw: unknown): ImportSourceFilesAction {
  if (raw === 'trash') return 'trash';
  return 'ask';
}

function sanitizeScreenshotFormat(raw: unknown): ScreenshotFormat {
  if (raw === 'png' || raw === 'jpg' || raw === 'webp') return raw;
  return 'webp';
}

function sanitizeAiModelTier(raw: unknown): AiModelTier {
  if (raw === 'medium' || raw === 'heavy') return 'heavy';
  return 'light';
}

function sanitizeUiTheme(raw: unknown): UiThemePreference {
  if (raw === 'light' || raw === 'system') return raw;
  return 'dark';
}

function sanitizeImportApiPrefixText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 64);
}

function sanitizeFromDisk(raw: Partial<AppPreferencesV1> & Record<string, unknown>): AppPreferencesV1 {
  const d = defaultAppPreferences();

  const sanitized: AppPreferencesV1 = {
    version: 1,
    launchAtLogin: typeof raw.launchAtLogin === 'boolean' ? raw.launchAtLogin : d.launchAtLogin,
    launchAtLoginHidden:
      typeof raw.launchAtLoginHidden === 'boolean' ? raw.launchAtLoginHidden : d.launchAtLoginHidden,
    closeToTrayOnWindowClose:
      typeof raw.closeToTrayOnWindowClose === 'boolean' ? raw.closeToTrayOnWindowClose : d.closeToTrayOnWindowClose,
    importSourceFilesAction: sanitizeImportAction(raw.importSourceFilesAction),
    deleteCardsUseTrash: typeof raw.deleteCardsUseTrash === 'boolean' ? raw.deleteCardsUseTrash : d.deleteCardsUseTrash,
    screenshotsEnabled: typeof raw.screenshotsEnabled === 'boolean' ? raw.screenshotsEnabled : d.screenshotsEnabled,
    screenshotFormat: sanitizeScreenshotFormat(raw.screenshotFormat),
    screenshotAskSaveLocation:
      typeof raw.screenshotAskSaveLocation === 'boolean' ? raw.screenshotAskSaveLocation : d.screenshotAskSaveLocation,
    screenshotRetina2x: typeof raw.screenshotRetina2x === 'boolean' ? raw.screenshotRetina2x : d.screenshotRetina2x,
    notifyScreenshotSaved:
      typeof raw.notifyScreenshotSaved === 'boolean' ? raw.notifyScreenshotSaved : d.notifyScreenshotSaved,
    notifyDuplicatesFound:
      typeof raw.notifyDuplicatesFound === 'boolean' ? raw.notifyDuplicatesFound : d.notifyDuplicatesFound,
    notifyAutoImport: typeof raw.notifyAutoImport === 'boolean' ? raw.notifyAutoImport : d.notifyAutoImport,
    notifyFilesAdded: typeof raw.notifyFilesAdded === 'boolean' ? raw.notifyFilesAdded : d.notifyFilesAdded,
    notifySoundEnabled: typeof raw.notifySoundEnabled === 'boolean' ? raw.notifySoundEnabled : d.notifySoundEnabled,
    autoImportEnabled: typeof raw.autoImportEnabled === 'boolean' ? raw.autoImportEnabled : d.autoImportEnabled,
    autoImportFolderPath:
      typeof raw.autoImportFolderPath === 'string' && raw.autoImportFolderPath.trim()
        ? path.resolve(raw.autoImportFolderPath.trim())
        : d.autoImportFolderPath,
    autoImportSourceFilesAction: sanitizeImportAction(raw.autoImportSourceFilesAction ?? d.autoImportSourceFilesAction),
    importApiEnabled: typeof raw.importApiEnabled === 'boolean' ? raw.importApiEnabled : d.importApiEnabled,
    importApiPrefixEnabled:
      typeof raw.importApiPrefixEnabled === 'boolean' ? raw.importApiPrefixEnabled : d.importApiPrefixEnabled,
    importApiPrefixText: sanitizeImportApiPrefixText(raw.importApiPrefixText ?? d.importApiPrefixText),
    mcpServerEnabled: typeof raw.mcpServerEnabled === 'boolean' ? raw.mcpServerEnabled : d.mcpServerEnabled,
    mcpToolsEnabled: sanitizeMcpToolsEnabled(raw.mcpToolsEnabled ?? d.mcpToolsEnabled),
    aiSemanticSearchEnabled:
      typeof raw.aiSemanticSearchEnabled === 'boolean' ? raw.aiSemanticSearchEnabled : d.aiSemanticSearchEnabled,
    aiModelTier: sanitizeAiModelTier(raw.aiModelTier ?? d.aiModelTier),
    aiThreads: typeof raw.aiThreads === 'number' ? Math.max(1, Math.min(32, Math.round(raw.aiThreads))) : d.aiThreads,
    aiGpuLayers:
      typeof raw.aiGpuLayers === 'number' ? Math.max(0, Math.min(128, Math.round(raw.aiGpuLayers))) : d.aiGpuLayers,
    aiMaxRamMb:
      typeof raw.aiMaxRamMb === 'number' ? Math.max(512, Math.min(65536, Math.round(raw.aiMaxRamMb))) : d.aiMaxRamMb,
    aiResourcePreset:
      typeof raw.aiResourcePreset === 'number'
        ? Math.max(10, Math.min(100, Math.round(raw.aiResourcePreset)))
        : d.aiResourcePreset,
    aiSearchStrictness:
      typeof raw.aiSearchStrictness === 'number'
        ? Math.max(0, Math.min(100, Math.round(raw.aiSearchStrictness / 5) * 5))
        : d.aiSearchStrictness,
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
    videoAutoplay: typeof raw.videoAutoplay === 'boolean' ? raw.videoAutoplay : d.videoAutoplay
  };

  if (!sanitized.launchAtLogin) {
    sanitized.launchAtLoginHidden = false;
  }

  return sanitized;
}

function applyPatch(current: AppPreferencesV1, patch: Partial<AppPreferencesV1>): AppPreferencesV1 {
  const next: AppPreferencesV1 = { ...current, version: 1 };

  if ('launchAtLogin' in patch && typeof patch.launchAtLogin === 'boolean') {
    next.launchAtLogin = patch.launchAtLogin;
  }
  if ('launchAtLoginHidden' in patch && typeof patch.launchAtLoginHidden === 'boolean') {
    next.launchAtLoginHidden = patch.launchAtLoginHidden;
  }
  if (!next.launchAtLogin) {
    next.launchAtLoginHidden = false;
  }
  if ('closeToTrayOnWindowClose' in patch && typeof patch.closeToTrayOnWindowClose === 'boolean') {
    next.closeToTrayOnWindowClose = patch.closeToTrayOnWindowClose;
  }
  if ('importSourceFilesAction' in patch) {
    next.importSourceFilesAction = sanitizeImportAction(patch.importSourceFilesAction);
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
      next.autoImportFolderPath = path.resolve(patch.autoImportFolderPath.trim());
    } else {
      next.autoImportFolderPath = null;
    }
  }
  if ('autoImportSourceFilesAction' in patch) {
    next.autoImportSourceFilesAction = sanitizeImportAction(patch.autoImportSourceFilesAction);
  }
  if ('importApiEnabled' in patch && typeof patch.importApiEnabled === 'boolean') {
    next.importApiEnabled = patch.importApiEnabled;
  }
  if ('importApiPrefixEnabled' in patch && typeof patch.importApiPrefixEnabled === 'boolean') {
    next.importApiPrefixEnabled = patch.importApiPrefixEnabled;
  }
  if ('importApiPrefixText' in patch) {
    next.importApiPrefixText = sanitizeImportApiPrefixText(patch.importApiPrefixText);
  }
  if ('mcpServerEnabled' in patch && typeof patch.mcpServerEnabled === 'boolean') {
    next.mcpServerEnabled = patch.mcpServerEnabled;
  }
  if ('mcpToolsEnabled' in patch && patch.mcpToolsEnabled && typeof patch.mcpToolsEnabled === 'object') {
    next.mcpToolsEnabled = mergeMcpToolsEnabled(current.mcpToolsEnabled, patch.mcpToolsEnabled);
  }
  if ('aiSemanticSearchEnabled' in patch && typeof patch.aiSemanticSearchEnabled === 'boolean') {
    next.aiSemanticSearchEnabled = patch.aiSemanticSearchEnabled;
  }
  if ('aiModelTier' in patch) {
    next.aiModelTier = sanitizeAiModelTier(patch.aiModelTier);
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
  if ('onboardingTourCompleted' in patch && typeof patch.onboardingTourCompleted === 'boolean') {
    next.onboardingTourCompleted = patch.onboardingTourCompleted;
  }
  if ('onboardingTourStep' in patch) {
    next.onboardingTourStep = sanitizeOnboardingTourStep(patch.onboardingTourStep);
  }
  if ('videoAutoplay' in patch && typeof patch.videoAutoplay === 'boolean') {
    next.videoAutoplay = patch.videoAutoplay;
  }

  return next;
}

export async function readAppPreferences(): Promise<AppPreferencesV1> {
  if (cached) return cached;
  try {
    const raw = JSON.parse(await readFile(prefsPath(), 'utf8')) as Partial<AppPreferencesV1> & Record<string, unknown>;
    cached = sanitizeFromDisk(raw);
  } catch {
    cached = defaultAppPreferences();
  }
  return cached;
}

export function readAppPreferencesSync(): AppPreferencesV1 {
  if (cached) return cached;
  try {
    const raw = JSON.parse(fs.readFileSync(prefsPath(), 'utf8')) as Partial<AppPreferencesV1> & Record<string, unknown>;
    cached = sanitizeFromDisk(raw);
  } catch {
    cached = defaultAppPreferences();
  }
  return cached;
}

export function getCloseToTrayOnWindowClose(): boolean {
  return readAppPreferencesSync().closeToTrayOnWindowClose;
}

export function shouldStartHiddenInTray(prefs: AppPreferencesV1, needsOnboarding: boolean): boolean {
  return shouldStartHiddenInTrayFromLaunch(
    prefs.launchAtLogin,
    prefs.launchAtLoginHidden,
    needsOnboarding,
    process.argv,
    app.getLoginItemSettings()
  );
}

export async function writeAppPreferences(patch: Partial<AppPreferencesV1>): Promise<AppPreferencesV1> {
  const current = await readAppPreferences();
  const next = applyPatch(current, patch);
  cached = next;
  const filePath = prefsPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
  if (
    ('launchAtLogin' in patch && typeof patch.launchAtLogin === 'boolean') ||
    ('launchAtLoginHidden' in patch && typeof patch.launchAtLoginHidden === 'boolean')
  ) {
    applyLaunchAtLogin(next.launchAtLogin, next.launchAtLoginHidden);
  }
  if (
    'screenshotsEnabled' in patch ||
    'screenshotFormat' in patch ||
    'screenshotAskSaveLocation' in patch ||
    'screenshotRetina2x' in patch
  ) {
    registerScreenshotShortcut();
  }
  if ('autoImportEnabled' in patch || 'autoImportFolderPath' in patch) {
    const { restartAutoImportWatcher } = await import('./autoImportWatcher');
    restartAutoImportWatcher();
  }
  if (
    'importApiEnabled' in patch ||
    'importApiPrefixEnabled' in patch ||
    'importApiPrefixText' in patch
  ) {
    const { restartImportApiServer } = await import('./importApi/importApiHost');
    await restartImportApiServer();
  }
  if (
    ('mcpServerEnabled' in patch && typeof patch.mcpServerEnabled === 'boolean') ||
    ('mcpToolsEnabled' in patch && patch.mcpToolsEnabled && typeof patch.mcpToolsEnabled === 'object')
  ) {
    const { restartMcpServer } = await import('./mcp/mcpHost');
    await restartMcpServer();
  }
  return next;
}

export async function applyStoredLaunchAtLogin(): Promise<void> {
  const prefs = await readAppPreferences();
  applyLaunchAtLogin(prefs.launchAtLogin, prefs.launchAtLoginHidden);
}

export function registerAppPreferencesIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('arc:app-preferences-get', async () => readAppPreferences());

  ipcMain.handle('arc:app-preferences-set', async (_e, patch: unknown) => {
    if (!patch || typeof patch !== 'object') {
      return readAppPreferences();
    }
    return writeAppPreferences(patch as Partial<AppPreferencesV1>);
  });
}
