---
name: arc-figma-icons
description: >-
  Выгрузка variant-иконок из Figma-файла «Иконки» в ARC: только Weight=1,
  один размер под задачу, сохранение в renderer/public/ui/icons/ и регистрация
  в navbarIconHydrate.ts. Use when a UI task needs arc-icon-* that is missing
  locally, when the user says «выгрузи иконку», «добавь иконку из Figma», or
  during arc-ui-dev work when the required glyph is not in the project.
---

# ARC — иконки из Figma

Skill для **выгрузки и подключения** иконок из отдельного Figma-файла [Иконки](https://www.figma.com/design/5JAgNwVUnPOVXLfewWMbGP/%D0%98%D0%BA%D0%BE%D0%BD%D0%BA%D0%B8) в репозиторий ARC. Дополняет `arc-ui-dev` и `UI-Kit-DS-Guard.mdc`.

## Источник правды

| Что | Где |
|-----|-----|
| Figma-файл | `fileKey: 5JAgNwVUnPOVXLfewWMbGP` — см. [figma-file.md](references/figma-file.md) |
| Каталог тем | [icon-themes.json](references/icon-themes.json) |
| Синонимы поиска | [icon-synonyms.json](references/icon-synonyms.json) |
| Размеры | [size-map.md](references/size-map.md) |
| Регистрация в коде | [registration.md](references/registration.md) |
| SVG в проекте | `renderer/public/ui/icons/{name}_{size}.svg` |
| Hydration | `renderer/src/components/layout/navbarIconHydrate.ts` |

## Правила Figma (обязательные)

1. **Только variant-компоненты** — `frame` с несколькими дочерними `symbol` (пример: [arrow-up, node 112:8](https://www.figma.com/design/5JAgNwVUnPOVXLfewWMbGP/%D0%98%D0%BA%D0%BE%D0%BD%D0%BA%D0%B8?node-id=112-8)).
2. **Только `Weight=1`** — не `Weight=2`, не `Weight=Fill`.
3. **Single-symbol без variant** — не использовать; сообщить пользователю: «иконку нужно перевести в variant в Figma».
4. **Один размер за раз** — под текущую UI-задачу, не все четыре сразу.
5. **Существующие SVG не перезаписывать** — если файл уже есть в `icons/`, пропустить экспорт.

## Триггеры

- **Автоматически:** UI-задача требует `arc-icon-*`, а файла или регистрации в `navbarIconHydrate.ts` нет.
- **Явно:** «выгрузи иконку», «добавь pin из Figma», «нужна иконка highlighter».

## Workflow (7 шагов)

### 1. Определить имя и размер

| Поле | Правило |
|------|---------|
| Имя файла | kebab-case как `frame.name` в Figma: `pin-off`, `flip-horizontal` |
| CSS-класс | `arc-icon-{kebab}` |
| IconKey (TS) | camelCase: `pinOff`, `flipHorizontal` |
| Размер файла | см. [size-map.md](references/size-map.md) |

**Выбор размера для выгрузки (приоритет):**

1. Явный размер в макете/задаче (16px → `_m`, 24px → `_l`, 12px → `_s`, 32px → `_xl`).
2. Контекст кнопки: `data-btn-size` / `data-arc-icon-size` на ближайшем предке.
3. Fallback: `_m` (16px).

### 2. Проверить локально

```
renderer/public/ui/icons/{name}_{size}.svg
```

- Файл **есть** → не экспортировать из Figma.
- Файл есть, но нет в `navbarIconHydrate.ts` → перейти к шагу 6 (только регистрация).
- Файла нет → шаг 3.

Проверить наличие класса в `ICON_SELECTOR` и ключа в `ICON_FILES` через grep по `navbarIconHydrate.ts`.

### 3. Найти в Figma (гибридный каталог)

1. Прочитать [icon-themes.json](references/icon-themes.json).
2. Выбрать тему по `keywords` или перебором тем.
3. Если иконка не найдена — обновить каталог (см. **Обновление каталога тем** ниже).
4. `get_metadata` на `nodeId` темы → fuzzy-поиск `frame` по имени.
5. Учесть [icon-synonyms.json](references/icon-synonyms.json).
6. При нескольких кандидатах — показать 2–3 варианта с `nodeId`; при необходимости `get_screenshot` для сверки.

**Fuzzy-поиск:** нормализовать к kebab-case, сравнивать точное совпадение, префикс/суффикс (`pin` ↔ `pin-off`), синонимы.

### 4. Валидировать variant

Внутри найденного `frame`:

- Должны быть `symbol` с именем `Size={N}, Weight=1`.
- Если только один `symbol` на canvas без variant-frame → **стоп**, отчёт пользователю.
- Если нет нужного `Size` с `Weight=1` → сообщить доступные размеры; предложить ближайший или ждать правки в Figma.

Записать `nodeId` конкретного symbol, например `855:98` для `Size=16, Weight=1`.

### 5. Экспорт через Figma MCP

Перед вызовом MCP: skill `figma-use` (если доступен).

```
download_assets:
  fileKey: 5JAgNwVUnPOVXLfewWMbGP
  nodeId: <symbol nodeId>
  defaultFormat: svg
```

Сразу скачать временный URL:

```bash
curl -L -o "renderer/public/ui/icons/{name}_{size}.svg" "<asset-url>"
```

**Проверка после скачивания:**

- Начинается с `<svg`.
- `width`/`height` или `viewBox` соответствуют ожидаемому px.
- Не менять `stroke`/`fill` вручную — `normalizeSvgForTokens()` в hydrate заменит white → `currentColor`.

**Постобработка (если Figma отдал артефакты превью):**

Иногда `download_assets` включает фон `#E8E8E8`, пунктирную рамку variant-set или `stroke="black"`. Тогда:

1. Оставить только `<path>` (и при необходимости `<g clip-path>`) внутри `viewBox` иконки.
2. Удалить preview-`rect`, dashed stroke, лишние `g id="Size=…"`.
3. Заменить `stroke="black"` → `stroke="white"` (как в существующих `icons/*.svg`).
4. Сверить с эталоном соседней иконки той же темы (`eraser_m.svg`, `pencil_m.svg`).

### 6. Регистрация в коде

Следовать [registration.md](references/registration.md):

- `IconKey` union
- `ICON_FILES`
- `ICON_CLASS_TO_KEY`
- `ICON_SELECTOR`

**CSS:** отдельных правил `.arc-icon-*` в `arc-ui.css` не нужно. Mask-паттерн `.arc-icon` + `--arc-icon-url` — только если явно требуется в задаче (редко).

### 7. Отчёт пользователю

- Что выгружено / пропущено / почему.
- Figma node (frame + symbol) для сверки.
- Использование в JSX:

```tsx
<span className="btn-icon-only__glyph arc-icon-{name}" aria-hidden="true" />
```

- Для icon-only кнопок: `Tooltip` + `aria-label` по правилам ARC.

## Обновление каталога тем

Когда иконка не найдена в [icon-themes.json](references/icon-themes.json):

1. `get_metadata` без `nodeId` → список top-level pages.
2. Для каждой page: `get_metadata` с `nodeId` page → собрать дочерние `canvas` (имя = тема).
3. Для каждого canvas: собрать имена variant-`frame` → `keywords`.
4. Обновить `icon-themes.json`: `updatedAt`, массив `themes[]`.
5. Не дублировать темы с одинаковым `nodeId`.

## Запреты

- Не подставлять иконки из Lucide, Heroicons и других наборов «на глаз».
- Не экспортировать `Weight=2` или `Weight=Fill`.
- Не перезаписывать существующие SVG.
- Не добавлять локальные `__icon` / `__glyph` стили на страницах.
- Не использовать `title=` вместо `Tooltip`.

## Связь с arc-ui-dev

При UI-задаче с новым `arc-icon-*` сначала `arc-ui-dev` (gate + DS), затем этот skill при отсутствии файла/регистрации.

## Пример: highlighter

1. Имя: `highlighter`, размер `_m` (16px, кнопка `data-btn-size="m"`).
2. Локально: `highlighter_m.svg` отсутствует.
3. Тема Edit (`872:65`) → frame `highlighter` (`532:463`).
4. Symbol `Size=16, Weight=1` → node из metadata.
5. `download_assets` → сохранить SVG.
6. Зарегистрировать `highlighter` в `navbarIconHydrate.ts`.
7. В UI: `arc-icon-highlighter`.
