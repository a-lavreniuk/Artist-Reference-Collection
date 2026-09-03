import { defaultMcpToolsEnabled, sanitizeMcpToolsEnabled } from '@arc-main-shared/mcpToolCatalog';
import {
  defaultDetailCardTemplate,
  sanitizeDetailCardTemplate,
  type DetailCardTemplateV1
} from '@arc-main-shared/detailCardTemplate';

export type ImportSourceFilesAction = 'ask' | 'trash';
export type ScreenshotFormat = 'png' | 'jpg' | 'webp';
export type AiModelTier = 'light' | 'heavy';
export type GalleryCollectionsSortMode = 'chrono' | 'count' | 'random';
export type UiThemePreference = 'dark' | 'light' | 'system';
export type TrashRetentionDays = 7 | 30 | 90 | 0;

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
  /** Chrome-тур пройден, шаги деталки / статистики ещё впереди. */
  onboardingRestTourPending: boolean;
  /** Пользователь нажал «Позже» на предложении продолжить. */
  onboardingRestTourOfferDismissed: boolean;
  /** Пользователь уже начал отложенную часть тура. */
  onboardingRestTourStarted: boolean;
  launchAtLogin: boolean;
  launchAtLoginHidden: boolean;
  closeToTrayOnWindowClose: boolean;
  importSourceFilesAction: ImportSourceFilesAction;
  deleteCardsUseTrash: boolean;
  trashRetentionDays: TrashRetentionDays;
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
  localApiSecret: string;
  mcpApiSecret: string;
  mcpServerEnabled: boolean;
  mcpToolsEnabled: McpToolsEnabledMap;
  aiSemanticSearchEnabled: boolean;
  /** Master toggle for semantic search (synced with aiSemanticSearchEnabled). */
  aiSearchEnabled: boolean;
  aiSearchModelId: 'clip-vit-base-patch32' | 'qwen3-vl-embedding-2b' | 'qwen3-vl-embedding-8b';
  aiCaptionEnabled: boolean;
  aiCaptionOnDemandMigrated: boolean;
  /** @deprecated Prefer aiSearchModelId + aiCaptionEnabled */
  aiModelTier: AiModelTier;
  aiThreads: number;
  aiGpuLayers: number;
  aiMaxRamMb: number;
  aiResourcePreset: number;
  aiSearchStrictness: number;
  aiAutoTagEnabled: boolean;
  aiAutoTagModelInstalled: boolean;
  aiAutoTagProductV2: boolean;
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
  detailCardTemplate: DetailCardTemplateV1;
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
    onboardingRestTourPending: false,
    onboardingRestTourOfferDismissed: false,
    onboardingRestTourStarted: false,
    launchAtLogin: false,
    launchAtLoginHidden: false,
    closeToTrayOnWindowClose: true,
    importSourceFilesAction: 'ask',
    deleteCardsUseTrash: true,
    trashRetentionDays: 30,
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
    localApiSecret: '',
    mcpApiSecret: '',
    mcpServerEnabled: false,
    mcpToolsEnabled: defaultMcpToolsEnabled(),
    aiSemanticSearchEnabled: false,
    aiSearchEnabled: false,
    aiSearchModelId: 'clip-vit-base-patch32',
    aiCaptionEnabled: false,
    aiCaptionOnDemandMigrated: true,
    aiModelTier: 'light',
    aiThreads: 4,
    aiGpuLayers: 0,
    aiMaxRamMb: 4096,
    aiResourcePreset: 50,
    aiSearchStrictness: 50,
    aiAutoTagEnabled: false,
    aiAutoTagModelInstalled: false,
    aiAutoTagProductV2: true,
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
    videoAutoplay: true,
    detailCardTemplate: defaultDetailCardTemplate()
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
  if (!libraryId) {
    return {
      enabled: prefs.autoImportEnabled,
      folderPath: prefs.autoImportFolderPath,
      sourceFilesAction: prefs.autoImportSourceFilesAction
    };
  }
  return {
    enabled: false,
    folderPath: null,
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

export function sanitizeTrashRetentionDays(raw: unknown): TrashRetentionDays {
  if (raw === 7 || raw === 30 || raw === 90 || raw === 0) return raw;
  if (raw === '7' || raw === '30' || raw === '90' || raw === '0') {
    return Number(raw) as TrashRetentionDays;
  }
  return 30;
}

/** Дополняет ответ IPC дефолтами — важно для новых полей prefs после обновления. */
export function coerceAppPreferences(raw: Partial<AppPreferencesV1> | null | undefined): AppPreferencesV1 {
  const d = defaultAppPreferences();
  if (!raw) return d;

  const next: AppPreferencesV1 = {
    ...d,
    ...raw,
    version: 1,
    importSourceFilesAction: sanitizeImportAction(raw.importSourceFilesAction ?? d.importSourceFilesAction),
    trashRetentionDays: sanitizeTrashRetentionDays(raw.trashRetentionDays ?? d.trashRetentionDays),
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
    onboardingRestTourPending:
      typeof raw.onboardingRestTourPending === 'boolean'
        ? raw.onboardingRestTourPending
        : d.onboardingRestTourPending,
    onboardingRestTourOfferDismissed:
      typeof raw.onboardingRestTourOfferDismissed === 'boolean'
        ? raw.onboardingRestTourOfferDismissed
        : d.onboardingRestTourOfferDismissed,
    onboardingRestTourStarted:
      typeof raw.onboardingRestTourStarted === 'boolean'
        ? raw.onboardingRestTourStarted
        : d.onboardingRestTourStarted,
    importApiEnabled:
      typeof raw.importApiEnabled === 'boolean' ? raw.importApiEnabled : d.importApiEnabled,
    importApiPrefixEnabled:
      typeof raw.importApiPrefixEnabled === 'boolean' ? raw.importApiPrefixEnabled : d.importApiPrefixEnabled,
    importApiPrefixText:
      typeof raw.importApiPrefixText === 'string' ? raw.importApiPrefixText.trim().slice(0, 64) : d.importApiPrefixText,
    localApiSecret: typeof raw.localApiSecret === 'string' ? raw.localApiSecret : d.localApiSecret,
    mcpApiSecret: typeof raw.mcpApiSecret === 'string' ? raw.mcpApiSecret : d.mcpApiSecret,
    mcpServerEnabled:
      typeof raw.mcpServerEnabled === 'boolean' ? raw.mcpServerEnabled : d.mcpServerEnabled,
    mcpToolsEnabled: sanitizeMcpToolsEnabled(raw.mcpToolsEnabled ?? d.mcpToolsEnabled),
    aiSemanticSearchEnabled:
      typeof raw.aiSearchEnabled === 'boolean'
        ? raw.aiSearchEnabled
        : typeof raw.aiSemanticSearchEnabled === 'boolean'
          ? raw.aiSemanticSearchEnabled
          : d.aiSemanticSearchEnabled,
    aiSearchEnabled:
      typeof raw.aiSearchEnabled === 'boolean'
        ? raw.aiSearchEnabled
        : typeof raw.aiSemanticSearchEnabled === 'boolean'
          ? raw.aiSemanticSearchEnabled
          : d.aiSearchEnabled,
    aiSearchModelId:
      raw.aiSearchModelId === 'qwen3-vl-embedding-2b' || raw.aiSearchModelId === 'qwen3-vl-embedding-8b'
        ? raw.aiSearchModelId
        : 'clip-vit-base-patch32',
    aiCaptionEnabled:
      typeof raw.aiCaptionEnabled === 'boolean' ? raw.aiCaptionEnabled : d.aiCaptionEnabled,
    aiCaptionOnDemandMigrated:
      typeof raw.aiCaptionOnDemandMigrated === 'boolean'
        ? raw.aiCaptionOnDemandMigrated
        : d.aiCaptionOnDemandMigrated,
    aiAutoTagEnabled:
      typeof raw.aiAutoTagEnabled === 'boolean' ? raw.aiAutoTagEnabled : d.aiAutoTagEnabled,
    aiAutoTagModelInstalled:
      typeof raw.aiAutoTagModelInstalled === 'boolean'
        ? raw.aiAutoTagModelInstalled
        : d.aiAutoTagModelInstalled,
    aiAutoTagProductV2: raw.aiAutoTagProductV2 === true,
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
    videoAutoplay: typeof raw.videoAutoplay === 'boolean' ? raw.videoAutoplay : d.videoAutoplay,
    detailCardTemplate: sanitizeDetailCardTemplate(
      (raw as { detailCardTemplate?: unknown }).detailCardTemplate ?? d.detailCardTemplate
    )
  };

  if (!next.aiAutoTagProductV2) {
    next.aiAutoTagModelInstalled = false;
    next.aiAutoTagProductV2 = true;
  }

  return next;
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
