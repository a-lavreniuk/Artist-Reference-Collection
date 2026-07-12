# Регистрация иконки в navbarIconHydrate.ts

Файл: `renderer/src/components/layout/navbarIconHydrate.ts`

После сохранения SVG (или если файл уже есть, но нет регистрации) — четыре правки в одном файле.

## 1. IconKey union

Добавить camelCase-ключ:

```ts
| 'highlighter'
```

## 2. ICON_FILES

Базовый файл — тот, что чаще всего нужен (обычно `_m`):

```ts
highlighter: 'highlighter_m.svg',
```

Если в задаче единственный размер — `_s` (как `pin: 'pin_s.svg'`), указать его.

## 3. ICON_CLASS_TO_KEY

Класс `arc-icon-{kebab}` → ключ через подчёркивания:

```ts
arc_icon_highlighter: 'highlighter',
```

Правило: `arc-icon-pin-off` → `arc_icon_pin_off`.

## 4. ICON_SELECTOR

Добавить селектор в строку (алфавитный порядок не обязателен, но удобен):

```ts
.arc-icon-highlighter
```

## CSS (arc-ui.css)

**Не требуется** для стандартного паттерна:

```tsx
<span className="btn-icon-only__glyph arc-icon-highlighter" aria-hidden="true" />
```

Hydrate подставит inline SVG; цвет — через `currentColor` от родителя.

### Исключение: mask-паттерн

Только если в задаче явно используется `.arc-icon` с `--arc-icon-url`:

```css
.arc-icon-example {
  --arc-icon-url: url('/ui/icons/example_m.svg');
}
```

В типичных navbar/context-menu кнопках ARC это **не нужно**.

## Проверка

1. Grep: `arc-icon-{name}` в JSX совпадает с `ICON_CLASS_TO_KEY`.
2. `hydrateArcNavbarIcons` вызывается в scope (navbar, `ContextMenu` — уже есть).
3. `npm run verify:renderer-ui` — OK.

## Пример полной цепочки (highlighter)

| Шаг | Значение |
|-----|----------|
| Figma frame | `highlighter` |
| Файл | `highlighter_m.svg` |
| IconKey | `highlighter` |
| CSS class | `arc-icon-highlighter` |
| ICON_CLASS_TO_KEY | `arc_icon_highlighter: 'highlighter'` |
