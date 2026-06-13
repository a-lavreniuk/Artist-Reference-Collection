import { app, nativeImage } from 'electron';
import path from 'path';

function iconsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons');
  }
  return path.join(app.getAppPath(), 'build', 'icons');
}

export function appIconPath(): string {
  return path.join(iconsDir(), 'icon.png');
}

export function appIconTrayPath(): string {
  return path.join(iconsDir(), 'icon-16.png');
}

/** Иконка для окна и трея. Каждый размер — отдельный подготовленный PNG. */
export function loadAppIconImage(size = 256) {
  const sourcePath = size === 16 ? appIconTrayPath() : appIconPath();
  return nativeImage.createFromPath(sourcePath);
}
