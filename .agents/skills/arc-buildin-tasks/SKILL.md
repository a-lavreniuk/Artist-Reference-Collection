---
name: arc-buildin-tasks
description: >-
  Picks up Buildin cards with Тип задачи «Задача» and status «В работе» on the
  Таски database for Artist Reference Collection and implements them in the ARC
  repo. Use when the user asks to take a task from «В работе», «возьми задачу»,
  «что в работе» (задачи), «задачи из Buildin», «продолжим задачи», or starts an
  ARC session on the task side of the Таски kanban.
---

# ARC — доска Таски / задачи (Buildin)

Доска **Таски** (Buildin database). Этот skill берёт карточки с **Тип задачи = Задача**, которые пользователь уже перенёс в колонку **«В работе»**. Статус «В работе» **не выставляет агент** — только пользователь.

Конфиг: [buildin-config.md](../arc-buildin-shared/references/buildin-config.md).  
Формат тела: [task-card-format.md](../arc-buildin-shared/references/task-card-format.md).  
Баги — [arc-buildin-bugs](../arc-buildin-bugs/SKILL.md).  
Старт по Codex — [buildin-task-take](../buildin-task-take/SKILL.md).  
Закрытие — [buildin-task-finish](../buildin-task-finish/SKILL.md).

## Перед стартом

1. `buildin --json doctor` / `whoami` (auth OK).
2. При сбое auth — предложить login / token, не продолжать запись.
3. Для UI-правок подключить skill `arc-ui-dev`.

## Workflow: подхват «В работе» (задачи)

```
- [ ] 1. database query: Статус=В работе AND Тип задачи=Задача
- [ ] 2. Если 0 — сообщить и остановиться
- [ ] 3. Если >1 — взять одну (приоритет: last_edited_time desc), остальные перечислить
- [ ] 4. page get + block children — секция Описание
- [ ] 5. Кратко пересказать и приступить (или buildin-task-take по Codex)
- [ ] 6. Реализовать в репозитории ARC (минимальный diff)
- [ ] 7. После подтверждения — buildin-task-finish (только «Что сделано» + Статус Готово)
```

Если пользователь сказал «возьми задачу» без уточнения столбца — всё равно брать только **В работе** + **Задача**.  
Если сказал «возьми баг» — **arc-buildin-bugs** / **buildin-task-take** с фильтром Баг.

## Правила

- **Одна активная карточка** за сессию, если пользователь не попросил пачку.
- Не менять статус на «В работе» и не снимать с доски без запроса.
- Не трогать Бэклог / Готово к работе / Готово, кроме явного триажа.
- Новые задачи: `page create` в database Таски с `Тип задачи` → Задача и телом по task-card-format.
- UI — токены ARC-2 (`arc-ui-dev`). Commit/push — только по явной просьбе.

## Формат отчёта

1. Карточка (название + page id / url), Тип задачи = Задача.
2. Что изменилось в приложении.
3. Файлы и проверка.
4. Статус Buildin / секция «Что сделано» обновлены или ждут подтверждения.

## Триггеры (примеры фраз)

- «Возьми задачу» / «возьми задачу из столбца В работе»
- «Что в работе» (про задачи)
- «Продолжим по Buildin» / «продолжим задачи»
