---
name: arc-anytype-tasks
description: >-
  Picks up AnyType task cards in status «В работе» for Artist Reference
  Collection and implements them in the ARC repo. Use when the user asks to take
  tasks from AnyType, work on the task board, «что в работе», «задачи из
  AnyType», «продолжим задачи», or starts an ARC dev session tied to the
  AnyType task kanban.
---

# ARC — доска Задач (AnyType)

Агент **берёт в работу** карточки типа **Задача** (`task`), которые пользователь уже перенёс в колонку **«В работе»** на доске AnyType. Статус «В работе» **не выставляет агент** — только пользователь.

Конфиг space, type keys и tag id: [anytype-config.md](../arc-anytype-shared/references/anytype-config.md).

## Перед стартом

1. Проверить MCP `user-anytype` (запрос `API-list-spaces`).
2. Если 401 — напомнить про `~/.cursor/mcp.json` и запущенный AnyType Desktop.
3. Подключить skill `arc-ui-dev` для UI-правок в renderer.

## Workflow: подхват «В работе»

```
- [ ] 1. API-search-space: space_id, types: ["task"], limit 100
- [ ] 2. Отфильтровать status «В работе»
- [ ] 3. Если 0 карточек — сообщить и остановиться
- [ ] 4. Если >1 — взять одну (приоритет: по last_modified_date desc), остальные перечислить
- [ ] 5. API-get-object (format md) — прочитать описание, acceptance criteria
- [ ] 6. Кратко пересказать задачу пользователю и приступить к коду
- [ ] 7. Реализовать в репозитории ARC (минимальный diff)
- [ ] 8. После подтверждения пользователя — API-update-object: status → Готово
- [ ] 9. Дописать в markdown карточки блок «Итог» (что сделано, файлы, как проверить)
```

## Правила

- **Одна активная задача** за сессию, если пользователь не попросил пачку.
- Не менять статус на «В работе» и не снимать с доски без запроса.
- Не трогать карточки со статусами Идея / Задача / Готово, кроме явного триажа.
- UI — только токены ARC-2 и общие компоненты (skill `arc-ui-dev`).
- Commit/push — только по явной просьбе пользователя.

## Формат отчёта

1. Какая карточка взята (название + object id).
2. Что изменилось в приложении.
3. Файлы и проверка.
4. Статус в AnyType обновлён или ждёт подтверждения.

## Триггеры (примеры фраз)

- «Возьми задачи из AnyType»
- «Что в работе на доске задач?»
- «Продолжим по AnyType»

## Переключение на space ARC2

Шаблон канала: [anytype-config-arc2.md](../arc-anytype-shared/references/anytype-config-arc2.md).

- `space_id` — из ARC2-конфига.
- Статус задачи: property **`task_status`** (не `status`).
- Фильтр «В работе»: `task_status` → tag «В работе».
- При обновлении карточки: `properties: [{ key: "task_status", select: "<tag_id Готово>" }]`.
