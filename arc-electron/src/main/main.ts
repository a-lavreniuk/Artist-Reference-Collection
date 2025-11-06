/**
 * Главный процесс Electron приложения ARC
 * Управляет окном приложения и системными функциями
 */

import { app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { registerIPCHandlers } from './ipc-handlers';
import { initializeAutoUpdater } from './auto-updater';
import { registerShortcuts, unregisterShortcuts } from './shortcuts';

// Хранилище главного окна
let mainWindow: BrowserWindow | null = null;

/**
 * Создание главного окна приложения
 */
function createWindow(): void {
  // Получаем размеры экрана
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Минимальный размер окна: 1920×1080
  const MIN_WIDTH = 1920;
  const MIN_HEIGHT = 1080;
  
  // Максимальный размер окна: 2560×1440
  const MAX_WIDTH = 2560;
  const MAX_HEIGHT = 1440;

  // Начальный размер - между минимальным и максимальным
  const initialWidth = Math.min(Math.max(screenWidth, MIN_WIDTH), MAX_WIDTH);
  const initialHeight = Math.min(Math.max(screenHeight, MIN_HEIGHT), MAX_HEIGHT);

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    maxWidth: MAX_WIDTH,
    maxHeight: MAX_HEIGHT,
    show: false, // Не показываем окно пока не загрузится контент
    webPreferences: {
      nodeIntegration: false, // Отключаем node integration для безопасности
      contextIsolation: true, // Включаем изоляцию контекста
      preload: path.join(__dirname, '../preload/preload.js'), // Подключаем preload скрипт
      webSecurity: true,
      sandbox: false // Нужно для доступа к файловой системе
    },
    backgroundColor: '#0A0A0A', // Фон из палитры ARC (grayscale-950)
    title: 'ARC - Artist Reference Collection',
    icon: path.join(__dirname, '../../resources/icon.ico')
  });

  // Загружаем React приложение
  if (process.env.NODE_ENV === 'development') {
    // В режиме разработки загружаем с dev-сервера Vite
    mainWindow.loadURL('http://localhost:5173');
    // Открываем DevTools в режиме разработки
    mainWindow.webContents.openDevTools();
  } else {
    // В продакшене загружаем собранное приложение
    mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
  }

  // Показываем окно когда контент загружен
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    
    // Инициализируем автообновления после показа окна
    if (mainWindow) {
      initializeAutoUpdater(mainWindow);
    }
  });

  // Обработка закрытия окна
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Запрещаем открытие новых окон
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  console.log('[MAIN] Окно приложения создано');
  console.log(`[MAIN] Размер окна: ${initialWidth}x${initialHeight}`);
}

/**
 * Инициализация приложения
 */
app.whenReady().then(() => {
  console.log('[MAIN] Приложение готово к запуску');
  console.log(`[MAIN] Версия Electron: ${process.versions.electron}`);
  console.log(`[MAIN] Версия Node: ${process.versions.node}`);
  console.log(`[MAIN] Версия Chrome: ${process.versions.chrome}`);
  
  // Регистрируем IPC handlers перед созданием окна
  registerIPCHandlers();
  
  createWindow();
  
  // Регистрируем горячие клавиши после создания окна
  if (mainWindow) {
    registerShortcuts(mainWindow);
  }

  // Для macOS - создаем окно если оно было закрыто и приложение активировано
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Выход из приложения когда все окна закрыты (кроме macOS)
 */
app.on('window-all-closed', () => {
  // Отменяем регистрацию горячих клавиш
  unregisterShortcuts();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Обработка ошибок
 */
process.on('uncaughtException', (error) => {
  console.error('[MAIN] Необработанная ошибка:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[MAIN] Необработанное отклонение промиса:', reason);
});

