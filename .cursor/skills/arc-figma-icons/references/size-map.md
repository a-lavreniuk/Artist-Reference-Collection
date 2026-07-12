# Маппинг размеров Figma → ARC

## Таблица

| Figma `Size` | Суффикс файла | UI size | px в SVG | Типичный контекст |
|--------------|---------------|---------|----------|-------------------|
| 32 | `_xl` | `xl` | 32 | Крупные empty state, редко |
| 24 | `_l` | `l` | 24 | Кнопки `data-btn-size="l"` |
| 16 | `_m` | `m` | 16 | **Default** — navbar M, context menu |
| 12 | `_s` | `s` | 12 | Кнопки `data-btn-size="s"`, tabs |

## Выбор размера для выгрузки

Приоритет (один файл за задачу):

1. **Макет / задача** — если указано «иконка 24px» → `_l`.
2. **`data-btn-size`** на ближайшем предке кнопки/меню:
   - `s` → `_s` (12px)
   - `m` → `_m` (16px)
   - `l` → `_l` (24px)
3. **`data-arc-icon-size`** — если задан явно на контейнере.
4. **Fallback** → `_m`.

## Hydration и fallback

`navbarIconHydrate.ts` при отображении подбирает файл по `getIconSize(scope)`:

- Базовый файл в `ICON_FILES` обычно `{name}_m.svg`.
- Для `data-btn-size="l"` запрашивается `{name}_l.svg`, при отсутствии — fallback на базовый.

Если выгружен только `_m`, а UI ожидает `_s` — hydrate возьмёт `_m` (как для `ai_s.svg`).

## Именование файла

```
{name}_{size}.svg
```

Примеры: `pin-off_s.svg`, `flip-horizontal_m.svg`, `search_xl.svg`.

Имя `{name}` = kebab-case имени `frame` в Figma.
