# Сборка и тестирование ARC на macOS

> **Чек-листы для тестеров** (актуальная версия) — в Notion KB: [Чек-листы тестирования](https://app.notion.com/p/38fbfa9fcc588169acaff89f56870b11) → **macOS smoke**. Ниже — инструкция по сборке и краткий локальный список.

Репозиторий: [github.com/a-lavreniuk/Artist-Reference-Collection](https://github.com/a-lavreniuk/Artist-Reference-Collection)

Получить установщик можно двумя способами: **скачать готовый DMG из GitHub Actions** или **собрать локально на Mac**. Сборка macOS с Windows не поддерживается (ограничение `electron-builder`).

---

## Способ A — скачать готовый DMG из GitHub

Подходит, если не нужно собирать проект локально.

### 1. Запустить сборку

1. Откройте workflow [Build macOS](https://github.com/a-lavreniuk/Artist-Reference-Collection/actions/workflows/build-macos.yml).
2. Нажмите **Run workflow** (справа).
3. Ветка: **main** → **Run workflow**.
4. Дождитесь успешного завершения (~10–20 минут).

### 2. Скачать артефакт

1. Откройте [список запусков Build macOS](https://github.com/a-lavreniuk/Artist-Reference-Collection/actions/workflows/build-macos.yml).
2. Кликните на последний успешный run (зелёная галочка).
3. Внизу страницы — блок **Artifacts**.
4. Скачайте архив `arc-macos-<номер>` (внутри — DMG-файлы).

Артефакты хранятся **30 дней**. В Releases DMG не публикуются.

### 3. Какой DMG выбрать

| Файл | Mac |
|------|-----|
| `ARC-X.Y.Z-arm64.dmg` | Apple Silicon (M1, M2, M3, M4) |
| `ARC-X.Y.Z.dmg` | Intel (x64) |

Версия `X.Y.Z` совпадает с полем `version` в `package.json`.

### 4. Установка

1. Откройте DMG двойным кликом.
2. Перетащите **ARC** в папку **Applications**.
3. Запустите ARC из Applications.

### Предупреждение Gatekeeper

Сборка **не подписана** Apple Developer ID. При первом запуске macOS может заблокировать приложение.

**Обход для теста:**

- ПКМ по ARC → **Открыть** → **Открыть** в диалоге, или
- **Системные настройки** → **Конфиденциальность и безопасность** → **Всё равно открыть**.

---

## Способ B — собрать DMG локально на Mac

### Требования

| Компонент | Версия / действие |
|-----------|-----------------|
| macOS | актуальная поддерживаемая версия |
| Node.js | **22** (LTS) — [nodejs.org](https://nodejs.org/) |
| Xcode Command Line Tools | `xcode-select --install` |
| Git | обычно уже установлен |

Проверка в Терминале:

```bash
node -v    # v22.x.x
npm -v
git --version
```

### 1. Клонировать репозиторий

```bash
git clone https://github.com/a-lavreniuk/Artist-Reference-Collection.git
cd Artist-Reference-Collection
```

Если репозиторий уже есть:

```bash
cd Artist-Reference-Collection
git pull origin main
```

### 2. Установить зависимости

```bash
npm ci
```

Первый запуск может занять 5–15 минут (нативные модули: `better-sqlite3`, `sharp`, `node-llama-cpp`).

### 3. Собрать установщики

```bash
npm run dist:mac
```

Скрипт собирает приложение и создаёт **два DMG**: для arm64 и x64. Обычно 10–20 минут.

### 4. Результат

```bash
ls -la dist-electron/*.dmg
```

Пример для версии 0.1.2:

```
dist-electron/ARC-0.1.2-arm64.dmg
dist-electron/ARC-0.1.2.dmg
```

Установка — как в [способе A, шаг 4](#4-установка).

---

## Устранение проблем при локальной сборке

| Симптом | Решение |
|---------|---------|
| `xcode-select: error` | `xcode-select --install`, перезапустить Терминал |
| Старая Node.js | Установить Node 22 с [nodejs.org](https://nodejs.org/) |
| Ошибки после `git pull` | `rm -rf node_modules && npm ci` |
| Нехватка места | Нужно ~2–3 ГБ свободного места на диске |
| `Build for macOS is supported only on macOS` | Вы на Windows/Linux — используйте [способ A](#способ-a--скачать-готовый-dmg-из-github) |

При ошибке пришлите **полный вывод Терминала** от `npm run dist:mac`.

---

## Чеклист для тестировщика

После установки проверьте:

1. ARC запускается без краша.
2. Открывается библиотека.
3. Импорт файла или папки.
4. Поиск и фильтры в галерее.
5. Раздел настроек открывается.
6. Повторный запуск после закрытия.

В отчёте укажите:

- модель Mac (например MacBook Pro M2);
- версию macOS;
- какой DMG использовали (`arm64` или Intel);
- способ получения (Actions или локальная сборка).

Баги: [GitHub Issues](https://github.com/a-lavreniuk/Artist-Reference-Collection/issues).

---

## Для разработчиков

| Команда | Назначение |
|---------|------------|
| `npm run dist:mac` | DMG для arm64 и x64 в `dist-electron/` |
| `npm run predist:mac` | подготовка иконок (вызывается автоматически) |

Конфигурация: `electron-builder.yml` (секция `mac`), workflow: `.github/workflows/build-macos.yml`.

Подпись отключена через `CSC_IDENTITY_AUTO_DISCOVERY=false` — только для тестовых сборок. В CI используется `--publish never` (артефакты, без Releases).
