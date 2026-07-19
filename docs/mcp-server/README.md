# ARC MCP Server

Локальный [Model Context Protocol](https://modelcontextprotocol.io) сервер в main-процессе ARC. MCP-клиенты могут читать библиотеку и выполнять разрешённые действия, пока ARC запущен.

План по dual transport и подключению клиентов: [client-connectivity-plan.md](./client-connectivity-plan.md).

В пользовательских текстах ARC не указываются названия конкретных агентов или IDE — только тип подключения (HTTP / stdio) и шаги.

## Требования

- ARC запущен (достаточно иконки в трее).
- В ARC открыта библиотека.
- **Настройки → MCP сервер** — включить «Разрешить подключение MCP-клиентов» и выбрать разрешённые инструменты.
- MCP-клиент настроен на endpoint или stdio-конфиг ниже.

## Endpoint (HTTP)

| | |
|---|---|
| URL | `http://127.0.0.1:47897/mcp` |
| Transport | Streamable HTTP |
| Host | только `127.0.0.1` (недоступен из сети) |

## Stdio

| | |
|---|---|
| Команда | путь к установленному ARC |
| Args | `--mcp` |
| Поведение | процесс без окна; мост к HTTP MCP уже запущенного ARC |

Import API для расширения браузера — порт **47896** (отдельный сервис).

## Подключение MCP-клиента (рекомендуемый UX)

1. **Настройки → MCP сервер** — включить «Разрешить подключение MCP-клиентов».
2. Как подключить ARC-MCP для вашего агента:
   1. Включите агента.
   2. Нажмите **Копировать** — в буфер попадёт пакет с вариантами **HTTP** и **stdio** (с абсолютным путём).
   3. В чате агента попросите его установить сервер и вставьте содержимое буфера.
3. Агент выбирает подходящий транспорт. Если не может править файлы — вставить нужный JSON вручную из того же текста.

Облачные клиенты без доступа к `127.0.0.1` не поддерживаются.

### Пример HTTP

```json
{
  "mcpServers": {
    "arc-mcp": {
      "transport": "http",
      "type": "streamable-http",
      "streamable": true,
      "url": "http://127.0.0.1:47897/mcp"
    }
  }
}
```

### Пример stdio

```json
{
  "mcpServers": {
    "arc-mcp": {
      "command": "/absolute/path/to/ARC",
      "args": ["--mcp"]
    }
  }
}
```

Проверка: запрос версии приложения должен вызвать `arc_get_app_info`. Если инструменты не появились — переключить сервер в клиенте off/on или перезапустить клиент.

## Инструменты (54)

Описания в протоколе MCP и в **Настройки → MCP сервер** — на русском. Каждый инструмент можно отключить отдельным переключателем; после сохранения сервер перезапускается автоматически.

### Приложение (`app`)

| Tool | Описание |
|------|----------|
| `arc_get_app_info` | Версия ARC, платформа, статус MCP, открыта ли библиотека |
| `arc_get_library_stats` | Карточки, корзина, диск, статус AI-индекса |
| `arc_get_recent_history` | Последние записи журнала библиотеки |
| `arc_get_ai_status` | Модели, индексация, готовность семантического поиска |

### Карточки — чтение (`cards-read`)

| Tool | Описание |
|------|----------|
| `arc_list_cards` | Список с пагинацией, фильтрами, сортировкой; корзина: `libraryScope: trash` |
| `arc_get_card` | Одна карточка по ID |
| `arc_search_cards` | Полнотекстовый поиск |
| `arc_get_card_palette` | Палитра и доминантный цвет |
| `arc_get_card_media_url` | URL превью/оригинала (localhost media-server) |
| `arc_card_media_resources` | Toggle MCP Resources `arc://card/{id}/thumb` и `/original` |

### Карточки — запись (`cards-write`)

| Tool | Описание |
|------|----------|
| `arc_update_card` | Имя, описание, коллекции (без меток) |
| `arc_set_card_tags` | Полный список меток на карточке |
| `arc_move_card_to_trash` | Мягкое удаление |
| `arc_restore_card` | Восстановление из корзины |
| `arc_permanent_delete_card` | Безвозвратное удаление |
| `arc_empty_trash` | Очистка корзины |

### Импорт (`import`)

| Tool | Описание |
|------|----------|
| `arc_import_item` | Импорт по HTTP(S) URL |
| `arc_import_item_base64` | Импорт из base64 |
| `arc_import_files` | Импорт локальных файлов по путям |
| `arc_check_import_duplicate` | Проверка дубликата до импорта |

### Коллекции (`collections`)

| Tool | Описание |
|------|----------|
| `arc_list_collections` | Список коллекций |
| `arc_get_collection` | Детали и превью |
| `arc_create_collection` | Создание |
| `arc_update_collection` | Редактирование |
| `arc_delete_collection` | Удаление |
| `arc_add_cards_to_collection` | Добавить карточки |
| `arc_remove_cards_from_collection` | Убрать карточки |

### Мудборд (`moodboard`)

| Tool | Описание |
|------|----------|
| `arc_get_moodboard` | Карточки и доска |
| `arc_add_to_moodboard` | Добавить карточки |
| `arc_remove_from_moodboard` | Убрать карточки |
| `arc_update_moodboard_board` | Сохранить раскладку доски |

### Каталог меток — чтение (`catalog-read`)

| Tool | Описание |
|------|----------|
| `arc_list_categories` | Категории |
| `arc_list_tags` | Все метки |
| `arc_list_tags_by_category` | Метки одной категории |

### Каталог меток — запись (`catalog-write`)

| Tool | Описание |
|------|----------|
| `arc_create_category` | Создать категорию |
| `arc_update_category` | Редактировать категорию |
| `arc_delete_category` | Удалить категорию |
| `arc_create_tag` | Создать метку (без привязки к карточкам) |
| `arc_update_tag` | Редактировать метку |
| `arc_delete_tag` | Удалить метку |

### Визуальный поиск (`visual-search`)

| Tool | Описание |
|------|----------|
| `arc_color_search` | Поиск по HEX-цвету |
| `arc_similar_search` | Похожие изображения по `cardId` |

### Фильтры галереи (`filters`)

| Tool | Описание |
|------|----------|
| `arc_get_filter_stats` | Счётчики для navbar-фильтров |
| `arc_list_filter_presets` | Сохранённые пресеты |
| `arc_save_filter_preset` | Создать/обновить пресет |
| `arc_delete_filter_preset` | Удалить пресет |
| `arc_rename_filter_preset` | Переименовать пресет |

### Дубликаты (`duplicates`)

| Tool | Описание |
|------|----------|
| `arc_scan_duplicates` | Запуск сканирования |
| `arc_list_duplicate_pairs` | Список пар |
| `arc_merge_duplicates` | Объединение пары |
| `arc_skip_duplicate_pair` | Пропустить пару |

### AI-поиск (`ai`)

| Tool | Описание |
|------|----------|
| `arc_ai_search` | Семантический поиск |
| `arc_suggest_card_tags` | Предложить метки (JoyCaption + каталог; read-only) |
| `arc_trigger_reindex` | Полная переиндексация |

## MCP Resources

При включённом `arc_card_media_resources`:

| URI | Содержимое |
|-----|------------|
| `arc://card/{cardId}/thumb` | JSON с локальным URL превью |
| `arc://card/{cardId}/original` | JSON с URL оригинала (image/video) |

## MCP Prompts (шаблоны на русском)

| Имя | Назначение |
|-----|------------|
| `suggest_tags` | Предложить метки карточке через engine ARC |
| `organize_imports` | Разметить недавний импорт метками/коллекциями |
| `build_moodboard` | Собрать мудборд по брифу |
| `find_duplicates` | Найти и предложить merge дубликатов |
| `color_palette_review` | Подбор референсов по цвету |
| `library_overview` | Обзор статистики и структуры меток |

## Примеры запросов

**Только чтение**

```
Покажи категории меток и сколько в каждой меток.
```

```
Найди карточки по запросу «sunset landscape», первые 10 результатов.
```

```
Список карточек в корзине (libraryScope: trash).
```

**Метки на карточках**

```
Предложи метки для карточки {id} через arc_suggest_card_tags. Покажи matched и proposedNew, ничего не записывай без подтверждения.
```

```
Назначь карточке {id} метки cat и dog. Сначала покажи план.
```

Playbook автотегирования для агентов: [docs/ai/mcp-agent-playbook.md](../ai/mcp-agent-playbook.md).

**Импорт**

```
Импортируй https://example.com/photo.jpg в библиотеку.
```

**Дубликаты**

```
Просканируй дубликаты и предложи объединение для первой пары.
```

## Конфиденциальность

MCP сам по себе не отправляет данные в облако. При **облачной LLM** в MCP-клиенте результаты инструментов (имена файлов, метки, поиск) попадают в контекст модели. Для чувствительных библиотек используйте локальную модель или режим только чтения.

## Устранение неполадок

| Проблема | Проверить |
|----------|-----------|
| Connection refused | ARC не запущен или порт 47897 занят |
| HTTP 403 | MCP выключен в настройках или неверный host |
| Нет инструментов в клиенте | конфиг MCP, переключить сервер, перезапуск ARC / клиента |
| Stdio сразу завершается | ARC с включённым MCP должен быть уже запущен; смотрите stderr процесса |
| Ошибки AI-поиска | Включить AI Search, установить модель, дождаться индексации |
| Ошибки библиотеки | Сначала открыть библиотеку в ARC |

## Разработка

- Код: `src/main/mcp/` (доменные регистраторы в `tools/`; stdio bridge: `mcpStdioHost.ts`; пакет настройки: `mcpSetupClipboard.ts`)
- Каталог и тексты RU: `src/main/shared/mcpToolCopy.ts`, `mcpToolCatalog.ts`
- Схемы параметров: `src/main/mcp/mcpSchemas.ts`
- Тесты: `src/main/mcp/__tests__/`
- Глобальный toggle: `mcpServerEnabled` в `appPreferences`
- Per-tool toggles: `mcpToolsEnabled` в настройках
- Stdio: `ARC --mcp` (без single-instance lock; мост на HTTP)

```bash
npm run build:main
npm test
npm run verify:renderer-ui
```
