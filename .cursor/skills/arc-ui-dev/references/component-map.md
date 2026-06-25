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
| Настройки | `SettingsPage`, `AiModelCard`, `SettingsCheckboxRow` |

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
