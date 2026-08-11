# Buildin — ARC workspace (конфиг)

CLI: `buildin` (skill [buildin-cli](../../../.agents/skills/buildin-cli/SKILL.md)).  
Workspace: **ARC**. Auth: `buildin --json doctor` / `buildin --json whoami` перед записью.

Трекер задач проекта — только Buildin (доска Таски). Не печатать токены.

## Идентификаторы

| Ключ | Значение |
|------|----------|
| `workspace_id` | `5d5a5e29-1753-4379-8bf5-f6d5eb0d9fb3` |
| `workspace_name` | ARC |
| Database **Таски** `database_id` | `56b5b380-8a79-4939-a188-1742d8862761` |
| URL доски | https://buildin.ai/56b5b380-8a79-4939-a188-1742d8862761 |

## Свойства database «Таски»

Ключи в API — **display names** (как в getDatabase).

| Свойство | Тип | Option names |
|----------|-----|--------------|
| `Название` | title | — |
| `Статус` | select | `Бэклог`, `Готово к работе`, `В работе`, `Готово` |
| `Тип задачи` | select | `Задача`, `Баг` |
| `Cursor` | multi_select | `Нужна ветка`, `Нужен план`, `Хотфикс` |
| `Source` | url | — |
| `Приоритет` | select | `Максимальный`, `Средний`, `Минимальный` |

### Option IDs (если нужен `id` вместо `name`)

| Поле | Option | id |
|------|--------|-----|
| Статус | Бэклог | `152cd80e-cd70-49cf-af15-aba48d9e0efb` |
| Статус | Готово к работе | `544d0dde-8331-4ced-b5db-5ad8debe9ec0` |
| Статус | В работе | `331f5a2e-5119-4939-bfe8-8ac8838ff455` |
| Статус | Готово | `db25c591-c4b3-4441-ab1f-cba54c2e9249` |
| Тип задачи | Задача | `352f8785-05e5-4670-a7e8-7e4374e4e18a` |
| Тип задачи | Баг | `a8b8e356-fb96-4421-81f0-728abb124460` |
| Cursor | Нужна ветка | `d7cbe456-52f8-4840-bef9-7c210629c28b` |
| Cursor | Нужен план | `eda24b52-b2cd-4c36-b615-56c84b92c43d` |
| Cursor | Хотфикс | `ea723c7a-b2b3-4375-99b1-d9b251885c8e` |

## Типовые команды

```bash
# Preflight
buildin --json doctor
buildin --json whoami

# Карточки «В работе» + тип
buildin --json database query 56b5b380-8a79-4939-a188-1742d8862761 --body query.json

# Страница и блоки тела
buildin --json page get <page_id>
buildin --json block children <page_id>
buildin --json block append <page_id> --body append.json
buildin --json page update <page_id> --body patch.json
buildin --json page create --body page.json
# markdown get — только для чтения legacy; не использовать markdown put для секций/сепараторов
buildin markdown get <page_id>
```

Формат тела карточки (Описание / Что сделано, блок `divider`): [task-card-format.md](./task-card-format.md).

### `query.json` — «В работе» + «Задача»

```json
{
  "filter": {
    "and": [
      { "property": "Статус", "select": { "equals": "В работе" } },
      { "property": "Тип задачи", "select": { "equals": "Задача" } }
    ]
  },
  "page_size": 50
}
```

Для багов замени `"Задача"` → `"Баг"`.

### `patch.json` — только статус «Готово»

```json
{
  "properties": {
    "Статус": { "select": { "name": "Готово" } }
  }
}
```

### `page.json` — создать карточку в «Таски»

Минимум свойств (тело — в `children` по [task-card-format.md](./task-card-format.md)):

```json
{
  "parent": { "database_id": "56b5b380-8a79-4939-a188-1742d8862761" },
  "properties": {
    "Название": {
      "title": [{ "type": "text", "text": { "content": "Три четыре слова" } }]
    },
    "Тип задачи": { "select": { "name": "Задача" } },
    "Статус": { "select": { "name": "Готово" } },
    "Source": { "url": null }
  },
  "children": []
}
```

В `children` — канон: Описание → divider → текст → Что сделано → divider → текст. Не использовать `markdown put` для структуры.

## Правила агента

- Статус **«В работе»** ставит только пользователь; агент при старте статус не меняет.
- При закрытии менять **только** `Статус` → `Готово` и дописать секцию **«Что сделано»** блоками (`heading_1` + `divider`). Не трогать Cursor / Тип задачи / Source без запроса.
- JSON body — во временный файл **без BOM** (`[System.IO.File]::WriteAllText` на Windows).
- Перед любой записью — write-safety из buildin-cli skill.
