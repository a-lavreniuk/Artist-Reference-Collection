import type { ArcMetadataV1, CardRecord, CollectionRecord, MoodboardBoardV1 } from './services/arcSchema';
import type { CategoryRecord, TagRecord } from './services/db';

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
      setLibraryPath: (absPath: string) => Promise<{ ok: boolean; error?: string }>;
      pickLibraryFolder: () => Promise<string | null>;
      readMetadata: () => Promise<ArcMetadataV1 | null>;
      writeMetadata: (data: ArcMetadataV1) => Promise<void>;
      pickImageFiles: () => Promise<string[]>;
      pickMediaFiles: () => Promise<string[]>;
      getPathsForDroppedFiles: (files: FileList) => string[];
      onFileDrop: (cb: (paths: string[]) => void) => () => void;
      importFiles: (absolutePaths: string[]) => Promise<ArcImportFileResult[]>;
      storageEnsureReady: () => Promise<{ ok: true } | { ok: false; error: string }>;
      storageListCards: (params: {
        offset: number;
        limit: number;
        filter: 'all' | 'images' | 'videos';
        libraryScope?: 'all' | 'untagged' | 'trash';
        selectedTagIds?: string[];
        cardIdExact?: string | null;
        collectionId?: string | null;
      }) => Promise<CardRecord[]>;
      storageGetCard: (cardId: string) => Promise<CardRecord | null>;
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
      storageDeleteCard: (cardId: string) => Promise<void>;
      storageCountCards: (
        filterOrPayload: 'all' | 'images' | 'videos' | { filter: 'all' | 'images' | 'videos'; libraryScope?: 'all' | 'untagged' | 'trash' }
      ) => Promise<number>;
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
      deleteFileIfInsideLibrary: (relativePath: string) => Promise<void>;
      showItemInFolder: (relativePath: string) => Promise<void>;
      showAbsoluteInFolder: (absPath: string) => Promise<void>;
      saveMediaToFolder: (
        relativePath: string
      ) => Promise<{ ok: true; destinationPath: string } | { ok: false; canceled?: boolean; error?: string }>;

      dirIsEmpty: (absPath: string) => Promise<boolean>;
      migrateLibrary: (targetPath: string) => Promise<{ ok: true; oldLibraryPath: string } | { ok: false; error: string }>;
      trashPath: (absPath: string) => Promise<{ ok: true } | { ok: false; error?: string }>;
      readHistory: () => Promise<Array<{ time: string; message: string }>>;
      appendHistoryLine: (message: string) => Promise<void>;
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
      scanLibraryOrphanFiles: (referencedPaths: string[]) => Promise<{ orphans: string[] }>;
      sumLibraryFilesBytes: (
        relativePaths: string[]
      ) => Promise<{ ok: true; totalBytes: number } | { ok: false; error: string }>;
      maintenanceBegin: () => Promise<{ ok: true }>;
      maintenanceEnd: () => Promise<{ ok: true }>;
      onMaintenance: (cb: (locked: boolean) => void) => () => void;

      getAppVersion: () => Promise<string>;
      getReleaseNotes: (version?: string) => Promise<{ buildDate: string; changes: string[] } | null>;
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
      onUpdateAvailable: (cb: (detail: { version: string; releaseDate: string | null }) => void) => () => void;
      onUpdateNotAvailable?: (cb: () => void) => () => void;
      onUpdateDownloadProgress?: (cb: (detail: { percent: number }) => void) => () => void;
      onUpdateDownloaded?: (cb: () => void) => () => void;
      onUpdateError?: (cb: (detail: { message: string }) => void) => () => void;
    };
  }
}
