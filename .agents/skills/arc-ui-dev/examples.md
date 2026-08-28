# Примеры: ARC UI patterns

## Empty State

```tsx
// ✅ Хорошо
import { EmptyState } from '../components/empty-state';
import { EMPTY_STATE_COPY } from '../content/emptyStates';

<EmptyState
  {...EMPTY_STATE_COPY.libraryEmpty}
  fill
  onPrimaryAction={openImportPicker}
/>

// ❌ Плохо
<div className="arc-page-empty">
  <p className="hint">Пусто</p>
</div>
```

## Tooltip

```tsx
// ✅ Хорошо
<Tooltip content="Добавить в мудборд" delay={500} position="top">
  <button type="button" aria-label="Добавить в мудборд">…</button>
</Tooltip>

// ❌ Плохо
<button type="button" title="Добавить в мудборд">…</button>
```

## Disabled + Tooltip

```tsx
// ✅ Хорошо — hover на disabled не срабатывает нативно
<Tooltip content="Недоступно" delay={500}>
  <span className="arc-tooltip-anchor-inline">
    <button type="button" disabled aria-label="…">…</button>
  </span>
</Tooltip>
```

## Context Menu

```tsx
// ✅ Хорошо — клик по кнопке
<ContextMenu
  open={open}
  anchorRef={anchorRef}
  onClose={() => setOpen(false)}
  ariaLabel="Сортировка"
  rows={rows}
/>

// ✅ Хорошо — ПКМ
const menu = useContextMenuAtPointer();
// … position: { x, y } на ContextMenu

// ❌ Плохо
<div className="selector-dropdown">…</div>
```

## Валидация поля

```tsx
// ✅ Хорошо — только визуальное состояние ошибки
<label className={cn('input-live', emptySubmitted && 'field-error')}>
  <input aria-invalid={emptySubmitted || undefined} />
</label>

// ❌ Плохо
{emptySubmitted && <p className="hint-error">Название не может быть пустым</p>}
```

## Composition (boolean props)

```tsx
// ❌ Плохо — размножение флагов
<Card isMoodboard isSelected isDragging showTags compact />

// ✅ Лучше — явные варианты или compound
<GalleryCardTile variant="moodboard-queue" … />
```

## React perf (renderer)

```tsx
// ✅ Параллельные независимые запросы
const [tags, collections] = await Promise.all([
  api.getTags(),
  api.getCollections()
]);

// ⚠️ Избегать — waterfall без необходимости
const tags = await api.getTags();
const collections = await api.getCollections();
```

## Отчёт пользователю (фрагмент)

```markdown
## Результат
На странице меток при пустом списке скрывается строка поиска; вместо hint-блока показывается Empty State с кнопкой «Создать метку».

## Файлы
- `TagsPage.tsx` — условие `mainSections.length === 0 && !searchQ`
- `emptyStates.ts` — без изменений, использован `tagsEmpty`

## Сверка с макетом (1414:14572)
- Отступы panel `--s-4` — совпало
- Кнопка brand с иконкой плюса — совпало

## Проверка
1. Открыть Метки без данных — нет поиска, есть Empty State
2. Tab до кнопки CTA — focus visible
```
