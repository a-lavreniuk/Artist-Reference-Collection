/**
 * Типы для Electron API доступного в renderer процессе
 */

interface ElectronAPI {
  // === ФАЙЛОВАЯ СИСТЕМА ===
  selectWorkingDirectory: () => Promise<string | undefined>;
  selectBackupPath: (defaultFileName: string) => Promise<string | undefined>;
  scanDirectory: (dirPath: string) => Promise<string[]>;
  getFileInfo: (filePath: string) => Promise<{
    name: string;
    size: number;
    created: Date;
    modified: Date;
  }>;
  fileExists: (filePath: string) => Promise<boolean>;
  organizeFile: (sourcePath: string, workingDir: string) => Promise<string>;
  saveFileFromBuffer: (buffer: ArrayBuffer, fileName: string, workingDir: string) => Promise<string>;
  generateThumbnail: (filePath: string, workingDir: string) => Promise<string>;
  getFileURL: (filePath: string) => Promise<string>;
  
  // === СИСТЕМНЫЕ ОПЕРАЦИИ ===
  openFileLocation: (filePath: string) => Promise<boolean>;
  exportFile: (sourcePath: string, defaultFileName: string) => Promise<string | null>;
  copyToClipboard: (text: string) => Promise<boolean>;
  deleteFile: (filePath: string) => Promise<boolean>;
  getDirectorySize: (workingDir: string) => Promise<{
    totalSize: number;
    imagesSize: number;
    videosSize: number;
    cacheSize: number;
    imageCount: number;
    videoCount: number;
  }>;
  moveWorkingDirectory: (oldDir: string, newDir: string) => Promise<{
    success: boolean;
    copiedFiles: number;
  }>;
  onMoveDirectoryProgress: (callback: (data: { percent: number; copied: number; total: number }) => void) => void;
  exportMoodboard: (filePaths: string[], targetDir: string) => Promise<{
    success: boolean;
    copiedCount: number;
    failedCount: number;
    failedFiles: string[];
  }>;
  onExportProgress: (callback: (data: { percent: number; copied: number; total: number }) => void) => void;
  
  // === РЕЗЕРВНОЕ КОПИРОВАНИЕ ===
  createBackup: (outputPath: string, workingDir: string, parts: number, databaseJson: string) => Promise<{
    success: boolean;
    size: number;
    filesCount: number;
    duration?: number;
    manifest?: any;
  }>;
  onBackupProgress: (callback: (data: { percent: number; processed: number; total: number }) => void) => void;
  restoreBackup: (archivePath: string, targetDir: string) => Promise<{
    success: boolean;
    databaseJson: string | null;
  }>;
  selectArchivePath: () => Promise<string | undefined>;
  
  // === СИСТЕМНЫЕ ФУНКЦИИ ===
  showNotification: (title: string, body: string) => Promise<void>;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<void>;
  
  // === СОБЫТИЯ ===
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateReady: (callback: () => void) => void;
  onNavigate: (callback: (path: string) => void) => void;
  installUpdate: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

