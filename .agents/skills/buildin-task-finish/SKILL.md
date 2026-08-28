---
name: buildin-task-finish
description: >-
  Закрывает карточку на доске Таски в Buildin: статус «Готово», секция
  «Что сделано» (блоки heading_1 + divider). Создаёт карточку для задач из чата.
  Use after git-task-finish or when the user says «закрой задачу», «заверши
  задачу» and work is done.
---

# Закрыть задачу / баг в Buildin

Финальный шаг после **git-task-finish** (или вместо него, если git не нужен): обновить или создать карточку на доске **Таски**.

CLI: `buildin`.  
Конфиг: [buildin-config.md](../arc-buildin-shared/references/buildin-config.md).  
Формат тела: [task-card-format.md](../arc-buildin-shared/references/task-card-format.md).

## Когда выполнять

| Ситуация | Действие |
|----------|----------|
| Git-финал прошёл успешно | Обновить / создать карточку Buildin |
| Git не требовался (только skills/docs) | Обновить / создать карточку Buildin |
| Git остановлен (тесты, конфликт, critical review) | Buildin **не трогать**, сообщить |
| Незавершённая работа, но пользователь закрывает | «Готово» + в «Что сделано» явно что осталось |

## 1. Определить карточку

1. **`buildin_page_id` из сессии** (**buildin-task-take**) → сценарий A.
2. **Нет `page_id`** — работа из чата → сценарий B (создать).
3. **`page_id` потерян**, но карточка в Buildin → спросить. **Не угадывать**.

## 2A. Готовая карточка — только «Что сделано»

1. Preflight: `buildin --json doctor` / `whoami`.
2. `buildin --json block children <page_id>` — понять текущую структуру.
3. Описание пользователя **не менять**.
4. Если уже есть каноническое «Что сделано» или неоднозначный legacy — спросить, не дублировать.
5. Иначе `buildin --json block append <page_id> --body append.json`:

```json
{
  "children": [
    {
      "type": "heading_1",
      "heading_1": {
        "rich_text": [{ "type": "text", "text": { "content": "Что сделано" } }]
      }
    },
    { "type": "divider", "divider": {} },
    {
      "type": "paragraph",
      "paragraph": {
        "rich_text": [{ "type": "text", "text": { "content": "<свободный текст; опционально несколько paragraph / heading_3>" } }]
      }
    }
  ]
}
```

Длинный текст дробить на несколько `paragraph` / `heading_3` в том же `children`.  
**Не** ставить текстовый `---`. **Не** использовать `markdown put` для секций.

6. Статус → Готово (п. 3).

## 2B. Работа из чата — полная карточка

1. Спросить **Тип задачи:** Задача или Баг.
2. **Название** — 3–4 слова по сути.
3. `page create` с `parent.database_id` Таски, свойствами и **`children`** полного шаблона (см. task-card-format):

- `heading_1` «Описание» → `divider` → текст из запроса чата  
- `heading_1` «Что сделано» → `divider` → итог работы  

4. `Статус` → `Готово`; `Source` — url если был; **Codex не заполнять**.

## 3. Обновить статус

```json
{
  "properties": {
    "Статус": { "select": { "name": "Готово" } }
  }
}
```

`buildin --json page update <page_id> --body patch.json`

**Не менять:** Codex, Source, `Тип задачи`, название (кроме create).

Перед записью — write-safety (цель + краткое резюме изменений в карточке).

## 4. Отчёт пользователю

- название + `https://buildin.ai/<page_id>`;
- Тип задачи;
- статус «Готово»;
- кратко содержание «Что сделано».

## 5. Связка

- Старт — **buildin-task-take**.
- Git — **git-task-finish** до этого skill.
- Порядок «закрой задачу»: git-task-finish → buildin-task-finish.
