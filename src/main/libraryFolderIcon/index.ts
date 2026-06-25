import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { appIconPath } from '../appIcon';
import { readLibraryRootSync } from '../libraryRootConfig';
import { applyLibraryFolderIconWin32, notifyFolderIconChanged } from './win32';

function iconsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons');
  }
  return path.join(app.getAppPath(), 'build', 'icons');
}

function folderIconSourcePath(): string {
  if (process.platform === 'win32') {
    const ico = path.join(iconsDir(), 'icon.ico');
    if (fs.existsSync(ico)) return ico;
  }
  return appIconPath();
}

function brandingHashPath(): string {
  return path.join(app.getPath('userData'), 'library-folder-icon-hash.txt');
}

async function readStoredIconHash(): Promise<string | null> {
  try {
    return (await readFile(brandingHashPath(), 'utf8')).trim() || null;
  } catch {
    return null;
  }
}

async function writeStoredIconHash(hash: string): Promise<void> {
  await mkdir(path.dirname(brandingHashPath()), { recursive: true });
  await writeFile(brandingHashPath(), hash, 'utf8');
}

function hashIconFile(iconPath: string): string | null {
  try {
    const buf = fs.readFileSync(iconPath);
    return createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

/** Best-effort: кастомная иконка на корне библиотеки. Не бросает исключений. */
export async function applyLibraryFolderIcon(libraryRoot: string): Promise<boolean> {
  const source = folderIconSourcePath();
  if (process.platform === 'win32') {
    return applyLibraryFolderIconWin32(libraryRoot, source);
  }
  return false;
}

/** При смене брендинга переустанавливает иконку на текущей библиотеке. */
export async function refreshBrandingIconIfNeeded(): Promise<void> {
  const source = folderIconSourcePath();
  const hash = hashIconFile(source);
  if (!hash) return;
  const prev = await readStoredIconHash();
  if (prev === hash) return;

  const root = readLibraryRootSync();
  if (!root) {
    await writeStoredIconHash(hash);
    return;
  }
  try {
    if (!fs.existsSync(root)) {
      await writeStoredIconHash(hash);
      return;
    }
    await applyLibraryFolderIcon(root);
    await writeStoredIconHash(hash);
  } catch {
    /* best-effort */
  }
}

export { notifyFolderIconChanged };
