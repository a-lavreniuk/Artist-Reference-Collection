# Artist Reference Collection (ARC)

Десктопное приложение для организации визуальных референсов без обязательного интернета. Импорт изображений и видео, метки и категории, коллекции, поиск (в том числе AI) и несколько библиотек на одном компьютере.

Актуальная публичная сборка Windows: **0.1.17** — [GitHub Releases](https://github.com/a-lavreniuk/Artist-Reference-Collection/releases).

**База знаний** (экраны, сценарии, гайды для тестеров): [`docs/gitbook/`](docs/gitbook/README.md).

## Основные возможности

- **Галерея** — сетка карточек, области просмотра (вся библиотека / без меток / корзина), фильтры и поиск в навбаре.
- **Поиск** — режимы по меткам, по цвету, AI-семантика и похожие изображения; фильтры по типу медиа, дате и параметрам файла.
- **Коллекции** — именованные подборки; одна карточка может входить в несколько коллекций.
- **Мудборд** — избранные карточки. Рабочая доска пока в разработке.
- **Метки и категории** — иерархия, цвета, создание и удаление через модалки.
- **Библиотеки** — контейнер «Библиотека ARC», несколько библиотек, переключение в настройках.
- **Импорт** — файлы и папки, очередь загрузки, теги при добавлении; опционально расширение браузера (Chrome MVP).
- **Поиск дублей** — отдельный сценарий в приложении.
- **Настройки** — тема, путь библиотеки, автоимпорт, AI, обновления, MCP-сервер для локальных клиентов.
- **UI-Kit** (для разработки интерфейса) — `renderer/public/ui/arc-ui/arc-ui.html`.

Медиа и база карточек лежат в выбранной папке библиотеки (SQLite в main-процессе Electron). Служебные данные приложения — отдельно, в профиле `%APPDATA%`. Клиентский слой в `renderer/src/services/db.ts` только ходит в main через IPC.

## Запуск и сборка

Нужен **Node.js 22**. В корне репозитория:

| Команда | Назначение |
|--------|------------|
| `npm run dev` | Vite (renderer) и Electron в режиме разработки |
| `npm run renderer:dev` | только фронтенд Vite (порт 5173) |
| `npm run build` | сборка `main`, `preload` и `renderer` |
| `npm run dist:win` | установщик Windows (NSIS) в `dist-electron/` |
| `npm run dist:mac` | установщики macOS (DMG, arm64 + x64) в `dist-electron/` — только на Mac |
| `npm run publish:win` | локальная сборка и публикация в GitHub Releases (нужен `GH_TOKEN`) |

Подробно про macOS (Actions, локальная сборка, установка): [`docs/build-macos.md`](docs/build-macos.md).

Расширение браузера: [`docs/browser-extension/README.md`](docs/browser-extension/README.md). MCP: [`docs/mcp-server/README.md`](docs/mcp-server/README.md).

## Установщик и обновления (Windows)

1. Скачайте `ARC-Setup-X.Y.Z.exe` из [Releases](https://github.com/a-lavreniuk/Artist-Reference-Collection/releases) (локальная сборка `dist:win` может называться `ARC Setup X.Y.Z.exe`).
2. При первом запуске Windows может показать SmartScreen (установщик не подписан): **Подробнее** → **Выполнить в любом случае**.
3. Установленное приложение при запуске проверяет обновления на GitHub. При согласии обновление ставится без повторного мастера установки.
4. Папка программы и папка библиотеки — разные места. Медиа и метаданные библиотеки не лежат внутри Program Files.
5. Dev (`npm run dev`) и установленный релиз не делят профиль: `%APPDATA%\ARC-dev` и `Библиотека ARC (Dev)` против `%APPDATA%\ARC` и `Библиотека ARC`.
6. Переустановка **поверх** текущей установки библиотеку не трогает. Полное удаление через деинсталлятор может стереть служебные данные в `%APPDATA%\ARC`. Папку библиотеки в «Документах» это само по себе не удаляет; для чистого старта служебных данных удалите `%APPDATA%\ARC` (или `%APPDATA%\ARC-dev` для dev).

### Публикация новой версии

1. Обновите `version` в `package.json` и добавьте запись в `release-notes.json`.
2. Закоммитьте, создайте тег `X.Y.Z` (без префикса `v`) и отправьте: `git push origin X.Y.Z`.
3. Workflow `.github/workflows/release-windows.yml` соберёт установщик и опубликует Release с `latest.yml` для автообновления.

## macOS (тестовые сборки)

Установщики — DMG для **Apple Silicon** (`arm64`) и **Intel** (`x64`). В GitHub Releases DMG пока не публикуются.

- **Скачать DMG:** workflow [Build macOS](https://github.com/a-lavreniuk/Artist-Reference-Collection/actions/workflows/build-macos.yml) → **Run workflow** → артефакт `arc-macos-*` в успешном run (хранятся 30 дней).
- **Собрать на Mac:** `npm run dist:mac` (Node.js 22 и Xcode Command Line Tools).

Полная инструкция: [`docs/build-macos.md`](docs/build-macos.md).

Справочник по UI: `renderer/public/ui/arc-ui/arc-ui.html`, стили — `renderer/public/ui/arc-ui/arc-ui.css`, навбар — `renderer/public/ui/arc-navbar.css`.
