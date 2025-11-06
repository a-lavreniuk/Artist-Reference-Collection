/**
 * Типы для Electron API доступного в renderer процессе
 */

interface ElectronAPI {
  // === ФАЙЛОВАЯ СИСТЕМА ===
  selectWorkingDirectory: () => Promise<string | undefined>;
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
  
  // === РЕЗЕРВНОЕ КОПИРОВАНИЕ ===
  createBackup: (outputPath: string, workingDir: string, parts: number) => Promise<{
    success: boolean;
    size: number;
    filesCount: number;
  }>;
  restoreBackup: (archivePath: string, targetDir: string) => Promise<boolean>;
  
  // === СИСТЕМНЫЕ ФУНКЦИИ ===
  showNotification: (title: string, body: string) => Promise<void>;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<void>;
  
  // === СОБЫТИЯ ===
  onUpdateAvailable: (callback: () => void) => void;
  onUpdateReady: (callback: () => void) => void;
  installUpdate: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

