import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('arc', {
  getLibraryPath: () => ipcRenderer.invoke('arc:get-library-path') as Promise<string | null>,
  setLibraryPath: (absPath: string) =>
    ipcRenderer.invoke('arc:set-library-path', absPath) as Promise<{ ok: boolean; error?: string }>,
  pickLibraryFolder: () => ipcRenderer.invoke('arc:pick-library-folder') as Promise<string | null>,
  readMetadata: () => ipcRenderer.invoke('arc:read-metadata'),
  writeMetadata: (data: unknown) => ipcRenderer.invoke('arc:write-metadata', data),
  pickImageFiles: () => ipcRenderer.invoke('arc:pick-image-files') as Promise<string[]>,
  pickMediaFiles: () => ipcRenderer.invoke('arc:pick-media-files') as Promise<string[]>,
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
              fileSize: number;
              addedAt: string;
              width?: number;
              height?: number;
            };
          }
        | { ok: false; error: string }
      >
    >,
  toFileUrl: (relativePath: string) =>
    ipcRenderer.invoke('arc:to-file-url', relativePath) as Promise<string | null>,
  deleteFileIfInsideLibrary: (relativePath: string) =>
    ipcRenderer.invoke('arc:delete-file-if-inside-library', relativePath),
  showItemInFolder: (relativePath: string) => ipcRenderer.invoke('arc:show-item-in-folder', relativePath),
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
