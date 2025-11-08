/**
 * Глобальные горячие клавиши для ARC
 */

import { globalShortcut, BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

/**
 * Регистрация всех горячих клавиш
 * @param window - главное окно приложения
 */
export function registerShortcuts(window: BrowserWindow): void {
  mainWindow = window;

  try {
    // Ctrl+N - Создать новую карточку (переход на страницу добавления)
    globalShortcut.register('CommandOrControl+N', () => {
      console.log('[Shortcuts] Ctrl+N: Создание новой карточки');
      mainWindow?.webContents.send('hotkey:new-card');
    });

    // Ctrl+F - Открыть поиск
    globalShortcut.register('CommandOrControl+F', () => {
      console.log('[Shortcuts] Ctrl+F: Открытие поиска');
      mainWindow?.webContents.send('hotkey:search');
    });

    // Delete - Удалить выбранные карточки
    globalShortcut.register('Delete', () => {
      console.log('[Shortcuts] Delete: Удаление выбранных');
      mainWindow?.webContents.send('hotkey:delete');
    });

    // Ctrl+, - Открыть настройки
    globalShortcut.register('CommandOrControl+,', () => {
      console.log('[Shortcuts] Ctrl+,: Открытие настроек');
      mainWindow?.webContents.send('hotkey:settings');
    });

    // Ctrl+M - Открыть мудборд
    globalShortcut.register('CommandOrControl+M', () => {
      console.log('[Shortcuts] Ctrl+M: Открытие мудборда');
      mainWindow?.webContents.send('hotkey:moodboard');
    });

    // F5 - Обновить галерею
    globalShortcut.register('F5', () => {
      console.log('[Shortcuts] F5: Обновление галереи');
      mainWindow?.webContents.send('hotkey:refresh');
    });

    console.log('[Shortcuts] Все горячие клавиши зарегистрированы');
  } catch (error) {
    console.error('[Shortcuts] Ошибка регистрации горячих клавиш:', error);
  }
}

/**
 * Отменить регистрацию всех горячих клавиш
 */
export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
  console.log('[Shortcuts] Все горячие клавиши отменены');
}

