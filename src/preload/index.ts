import { contextBridge, ipcRenderer } from 'electron';
import { pathsFromDroppedDataTransfer, pathsFromFileList, registerFileDropListener } from './fileDropBridge';

type HistoryEntityType = 'card' | 'collection' | 'category' | 'tag';
type HistorySegmentPayload =
  | { kind: 'text'; text: string }
  | { kind: 'entity'; entityType: HistoryEntityType; id: string; label: string };

contextBridge.exposeInMainWorld('arc', {
  getLibraryPath: () => ipcRenderer.invoke('arc:get-library-path') as Promise<string | null>,
  setActiveMediaTab: (tab: 'gallery' | 'collections' | 'moodboard' | null) => {
    ipcRenderer.sendSync('arc:set-active-media-tab', tab);
  },
  getMediaServerOrigin: () =>
    ipcRenderer.sendSync('arc:get-media-server-origin') as string | null,
  setLibraryPath: (absPath: string) =>
    ipcRenderer.invoke('arc:set-library-path', absPath) as Promise<{ ok: boolean; error?: string }>,
  createLibraryFolder: () =>
    ipcRenderer.invoke('arc:create-library-folder') as Promise<
      | {
          ok: true;
          absPath: string;
          folderName: string;
          existingArcLibrary: boolean;
        }
      | { ok: false; error: string }
    >,
  checkLibraryRelocateModal: () =>
    ipcRenderer.invoke('arc:check-library-relocate-modal') as Promise<
      { show: false } | { show: true; reason: 'path_missing' | 'empty_library' }
    >,
  validateLibraryFolder: (absPath: string) =>
    ipcRenderer.invoke('arc:validate-library-folder', absPath) as Promise<{ ok: boolean; valid: boolean }>,
  relinkLibraryFolder: (absPath: string) =>
    ipcRenderer.invoke('arc:relink-library-folder', absPath) as Promise<{ ok: boolean; error?: string }>,
  pickLibraryFolder: () => ipcRenderer.invoke('arc:pick-library-folder') as Promise<string | null>,
  getDefaultLibraryParent: () =>
    ipcRenderer.invoke('arc:get-default-library-parent') as Promise<string>,
  getDefaultLibraryFolderName: () =>
    ipcRenderer.invoke('arc:get-default-library-folder-name') as Promise<string>,
  setMainWindowOnboardingMode: (enabled: boolean) =>
    ipcRenderer.invoke('arc:set-main-window-onboarding-mode', enabled) as Promise<{ ok: boolean }>,
  readMetadata: () => ipcRenderer.invoke('arc:read-metadata'),
  writeMetadata: (data: unknown) => ipcRenderer.invoke('arc:write-metadata', data),
  pickImageFiles: () => ipcRenderer.invoke('arc:pick-image-files') as Promise<string[]>,
  pickMediaFiles: () => ipcRenderer.invoke('arc:pick-media-files') as Promise<string[]>,
  classifyDroppedPaths: (absolutePaths: string[]) =>
    ipcRenderer.invoke('arc:classify-dropped-paths', absolutePaths) as Promise<{
      files: string[];
      directories: string[];
    }>,
  listImportableFilesInDirectory: (folderPath: string) =>
    ipcRenderer.invoke('arc:list-importable-files-in-directory', folderPath) as Promise<string[]>,
  getPathsForDroppedFiles: (files: FileList) => pathsFromFileList(files),
  getPathsForDroppedDataTransfer: (dt: DataTransfer) => pathsFromDroppedDataTransfer(dt),
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
  storageListCards: (params: unknown) => {
    ipcRenderer.sendSync('arc:navigation-begin');
    try {
      return ipcRenderer.sendSync('arc:storage-list-cards-sync', params);
    } finally {
      ipcRenderer.sendSync('arc:navigation-end');
    }
  },
  colorSearchCards: (params: unknown) => ipcRenderer.invoke('arc:color-search-cards', params),
  aiSimilarStageFile: (sourcePath: string) => ipcRenderer.invoke('arc:ai-similar-stage-file', sourcePath),
  aiSimilarSearchCards: (params: unknown) => ipcRenderer.invoke('arc:ai-similar-search-cards', params),
  storageGetCard: (cardId: string) => ipcRenderer.invoke('arc:storage-get-card', cardId),
  setVideoPreviewFrame: (cardId: string, frameMs: number) =>
    ipcRenderer.invoke('arc:set-video-preview-frame', { cardId, frameMs }),
  saveVideoFrameToCardFolder: (cardId: string, frameMs: number) =>
    ipcRenderer.invoke('arc:save-video-frame-to-card-folder', { cardId, frameMs }) as Promise<{
      relativePath: string;
    }>,
  copyVideoFrameToClipboard: (cardId: string, frameMs: number) =>
    ipcRenderer.invoke('arc:copy-video-frame-to-clipboard', { cardId, frameMs }) as Promise<{ ok: true }>,
  storageGetCardDisplayPalette: (cardId: string) =>
    ipcRenderer.invoke('arc:storage-get-card-display-palette', cardId) as Promise<
      Array<{ hex: string; pct: number }>
    >,
  storageUpdateCard: (cardId: string, patch: unknown) =>
    ipcRenderer.invoke('arc:storage-update-card', { cardId, patch }),
  storageInsertCardsMetadata: (cards: unknown) =>
    ipcRenderer.invoke('arc:storage-insert-cards-metadata', cards),
  storageSoftDeleteCard: (cardId: string) => ipcRenderer.invoke('arc:storage-soft-delete-card', cardId),
  storageRestoreCard: (cardId: string) => ipcRenderer.invoke('arc:storage-restore-card', cardId),
  storagePermanentDeleteCard: (cardId: string) =>
    ipcRenderer.invoke('arc:storage-permanent-delete-card', cardId),
  storageEmptyTrash: () => ipcRenderer.invoke('arc:storage-empty-trash') as Promise<number>,
  storageCountCards: (payload: string | { filter: string; libraryScope?: string }) =>
    ipcRenderer.invoke('arc:storage-count-cards', payload),
  storageCountCardsWithTagIds: (tagIds: string[]) =>
    ipcRenderer.invoke('arc:storage-count-cards-with-tag-ids', tagIds) as Promise<number>,
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
  storageCollectionPreviewSlices: (limit: number) =>
    ipcRenderer.invoke('arc:storage-collection-preview-slices', limit),
  storageCollectionsSidebar: (payload: { previewLimit?: number }) =>
    ipcRenderer.invoke('arc:storage-collections-sidebar', payload),
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
  checkImportDuplicates: (absolutePaths: string[]) =>
    ipcRenderer.invoke('arc:check-import-duplicates', absolutePaths),
  checkExactDuplicateFile: (absolutePath: string) =>
    ipcRenderer.invoke('arc:check-exact-duplicate-file', absolutePath) as Promise<boolean>,
  probeIncomingFile: (absolutePath: string) => ipcRenderer.invoke('arc:probe-incoming-file', absolutePath),
  scanDuplicatePairs: (payload?: { thresholdPct?: number; resetSession?: boolean }) =>
    ipcRenderer.invoke('arc:scan-duplicate-pairs', payload ?? {}),
  runDuplicateScan: (payload?: { thresholdPct?: number; resetSession?: boolean }) =>
    ipcRenderer.invoke('arc:duplicate-scan-run', payload ?? {}),
  cancelDuplicateScan: () => ipcRenderer.invoke('arc:duplicate-scan-cancel'),
  onDuplicateScanProgress: (
    cb: (p: { scannedCards: number; totalCards: number; duplicatesFound: number; etaMs: number | null }) => void
  ) => {
    const fn = (_: unknown, payload: unknown) => cb(payload as never);
    ipcRenderer.on('arc:duplicate-scan-progress', fn);
    return () => ipcRenderer.removeListener('arc:duplicate-scan-progress', fn);
  },
  duplicateSessionSkipPair: (idA: string, idB: string) =>
    ipcRenderer.invoke('arc:duplicate-session-skip-pair', idA, idB),
  duplicateResetScanSession: () => ipcRenderer.invoke('arc:duplicate-reset-scan-session'),
  duplicateGetCachedPairs: () => ipcRenderer.invoke('arc:duplicate-get-cached-pairs'),
  replaceCardOriginal: (cardId: string, sourceAbs: string) =>
    ipcRenderer.invoke('arc:replace-card-original', { cardId, sourceAbs }),
  mergeDuplicateCards: (primaryId: string, secondaryId: string) =>
    ipcRenderer.invoke('arc:merge-duplicate-cards', { primaryId, secondaryId }),
  onMigrationProgress: (cb: (p: unknown) => void) => {
    const fn = (_: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on('arc:migration-progress', fn);
    return () => ipcRenderer.removeListener('arc:migration-progress', fn);
  },
  toFileUrl: (relativePath: string) =>
    ipcRenderer.invoke('arc:to-file-url', relativePath) as Promise<string | null>,
  toFileUrls: (relativePaths: string[]) =>
    ipcRenderer.invoke('arc:to-file-urls', relativePaths) as Promise<Record<string, string>>,
  registerMediaStagingToken: (absPath: string) =>
    ipcRenderer.invoke('arc:register-media-staging-token', absPath) as Promise<string | null>,
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
  readHistory: () =>
    ipcRenderer.invoke('arc:read-history') as Promise<
      Array<{ time: string; message: string; segments?: HistorySegmentPayload[] }>
    >,
  appendHistoryLine: (message: string, segments?: HistorySegmentPayload[]) =>
    ipcRenderer.invoke('arc:append-history-line', message, segments) as Promise<void>,
  clearHistory: () => ipcRenderer.invoke('arc:clear-history') as Promise<void>,
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
  scanLibraryOrphanFiles: (input: string[] | { paths: string[]; cardIds: string[] }) =>
    ipcRenderer.invoke('arc:scan-library-orphan-files', input) as Promise<{ orphans: string[] }>,
  sumLibraryFilesBytes: (relativePaths: string[]) =>
    ipcRenderer.invoke('arc:sum-library-files-bytes', relativePaths) as Promise<
      { ok: true; totalBytes: number } | { ok: false; error: string }
    >,
  getLibraryDiskStats: () =>
    ipcRenderer.invoke('arc:get-library-disk-stats') as Promise<
      | {
          ok: true;
          driveLabel: string;
          diskTotalBytes: number;
          diskFreeBytes: number;
          libraryFolderBytes: number;
        }
      | { ok: false; error: string }
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
  onRendererShortcut: (cb: (id: string) => void) => {
    const fn = (_: unknown, id: string) => {
      cb(id);
    };
    ipcRenderer.on('arc:renderer-shortcut', fn);
    return () => ipcRenderer.removeListener('arc:renderer-shortcut', fn);
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
      launchAtLoginHidden: boolean;
      closeToTrayOnWindowClose: boolean;
      importSourceFilesAction: 'ask' | 'trash';
      deleteCardsUseTrash: boolean;
      screenshotsEnabled: boolean;
      screenshotFormat: 'png' | 'jpg' | 'webp';
      screenshotAskSaveLocation: boolean;
      screenshotRetina2x: boolean;
      notifyScreenshotSaved: boolean;
      notifyDuplicatesFound: boolean;
      notifyAutoImport: boolean;
      notifyFilesAdded: boolean;
      notifySoundEnabled: boolean;
      autoImportEnabled: boolean;
      autoImportFolderPath: string | null;
      autoImportSourceFilesAction: 'ask' | 'trash';
      aiSemanticSearchEnabled: boolean;
      aiModelTier: 'light' | 'heavy';
      aiThreads: number;
      aiGpuLayers: number;
      aiMaxRamMb: number;
    }>,
  setAppPreferences: (patch: Record<string, unknown>) =>
    ipcRenderer.invoke('arc:app-preferences-set', patch) as Promise<{
      version: 1;
      launchAtLogin: boolean;
      launchAtLoginHidden: boolean;
      closeToTrayOnWindowClose: boolean;
      importSourceFilesAction: 'ask' | 'trash';
      deleteCardsUseTrash: boolean;
      screenshotsEnabled: boolean;
      screenshotFormat: 'png' | 'jpg' | 'webp';
      screenshotAskSaveLocation: boolean;
      screenshotRetina2x: boolean;
      notifyScreenshotSaved: boolean;
      notifyDuplicatesFound: boolean;
      notifyAutoImport: boolean;
      notifyFilesAdded: boolean;
      notifySoundEnabled: boolean;
      autoImportEnabled: boolean;
      autoImportFolderPath: string | null;
      autoImportSourceFilesAction: 'ask' | 'trash';
      aiSemanticSearchEnabled: boolean;
      aiModelTier: 'light' | 'heavy';
      aiThreads: number;
      aiGpuLayers: number;
      aiMaxRamMb: number;
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
  onExtensionImportSaved: (cb: (detail: { cardIds: string[]; collectionId?: string; quiet?: boolean }) => void) => {
    const fn = (_: unknown, payload: { cardIds: string[]; collectionId?: string; quiet?: boolean }) => cb(payload);
    ipcRenderer.on('arc:extension-import-saved', fn);
    return () => ipcRenderer.removeListener('arc:extension-import-saved', fn);
  },
  onMcpTagCatalogChanged: (cb: () => void) => {
    const fn = () => cb();
    ipcRenderer.on('arc:mcp-tag-catalog-changed', fn);
    return () => ipcRenderer.removeListener('arc:mcp-tag-catalog-changed', fn);
  },
  openBugReportForm: () =>
    ipcRenderer.invoke('arc:bug-report-open') as Promise<
      | { ok: true; formUrl: string }
      | { ok: false; error: string; code?: string }
    >,
  getBugReportFormUrl: () =>
    ipcRenderer.invoke('arc:bug-report-get-url') as Promise<string | null>,
  screenshotPickerConfirm: (region: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('arc:screenshot-picker-confirm', region) as Promise<{ ok: boolean }>,
  screenshotPickerCancel: () =>
    ipcRenderer.invoke('arc:screenshot-picker-cancel') as Promise<{ ok: boolean }>,
  screenshotWindowPickerAtPoint: (point: { x: number; y: number }) =>
    ipcRenderer.invoke('arc:screenshot-window-picker-at-point', point) as Promise<{
      ok: boolean;
      window: { title: string; nativeId?: number; x: number; y: number; width: number; height: number } | null;
    }>,
  screenshotWindowPickerConfirm: (payload: { title: string; nativeId?: number }) =>
    ipcRenderer.invoke('arc:screenshot-window-picker-confirm', payload) as Promise<{ ok: boolean }>,
  screenshotWindowPickerCancel: () =>
    ipcRenderer.invoke('arc:screenshot-window-picker-cancel') as Promise<{ ok: boolean }>,
  openCardViewer: (payload: {
    cardIds: string[];
    startIndex?: number;
    context?: { kind: 'library' | 'moodboard' | 'collection'; name?: string };
  }) =>
    ipcRenderer.invoke('arc:card-viewer-open', payload) as Promise<{ ok: boolean }>,
  cardViewerSetAlwaysOnTop: (enabled: boolean) =>
    ipcRenderer.invoke('arc:card-viewer-set-always-on-top', enabled) as Promise<{ ok: boolean }>,
  cardViewerSetOpacity: (value: number) =>
    ipcRenderer.invoke('arc:card-viewer-set-opacity', value) as Promise<{ ok: boolean }>,
  cardViewerClose: () => ipcRenderer.invoke('arc:card-viewer-close') as Promise<{ ok: boolean }>,
  cardViewerResolvePath: (relativePath: string) =>
    ipcRenderer.invoke('arc:card-viewer-resolve-path', relativePath) as Promise<string | null>,
  cardViewerStartFileDrag: (payload: string | { relativePath?: string; cardId?: string }) =>
    ipcRenderer.invoke('arc:card-viewer-start-file-drag', payload) as Promise<{ ok: boolean }>,
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
  },

  aiGetStatus: () => ipcRenderer.invoke('arc:ai-get-status'),
  aiGetIndexStatus: () => ipcRenderer.invoke('arc:ai-get-index-status'),
  aiDetectHardware: () => ipcRenderer.invoke('arc:ai-detect-hardware'),
  aiDownloadModel: (tier: 'light' | 'heavy') =>
    ipcRenderer.invoke('arc:ai-download-model', tier) as Promise<
      { ok: true; modelId: string; tier: string } | { ok: false; error: string }
    >,
  aiDownloadLlamaRuntime: (payload: { variant: 'cpu' | 'cuda'; tier: 'light' | 'heavy' }) =>
    ipcRenderer.invoke('arc:ai-download-llama-runtime', payload) as Promise<
      { ok: true; variant: string } | { ok: false; error: string }
    >,
  aiCancelDownload: () => ipcRenderer.invoke('arc:ai-cancel-download') as Promise<{ ok: true }>,
  aiPauseDownload: () => ipcRenderer.invoke('arc:ai-pause-download') as Promise<{ ok: true }>,
  aiResumeDownload: () => ipcRenderer.invoke('arc:ai-resume-download') as Promise<{ ok: true }>,
  aiSearch: (query: string) => ipcRenderer.invoke('arc:ai-search', query) as Promise<Array<{ cardId: string; score: number }>>,
  aiSearchCards: (params:
    | string
    | {
        query: string;
        collectionId?: string | null;
        moodboardCardIds?: string[] | null;
        scopeCardIds?: string[];
      }) =>
    ipcRenderer.invoke('arc:ai-search-cards', params) as Promise<
      Array<Record<string, unknown> & { id: string; aiScore?: number }>
    >,
  aiDeleteModel: (tier: 'light' | 'heavy') => ipcRenderer.invoke('arc:ai-delete-model', tier),
  aiUpdateModel: (tier: 'light' | 'heavy') =>
    ipcRenderer.invoke('arc:ai-update-model', tier) as Promise<
      { ok: true; modelId: string; tier: string } | { ok: false; error: string }
    >,
  aiTestModel: (tier: 'light' | 'heavy') =>
    ipcRenderer.invoke('arc:ai-test-model', tier) as Promise<{ ok: boolean; message: string; vectorDim?: number }>,
  aiSetActiveModel: (tier: 'light' | 'heavy') => ipcRenderer.invoke('arc:ai-set-active-model', tier),
  aiReindex: () => ipcRenderer.invoke('arc:ai-reindex') as Promise<{ ok: true }>,
  aiPauseIndex: () => ipcRenderer.invoke('arc:ai-pause-index') as Promise<{ ok: true }>,
  aiResumeIndex: () => ipcRenderer.invoke('arc:ai-resume-index') as Promise<{ ok: true }>,
  aiSetEnabled: (payload: Record<string, unknown>) => ipcRenderer.invoke('arc:ai-set-enabled', payload),
  onAiDownloadProgress: (cb: (detail: {
    tier: string;
    percent: number;
    bytesReceived?: number;
    bytesTotal?: number;
    phase?: 'runtime' | 'model' | 'finalize';
  }) => void) => {
    const fn = (
      _: unknown,
      payload: {
        tier: string;
        percent: number;
        bytesReceived?: number;
        bytesTotal?: number;
        phase?: 'runtime' | 'model' | 'finalize';
      }
    ) => cb(payload);
    ipcRenderer.on('arc:ai-download-progress', fn);
    return () => ipcRenderer.removeListener('arc:ai-download-progress', fn);
  },
  onAiDownloadComplete: (cb: (detail: { tier: string }) => void) => {
    const fn = (_: unknown, payload: { tier: string }) => cb(payload);
    ipcRenderer.on('arc:ai-download-complete', fn);
    return () => ipcRenderer.removeListener('arc:ai-download-complete', fn);
  },
  onAiIndexProgress: (cb: (detail: {
    done: number;
    total: number;
    running?: boolean;
    currentCardId?: string | null;
    currentCardProgress?: number | null;
  }) => void) => {
    const fn = (_: unknown, payload: {
      done: number;
      total: number;
      running?: boolean;
      currentCardId?: string | null;
      currentCardProgress?: number | null;
    }) => cb(payload);
    ipcRenderer.on('arc:ai-index-progress', fn);
    return () => ipcRenderer.removeListener('arc:ai-index-progress', fn);
  },
  onAiIndexComplete: (cb: (detail: { indexed: number; total: number }) => void) => {
    const fn = (_: unknown, payload: { indexed: number; total: number }) => cb(payload);
    ipcRenderer.on('arc:ai-index-complete', fn);
    return () => ipcRenderer.removeListener('arc:ai-index-complete', fn);
  },
  onAiError: (cb: (detail: { message: string; fallback?: boolean }) => void) => {
    const fn = (_: unknown, payload: { message: string; fallback?: boolean }) => cb(payload);
    ipcRenderer.on('arc:ai-error', fn);
    return () => ipcRenderer.removeListener('arc:ai-error', fn);
  },
  onAiIndexLog: (
    cb: (detail: {
      level: 'log' | 'warn' | 'error';
      message: string;
      detail: Record<string, unknown> | null;
      at: number;
    }) => void
  ) => {
    const fn = (
      _: unknown,
      payload: {
        level: 'log' | 'warn' | 'error';
        message: string;
        detail: Record<string, unknown> | null;
        at: number;
      }
    ) => cb(payload);
    ipcRenderer.on('arc:ai-index-log', fn);
    return () => ipcRenderer.removeListener('arc:ai-index-log', fn);
  },

  signalLoadingSplashReady: () => ipcRenderer.invoke('loading:splash-ready') as Promise<{ ok: boolean }>,
  onLoadingProgress: (
    cb: (payload: { percent: number; phaseText: string; version: string }) => void
  ) => {
    const fn = (_: unknown, payload: { percent: number; phaseText: string; version: string }) => cb(payload);
    ipcRenderer.on('loading:progress-update', fn);
    return () => ipcRenderer.removeListener('loading:progress-update', fn);
  },
  onLoadingFadeOut: (cb: () => void) => {
    const fn = () => cb();
    ipcRenderer.on('loading:splash-fade-out', fn);
    return () => ipcRenderer.removeListener('loading:splash-fade-out', fn);
  },
  signalLoadingFadeComplete: () => {
    ipcRenderer.send('loading:splash-fade-complete');
  },
  reportLoadingBootstrapProgress: (percent: number, phaseText: string) =>
    ipcRenderer.invoke('loading:bootstrap-progress', { percent, phaseText }) as Promise<{ ok: boolean }>,
  reportLoadingBootstrapComplete: () =>
    ipcRenderer.invoke('loading:bootstrap-complete') as Promise<{ ok: boolean }>
});
