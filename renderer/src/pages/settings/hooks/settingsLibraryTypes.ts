export type BackupPart = 1 | 2 | 4 | 8;

export const BACKUP_PARTS: readonly BackupPart[] = [1, 2, 4, 8] as const;

export function runningInElectronShell(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}
