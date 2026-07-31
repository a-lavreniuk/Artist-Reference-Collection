---
name: arc-anytype-tasks
description: >-
  Picks up AnyType cards with tip_zadachi «Задача» and status «В работе» on the
  unified Таски board for Artist Reference Collection and implements them in the
  ARC repo. Use when the user asks to take a task from «В работе», «возьми
  задачу», «что в работе» (задачи), «задачи из AnyType», «продолжим задачи», or
  starts an ARC session on the task side of the Таски kanban.
---

# ARC — доска Таски / задачи (AnyType)

Единая доска **Таски** (`type_key: task`). Этот skill берёт карточки с **Тип задачи = Задача** (`tip_zadachi`), которые пользователь уже перенёс в колонку **«В работе»**. Статус «В работе» **не выставляет агент** — только пользователь.

Конфиг: [anytype-config.md](../arc-anytype-shared/references/anytype-config.md).  
Баги на той же доске — skill [arc-anytype-bugs](../arc-anytype-bugs/SKILL.md) (`tip_zadachi` = Баг).  
Старт по Cursor-режимам — [anytype-task-take](../anytype-task-take/SKILL.md).

## Перед стартом

1. Проверить MCP `user-anytype` (запрос `API-list-spaces`).
2. Если 401 — напомнить про `~/.cursor/mcp.json` и запущенный AnyType Desktop.
3. Подключить skill `arc-ui-dev` для UI-правок в renderer.

## Workflow: подхват «В работе» (задачи)

```
- [ ] 1. API-search-space: space_id, types: ["task"], limit 100
- [ ] 2. Отфильтровать tip_zadachi === «Задача» И status === «В работе»
- [ ] 3. Если 0 карточек — сообщить и остановиться
- [ ] 4. Если >1 — взять одну (приоритет: last_modified_date desc), остальные перечислить
- [ ] 5. API-get-object (format md) — описание, acceptance criteria
- [ ] 6. Кратко пересказать пользователю и приступить к коду
- [ ] 7. Реализовать в репозитории ARC (минимальный diff)
- [ ] 8. После подтверждения — API-update-object: status → Готово
- [ ] 9. Дописать в markdown блок «Итог» / «Результат»
```

Если пользователь сказал «возьми задачу» без уточнения столбца — всё равно брать только **В работе** + **Тип задачи = Задача**.  
Если сказал «возьми баг» — не этот skill, а **arc-anytype-bugs** / **anytype-task-take** с фильтром Баг.

## Правила

- **Одна активная карточка** за сессию, если пользователь не попросил пачку.
- Не менять статус на «В работе» и не снимать с доски без запроса.
- Не трогать Идея / Задача (бэклог) / Готово, кроме явного триажа.
- Новые задачи создавать с `type_key: "task"` и `tip_zadachi` → Задача.
- UI — токены ARC-2 (`arc-ui-dev`). Commit/push — только по явной просьбе.

## Формат отчёта

1. Карточка (название + object id), Тип задачи = Задача.
2. Что изменилось в приложении.
3. Файлы и проверка.
4. Статус AnyType обновлён или ждёт подтверждения.

## Триггеры (примеры фраз)

- «Возьми задачу» / «возьми задачу из столбца В работе»
- «Что в работе» (про задачи)
- «Продолжим по AnyType» (если речь о задачах)

## Переключение на space ARC2

Шаблон: [anytype-config-arc2.md](../arc-anytype-shared/references/anytype-config-arc2.md).

- `space_id` — из ARC2-конфига.
- Статус: property **`task_status`** (не `status`).
- Фильтр «В работе»: `task_status` → tag «В работе».
- Обновление: `properties: [{ key: "task_status", select: "<tag_id Готово>" }]`.
