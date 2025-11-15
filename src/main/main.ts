/**
 * Главный процесс Electron приложения ARC
 * Управляет окном приложения и системными функциями
 */

import { app, BrowserWindow, screen, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { registerIPCHandlers } from './ipc-handlers';
import { initializeAutoUpdater } from './auto-updater';
import { registerShortcuts, unregisterShortcuts } from './shortcuts';

// Настройка логирования в файл
const logFile = path.join(app.getPath('userData'), 'main-process.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Перехватываем console.log для записи в файл
const originalLog = console.log;
const originalError = console.error;

console.log = (...args: any[]) => {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.join(' ')}\n`;
  logStream.write(message);
  originalLog(...args);
};

console.error = (...args: any[]) => {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ERROR: ${args.join(' ')}\n`;
  logStream.write(message);
  originalError(...args);
};

// Хранилище главного окна и трея
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Флаг для отслеживания принудительного выхода
let isQuitting = false;

/**
 * Single Instance Lock
 * Предотвращает запуск множественных экземпляров приложения
 */
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Если уже запущен другой экземпляр, выходим
  console.log('[MAIN] Приложение уже запущено. Завершаем текущий экземпляр.');
  app.quit();
} else {
  // Обработчик повторного запуска - фокусируем существующее окно
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('[MAIN] Попытка запустить второй экземпляр приложения');
    
    // Если окно существует, показываем и фокусируем его
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
      console.log('[MAIN] Окно восстановлено и сфокусировано');
      
      // Обрабатываем аргументы командной строки для навигации
      for (const arg of commandLine) {
        if (arg.startsWith('--navigate=')) {
          const page = arg.replace('--navigate=', '');
          mainWindow.webContents.send('navigate-to', `/${page}`);
          console.log(`[MAIN] Навигация на страницу: /${page}`);
          break;
        }
      }
    }
  });
}

/**
 * Обработка аргументов командной строки для навигации
 */
function handleCommandLineNavigation(): void {
  const args = process.argv.slice(1);
  
  for (const arg of args) {
    if (arg.startsWith('--navigate=')) {
      const page = arg.replace('--navigate=', '');
      
      if (mainWindow) {
        // Небольшая задержка, чтобы окно успело полностью загрузиться
        setTimeout(() => {
          mainWindow?.webContents.send('navigate-to', `/${page}`);
          console.log(`[MAIN] Навигация на страницу: /${page}`);
        }, 500);
      }
      break;
    }
  }
}

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
    // Иконка берется из resources при сборке electron-builder
    ...(app.isPackaged ? {} : { icon: path.join(__dirname, '../../resources/icon.ico') })
  });

  // Загружаем React приложение
  if (process.env.NODE_ENV === 'development') {
    // В режиме разработки загружаем с dev-сервера Vite
    mainWindow.loadURL('http://localhost:5173');
    
    // DevTools можно открыть вручную через Ctrl+Shift+I если нужно
    // mainWindow.webContents.openDevTools();
  } else {
    // В продакшене загружаем собранное приложение
    // После сборки структура: main/main.js и renderer/dist/index.html находятся на одном уровне
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  // Показываем окно когда контент загружен
  mainWindow.once('ready-to-show', () => {
    mainWindow?.maximize(); // Разворачиваем на весь экран
    mainWindow?.show();
    
    // Инициализируем автообновления после показа окна
    if (mainWindow) {
      initializeAutoUpdater(mainWindow);
    }
    
    // Обрабатываем аргументы командной строки для навигации из Jump List
    handleCommandLineNavigation();
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
  // Путь к иконке для трея
  let iconPath: string;
  
  if (app.isPackaged) {
    // В продакшене: extraResources копируются в process.resourcesPath
    iconPath = path.join(process.resourcesPath, 'icon.ico');
    console.log('[MAIN] Режим PRODUCTION');
    console.log('[MAIN] process.resourcesPath:', process.resourcesPath);
    console.log('[MAIN] Путь к иконке:', iconPath);
  } else {
    // В разработке
    iconPath = path.join(__dirname, '../../resources/icon.ico');
    console.log('[MAIN] Режим DEVELOPMENT');
    console.log('[MAIN] Путь к иконке:', iconPath);
  }
  
  console.log('[MAIN] Файл существует:', fs.existsSync(iconPath));
  
  // Загружаем иконку
  const icon = nativeImage.createFromPath(iconPath);
  
  if (icon.isEmpty()) {
    console.error('[MAIN] ❌ Не удалось загрузить иконку трея!');
    console.error('[MAIN] Финальный путь:', iconPath);
    // Создаем трей с пустой иконкой - хотя бы меню будет работать
  } else {
    console.log('[MAIN] ✅ Иконка загружена успешно, размер:', icon.getSize());
  }
  
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
 * Создание Jump List для Windows (контекстное меню на панели задач)
 */
function createJumpList(): void {
  if (process.platform !== 'win32') {
    return; // Jump List работает только на Windows
  }

  app.setJumpList([
    {
      type: 'custom',
      name: 'Навигация',
      items: [
        {
          type: 'task',
          title: 'Карточки',
          description: 'Открыть страницу карточек',
          program: process.execPath,
          args: '--navigate=cards',
          iconPath: process.execPath,
          iconIndex: 0
        },
        {
          type: 'task',
          title: 'Коллекции',
          description: 'Открыть страницу коллекций',
          program: process.execPath,
          args: '--navigate=collections',
          iconPath: process.execPath,
          iconIndex: 0
        },
        {
          type: 'task',
          title: 'Метки',
          description: 'Открыть страницу меток',
          program: process.execPath,
          args: '--navigate=tags',
          iconPath: process.execPath,
          iconIndex: 0
        },
        {
          type: 'task',
          title: 'Мудборд',
          description: 'Открыть мудборд',
          program: process.execPath,
          args: '--navigate=moodboard',
          iconPath: process.execPath,
          iconIndex: 0
        }
      ]
    },
    {
      type: 'custom',
      name: 'Действия',
      items: [
        {
          type: 'task',
          title: 'Добавить карточку',
          description: 'Добавить новую карточку',
          program: process.execPath,
          args: '--navigate=add',
          iconPath: process.execPath,
          iconIndex: 0
        }
      ]
    }
  ]);

  console.log('[MAIN] Jump List создан');
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
  
  // Создаём Jump List для Windows
  createJumpList();
  
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

