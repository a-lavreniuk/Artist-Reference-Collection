# Figma-файл «Иконки»

## Ссылки

- Файл: https://www.figma.com/design/5JAgNwVUnPOVXLfewWMbGP/%D0%98%D0%BA%D0%BE%D0%BD%D0%BA%D0%B8
- Пример темы Edit: https://www.figma.com/design/5JAgNwVUnPOVXLfewWMbGP/%D0%98%D0%BA%D0%BE%D0%BD%D0%BA%D0%B8?node-id=872-65
- Пример variant: https://www.figma.com/design/5JAgNwVUnPOVXLfewWMbGP/%D0%98%D0%BA%D0%BE%D0%BD%D0%BA%D0%B8?node-id=112-8

## Константы

| Поле | Значение |
|------|----------|
| `fileKey` | `5JAgNwVUnPOVXLfewWMbGP` |
| Формат экспорта | `svg` (`defaultFormat` в `download_assets`) |

## Структура файла

1. **Страницы (pages)** — верхний уровень документа. Список: `get_metadata` без `nodeId`.
2. **Canvas / темы** — артборды по темам иконок (`Edit`, `Cursor`, …). Имя canvas = имя темы.
3. **Variant-frame** — `frame` с именем иконки (`pin`, `arrow-up`, `flip-horizontal`). Внутри — `symbol` с variant-свойствами.
4. **Single-symbol** — одиночный `symbol` на canvas без variant-frame. **Не использовать.**

## Имена variant-symbol

Формат: `Size={px}, Weight={1|2|Fill}`

| Weight | Использовать |
|--------|--------------|
| `1` | Да (1px stroke) |
| `2` | Нет (2px stroke) |
| `Fill` | Нет (заливка) |

## MCP-инструменты

| Задача | Tool |
|--------|------|
| Список страниц | `get_metadata` (без nodeId) |
| Дерево темы / иконки | `get_metadata` (nodeId canvas или frame) |
| Экспорт SVG | `download_assets` (nodeId symbol, `defaultFormat: svg`) |
| Сверка визуала | `get_screenshot` |

Перед `use_figma` / write-операциями — skill `figma-use`.

## Ограничения

- URL из `download_assets` временный — скачивать сразу.
- Не все иконки имеют все комбинации Size × Weight=1 (например, нет `Size=12, Weight=1` у `hand` в теме Cursor).
