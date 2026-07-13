---
name: arc-ui-dev
description: >-
  Guides UI development, review, and refactoring in Artist Reference Collection
  (ARC) — Electron desktop app with React renderer and ARC-2 design system. Use
  whenever the user works on renderer UI, React components, CSS, Figma
  implementation, empty states, tooltips, context menus, forms, modals, gallery,
  tags, collections, moodboard, settings, or says "по макету", "ARC", "дизайн",
  "кнопка", "модалка", "empty state", "tooltip", "меню", even if they do not
  mention skills or rules explicitly.
---

# ARC UI Development

Skill для разработки и ревью UI в репозитории **Artist Reference Collection**. Дополняет always-applied rules в `.cursor/rules/` — не заменяет их. При конфликте **ARC rules и Figma важнее** generic web/React guidelines.

## Стек и границы

| Слой | Путь / технология |
|------|-------------------|
| Desktop shell | Electron (`main/`, `preload/`) |
| UI | React 19 + Vite (`renderer/`) |
| Стили | `renderer/public/ui/arc-ui/arc-ui.css`, `renderer/src/styles/index.css` |
| Дизайн-система | ARC-2 (Figma), UI-Kit: `renderer/src/ui-kit/` |
| Маршруты / страницы | `renderer/src/pages/` |

**Не применять без запроса:** Next.js-паттерны, Vercel deploy, React Native, «креативный» frontend-design с произвольной палитрой, новые npm-зависимости.

## Приоритет источников

1. `.cursor/rules/*.mdc` — обязательные ограничения (см. [rules-index.md](references/rules-index.md)); для контролов — **`UI-Kit-DS-Guard.mdc`**
2. Макет Figma ARC-2 — конкретный node для задачи
3. UI-Kit в приложении (`renderer/src/ui-kit/arcUiKitMain.html`, `UiKitPage.tsx`)
4. Эталонные экраны в коде (см. [component-map.md](references/component-map.md))
5. Общие практики React (composition, perf) — только если не противоречат п.1–4

## Workflow: перед правками

**Обязательно:** правило `UI-Kit-DS-Guard.mdc` — gate + карта элементов.

```
- [ ] 1. Понять задачу на языке UI (что видит пользователь)
- [ ] 2. Найти существующий компонент / паттерн (grep + component-map)
- [ ] 3. Уточнить Figma node, если макет не указан
- [ ] 4. Зафиксировать, что должно совпасть: отступы, типографика, состояния
- [ ] 5. Оценить: расширить общий компонент или локальная правка
- [ ] 6. Если меняется общий компонент — проверить влияние на другие экраны
- [ ] 7. Если нужен новый `arc-icon-*`, а файла нет в `renderer/public/ui/icons/` — подключить skill `arc-figma-icons`
```

### Поиск перед созданием

Перед новым UI-элементом:

1. `renderer/src/components/` — общие компоненты
2. Похожие страницы в `renderer/src/pages/`
3. Классы в `arc-ui.css` / `index.css` — не дублировать локально
4. Тексты empty state — только `renderer/src/content/emptyStates.ts`

**Запрещено:** копировать стили «как есть», локальные dropdown/tooltip/empty-state, хардкод `#hex` и произвольных `px`/`ms` при наличии токена.

## Workflow: реализация

### Общие компоненты (обязательный выбор)

| Задача | Компонент / хук |
|--------|-----------------|
| Пустой раздел / не найдено | `EmptyState` + `EMPTY_STATE_COPY` |
| Подсказка на иконке | `Tooltip` (`renderer/src/components/tooltip/`) |
| Rich-подсказка метки | `TagTooltipBody`, `variant="rich"` |
| Disabled + tooltip | обёртка `<span className="arc-tooltip-anchor-inline">` |
| Меню по клику / ПКМ | `ContextMenu` + `useContextMenuAtPointer` |
| Модалка подтверждения | `MessageModal` и существующие modal-паттерны |
| Сброс поиска галереи | `useResetGallerySearch()` |
| Иконки navbar | `hydrateArcNavbarIcons`, `arc-icon-*` |
| Иконка отсутствует в проекте | skill [`arc-figma-icons`](../arc-figma-icons/SKILL.md) — выгрузка из Figma (variant, Weight=1) |
| Сетка карточек | `MasonryGrid`, `GalleryBoard` |
| Валидация поля | `field-error` + `aria-invalid`, **без** текста под полем |

Детальная карта: [component-map.md](references/component-map.md).  
Синхронизация Knowledge Base с chrome UI: [kb-chrome-contract.md](references/kb-chrome-contract.md).

### Паттерны композиции (из Vercel composition-patterns, адаптировано)

- Не размножать boolean props (`isX`, `showY`) — variant-компоненты или compound components
- Состояние меню/модалки — в provider или родителе страницы, не в листовых tile
- Расширять API общего компонента вместо форка стилей
- Не объявлять компоненты внутри render другого компонента

### React perf (renderer, без Next.js)

Применять по необходимости, не в ущерб читаемости:

- Независимые async-операции — `Promise.all`
- Тяжёлые списки — `content-visibility`, виртуализация через существующие feed-хуки
- Дорогой derived state — вычислять в render, не в лишних `useEffect`
- Стабильные колбэки — `useCallback` / functional `setState` только где есть измеримая проблема
- Прямые импорты вместо barrel-файлов для тяжёлых модулей

### Electron-ограничения

- Не ломать выделение текста и нативный ввод
- Сохранять `focus`, `cursor`, `pointer-events` для a11y
- Drag окна: `-webkit-app-region` только в топбаре; кнопки — `arc-navbar-no-drag`
- DnD — только через общие компоненты/хуки проекта

### Токены и переходы

Только системные: `--s-*`, `--brand-*`, `--typo-*`, `--transition-fast|base|slow`. Transitions: 150 / 250 / 350 ms.

## Workflow: перед завершением

```
- [ ] hover / focus / disabled / error / loading — где применимо
- [ ] Клавиатура: Tab, Enter, Escape для модалок и меню
- [ ] Tooltip: delay 500 ms (rich — до 1000 ms), не выходит за viewport
- [ ] Context menu: portal, backdrop, Escape, ширина 250px
- [ ] Empty state: без точки в заголовке/подзаголовке, copy из emptyStates.ts
- [ ] Нет локальных стилей, дублирующих arc-ui
- [ ] Нет title= на кнопках вместо Tooltip
- [ ] Нет hint-error под полем при field-level валидации
- [ ] Отчёт: что изменилось в UI → технические детали → сверка с макетом
```

Полный чеклист ревью: [review-template.md](references/review-template.md).

## Figma

- Для каждой UI-задачи — **конкретный node** ARC-2
- Нет ссылки на макет → спросить пользователя
- Неоднозначность макета → уточнить, не додумывать
- Расхождение: сначала общий компонент, потом страница
- Для Figma MCP: skills `figma-use`, `figma-generate-design` из плагина

Файл дизайна: `JD3pZdlV4Sz62creRMQsJV` (ARC-2).

## Специфика разделов ARC

| Раздел | Эталон | Особенности |
|--------|--------|-------------|
| Библиотека | `GalleryPage.tsx` | Фильтры, masonry, context menu карточки |
| Метки | `TagsPage.tsx` | Скрыть поиск при пустом main; nested empty state |
| Коллекции | `CollectionsPage.tsx` | Sidebar + strip |
| Настройки | `SettingsNavbarPanelPage.tsx` | Панели, флаг in-development |
| Мудборд | `MoodboardPage.tsx` | Konva stage, queue context menu |
| UI-Kit | `UiKitPage.tsx` | Источник правды для контролов |

Раздел «в разработке»: `EmptyState` с `fill`, copy `inDevelopment*` из `emptyStates.ts`, в меню — суффикс «— в разработке».

## Формат ответа агенту (для пользователя)

1. **Результат в UI** — что изменилось визуально и в поведении
2. **Технические детали** — файлы и суть правок
3. **Сверка с макетом** — совпало / не совпало / почему
4. **Проверка** — пошагово, что кликнуть
5. **Следующий шаг** — если есть неопределённость

Язык отчётов: русский, деловой тон, без эмодзи.

## UI-ревью по запросу

Когда пользователь просит ревью UI / a11y / UX:

1. Прочитать [rules-index.md](references/rules-index.md)
2. Пройти [review-template.md](references/review-template.md)
3. Опционально: сверить с Web Interface Guidelines (Vercel) — **только** там, где нет ARC rule; findings в формате `file:line — issue`
4. Generic `frontend-design` (Anthropic) **не** использовать для ARC — есть фиксированная дизайн-система

## Code review (PR / diff)

**UI-часть ревью** — этот skill + [review-template.md](references/review-template.md).

**Полное ревью PR** (main, IPC, storage, perf, Bugbot, Security) — делегировать в [arc-code-review](../arc-code-review/SKILL.md). Не дублировать чеклисты IPC/security/perf здесь.

Триггеры: «code review», «ревью PR», «проверь diff», перед merge.

## Примеры

См. [examples.md](examples.md).

## Связанные rules (always-applied)

Полный индекс с glob-правилами: [references/rules-index.md](references/rules-index.md).

При UI-задачах дополнительно читать по теме:

- `EmptyState-ARC.mdc`, `Tooltip-ARC.mdc`, `ContextMenu-ARC.mdc` — при соответствующих элементах
- `TopBar-ARC.mdc` — только для `ArcTopBar.tsx` / top bar
- `Input-validation-no-inline-errors.mdc` — формы и модалки
