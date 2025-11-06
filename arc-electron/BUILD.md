# Руководство по сборке ARC Electron

## Требования

- Node.js 18+ (рекомендуется 20.x)
- npm или yarn
- Windows 10/11 (для сборки Windows версии)
- ~500 МБ свободного места на диске

## Установка зависимостей

```bash
# Корневые зависимости (Electron)
npm install

# Зависимости renderer (React)
cd renderer
npm install
cd ..
```

## Разработка

### Вариант 1: Автоматический запуск (рекомендуется)

```bash
# Windows
start-dev.bat

# Или вручную через npm
npm run dev
```

Это запустит:
1. Vite dev-сервер на http://localhost:5173
2. Electron в режиме разработки с hot reload

### Вариант 2: Раздельный запуск

Терминал 1 - запуск Vite:
```bash
cd renderer
npm run dev
```

Терминал 2 - запуск Electron (после запуска Vite):
```bash
set NODE_ENV=development
npm run electron:dev
```

## Сборка

### Шаг 1: Сборка TypeScript и React

```bash
# Собрать всё
npm run build
```

Это выполнит:
- `npm run build:main` - компиляция main процесса
- `npm run build:preload` - компиляция preload скрипта
- `npm run build:renderer` - сборка React приложения

### Шаг 2: Создание установщика

```bash
# Создать Windows установщик
npm run electron:build
```

Результат будет в папке `release/`:
- `ARC-Setup-1.0.0.exe` - установщик
- `win-unpacked/` - распакованная версия для тестирования

## Структура сборки

```
arc-electron/
├── main/                    # Скомпилированный main процесс (JS)
├── preload/                 # Скомпилированный preload (JS)
├── renderer/dist/           # Собранное React приложение
├── release/                 # Готовые установщики
│   ├── ARC-Setup-1.0.0.exe
│   └── win-unpacked/
├── src/                     # Исходный код TypeScript
│   ├── main/
│   └── preload/
└── renderer/                # React приложение
    └── src/
```

## Тестирование сборки

### Тестирование распакованной версии

```bash
cd release/win-unpacked
ARC.exe
```

### Тестирование установщика

1. Запустите `release/ARC-Setup-1.0.0.exe`
2. Следуйте инструкциям установщика
3. Найдите ARC в меню Пуск или на рабочем столе

## Отладка

### DevTools

В режиме разработки DevTools открываются автоматически.

Для открытия в продакшене, измените `main.ts`:
```typescript
mainWindow.webContents.openDevTools();
```

### Логи

- **Main процесс**: логи в терминале где запущен Electron
- **Renderer**: логи в DevTools Console
- **IPC**: логи с префиксом `[IPC]` в main процессе

### Частые проблемы

**Ошибка: "Electron API недоступен"**
- Проверьте что preload.js правильно загружается
- Проверьте пути в main.ts

**Ошибка компиляции TypeScript**
- Запустите `npm run build:main` и `npm run build:preload` отдельно
- Проверьте ошибки в консоли

**React не загружается**
- Убедитесь что Vite dev-сервер запущен на порту 5173
- Проверьте `NODE_ENV=development` установлен

## Очистка

Удалить все собранные файлы:

```bash
# Windows
rmdir /s /q main preload renderer\dist release

# Или создать скрипт clean.bat:
@echo off
rmdir /s /q main
rmdir /s /q preload
rmdir /s /q renderer\dist
rmdir /s /q release
echo Cleaned!
```

## Обновление версии

1. Обновите версию в `package.json`
2. Обновите `CHANGELOG.md`
3. Соберите новый релиз: `npm run electron:build`

## Публикация

Для настройки автообновлений:
1. Загрузите установщик на сервер
2. Обновите `electron-builder.yml` с URL сервера
3. Настройте CI/CD для автоматической сборки

## Производительность

Оптимизация размера:
- Используйте `asar: true` (включено по умолчанию)
- Минимизируйте зависимости в `dependencies`
- Используйте `devDependencies` для dev-инструментов

Оптимизация скорости:
- Используйте производственную сборку React
- Включите минификацию в Vite
- Оптимизируйте изображения и ассеты

## Дополнительная информация

- Документация Electron: https://electronjs.org/docs
- Документация electron-builder: https://www.electron.build/
- Документация Vite: https://vitejs.dev/

