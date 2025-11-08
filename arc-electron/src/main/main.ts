/**
 * Главный процесс Electron приложения ARC
 * Управляет окном приложения и системными функциями
 */

import { app, BrowserWindow, screen, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import { registerIPCHandlers } from './ipc-handlers';
import { initializeAutoUpdater } from './auto-updater';
import { registerShortcuts, unregisterShortcuts } from './shortcuts';

// Хранилище главного окна и трея
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Флаг для отслеживания принудительного выхода
let isQuitting = false;

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

  // Обработка закрытия окна - сворачиваем в трей
  mainWindow.on('close', (event) => {
    // Если не принудительный выход, сворачиваем в трей
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      console.log('[MAIN] Окно свернуто в трей');
      return false;
    }
  });

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
 * Создание системного трея
 */
function createTray(): void {
  // Путь к иконке для трея (используем ту же что и для окна)
  const iconPath = path.join(__dirname, '../../resources/icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  
  // Создаём трей
  tray = new Tray(icon);
  
  // Подсказка при наведении
  tray.setToolTip('ARC - Artist Reference Collection');
  
  // Контекстное меню
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Открыть ARC',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Карточки',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/cards');
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Коллекции',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/collections');
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Метки',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/tags');
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Мудборд',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/moodboard');
        } else {
          createWindow();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Добавить',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/add');
        } else {
          createWindow();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Закрыть ARC',
      click: () => {
        // Принудительный выход (не сворачиваем в трей)
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // Двойной клик на иконку - показать/скрыть окно
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  console.log('[MAIN] Системный трей создан');
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
  
  // Создаём системный трей
  createTray();
  
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
 * Если окно свернуто в трей, не выходим
 */
app.on('window-all-closed', () => {
  // Отменяем регистрацию горячих клавиш
  unregisterShortcuts();
  
  // Не выходим если окно свернуто в трей
  if (!isQuitting && process.platform === 'win32') {
    console.log('[MAIN] Приложение свернуто в трей, не выходим');
    return;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * Очистка при выходе из приложения
 */
app.on('before-quit', () => {
  isQuitting = true;
  
  // Удаляем трей
  if (tray) {
    tray.destroy();
    tray = null;
    console.log('[MAIN] Системный трей удалён');
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

