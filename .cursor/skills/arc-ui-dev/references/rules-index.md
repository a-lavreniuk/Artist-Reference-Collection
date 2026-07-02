# Индекс rules ARC

Rules в `.cursor/rules/` применяются автоматически. Этот файл — навигация: **когда** перечитать rule целиком.

## Always-applied (все UI-задачи)

| Rule | Суть |
|------|------|
| `ARC-Project.mdc` | Код только в этом репо; адаптировать внешние идеи |
| `Base.mdc` | Токены дизайн-системы; без новых зависимостей |
| `UI-Consistency-Guard.mdc` | Сначала существующий компонент; все состояния; без локальных костылей |
| `Common-Components.mdc` | Единообразие; Electron a11y; tooltip/dnd через общие компоненты |
| `Figma.mdc` | Node Figma; self-check; общий компонент перед локальным |
| `Input-validation-no-inline-errors.mdc` | Ошибка поля = `field-error` / `aria-invalid`, без текста под полем |

## По типу элемента

| Rule | Когда читать |
|------|--------------|
| `EmptyState-ARC.mdc` | Пустые разделы, «не найдено», заглушки in-development |
| `Tooltip-ARC.mdc` | Иконки без подписи, disabled-кнопки, rich-метки |
| `ContextMenu-ARC.mdc` | Dropdown сортировки/сетки/фильтров, ПКМ-меню |
| `TopBar-ARC.mdc` | `ArcTopBar`, window controls, history back/forward |

## Figma nodes (частые)

| Элемент | Node |
|---------|------|
| Tooltip | 28:387 |
| Context Menu | 1168:23372 (строка 771:2110, header 771:2195) |
| Empty State (библиотека) | 1414:13470 |
| Empty State (метки) | 1414:14572 |
| Top Bar | 1225:11377 |

Файл: [ARC-2](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2).

## Code review (не UI-only)

| Skill | Когда |
|-------|-------|
| [arc-code-review](../../arc-code-review/SKILL.md) | PR/diff, main, IPC, storage, perf, Bugbot, Security |
| [arc-ui-dev](../SKILL.md) + [review-template.md](review-template.md) | UI-проход внутри code review или «ревью UI» |

## Иерархия при конфликте

```
ARC rule (.mdc)  >  Figma ARC-2  >  UI-Kit в коде  >  Vercel web-guidelines  >  generic React/AI design
```
