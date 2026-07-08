import type {
  GalleryAdvancedFilters,
  GalleryFilterPresetPayload,
  GalleryFilterStats,
  GallerySortState,
  SavedFilterPreset
} from './components/gallery/galleryFilterTypes';
import type { ArcMetadataV1, CardRecord, CollectionRecord, MoodboardBoardV1 } from './services/arcSchema';

export {};

export type ArcImportedMediaRow = {
  id: string;
  type: 'image' | 'video';
  originalRelativePath: string;
  thumbRelativePath: string;
  thumbSRelativePath?: string;
  thumbMRelativePath?: string;
  thumbLRelativePath?: string;
  dominantColorHex?: string;
  fileSize: number;
  fileSizeMb?: number;
  addedAt: string;
  dateModified?: string;
  width?: number;
  height?: number;
  format?: string;
};

export type ArcImportFileResult = { ok: true; row: ArcImportedMediaRow } | { ok: false; error: string };

export type ArcBackupProgress = {
  phase?: string;
  percent?: number;
  bytesPerSecond?: number;
  etaSeconds?: number;
  message?: string;
};

declare global {
  interface Window {
    arc?: {
      getLibraryPath: () => Promise<string | null>;
      setActiveMediaTab: (tab: 'gallery' | 'collections' | 'moodboard' | null) => void;
      getMediaServerOrigin: () => string | null;
      setLibraryPath: (absPath: string) => Promise<{ ok: boolean; error?: string }>;
      createLibraryFolder: () => Promise<
        | { ok: true; absPath: string; folderName: string; existingArcLibrary: boolean }
        | { ok: false; error: string }
      >;
      checkLibraryRelocateModal: () => Promise<
        { show: false } | { show: true; reason: 'path_missing' | 'empty_library' }
      >;
      validateLibraryFolder: (absPath: string) => Promise<{ ok: boolean; valid: boolean }>;
      relinkLibraryFolder: (absPath: string) => Promise<{ ok: boolean; error?: string }>;
      pickLibraryFolder: () => Promise<string | null>;
      getDefaultLibraryParent: () => Promise<string>;
      getDefaultLibraryFolderName: () => Promise<string>;
      setMainWindowOnboardingMode: (enabled: boolean) => Promise<{ ok: boolean }>;
      readMetadata: () => Promise<ArcMetadataV1 | null>;
      writeMetadata: (data: ArcMetadataV1) => Promise<void>;
      pickImageFiles: () => Promise<string[]>;
      pickMediaFiles: () => Promise<string[]>;
      getPathsForDroppedFiles: (files: FileList) => string[];
      getPathsForDroppedDataTransfer: (dt: DataTransfer) => string[];
      onFileDrop: (cb: (paths: string[]) => void) => () => void;
      importFiles: (absolutePaths: string[]) => Promise<ArcImportFileResult[]>;
      storageEnsureReady: () => Promise<{ ok: true } | { ok: false; error: string }>;
      storageListCards: (params: {
        offset: number;
        limit: number;
        libraryScope?: 'all' | 'untagged' | 'trash';
        selectedTagIds?: string[];
        cardIdExact?: string | null;
        collectionId?: string | null;
        moodboardCardIds?: string[] | null;
        advancedFilters?: GalleryAdvancedFilters;
        sort?: GallerySortState;
      }) => Promise<CardRecord[]>;
      storageGetCard: (cardId: string) => Promise<CardRecord | null>;
      storageGetCardDisplayPalette: (cardId: string) => Promise<Array<{ hex: string; pct: number }>>;
      storageUpdateCard: (
        cardId: string,
        patch: { tagIds?: string[]; collectionIds?: string[]; description?: string; name?: string; linkUrl?: string }
      ) => Promise<void>;
      storageInsertCardsMetadata: (
        cards: Array<{
          id: string;
          tagIds: string[];
          collectionIds: string[];
          description?: string;
          format?: string;
          width?: number;
          height?: number;
          fileSize?: number;
          fileSizeMb?: number;
          dateModified?: string;
        }>
      ) => Promise<void>;
      storageSoftDeleteCard: (cardId: string) => Promise<void>;
      storageRestoreCard: (cardId: string) => Promise<void>;
      storagePermanentDeleteCard: (cardId: string) => Promise<void>;
      storageEmptyTrash: () => Promise<number>;
      storageCountCards: (
        filterOrPayload: 'all' | 'images' | 'videos' | { filter: 'all' | 'images' | 'videos'; libraryScope?: 'all' | 'untagged' | 'trash' }
      ) => Promise<number>;
      storageCountCardsWithTagIds: (tagIds: string[]) => Promise<number>;
      storageGalleryFilterStats: (payload: {
        libraryScope?: 'all' | 'untagged' | 'trash';
        selectedTagIds?: string[];
        cardIdExact?: string | null;
        collectionId?: string | null;
        moodboardCardIds?: string[] | null;
      }) => Promise<GalleryFilterStats | null>;
      storageListFilterPresets: () => Promise<SavedFilterPreset[]>;
      storageUpsertFilterPreset: (payload: {
        id: string;
        name: string;
        payload: GalleryFilterPresetPayload;
      }) => Promise<void>;
      storageDeleteFilterPreset: (id: string) => Promise<void>;
      storageRenameFilterPreset: (payload: { id: string; name: string }) => Promise<void>;
      storageBackfillDuration: () => Promise<{ updated: number; failed: number }>;
      onImportFilesProgress: (cb: (p: { current: number; total: number; message?: string }) => void) => () => void;
      storageListCategories: () => Promise<CategoryRecord[]>;
      storageUpsertCategory: (cat: CategoryRecord) => Promise<void>;
      storageDeleteCategory: (id: string) => Promise<void>;
      storageListTagsByCategory: (categoryId: string) => Promise<TagRecord[]>;
      storageListAllTags: () => Promise<TagRecord[]>;
      storageUpsertTag: (tag: TagRecord) => Promise<void>;
      storageDeleteTag: (tagId: string) => Promise<void>;
      storageListCollections: () => Promise<CollectionRecord[]>;
      storageUpsertCollection: (col: CollectionRecord) => Promise<void>;
      storageDeleteCollection: (id: string) => Promise<void>;
      storageCollectionCounts: () => Promise<Record<string, number>>;
      storageCollectionPreviewSlices: (limit: number) => Promise<Record<string, CardRecord[]>>;
      storageCollectionsSidebar: (payload: {
        previewLimit?: number;
      }) => Promise<{
        collections: CollectionRecord[];
        counts: Record<string, number>;
        previews: Record<string, CardRecord[]>;
      }>;
      storageCollectionStats: (collectionId: string) => Promise<{
        cardCount: number;
        totalSizeMb: number;
        createdAt: string;
      } | null>;
      storageGetMoodboard: () => Promise<{
        version: 1;
        moodboardCardIds: string[];
        moodboardBoard?: MoodboardBoardV1;
      }>;
      storageSaveMoodboard: (data: {
        version: 1;
        moodboardCardIds: string[];
        moodboardBoard?: MoodboardBoardV1;
      }) => Promise<void>;
      storageGetSystem: () => Promise<{
        version: 1;
        schemaVersion: number;
        duplicateSimilarityThresholdPct: number;
      } | null>;
      storageSaveSystem: (data: {
        version: 1;
        schemaVersion: number;
        duplicateSimilarityThresholdPct: number;
      }) => Promise<void>;
      storageSkippedPairs: () => Promise<[string, string][]>;
      storageAddSkippedPair: (idA: string, idB: string) => Promise<void>;
      storageCardsPhash: () => Promise<
        Array<{ id: string; phash: { rotHashes: [string, string, string, string]; hist: number[] } }>
      >;
      onMigrationProgress: (cb: (p: { phase: string; current: number; total: number; message?: string }) => void) => () => void;
      toFileUrl: (path: string) => Promise<string | null>;
      toFileUrls: (paths: string[]) => Promise<Record<string, string>>;
      registerMediaStagingToken: (absPath: string) => Promise<string | null>;
      deleteFileIfInsideLibrary: (relativePath: string) => Promise<void>;
      showItemInFolder: (relativePath: string) => Promise<void>;
      openExternalUrl: (url: string) => Promise<{ ok: true } | { ok: false; error?: string }>;
      showAbsoluteInFolder: (absPath: string) => Promise<void>;
      saveMediaToFolder: (
        relativePath: string
      ) => Promise<{ ok: true; destinationPath: string } | { ok: false; canceled?: boolean; error?: string }>;

      dirIsEmpty: (absPath: string) => Promise<boolean>;
      migrateLibrary: (targetPath: string) => Promise<{ ok: true; oldLibraryPath: string } | { ok: false; error: string }>;
      trashPath: (absPath: string) => Promise<{ ok: true } | { ok: false; error?: string }>;
      readHistory: () => Promise<HistoryEntry[]>;
      appendHistoryLine: (message: string, segments?: HistorySegment[]) => Promise<void>;
      clearHistory: () => Promise<void>;
      pickBackupArchive: () => Promise<string | null>;
      backupStart: (opts: { destDir: string; partCount: 1 | 2 | 4 | 8 }) => Promise<{ ok: true } | { ok: false; error: string }>;
      backupCancel: () => Promise<{ ok: true }>;
      onBackupProgress: (cb: (p: ArcBackupProgress) => void) => () => void;
      restoreLibrary: (payload: {
        firstPartPath: string;
        destDir: string;
      }) => Promise<{ ok: true; restart: true } | { ok: false; error: string }>;
      consumePendingRestoreModal: () => Promise<{ message: string } | null>;
      verifyLibraryPaths: (relativePaths: string[]) => Promise<{ missing: string[] }>;
      scanLibraryOrphanFiles: (
        input: string[] | { paths: string[]; cardIds: string[] }
      ) => Promise<{ orphans: string[] }>;
      sumLibraryFilesBytes: (
        relativePaths: string[]
      ) => Promise<{ ok: true; totalBytes: number } | { ok: false; error: string }>;
      getLibraryDiskStats: () => Promise<
        | {
            ok: true;
            driveLabel: string;
            diskTotalBytes: number;
            diskFreeBytes: number;
            libraryFolderBytes: number;
          }
        | { ok: false; error: string }
      >;
      maintenanceBegin: () => Promise<{ ok: true }>;
      maintenanceEnd: () => Promise<{ ok: true }>;
      onMaintenance: (cb: (locked: boolean) => void) => () => void;

      getAppVersion: () => Promise<string>;
      getReleaseNotes: (version?: string) => Promise<{ buildDate: string; changes: string[] } | null>;
      listReleaseNotes: () => Promise<{
        versions: { version: string; buildDate: string; changes: string[] }[];
      }>;
      getLastSeenReleaseVersion: () => Promise<string | null>;
      setLastSeenReleaseVersion: (version: string) => Promise<{ ok: boolean }>;
      dismissUpdateVersion: (version: string) => Promise<{ ok: boolean }>;
      checkForUpdates: () => Promise<
        | { ok: true; updateInfo: unknown }
        | { ok: false; reason?: string }
      >;
      downloadUpdate: () => Promise<{ ok: boolean }>;
      quitAndInstall: () => Promise<{ ok: boolean }>;
      windowMinimizeToTray: () => Promise<{ ok: boolean }>;
      windowToggleMaximize: () => Promise<{ ok: boolean; maximized?: boolean }>;
      windowCloseToTray: () => Promise<{ ok: boolean }>;
      getAppPreferences: () => Promise<import('./services/appPreferences').AppPreferencesV1>;
      setAppPreferences: (patch: Partial<import('./services/appPreferences').AppPreferencesV1>) => Promise<import('./services/appPreferences').AppPreferencesV1>;
      onScreenshotSaved: (cb: (detail: { cardId: string }) => void) => () => void;
      onExtensionImportSaved?: (cb: (detail: { cardIds: string[]; collectionId?: string; quiet?: boolean }) => void) => () => void;
      onMcpTagCatalogChanged?: (cb: () => void) => () => void;
      openBugReportForm?: () => Promise<
        | { ok: true; formUrl: string }
        | { ok: false; error: string; code?: string }
      >;
      getBugReportFormUrl?: () => Promise<string | null>;
      screenshotPickerConfirm?: (region: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) => Promise<{ ok: boolean }>;
      screenshotPickerCancel?: () => Promise<{ ok: boolean }>;
      startDuplicateFileScan?: () => Promise<{ ok: true }>;
      onDuplicatesFound?: (cb: () => void) => () => void;
      checkImportDuplicates?: (
        absolutePaths: string[]
      ) => Promise<
        Array<{
          path: string;
          existingCardId: string;
          similarity: number;
          matchKind: 'exact' | 'similar';
          existingCard: import('./services/arcSchema').CardRecord | null;
        }>
      >;
      checkExactDuplicateFile?: (absolutePath: string) => Promise<boolean>;
      probeIncomingFile?: (absolutePath: string) => Promise<{
        format: string;
        width?: number;
        height?: number;
        fileSize?: number;
        fileCreatedAt?: string;
      } | null>;
      scanDuplicatePairs?: (payload?: {
        thresholdPct?: number;
        resetSession?: boolean;
      }) => Promise<{
        pairs: Array<{
          cardIdA: string;
          cardIdB: string;
          similarity: number;
          matchKind: 'exact' | 'similar';
        }>;
        thresholdPct: number;
      }>;
      runDuplicateScan?: (payload?: {
        thresholdPct?: number;
        resetSession?: boolean;
      }) => Promise<{
        pairs: Array<{
          cardIdA: string;
          cardIdB: string;
          similarity: number;
          matchKind: 'exact' | 'similar';
          cardA: import('./services/arcSchema').CardRecord | null;
          cardB: import('./services/arcSchema').CardRecord | null;
        }>;
        thresholdPct: number;
        scannedCards: number;
        totalCards: number;
        duplicatesFound: number;
        spaceSavedBytes: number;
        cancelled: boolean;
      }>;
      cancelDuplicateScan?: () => Promise<{ ok: true }>;
      onDuplicateScanProgress?: (
        cb: (p: {
          scannedCards: number;
          totalCards: number;
          duplicatesFound: number;
          etaMs: number | null;
        }) => void
      ) => () => void;
      duplicateSessionSkipPair?: (idA: string, idB: string) => Promise<void>;
      duplicateResetScanSession?: () => Promise<void>;
      duplicateGetCachedPairs?: () => Promise<
        Array<{
          cardIdA: string;
          cardIdB: string;
          similarity: number;
          matchKind: 'exact' | 'similar';
        }>
      >;
      replaceCardOriginal?: (cardId: string, sourceAbs: string) => Promise<void>;
      mergeDuplicateCards?: (primaryId: string, secondaryId: string) => Promise<void>;
      autoImportRescan?: () => Promise<{ ok: true }>;
      onAutoImportProgress?: (cb: (p: { current: number; total: number; message?: string }) => void) => () => void;
      onAutoImportBatchDone?: (
        cb: (p: { imported: number; total: number; sourcePaths: string[] }) => void
      ) => () => void;
      onAutoImportFinished?: (
        cb: (p: { imported: number; attempted: number; sourcePaths: string[] }) => void
      ) => () => void;
      onUpdateAvailable: (cb: (detail: { version: string; releaseDate: string | null }) => void) => () => void;
      onUpdateNotAvailable?: (cb: () => void) => () => void;
      onUpdateDownloadProgress?: (cb: (detail: { percent: number }) => void) => () => void;
      onUpdateDownloaded?: (cb: () => void) => () => void;
      onUpdateError?: (cb: (detail: { message: string }) => void) => () => void;

      aiGetStatus?: () => Promise<import('./services/aiTypes').AiStatus>;
      aiGetIndexStatus?: () => Promise<import('./services/aiTypes').AiIndexStatus>;
      aiDetectHardware?: () => Promise<import('./services/aiTypes').AiHardwareInfo>;
      aiDownloadModel?: (
        tier: 'light' | 'heavy'
      ) => Promise<{ ok: true; modelId: string; tier: string } | { ok: false; error: string }>;
      aiDownloadLlamaRuntime?: (payload: {
        variant: 'cpu' | 'cuda';
        tier: 'light' | 'heavy';
      }) => Promise<{ ok: true; variant: string } | { ok: false; error: string }>;
      aiCancelDownload?: () => Promise<{ ok: true }>;
      aiPauseDownload?: () => Promise<{ ok: true }>;
      aiResumeDownload?: () => Promise<{ ok: true }>;
      aiSearch?: (query: string) => Promise<Array<{ cardId: string; score: number }>>;
      aiSearchCards?: (params:
        | string
        | {
            query: string;
            collectionId?: string | null;
            moodboardCardIds?: string[] | null;
            scopeCardIds?: string[];
          }) => Promise<Array<import('./services/arcSchema').CardRecord & { aiScore?: number }>>;
      colorSearchCards?: (params: {
        hex: string;
        accuracy?: number;
        libraryScope?: 'all' | 'untagged' | 'trash';
        selectedTagIds?: string[];
        cardIdExact?: string | null;
        collectionId?: string | null;
        moodboardCardIds?: string[] | null;
        advancedFilters?: GalleryAdvancedFilters;
        sort?: GallerySortState;
        scopeCardIds?: string[];
      }) => Promise<import('./services/arcSchema').CardRecord[]>;
      aiSimilarStageFile?: (
        sourcePath: string
      ) => Promise<{ ok: true; stagedPath: string } | { ok: false; error: string }>;
      aiSimilarSearchCards?: (params: {
        cardId?: string | null;
        imagePath?: string | null;
        crop?: { x: number; y: number; w: number; h: number };
        libraryScope?: 'all' | 'untagged' | 'trash';
        selectedTagIds?: string[];
        cardIdExact?: string | null;
        collectionId?: string | null;
        moodboardCardIds?: string[] | null;
        advancedFilters?: GalleryAdvancedFilters;
        sort?: GallerySortState;
        scopeCardIds?: string[];
      }) => Promise<import('./services/arcSchema').CardRecord[]>;
      aiReindex?: () => Promise<{ ok: true }>;
      aiPauseIndex?: () => Promise<{ ok: true }>;
      aiResumeIndex?: () => Promise<{ ok: true }>;
      aiSetEnabled?: (payload: Record<string, unknown>) => Promise<import('./services/aiTypes').AiStatus>;
      aiDeleteModel?: (tier: 'light' | 'heavy') => Promise<import('./services/aiTypes').AiStatus>;
      aiUpdateModel?: (
        tier: 'light' | 'heavy'
      ) => Promise<{ ok: true; modelId: string; tier: string } | { ok: false; error: string }>;
      aiTestModel?: (
        tier: 'light' | 'heavy'
      ) => Promise<{ ok: boolean; message: string; vectorDim?: number }>;
      aiSetActiveModel?: (tier: 'light' | 'heavy') => Promise<import('./services/aiTypes').AiStatus>;
      onAiDownloadProgress?: (cb: (detail: {
        tier: string;
        percent: number;
        bytesReceived?: number;
        bytesTotal?: number;
        phase?: 'runtime' | 'model' | 'finalize';
      }) => void) => () => void;
      onAiDownloadComplete?: (cb: (detail: { tier: string }) => void) => () => void;
      onAiIndexProgress?: (cb: (detail: {
        done: number;
        total: number;
        running?: boolean;
        currentCardId?: string | null;
        currentCardProgress?: number | null;
      }) => void) => () => void;
      onAiIndexComplete?: (cb: (detail: { indexed: number; total: number }) => void) => () => void;
      onAiError?: (cb: (detail: { message: string; fallback?: boolean }) => void) => () => void;
      onAiIndexLog?: (
        cb: (detail: {
          level: 'log' | 'warn' | 'error';
          message: string;
          detail: Record<string, unknown> | null;
          at: number;
        }) => void
      ) => () => void;
      signalLoadingSplashReady?: () => Promise<{ ok: boolean }>;
      onLoadingProgress?: (
        cb: (payload: { percent: number; phaseText: string; version: string }) => void
      ) => () => void;
      onLoadingFadeOut?: (cb: () => void) => () => void;
      signalLoadingFadeComplete?: () => void;
      reportLoadingBootstrapProgress?: (percent: number, phaseText: string) => Promise<{ ok: boolean }>;
      reportLoadingBootstrapComplete?: () => Promise<{ ok: boolean }>;
    };
  }
}
