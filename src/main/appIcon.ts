import { app, nativeImage } from 'electron';
import path from 'path';

export function iconLightPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', 'icon-light.png');
  }
  return path.join(app.getAppPath(), 'build', 'icons', 'icon-light.png');
}

/** Иконка для окна и трея (на Windows трей — 16×16). */
export function loadAppIconImage(size = 256) {
  const image = nativeImage.createFromPath(iconLightPath());
  if (image.isEmpty()) return image;
  if (size > 0 && (image.getSize().width !== size || image.getSize().height !== size)) {
    return image.resize({ width: size, height: size });
  }
  return image;
}
