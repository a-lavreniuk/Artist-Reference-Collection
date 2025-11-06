# ARC Electron - Artist Reference Collection

Полноценное настольное приложение для Windows 10/11, созданное на базе Electron.

## Требования

- Node.js 18+ (рекомендуется 20.x)
- npm или yarn
- Windows 10/11

## Установка зависимостей

```bash
# Установить зависимости главного проекта
npm install

# Установить зависимости renderer (React приложения)
cd renderer
npm install
cd ..
```

## Разработка

```bash
# Запустить приложение в режиме разработки
npm run dev
```

Это запустит:
1. Vite dev-сервер для React приложения (http://localhost:5173)
2. Electron с горячей перезагрузкой

## Сборка

```bash
# Собрать TypeScript в JavaScript
npm run build

# Собрать установщик для Windows
npm run electron:build
```

Установщик будет создан в папке `release/`.

## Структура проекта

```
arc-electron/
├── main/               # Main процесс (скомпилированный)
├── preload/            # Preload скрипты (скомпилированные)
├── renderer/           # React приложение
├── resources/          # Иконки и ресурсы
├── src/
│   ├── main/          # Исходный код main процесса
│   └── preload/       # Исходный код preload скриптов
├── package.json
└── tsconfig.json
```

## Архитектура

- **Main Process** (`src/main/main.ts`) - управляет окном приложения и системными функциями
- **Preload Script** (`src/preload/preload.ts`) - безопасный мост между main и renderer
- **Renderer Process** (`renderer/`) - React UI приложение

## API для Renderer

Доступен через `window.electronAPI`:

```typescript
// Выбор рабочей папки
const path = await window.electronAPI.selectWorkingDirectory();

// Сканирование директории
const files = await window.electronAPI.scanDirectory(path);

// Информация о файле
const info = await window.electronAPI.getFileInfo(filePath);

// Создание превью
const thumbPath = await window.electronAPI.generateThumbnail(filePath, workingDir);
```

Полный список API см. в `src/preload/preload.ts`.

## Горячие клавиши

- `Ctrl+N` - Создать новую карточку
- `Ctrl+F` - Открыть поиск
- `Delete` - Удалить выбранные карточки

## Технологии

- Electron 28+
- TypeScript 5.3+
- Node.js File System API
- IPC (Inter-Process Communication)
- electron-builder для сборки

## Лицензия

MIT

