# Индекс rules ARC

Rules в `.cursor/rules/` применяются автоматически (alwaysApply или по globs). Этот файл — навигация: **когда** перечитать rule целиком.

## Always-applied (все задачи)

| Rule | Суть |
|------|------|
| `Base.mdc` | Токены; границы репо; без новых зависимостей; не плодить одноразовые UI-варианты |
| `UI-Kit-DS-Guard.mdc` | Gate перед разметкой; карта контролов; Figma-классы дословно; Electron a11y |
| `Critical-UX-Regression-Check.mdc` | Перед сдачей: `verify:renderer-ui` + `npm test`; дата / UI / деталка |

## По globs (когда открыты matching-файлы)

| Rule | Когда читать |
|------|--------------|
| `EmptyState-ARC.mdc` | Пустые разделы, «не найдено», заглушки in-development |
| `Tooltip-ARC.mdc` | Иконки без подписи, disabled-кнопки, rich-метки |
| `ContextMenu-ARC.mdc` | Dropdown сортировки/сетки/фильтров, ПКМ-меню |
| `TopBar-ARC.mdc` | `ArcTopBar`, window controls, history back/forward |
| `Scroll-clip-ARC.mdc` | Внутренний скролл panel/sidebar/modal: клип flush к рамке |
| `Input-validation-no-inline-errors.mdc` | Валидация полей: `field-error` / `aria-invalid`, без текста под инпутом |

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
