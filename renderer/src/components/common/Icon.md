# Компонент Icon

Централизованная система иконок для приложения ARC. Все иконки взяты из дизайна Figma и доступны в двух размерах и двух стилях.

## Основные параметры

- **`name`** — название иконки (обязательный)
- **`size`** — размер: `16` или `24` (по умолчанию `24`)
- **`variant`** — стиль: `'border'` (outline) или `'fill'` (filled) (по умолчанию `'border'`)
- **`className`** — дополнительные CSS классы

## Использование

### Базовый пример

```tsx
import { Icon } from '../common';

<Icon name="folder" size={24} variant="border" />
```

### В кнопке

```tsx
<Button
  variant="primary"
  iconLeft={<Icon name="plus" size={24} variant="border" />}
>
  Добавить
</Button>
```

### В поле ввода

```tsx
<Input
  type="search"
  placeholder="Поиск..."
  iconLeft={<Icon name="search" size={24} variant="border" />}
/>
```

### Кнопка только с иконкой

```tsx
<button className="icon-button">
  <Icon name="trash" size={16} variant="border" />
</button>
```

## Доступные иконки

### Навигация и структура
- `folder` — папка
- `folder-open` — открытая папка
- `folder-plus` — добавить в папку
- `folder-input` — импорт в папку
- `folder-output` — экспорт из папки

### Сетка и виды
- `grid` — сетка стандартная
- `grid-default` — сетка 2х2
- `grid-small` — сетка 3х3 компактная

### Действия
- `plus` — добавить
- `x` — закрыть/удалить
- `trash` — удалить в корзину
- `pencil` — редактировать
- `copy` — копировать
- `check` — подтвердить
- `save` — сохранить
- `download` — скачать
- `import` — импортировать

### Метки и категории
- `tag` — метка
- `tags` — несколько меток
- `tag-plus` — добавить метку
- `tag-check` — метка с галочкой

### Медиа
- `image` — изображение
- `images` — несколько изображений
- `play` — воспроизвести
- `play-circle` — воспроизвести (круг)

### Коллекции
- `bookmark` — закладка
- `bookmark-plus` — добавить в закладки

### Система
- `settings` — настройки
- `eye` — просмотр
- `search` — поиск
- `history` — история
- `line-chart` — статистика

### Файлы
- `file-search` — поиск файла
- `file-check` — файл проверен

### Данные
- `server` — сервер
- `hard-drive` — жёсткий диск

### Прочее
- `arrow-left` — стрелка влево

## Примеры из компонентов

### Sidebar

```tsx
<Icon name="grid-default" size={24} variant="border" />  // Карточки
<Icon name="folder" size={24} variant="border" />       // Коллекции
<Icon name="tag" size={24} variant="border" />          // Метки
<Icon name="bookmark" size={24} variant="border" />     // Мудборд
<Icon name="plus" size={24} variant="border" />         // Добавить
<Icon name="settings" size={24} variant="border" />     // Настройки
```

### SectionHeader

```tsx
// Кнопка "Назад"
<Icon name="arrow-left" size={24} variant="border" />

// Переключатель вида
<Icon name="grid-default" size={24} variant="border" />  // Стандартный
<Icon name="grid-small" size={24} variant="border" />    // Компактный

// Фильтр контента
<Icon name="grid" size={24} variant="border" />          // Всё
<Icon name="image" size={24} variant="border" />         // Изображения
<Icon name="play-circle" size={24} variant="border" />   // Видео
```

### SearchBar

```tsx
// Иконка поиска
<Icon name="search" size={24} variant="border" />

// Удаление метки
<Icon name="x" size={16} variant="border" />
```

### AddCardFlow

```tsx
// Drag & Drop зона
<Icon name="import" size={24} variant="border" style={{ width: 96, height: 96 }} />

// Статус настройки
<Icon name="check" size={16} variant="border" />

// Удалить из очереди
<Icon name="x" size={16} variant="border" />
```

## Стили

### Border (outline) — по умолчанию
Используется для большинства UI элементов. Иконки с обводкой, без заливки.

```tsx
<Icon name="folder" size={24} variant="border" />
```

### Fill (filled)
Используется для активных состояний или акцентов.

```tsx
<Icon name="folder" size={24} variant="fill" />
```

## Цвет

Иконки наследуют цвет текста через `currentColor`:

```tsx
<div style={{ color: 'var(--text-primary)' }}>
  <Icon name="folder" size={24} variant="border" />
</div>
```

## Размеры

- **16px** — для маленьких элементов (кнопки закрытия, метки)
- **24px** — основной размер для большинства UI элементов

## CSS классы

Компонент автоматически добавляет следующие классы:
- `.icon` — базовый класс
- `.icon--16` или `.icon--24` — размер
- `.icon--border` или `.icon--fill` — стиль

Можно добавить собственные классы через проп `className`.

## Анимации

Иконки в кнопках и элементах навигации имеют встроенные анимации при hover/active:

```css
.button .icon,
.sidebar__icon .icon {
  transition: transform 0.2s ease;
}

.button:hover .icon {
  transform: scale(1.05);
}

.button:active .icon {
  transform: scale(0.95);
}
```

## Типизация

```typescript
import type { IconName, IconSize, IconVariant } from '../common';

const iconName: IconName = 'folder';
const iconSize: IconSize = 24;
const iconVariant: IconVariant = 'border';
```

