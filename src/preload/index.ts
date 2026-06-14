import { contextBridge, ipcRenderer } from 'electron';
import { pathsFromFileList, registerFileDropListener } from './fileDropBridge';

contextBridge.exposeInMainWorld('arc', {
  getLibraryPath: () => ipcRenderer.invoke('arc:get-library-path') as Promise<string | null>,
  setLibraryPath: (absPath: string) =>
    ipcRenderer.invoke('arc:set-library-path', absPath) as Promise<{ ok: boolean; error?: string }>,
  pickLibraryFolder: () => ipcRenderer.invoke('arc:pick-library-folder') as Promise<string | null>,
  readMetadata: () => ipcRenderer.invoke('arc:read-metadata'),
  writeMetadata: (data: unknown) => ipcRenderer.invoke('arc:write-metadata', data),
  pickImageFiles: () => ipcRenderer.invoke('arc:pick-image-files') as Promise<string[]>,
  pickMediaFiles: () => ipcRenderer.invoke('arc:pick-media-files') as Promise<string[]>,
  getPathsForDroppedFiles: (files: FileList) => pathsFromFileList(files),
  onFileDrop: (cb: (paths: string[]) => void) => registerFileDropListener(cb),
  importFiles: (absolutePaths: string[]) =>
    ipcRenderer.invoke('arc:import-files', absolutePaths) as Promise<
      Array<
        | {
            ok: true;
            row: {
              id: string;
              type: 'image' | 'video';
              originalRelativePath: string;
              thumbRelativePath: string;
              thumbSRelativePath?: string;
              thumbMRelativePath?: string;
              thumbLRelativePath?: string;
              dominantColorHex?: string;
              fileSize: number;
              addedAt: string;
              width?: number;
              height?: number;
            };
          }
        | { ok: false; error: string }
      >
    >,
  storageEnsureReady: () =>
    ipcRenderer.invoke('arc:storage-ensure-ready') as Promise<{ ok: true } | { ok: false; error: string }>,
  storageListCards: (params: unknown) => ipcRenderer.invoke('arc:storage-list-cards', params),
  storageGetCard: (cardId: string) => ipcRenderer.invoke('arc:storage-get-card', cardId),
  storageUpdateCard: (cardId: string, patch: unknown) =>
    ipcRenderer.invoke('arc:storage-update-card', { cardId, patch }),
  storageInsertCardsMetadata: (cards: unknown) =>
    ipcRenderer.invoke('arc:storage-insert-cards-metadata', cards),
  storageSoftDeleteCard: (cardId: string) => ipcRenderer.invoke('arc:storage-soft-delete-card', cardId),
  storageRestoreCard: (cardId: string) => ipcRenderer.invoke('arc:storage-restore-card', cardId),
  storagePermanentDeleteCard: (cardId: string) =>
    ipcRenderer.invoke('arc:storage-permanent-delete-card', cardId),
  storageEmptyTrash: () => ipcRenderer.invoke('arc:storage-empty-trash') as Promise<number>,
  storageDeleteCard: (cardId: string) => ipcRenderer.invoke('arc:storage-delete-card', cardId),
  storageCountCards: (payload: string | { filter: string; libraryScope?: string }) =>
    ipcRenderer.invoke('arc:storage-count-cards', payload),
  storageGalleryFilterStats: (payload: unknown) =>
    ipcRenderer.invoke('arc:storage-gallery-filter-stats', payload),
  storageListFilterPresets: () => ipcRenderer.invoke('arc:storage-list-filter-presets'),
  storageUpsertFilterPreset: (payload: unknown) =>
    ipcRenderer.invoke('arc:storage-upsert-filter-preset', payload),
  storageDeleteFilterPreset: (id: string) => ipcRenderer.invoke('arc:storage-delete-filter-preset', id),
  storageRenameFilterPreset: (payload: unknown) =>
    ipcRenderer.invoke('arc:storage-rename-filter-preset', payload),
  storageBackfillDuration: () =>
    ipcRenderer.invoke('arc:storage-backfill-duration') as Promise<{ updated: number; failed: number }>,
  onImportFilesProgress: (cb: (p: { current: number; total: number; message?: string }) => void) => {
    const fn = (_: unknown, payload: { current: number; total: number; message?: string }) => cb(payload);
    ipcRenderer.on('arc:import-files-progress', fn);
    return () => ipcRenderer.removeListener('arc:import-files-progress', fn);
  },
  storageListCategories: () => ipcRenderer.invoke('arc:storage-list-categories'),
  storageUpsertCategory: (cat: unknown) => ipcRenderer.invoke('arc:storage-upsert-category', cat),
  storageDeleteCategory: (id: string) => ipcRenderer.invoke('arc:storage-delete-category', id),
  storageListTagsByCategory: (categoryId: string) =>
    ipcRenderer.invoke('arc:storage-list-tags-by-category', categoryId),
  storageListAllTags: () => ipcRenderer.invoke('arc:storage-list-all-tags'),
  storageUpsertTag: (tag: unknown) => ipcRenderer.invoke('arc:storage-upsert-tag', tag),
  storageDeleteTag: (tagId: string) => ipcRenderer.invoke('arc:storage-delete-tag', tagId),
  storageListCollections: () => ipcRenderer.invoke('arc:storage-list-collections'),
  storageUpsertCollection: (col: unknown) => ipcRenderer.invoke('arc:storage-upsert-collection', col),
  storageDeleteCollection: (id: string) => ipcRenderer.invoke('arc:storage-delete-collection', id),
  storageCollectionCounts: () => ipcRenderer.invoke('arc:storage-collection-counts'),
  storageCollectionStats: (collectionId: string) =>
    ipcRenderer.invoke('arc:storage-collection-stats', collectionId),
  storageGetMoodboard: () => ipcRenderer.invoke('arc:storage-get-moodboard'),
  storageSaveMoodboard: (data: unknown) => ipcRenderer.invoke('arc:storage-save-moodboard', data),
  storageGetSystem: () => ipcRenderer.invoke('arc:storage-get-system'),
  storageSaveSystem: (data: unknown) => ipcRenderer.invoke('arc:storage-save-system', data),
  storageSkippedPairs: () => ipcRenderer.invoke('arc:storage-skipped-pairs'),
  storageAddSkippedPair: (idA: string, idB: string) =>
    ipcRenderer.invoke('arc:storage-add-skipped-pair', idA, idB),
  storageCardsPhash: () => ipcRenderer.invoke('arc:storage-cards-phash'),
  onMigrationProgress: (cb: (p: unknown) => void) => {
    const fn = (_: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on('arc:migration-progress', fn);
    return () => ipcRenderer.removeListener('arc:migration-progress', fn);
  },
  toFileUrl: (relativePath: string) =>
    ipcRenderer.invoke('arc:to-file-url', relativePath) as Promise<string | null>,
  deleteFileIfInsideLibrary: (relativePath: string) =>
    ipcRenderer.invoke('arc:delete-file-if-inside-library', relativePath),
  showItemInFolder: (relativePath: string) => ipcRenderer.invoke('arc:show-item-in-folder', relativePath),
  openExternalUrl: (url: string) =>
    ipcRenderer.invoke('arc:open-external-url', url) as Promise<{ ok: true } | { ok: false; error?: string }>,
  showAbsoluteInFolder: (absPath: string) => ipcRenderer.invoke('arc:show-absolute-in-folder', absPath),
  saveMediaToFolder: (relativePath: string) =>
    ipcRenderer.invoke('arc:save-media-to-folder', relativePath) as Promise<
      { ok: true; destinationPath: string } | { ok: false; canceled?: boolean; error?: string }
    >,

  dirIsEmpty: (absPath: string) => ipcRenderer.invoke('arc:dir-is-empty', absPath) as Promise<boolean>,
  migrateLibrary: (targetPath: string) =>
    ipcRenderer.invoke('arc:migrate-library', targetPath) as Promise<
      { ok: true; oldLibraryPath: string } | { ok: false; error: string }
    >,
  trashPath: (absPath: string) =>
    ipcRenderer.invoke('arc:trash-path', absPath) as Promise<{ ok: true } | { ok: false; error?: string }>,
  readHistory: () => ipcRenderer.invoke('arc:read-history') as Promise<Array<{ time: string; message: string }>>,
  appendHistoryLine: (message: string) => ipcRenderer.invoke('arc:append-history-line', message) as Promise<void>,
  pickBackupArchive: () => ipcRenderer.invoke('arc:pick-backup-archive') as Promise<string | null>,
  backupStart: (opts: { destDir: string; partCount: 1 | 2 | 4 | 8 }) =>
    ipcRenderer.invoke('arc:backup-start', opts) as Promise<{ ok: true } | { ok: false; error: string }>,
  backupCancel: () => ipcRenderer.invoke('arc:backup-cancel') as Promise<{ ok: true }>,
  onBackupProgress: (cb: (p: unknown) => void) => {
    const fn = (_: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on('arc:backup-progress', fn);
    return () => ipcRenderer.removeListener('arc:backup-progress', fn);
  },
  restoreLibrary: (payload: { firstPartPath: string; destDir: string }) =>
    ipcRenderer.invoke('arc:restore-library', payload) as Promise<
      { ok: true; restart: true } | { ok: false; error: string }
    >,
  consumePendingRestoreModal: () =>
    ipcRenderer.invoke('arc:consume-pending-restore-modal') as Promise<{ message: string } | null>,
  verifyLibraryPaths: (relativePaths: string[]) =>
    ipcRenderer.invoke('arc:verify-library-paths', relativePaths) as Promise<{ missing: string[] }>,
  scanLibraryOrphanFiles: (referencedPaths: string[]) =>
    ipcRenderer.invoke('arc:scan-library-orphan-files', referencedPaths) as Promise<{ orphans: string[] }>,
  sumLibraryFilesBytes: (relativePaths: string[]) =>
    ipcRenderer.invoke('arc:sum-library-files-bytes', relativePaths) as Promise<
      { ok: true; totalBytes: number } | { ok: false; error: string }
    >,
  maintenanceBegin: () => ipcRenderer.invoke('arc:maintenance-begin') as Promise<{ ok: true }>,
  maintenanceEnd: () => ipcRenderer.invoke('arc:maintenance-end') as Promise<{ ok: true }>,
  onMaintenance: (cb: (locked: boolean) => void) => {
    const fn = (_: unknown, payload: { locked?: boolean }) => {
      cb(Boolean(payload?.locked));
    };
    ipcRenderer.on('arc:maintenance', fn);
    return () => ipcRenderer.removeListener('arc:maintenance', fn);
  },

  getAppVersion: () => ipcRenderer.invoke('arc:get-app-version') as Promise<string>,
  getReleaseNotes: (version?: string) =>
    ipcRenderer.invoke('arc:get-release-notes', version) as Promise<{
      buildDate: string;
      changes: string[];
    } | null>,
  listReleaseNotes: () =>
    ipcRenderer.invoke('arc:list-release-notes') as Promise<{
      versions: { version: string; buildDate: string; changes: string[] }[];
    }>,
  getLastSeenReleaseVersion: () =>
    ipcRenderer.invoke('arc:get-last-seen-release-version') as Promise<string | null>,
  setLastSeenReleaseVersion: (version: string) =>
    ipcRenderer.invoke('arc:set-last-seen-release-version', version) as Promise<{ ok: boolean }>,
  dismissUpdateVersion: (version: string) =>
    ipcRenderer.invoke('arc:dismiss-update-version', version) as Promise<{ ok: boolean }>,
  checkForUpdates: () =>
    ipcRenderer.invoke('arc:check-for-updates') as Promise<
      | { ok: true; updateInfo: unknown }
      | { ok: false; reason?: string }
    >,
  downloadUpdate: () => ipcRenderer.invoke('arc:download-update') as Promise<{ ok: boolean }>,
  quitAndInstall: () => ipcRenderer.invoke('arc:quit-and-install') as Promise<{ ok: boolean }>,
  windowMinimizeToTray: () =>
    ipcRenderer.invoke('arc:window-minimize-to-tray') as Promise<{ ok: boolean }>,
  windowToggleMaximize: () =>
    ipcRenderer.invoke('arc:window-toggle-maximize') as Promise<{ ok: boolean; maximized?: boolean }>,
  windowCloseToTray: () => ipcRenderer.invoke('arc:window-close-to-tray') as Promise<{ ok: boolean }>,
  getAppPreferences: () =>
    ipcRenderer.invoke('arc:app-preferences-get') as Promise<{
      version: 1;
      launchAtLogin: boolean;
      closeToTrayOnWindowClose: boolean;
      importSourceFilesAction: 'ask' | 'trash';
      deleteCardsUseTrash: boolean;
      screenshotsEnabled: boolean;
      screenshotFormat: 'png' | 'jpg' | 'webp';
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
      autoImportSourceFilesAction: 'ask' | 'trash';
    }>,
  setAppPreferences: (patch: Record<string, unknown>) =>
    ipcRenderer.invoke('arc:app-preferences-set', patch) as Promise<{
      version: 1;
      launchAtLogin: boolean;
      closeToTrayOnWindowClose: boolean;
      importSourceFilesAction: 'ask' | 'trash';
      deleteCardsUseTrash: boolean;
      screenshotsEnabled: boolean;
      screenshotFormat: 'png' | 'jpg' | 'webp';
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
      autoImportSourceFilesAction: 'ask' | 'trash';
    }>,
  autoImportRescan: () => ipcRenderer.invoke('arc:auto-import-rescan') as Promise<{ ok: true }>,
  onAutoImportProgress: (cb: (p: { current: number; total: number; message?: string }) => void) => {
    const fn = (_: unknown, payload: { current: number; total: number; message?: string }) => cb(payload);
    ipcRenderer.on('arc:auto-import-progress', fn);
    return () => ipcRenderer.removeListener('arc:auto-import-progress', fn);
  },
  onAutoImportBatchDone: (
    cb: (p: { imported: number; total: number; sourcePaths: string[] }) => void
  ) => {
    const fn = (_: unknown, payload: { imported: number; total: number; sourcePaths: string[] }) => cb(payload);
    ipcRenderer.on('arc:auto-import-batch-done', fn);
    return () => ipcRenderer.removeListener('arc:auto-import-batch-done', fn);
  },
  onAutoImportFinished: (cb: (p: { imported: number; attempted: number; sourcePaths: string[] }) => void) => {
    const fn = (_: unknown, payload: { imported: number; attempted: number; sourcePaths: string[] }) => cb(payload);
    ipcRenderer.on('arc:auto-import-finished', fn);
    return () => ipcRenderer.removeListener('arc:auto-import-finished', fn);
  },
  onScreenshotSaved: (cb: (detail: { cardId: string }) => void) => {
    const fn = (_: unknown, payload: { cardId: string }) => cb(payload);
    ipcRenderer.on('arc:screenshot-saved', fn);
    return () => ipcRenderer.removeListener('arc:screenshot-saved', fn);
  },
  screenshotPickerConfirm: (region: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('arc:screenshot-picker-confirm', region) as Promise<{ ok: boolean }>,
  screenshotPickerCancel: () =>
    ipcRenderer.invoke('arc:screenshot-picker-cancel') as Promise<{ ok: boolean }>,
  startDuplicateFileScan: () =>
    ipcRenderer.invoke('arc:duplicate-scan-start') as Promise<{ ok: true }>,
  onDuplicatesFound: (cb: () => void) => {
    const fn = () => cb();
    ipcRenderer.on('arc:duplicates-found', fn);
    return () => ipcRenderer.removeListener('arc:duplicates-found', fn);
  },
  onUpdateAvailable: (cb: (detail: { version: string; releaseDate: string | null }) => void) => {
    const fn = (_: unknown, payload: { version: string; releaseDate: string | null }) => cb(payload);
    ipcRenderer.on('arc:update-available', fn);
    return () => ipcRenderer.removeListener('arc:update-available', fn);
  },
  onUpdateNotAvailable: (cb: () => void) => {
    const fn = () => cb();
    ipcRenderer.on('arc:update-not-available', fn);
    return () => ipcRenderer.removeListener('arc:update-not-available', fn);
  },
  onUpdateDownloadProgress: (cb: (detail: { percent: number }) => void) => {
    const fn = (_: unknown, payload: { percent: number }) => cb(payload);
    ipcRenderer.on('arc:update-download-progress', fn);
    return () => ipcRenderer.removeListener('arc:update-download-progress', fn);
  },
  onUpdateDownloaded: (cb: () => void) => {
    const fn = () => cb();
    ipcRenderer.on('arc:update-downloaded', fn);
    return () => ipcRenderer.removeListener('arc:update-downloaded', fn);
  },
  onUpdateError: (cb: (detail: { message: string }) => void) => {
    const fn = (_: unknown, payload: { message: string }) => cb(payload);
    ipcRenderer.on('arc:update-error', fn);
    return () => ipcRenderer.removeListener('arc:update-error', fn);
  }
});
