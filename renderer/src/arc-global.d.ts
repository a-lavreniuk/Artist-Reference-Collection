import type { ArcMetadataV1 } from './services/arcSchema';

export {};

export type ArcImportedMediaRow = {
  id: string;
  type: 'image' | 'video';
  originalRelativePath: string;
  thumbRelativePath: string;
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
      importFiles: (absolutePaths: string[]) => Promise<ArcImportFileResult[]>;
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
      /** Файлы в `media/` и в корне библиотеки, не перечисленные в ссылках из метаданных. */
      scanLibraryOrphanFiles: (referencedPaths: string[]) => Promise<{ orphans: string[] }>;
      /** Сумма размеров файлов по относительным путям внутри текущей библиотеки (дедуп путей). */
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
      onUpdateAvailable: (cb: (detail: { version: string; releaseDate: string | null }) => void) => () => void;
      onUpdateNotAvailable?: (cb: () => void) => () => void;
      onUpdateDownloadProgress?: (cb: (detail: { percent: number }) => void) => () => void;
      onUpdateDownloaded?: (cb: () => void) => () => void;
      onUpdateError?: (cb: (detail: { message: string }) => void) => () => void;
    };
  }
}
