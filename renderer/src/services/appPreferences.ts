import type { McpToolsEnabledMap } from '@arc-main-shared/mcpToolCatalog';
import { defaultMcpToolsEnabled, sanitizeMcpToolsEnabled } from '@arc-main-shared/mcpToolCatalog';

export type ImportSourceFilesAction = 'ask' | 'trash';
export type ScreenshotFormat = 'png' | 'jpg' | 'webp';
export type AiModelTier = 'light' | 'heavy';
export type GalleryCollectionsSortMode = 'chrono' | 'count' | 'random';
export type UiThemePreference = 'dark' | 'light' | 'system';

export const JOY_CAPTION_TYPE_IDS = [
  'descriptive_casual',
  'straightforward',
  'stable_diffusion',
  'midjourney',
  'art_critic',
  'product_listing',
  'social_media',
  'danbooru'
] as const;
export type JoyCaptionTypeId = (typeof JOY_CAPTION_TYPE_IDS)[number];

export const JOY_CAPTION_LENGTH_LEVELS = [0, 20, 40, 60, 80, 100] as const;
export type JoyCaptionLengthLevel = (typeof JOY_CAPTION_LENGTH_LEVELS)[number];

export const JOY_CAPTION_EXTRA_IDS = [
  'lighting',
  'camera_angle',
  'aesthetic_quality',
  'composition',
  'no_text',
  'depth_of_field',
  'lighting_sources',
  'sfw_rating',
  'only_important',
  'no_artist_title',
  'orientation',
  'vulgar_slang',
  'ages',
  'shot_type',
  'vantage_height'
] as const;
export type JoyCaptionExtraId = (typeof JOY_CAPTION_EXTRA_IDS)[number];

const JOY_CAPTION_TYPE_SET = new Set<string>(JOY_CAPTION_TYPE_IDS);
const JOY_CAPTION_EXTRA_SET = new Set<string>(JOY_CAPTION_EXTRA_IDS);

export function sanitizeJoyCaptionType(raw: unknown): JoyCaptionTypeId {
  if (typeof raw === 'string' && JOY_CAPTION_TYPE_SET.has(raw)) return raw as JoyCaptionTypeId;
  return 'descriptive_casual';
}

export function sanitizeJoyCaptionLengthLevel(raw: unknown): JoyCaptionLengthLevel {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 80;
  const stepped = Math.round(raw / 20) * 20;
  const clamped = Math.max(0, Math.min(100, stepped)) as JoyCaptionLengthLevel;
  return (JOY_CAPTION_LENGTH_LEVELS as readonly number[]).includes(clamped) ? clamped : 80;
}

export function sanitizeJoyCaptionExtraIds(raw: unknown): JoyCaptionExtraId[] {
  if (!Array.isArray(raw)) return [];
  const out: JoyCaptionExtraId[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string' || !JOY_CAPTION_EXTRA_SET.has(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item as JoyCaptionExtraId);
  }
  return out;
}

export type NotificationPrefKey =
  | 'notifyScreenshotSaved'
  | 'notifyDuplicatesFound'
  | 'notifyAutoImport'
  | 'notifyFilesAdded';

export type OnboardingSetupStep = 0 | 1 | 2;

export type OnboardingTourStep = number;

export type AutoImportLibrarySettings = {
  enabled?: boolean;
  folderPath?: string | null;
  sourceFilesAction?: ImportSourceFilesAction;
};

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
  autoImportByLibraryId: Record<string, AutoImportLibrarySettings>;
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
  aiAutoTagEnabled: boolean;
  aiAutoTagVolume: number;
  aiAutoTagCatalogMode: 'reuse' | 'reuse_create';
  aiAutoTagOnImport: boolean;
  aiVideoCaptionOnImport: boolean;
  aiCaptionType: JoyCaptionTypeId;
  aiCaptionLengthLevel: JoyCaptionLengthLevel;
  aiCaptionExtraIds: JoyCaptionExtraId[];
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
    autoImportByLibraryId: {},
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
    aiAutoTagEnabled: false,
    aiAutoTagVolume: 50,
    aiAutoTagCatalogMode: 'reuse',
    aiAutoTagOnImport: false,
    aiVideoCaptionOnImport: false,
    aiCaptionType: 'descriptive_casual',
    aiCaptionLengthLevel: 80,
    aiCaptionExtraIds: [],
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

function sanitizeAutoImportByLibraryId(
  raw: unknown
): Record<string, AutoImportLibrarySettings> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, AutoImportLibrarySettings> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!id.trim() || !value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    out[id] = {
      enabled: typeof row.enabled === 'boolean' ? row.enabled : false,
      folderPath:
        typeof row.folderPath === 'string' && row.folderPath.trim() ? row.folderPath.trim() : null,
      sourceFilesAction: sanitizeImportAction(row.sourceFilesAction)
    };
  }
  return out;
}

export function resolveAutoImportForLibraryId(
  prefs: AppPreferencesV1,
  libraryId: string | null | undefined
): Required<AutoImportLibrarySettings> {
  if (libraryId && prefs.autoImportByLibraryId[libraryId]) {
    const row = prefs.autoImportByLibraryId[libraryId]!;
    return {
      enabled: row.enabled === true,
      folderPath: row.folderPath ?? null,
      sourceFilesAction: sanitizeImportAction(row.sourceFilesAction)
    };
  }
  return {
    enabled: prefs.autoImportEnabled,
    folderPath: prefs.autoImportFolderPath,
    sourceFilesAction: prefs.autoImportSourceFilesAction
  };
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
    autoImportByLibraryId: sanitizeAutoImportByLibraryId(raw.autoImportByLibraryId),
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
    aiAutoTagEnabled:
      typeof raw.aiAutoTagEnabled === 'boolean' ? raw.aiAutoTagEnabled : d.aiAutoTagEnabled,
    aiAutoTagVolume:
      typeof raw.aiAutoTagVolume === 'number'
        ? Math.max(0, Math.min(100, Math.round(raw.aiAutoTagVolume / 5) * 5))
        : d.aiAutoTagVolume,
    aiAutoTagCatalogMode: raw.aiAutoTagCatalogMode === 'reuse_create' ? 'reuse_create' : 'reuse',
    aiAutoTagOnImport:
      typeof raw.aiAutoTagOnImport === 'boolean' ? raw.aiAutoTagOnImport : d.aiAutoTagOnImport,
    aiVideoCaptionOnImport:
      typeof raw.aiVideoCaptionOnImport === 'boolean'
        ? raw.aiVideoCaptionOnImport
        : d.aiVideoCaptionOnImport,
    aiCaptionType: sanitizeJoyCaptionType(raw.aiCaptionType ?? d.aiCaptionType),
    aiCaptionLengthLevel: sanitizeJoyCaptionLengthLevel(raw.aiCaptionLengthLevel ?? d.aiCaptionLengthLevel),
    aiCaptionExtraIds: sanitizeJoyCaptionExtraIds(raw.aiCaptionExtraIds ?? d.aiCaptionExtraIds),
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
