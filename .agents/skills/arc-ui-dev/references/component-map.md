# Карта компонентов ARC

## Общие UI-компоненты

| Импорт | Путь | Назначение |
|--------|------|------------|
| `EmptyState` | `components/empty-state/` | Пустые экраны, CTA brand/outline |
| `Tooltip` | `components/tooltip/Tooltip.tsx` | Подсказки, `position: fixed` |
| `TagTooltipBody` | `components/tooltip/` | Rich tooltip для меток |
| `ContextMenu` | `components/context-menu/` | Меню по клику и ПКМ |
| `Datepicker` | `components/datepicker/` | Выбор даты |
| `Calendar` | `components/calendar/` | Календарь |
| `RangeSlider` | `components/range-slider/` | Слайдер диапазона |
| `MasonryGrid` | `components/masonry/` | Колоночная сетка |
| Button icon split | Классы `btn-icon-split` (+ `--brand` / `--ghost`, `__primary` / `__sep` / `__secondary`) в `arc-ui.css`; демо `ui-kit/UiKitButtonIconSplitDemo.tsx`; production: `NavbarLibrarySwitcher` | Split-кнопка: две половины + stroke в `__sep::before` (Figma 2062:14857). Ghost stroke: `--btn-icon-split-ghost-sep` (Dark: 950/900/850; Light: 100/100/150 по sunken/default/raised). Brand stroke: `--brand-600`. Hover/`is-active` скрывает только stroke. Navbar: Brand на `/gallery`, Ghost иначе |

## Layout и chrome

| Компонент | Путь |
|-----------|------|
| `ArcTopBar` | `components/layout/ArcTopBar.tsx` |
| `NavbarMenu` | `components/layout/NavbarMenu.tsx` — эталон ContextMenu по клику |
| `MessageModal` | `components/layout/MessageModal.tsx` |
| `ScrollToTopButton` | `components/layout/ScrollToTopButton.tsx` |
| `GalleryNavbarFilters` | `components/layout/navbar-filters/` |

## Доменные блоки

| Область | Ключевые файлы |
|---------|----------------|
| Галерея | `GalleryBoard`, `GalleryCardTile`, `CardInspectModal`, `useGalleryCardContextMenu` |
| Метки | `TagsPage`, `CategoryPanel`, `TagSettingsModal`, `useTagCategoryContextMenu` |
| Коллекции | `CollectionGalleryCard`, `LibraryCollectionsStrip`, `CollectionSettingsModal` |
| Мудборд | `MoodboardBoardView`, `MoodboardKonvaStage`, `useMoodboardQueueContextMenu` |
| Импорт | `ImportContext`, `SourceFilesModal`, `AutoImportHost` |
| Настройки | `SettingsPage`, `AiModelCard`, `SettingsOptionCard`, `SettingsCheckboxRow` |

## Хуки (повторное использование)

| Хук | Путь |
|-----|------|
| `useContextMenuAtPointer` | `hooks/useContextMenuAtPointer.ts` |
| `useResetGallerySearch` | `hooks/useResetGallerySearch.ts` |
| `hydrateArcNavbarIcons` | `components/layout/navbarIconHydrate.ts` |

## Контент и стили

| Ресурс | Путь |
|--------|------|
| Empty state copy | `renderer/src/content/emptyStates.ts` |
| Design tokens / компоненты CSS | `renderer/public/ui/arc-ui/arc-ui.css` |
| Доп. стили приложения | `renderer/src/styles/index.css` |
| UI-Kit (эталон контролов) | `renderer/src/ui-kit/arcUiKitMain.html`, `UiKitPage.tsx` |
| UI-Kit product patterns | `UiKitProductPatternsDemo.tsx` — Empty State, Tooltip, Datepicker/Calendar, Sidebar row, Settings option/AI cards |
| Navbar CSS | `renderer/public/ui/arc-navbar.css` |

## Эталонные страницы

| Страница | Файл |
|----------|------|
| Библиотека | `pages/GalleryPage.tsx` |
| Метки | `pages/TagsPage.tsx` |
| Коллекции | `pages/CollectionsPage.tsx` |
| Настройки (панель) | `pages/SettingsNavbarPanelPage.tsx` |
| Мудборд | `pages/MoodboardPage.tsx` |

## Антипаттерны (не создавать)

- `.arc-page-empty` с одним `<p className="hint">`
- `.selector-dropdown`, `.arc-gallery-sort-menu` — локальные меню
- `title="..."` на кнопках вместо `Tooltip`
- `hint-error`, `input-inline-error` при валидации поля
- Хардкод цветов/отступов вне токенов
- Новый вариант кнопки/инпута без расширения `btn-ds` / `input-live`
