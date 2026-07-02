import { app } from 'electron';
import path from 'path';

let devProfile = false;

/** Разделяет dev и установленную версию: userData, библиотека по умолчанию. Вызывать до app.whenReady(). */
export function configureAppProfile(): void {
  devProfile = !app.isPackaged;
  app.setName('ARC');
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.arc.artist-reference-collection');
  }
  if (!devProfile) {
    app.setPath('userData', path.join(app.getPath('appData'), 'ARC'));
    return;
  }

  const defaultUserData = app.getPath('userData');
  app.setPath('userData', `${defaultUserData}-dev`);
}

export function isDevProfile(): boolean {
  return devProfile;
}

export function getDefaultLibraryFolderName(): string {
  return isDevProfile() ? 'Библиотека ARC (Dev)' : 'Библиотека ARC';
}
