# 📋 TODO - Что нужно доработать

## ❗ Критически важно (без этого приложение не полностью функционально)

### 1. Генерация превью для изображений и видео
**Файл:** `src/main/ipc-handlers.ts`, строка 195  
**Приоритет:** Высокий  
**Время:** 1-2 часа

**Что нужно:**
```bash
# Установить библиотеки
npm install sharp
npm install fluent-ffmpeg
npm install --save-dev @types/fluent-ffmpeg
```

**Как реализовать:**
```typescript
// В ipc-handlers.ts
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';

ipcMain.handle('generate-thumbnail', async (_event, filePath, workingDir) => {
  const ext = path.extname(filePath).toLowerCase();
  const isVideo = ['.mp4', '.webm'].includes(ext);
  
  const thumbsDir = path.join(workingDir, '_cache', 'thumbs');
  await fs.mkdir(thumbsDir, { recursive: true });
  
  const fileName = path.basename(filePath, ext);
  const thumbPath = path.join(thumbsDir, `${fileName}_thumb.jpg`);
  
  if (isVideo) {
    // Генерация из видео
    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .screenshots({
          count: 1,
          folder: thumbsDir,
          filename: `${fileName}_thumb.jpg`,
          size: '400x?'
        })
        .on('end', () => resolve(thumbPath))
        .on('error', reject);
    });
  } else {
    // Генерация из изображения
    await sharp(filePath)
      .resize(400, 400, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toFile(thumbPath);
    return thumbPath;
  }
});
```

---

### 2. Сохранение файлов через Electron API
**Файл:** `renderer/src/components/gallery/AddCardFlow.tsx`, строка 270  
**Приоритет:** Высокий  
**Время:** 1 час

**Текущая проблема:** Используется preview вместо реального сохранения

**Как исправить:**
```typescript
// В AddCardFlow.tsx, функция saveFiles

// Заменить строки 270-272:
// TODO: Реализовать полную интеграцию с Electron API

На:

// Сохраняем файл в рабочую папку
const filePath = await window.electronAPI.organizeFile(
  item.file.path, // Путь к временному файлу
  directoryPath
);

// Генерируем превью
const thumbnailPath = await window.electronAPI.generateThumbnail(
  filePath,
  directoryPath
);

// Получаем file:// URL для превью
const thumbnailUrl = await window.electronAPI.getFileURL(thumbnailPath);
```

**Проблема:** `item.file.path` может быть undefined для drag & drop файлов.

**Решение:** Нужно временно сохранить файл и передать путь. Или использовать Buffer:

```typescript
// Вариант 1: Читаем файл как ArrayBuffer
const arrayBuffer = await item.file.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

// Добавить новый IPC handler:
ipcMain.handle('save-file-from-buffer', async (_event, buffer, fileName, workingDir) => {
  // Сохраняем buffer в файл
  const tempPath = path.join(app.getPath('temp'), fileName);
  await fs.writeFile(tempPath, buffer);
  
  // Организуем файл (копируем в структуру год/месяц/день)
  const finalPath = await organizeFile(tempPath, workingDir);
  
  // Удаляем временный файл
  await fs.unlink(tempPath);
  
  return finalPath;
});
```

---

### 3. Иконка приложения
**Файл:** `resources/icon.ico`  
**Приоритет:** Средний  
**Время:** 30 минут

**Шаги:**
1. Создайте PNG изображение 512×512px с логотипом ARC
2. Используйте онлайн конвертер: https://icoconvert.com/
3. Выберите "Custom Sizes" и отметьте: 16, 32, 48, 64, 128, 256
4. Скачайте icon.ico
5. Поместите в `arc-electron/resources/icon.ico`
6. Пересоберите: `npm run electron:build`

---

## ⚠️ Важно (желательно реализовать)

### 4. Резервное копирование
**Файл:** `src/main/ipc-handlers.ts`, строка 218  
**Приоритет:** Средний  
**Время:** 2-3 часа

**Установить:**
```bash
npm install archiver
npm install --save-dev @types/archiver
```

**Реализовать:**
```typescript
import archiver from 'archiver';

ipcMain.handle('create-backup', async (_event, outputPath, workingDir, parts) => {
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });
  
  const output = fs.createWriteStream(outputPath);
  archive.pipe(output);
  
  // Добавляем все файлы из рабочей папки
  archive.directory(workingDir, false);
  
  await archive.finalize();
  
  const stats = await fs.stat(outputPath);
  return {
    success: true,
    size: stats.size,
    filesCount: archive.pointer()
  };
});
```

---

### 5. Обработка горячих клавиш в UI
**Файл:** `renderer/src/App.tsx` или создать новый hook  
**Приоритет:** Средний  
**Время:** 1 час

**Что добавить:**
```typescript
// В App.tsx
useEffect(() => {
  if (!window.electronAPI) return;
  
  // Слушаем события горячих клавиш
  const { ipcRenderer } = window.require('electron');
  
  ipcRenderer.on('hotkey:new-card', () => {
    navigate('/add');
  });
  
  ipcRenderer.on('hotkey:search', () => {
    // Открыть поисковую панель
    setShowSearch(true);
  });
  
  ipcRenderer.on('hotkey:delete', () => {
    // Удалить выбранные карточки
    if (selectedCards.length > 0) {
      handleDelete(selectedCards);
    }
  });
  
  // ...остальные хоткеи
}, []);
```

---

## 📋 Желательно (опционально)

### 6. Экспорт коллекций
**Где:** Новый IPC handler + UI кнопка  
**Время:** 2 часа

Экспорт выбранной коллекции в отдельную папку со всеми файлами.

### 7. Системный трей
**Где:** `src/main/main.ts`  
**Время:** 1 час

```typescript
import { Tray, Menu } from 'electron';

let tray: Tray | null = null;

function createTray() {
  tray = new Tray(path.join(__dirname, '../../resources/tray-icon.ico'));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Открыть ARC', click: () => mainWindow?.show() },
    { label: 'Выход', click: () => app.quit() }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('ARC - Artist Reference Collection');
}
```

### 8. Полнотекстовый поиск
**Где:** `renderer/src/services/db.ts`  
**Время:** 2-3 часа

Поиск по названиям файлов и заметкам карточек.

---

## ✅ Чеклист перед первым релизом

### Обязательно
- [ ] Генерация превью работает
- [ ] Сохранение файлов работает
- [ ] Создана иконка приложения
- [ ] Протестировано на реальных данных (100+ файлов)
- [ ] Нет ошибок в DevTools
- [ ] Установщик создаётся без ошибок
- [ ] Приложение устанавливается и запускается

### Желательно
- [ ] Резервное копирование работает
- [ ] Горячие клавиши обрабатываются в UI
- [ ] Создан user guide
- [ ] Протестировано на чистой Windows 10/11

### Опционально
- [ ] Системный трей
- [ ] Экспорт коллекций
- [ ] Полнотекстовый поиск
- [ ] Code signing сертификат

---

## 🎯 Рекомендуемый порядок доработки

**День 1: Базовый функционал**
1. Генерация превью (TODO #1)
2. Сохранение файлов (TODO #2)
3. Тестирование на реальных данных

**День 2: Визуал и UX**
4. Создание иконки (TODO #3)
5. Тестирование горячих клавиш
6. Обработка ошибок и edge cases

**День 3: Продвинутые функции**
7. Резервное копирование (TODO #4)
8. Обработка горячих клавиш (TODO #5)
9. Финальное тестирование

**День 4: Релиз**
10. Создание установщика
11. Тестирование на чистой системе
12. Написание user guide
13. Публикация v1.0.0

---

## 💡 Советы

### При работе с Cursor AI

**Хорошие промпты:**
- "Реализуй генерацию превью через sharp в generate-thumbnail handler"
- "Доработай сохранение файлов в AddCardFlow используя organizeFile API"
- "Создай IPC handler для резервного копирования с archiver"

**Плохие промпты:**
- "Исправь файлы"
- "Сделай чтобы работало"
- "Добавь функционал"

### При тестировании

1. Всегда смотрите логи в обоих процессах (main + renderer)
2. Используйте DevTools Network tab для проверки загрузки ресурсов
3. Проверяйте IndexedDB в DevTools → Application → IndexedDB
4. Тестируйте на разных размерах окна (1920×1080 и 2560×1440)

### При отладке

1. Добавляйте `console.log` с префиксами: `[MAIN]`, `[IPC]`, `[Renderer]`
2. Используйте try/catch для всех async функций
3. Проверяйте типы данных в TypeScript
4. Читайте ошибки полностью - они обычно указывают на проблему

---

**Удачи! Вы на финишной прямой! 🏁**

