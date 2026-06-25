import { copyFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { libraryMetaDirAbs } from '../libraryFilenames';

const execFileAsync = promisify(execFile);

const FOLDER_ICON_NAME = 'arc-folder.ico';
const DESKTOP_INI = 'desktop.ini';

function desktopIniContent(iconRelPath: string): string {
  const normalized = iconRelPath.replace(/\//g, '\\');
  return `[.ShellClassInfo]\r\nIconResource=${normalized},0\r\n`;
}

async function setWindowsAttributes(fileAbs: string, flags: string): Promise<void> {
  try {
    await execFileAsync('attrib', [flags, fileAbs], { windowsHide: true });
  } catch {
    /* best-effort */
  }
}

export async function notifyFolderIconChanged(): Promise<void> {
  if (process.platform !== 'win32') return;
  const ps = [
    'Add-Type -TypeDefinition @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class ArcShellNotify {',
    '  [DllImport("shell32.dll")] public static extern void SHChangeNotify(int e, uint f, IntPtr i1, IntPtr i2);',
    '}',
    '"@ -ErrorAction SilentlyContinue;',
    '[ArcShellNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)'
  ].join(' ');
  try {
    await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true }
    );
  } catch {
    /* best-effort */
  }
}

export async function applyLibraryFolderIconWin32(libraryRoot: string, iconSourcePath: string): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  const root = path.resolve(libraryRoot);
  const metaDir = libraryMetaDirAbs(root);
  await mkdir(metaDir, { recursive: true });
  const iconDest = path.join(metaDir, FOLDER_ICON_NAME);
  const iconRel = `${path.basename(metaDir)}\\${FOLDER_ICON_NAME}`;
  const desktopIniAbs = path.join(root, DESKTOP_INI);

  try {
    await copyFile(iconSourcePath, iconDest);
    await writeFile(desktopIniAbs, desktopIniContent(iconRel), 'utf8');
    await setWindowsAttributes(desktopIniAbs, '+h +s');
    await setWindowsAttributes(root, '+r');
    await notifyFolderIconChanged();
    return true;
  } catch {
    return false;
  }
}
