---
name: arc-anytype-tasks
description: >-
  Implements ARC tasks from the Таски board (now in Buildin). Prefer
  buildin-task-take for «возьми задачу». Use when the user asks about tasks in
  «В работе», «что в работе» (задачи), «продолжим задачи», or related task-board
  work. Legacy AnyType mentions still trigger this skill as a pointer.
---

# ARC — доска Таски / задачи

Единая доска **Таски** живёт в **Buildin** (database). Старт по Cursor — **buildin-task-take**. Этот skill — ориентир по правилам работы с задачами (Тип задачи = Задача); чтение карточек «В работе» — через Buildin MCP, не AnyType.

Конфиг Buildin: [buildin-ids.md](../buildin-task-finish/references/buildin-ids.md).  
Баги на той же доске — skill [arc-anytype-bugs](../arc-anytype-bugs/SKILL.md) + старт [buildin-task-take](../buildin-task-take/SKILL.md).  
Legacy AnyType-конфиг (архив): [anytype-config.md](../arc-anytype-shared/references/anytype-config.md).

## Перед стартом

1. Проверить MCP `user-buildin` (`API-getMe`).
2. Если 401 — Connect / OAuth в Cursor Settings → Tools & MCP.
3. Подключить skill `arc-ui-dev` для UI-правок в renderer.
4. Для «возьми задачу» / Cursor-режимов — сразу **buildin-task-take**.

## Workflow: подхват «В работе» (задачи)

Полный алгоритм чтения и режимов Cursor — в [buildin-task-take](../buildin-task-take/SKILL.md). Кратко:

```
- [ ] 1. API-queryDatabase (Таски): Статус = «В работе», Тип задачи = «Задача»
- [ ] 2. Если 0 карточек — сообщить и остановиться
- [ ] 3. Если >1 — спросить или взять одну; остальные перечислить
- [ ] 4. API-getMarkdown — описание, acceptance criteria
- [ ] 5. Кратко пересказать пользователю и следовать Cursor (ветка/план/хотфикс)
- [ ] 6. Реализовать в репозитории ARC (минимальный diff)
- [ ] 7. После подтверждения — buildin-task-finish: статус → Готово + «Результат»
```

## Правила

- **Одна активная карточка** за сессию, если пользователь не попросил пачку.
- Не менять статус на «В работе» и не снимать с доски без запроса.
- Не трогать Бэклог / Готово к работе / Готово, кроме явного триажа.
- Новые задачи создавать в database Таски (Buildin): `Тип задачи` → Задача.
- UI — токены ARC-2 (`arc-ui-dev`). Commit/push — только по явной просьбе.

## Формат отчёта

1. Карточка (название + `buildin_page_id`), Тип задачи = Задача.
2. Что изменилось в приложении.
3. Файлы и проверка.
4. Статус Buildin обновлён или ждёт подтверждения.

## Триггеры (примеры фраз)

- «Возьми задачу» / «возьми задачу из столбца В работе»
- «Что в работе» (про задачи)
- «Продолжим по Buildin» / «задачи из Buildin»

## Переключение на space ARC2

Шаблон ARC2 в AnyType устарел для Таски; актуальная доска — Buildin ([buildin-ids.md](../buildin-task-finish/references/buildin-ids.md)).
Legacy: [anytype-config-arc2.md](../arc-anytype-shared/references/anytype-config-arc2.md).
