# Иконки приложения ARC

Эта папка содержит все SVG иконки, экспортированные из Figma.

## Формат названий файлов

Все файлы должны следовать формату: `[name]-[size]-[style].svg`

### Параметры:

- **name** — название иконки (folder, tag, image, play-circle и т.д.)
- **size** — размер в пикселях: `16` или `24`
- **style** — стиль иконки: `border` (обводка) или `fill` (заливка)

### Примеры:

```
folder-24-border.svg
folder-24-fill.svg
folder-16-border.svg
folder-16-fill.svg
tag-24-border.svg
tag-24-fill.svg
grid-default-24-border.svg
grid-small-24-border.svg
play-circle-24-border.svg
...
```

## Полный список необходимых иконок:

### Навигация и папки (5 иконок × 4 варианта = 20 файлов)
- folder
- folder-open
- folder-plus
- folder-input
- folder-output

### Сетки (3 иконки × 4 варианта = 12 файлов)
- grid
- grid-default
- grid-small

### Действия (10 иконок × 4 варианта = 40 файлов)
- plus
- x
- trash
- pencil
- copy
- check
- save
- download
- import
- arrow-left

### Метки (4 иконки × 4 варианта = 16 файлов)
- tag
- tags
- tag-plus
- tag-check

### Медиа (4 иконки × 4 варианта = 16 файлов)
- image
- images
- play
- play-circle

### Коллекции (2 иконки × 4 варианта = 8 файлов)
- bookmark
- bookmark-plus

### Система (4 иконки × 4 варианта = 16 файлов)
- settings
- eye
- search
- history

### Данные (3 иконки × 4 варианта = 12 файлов)
- line-chart
- server
- hard-drive

### Файлы (2 иконки × 4 варианта = 8 файлов)
- file-search
- file-check

**Итого:** ~37 иконок × 4 варианта (24-border, 24-fill, 16-border, 16-fill) = **~148 SVG файлов**

## Требования к SVG файлам:

1. **Цвета:** Используйте `currentColor` для stroke и fill, чтобы иконки наследовали цвет из CSS
2. **ViewBox:** Должен быть `0 0 24 24` для 24px или `0 0 16 16` для 16px
3. **Размеры:** Атрибуты width и height можно не указывать (будут задаваться через CSS)
4. **Оптимизация:** Минимизируйте paths, удалите лишние группы и трансформации

### Пример правильного SVG:

```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 6H12L10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6Z" stroke="currentColor" stroke-width="2"/>
</svg>
```

## Добавление новых иконок:

1. Экспортируйте иконку из Figma в SVG
2. Назовите файл по формату `[name]-[size]-[style].svg`
3. Убедитесь что используется `currentColor`
4. Поместите файл в эту папку
5. Добавьте название иконки в тип `IconName` в `Icon.tsx` (если это новая иконка)

Компонент Icon автоматически подхватит новые файлы!

