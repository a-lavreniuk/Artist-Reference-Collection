# Сборка установщика ARC

Это руководство описывает процесс создания Windows-установщика для ARC.

## Требования

- Node.js 20+ установлен
- Все зависимости установлены (`npm install`)
- Windows 10/11

## Быстрый старт

```bash
# 1. Установка зависимостей (если еще не установлены)
npm install
cd renderer && npm install && cd ..

# 2. Сборка приложения
npm run build

# 3. Создание установщика
npm run build:prod
```

## Известная проблема: ошибка winCodeSign

При первой сборке на Windows вы можете столкнуться с ошибкой:

```
ERROR: Cannot create symbolic link
```

Это происходит из-за ограничений Windows на создание символьных ссылок.

### Решение 1: Developer Mode (рекомендуется)

1. Откройте **Параметры Windows** (Win + I)
2. Перейдите в **Конфиденциальность и безопасность** → **Для разработчиков**
3. Включите **Режим разработчика**
4. Перезапустите компьютер
5. Повторите сборку: `npm run build:prod`

### Решение 2: Запуск от администратора

1. Закройте текущий терминал
2. Откройте PowerShell от имени администратора
3. Перейдите в папку проекта
4. Выполните: `npm run build:prod`

### Решение 3: Использование GitHub Actions (автоматическая сборка)

Самый простой способ - использовать GitHub Actions для автоматической сборки:

1. Закоммитьте все изменения
2. Создайте и отправьте git tag:
   ```bash
   npm version patch  # или minor, или major
   git push origin main
   git push origin v1.0.1
   ```
3. GitHub Actions автоматически соберет установщик
4. Скачайте готовый установщик из GitHub Releases

Подробнее см. [docs/release-process.md](./release-process.md)

## Результат сборки

После успешной сборки в папке `release/` появятся файлы:

```
release/
  ├── ARC-Setup-1.0.0.exe     # Установщик (без подписи)
  ├── latest.yml              # Метаданные для автообновлений
  └── win-unpacked/           # Распакованное приложение
      └── ARC.exe             # Исполняемый файл
```

## Сборка с цифровой подписью

Для сборки с цифровой подписью (устраняет предупреждения Windows):

1. Получите сертификат Code Signing (см. [docs/code-signing.md](./code-signing.md))
2. Установите переменные окружения:
   ```powershell
   $env:CSC_LINK = "C:\path\to\certificate.pfx"
   $env:CSC_KEY_PASSWORD = "ваш_пароль"
   ```
3. Соберите: `npm run build:prod:signed`

## Сборка без установщика (для тестирования)

Для быстрого тестирования без создания установщика:

```bash
npm run pack
```

Это создаст только папку `release/win-unpacked/` с готовым приложением.

## Тестирование установщика

### Перед публикацией проверьте:

1. **Запуск установщика**
   - Запустите `ARC-Setup-1.0.0.exe`
   - Выберите папку установки
   - Дождитесь завершения установки

2. **Проверка ярлыков**
   - Ярлык на рабочем столе создан?
   - Ярлык в меню Пуск создан?

3. **Запуск приложения**
   - Приложение запускается?
   - Все функции работают?
   - База данных создается?

4. **Обновление**
   - Установите старую версию
   - Установите новую версию поверх
   - Данные сохранились?

5. **Удаление**
   - Откройте "Установка и удаление программ"
   - Удалите ARC
   - Приложение удалено корректно?

## Скрипты сборки

| Команда | Описание |
|---------|----------|
| `npm run build` | Собрать все компоненты (main, preload, renderer) |
| `npm run build:prod` | Полная сборка + создание установщика |
| `npm run build:prod:signed` | Сборка с цифровой подписью |
| `npm run pack` | Создать только папку с приложением (без установщика) |
| `npm run release` | Сборка + публикация в GitHub Releases |

## Структура проекта при сборке

```
arc/
├── main/                  # Скомпилированный main process (из src/main/)
├── preload/               # Скомпилированный preload script (из src/preload/)
├── renderer/dist/         # Собранное React приложение
└── release/               # Результат сборки electron-builder
    ├── ARC-Setup-1.0.0.exe
    ├── latest.yml
    └── win-unpacked/
```

## Очистка

Для полной очистки всех сборочных файлов:

```powershell
# Удалить скомпилированные файлы
Remove-Item main\*.js, main\*.js.map, preload\*.js, preload\*.js.map -Force
Remove-Item renderer\dist -Recurse -Force

# Удалить результаты сборки
Remove-Item release -Recurse -Force

# Очистить кэш electron-builder
Remove-Item $env:LOCALAPPDATA\electron-builder\Cache -Recurse -Force
```

## Частые ошибки

### Ошибка: "Cannot find module"

**Причина**: Не установлены зависимости

**Решение**:
```bash
npm install
cd renderer && npm install && cd ..
```

### Ошибка: TypeScript ошибки компиляции

**Причина**: Ошибки в коде TypeScript

**Решение**: Исправьте ошибки в коде или временно отключите strict mode в `tsconfig.json`

### Ошибка: "ENOENT: no such file or directory"

**Причина**: Не собран renderer или main process

**Решение**:
```bash
npm run build:main
npm run build:preload
npm run build:renderer
```

### Предупреждение: "Unrecognized publisher" при установке

**Причина**: Установщик не подписан цифровой подписью

**Решение**: Это нормально для неподписанных приложений. Пользователи могут нажать "Дополнительно" → "Выполнить в любом случае". Для устранения предупреждения см. [docs/code-signing.md](./code-signing.md)

## Полезные ссылки

- [Electron Builder Documentation](https://www.electron.build/)
- [NSIS Documentation](https://nsis.sourceforge.io/Docs/)
- [Code Signing Guide](./code-signing.md)
- [Release Process](./release-process.md)


