# Button Component — Примеры использования

Обновленный компонент кнопок согласно дизайн-системе ARC из Figma.

## Основные варианты (styles)

### Primary — основная кнопка
```tsx
<Button variant="primary" size="L">Сохранить</Button>
<Button variant="primary" size="S">Сохранить</Button>
```

### Secondary — второстепенная кнопка
```tsx
<Button variant="secondary" size="L">Отмена</Button>
<Button variant="secondary" size="S">Отмена</Button>
```

### Border — кнопка с обводкой
```tsx
<Button variant="border" size="L">Фильтры</Button>
<Button variant="border" size="S">Фильтры</Button>
```

### Ghost — прозрачная кнопка
```tsx
<Button variant="ghost" size="L">Закрыть</Button>
<Button variant="ghost" size="S">Закрыть</Button>
```

### Error — опасное действие
```tsx
<Button variant="error" size="L">Удалить</Button>
<Button variant="error" size="S">Удалить</Button>
```

### Warning — предупреждение
```tsx
<Button variant="warning" size="L">Внимание</Button>
<Button variant="warning" size="S">Внимание</Button>
```

### Success — успешное действие
```tsx
<Button variant="success" size="L">Готово</Button>
<Button variant="success" size="S">Готово</Button>
```

## Размеры

- **L (Large)** — 56px высота, основной размер для большинства действий
- **S (Small)** — 40px высота, для модальных окон и менее важных элементов

## Состояния

### Default
```tsx
<Button variant="primary">Обычная кнопка</Button>
```

### Hover
Автоматически при наведении курсора

### Disabled
```tsx
<Button variant="primary" disabled>Неактивна</Button>
```

## С иконками

### Иконка слева
```tsx
import { Icon } from './Icon';

<Button variant="primary" iconLeft={<Icon name="plus" size={24} />}>
  Добавить
</Button>
```

### Иконка справа
```tsx
<Button variant="secondary" iconRight={<Icon name="arrow-right" size={24} />}>
  Далее
</Button>
```

### Обе иконки
```tsx
<Button 
  variant="border" 
  iconLeft={<Icon name="filter" size={24} />}
  iconRight={<Icon name="chevron-down" size={24} />}
>
  Фильтры
</Button>
```

### Только иконка (без текста)
```tsx
<Button variant="ghost" iconOnly iconLeft={<Icon name="close" size={24} />} />
```

## Со счетчиком (counter)

Счетчик автоматически форматируется:
- **0** → скрывается
- **1–999** → как есть (7, 42, 999)
- **≥1000** → с K (1.2K, 15.3K, 999K)

```tsx
<Button variant="secondary" counter={0}>
  Коллекции
</Button>
// Счетчик не отображается

<Button variant="secondary" counter={42}>
  Коллекции
</Button>
// Отображается: Коллекции 42

<Button variant="secondary" counter={1250}>
  Коллекции
</Button>
// Отображается: Коллекции 1.3K

<Button variant="primary" counter={150000}>
  Изображений
</Button>
// Отображается: Изображений 150K
```

## Комплексные примеры

### Кнопка с иконкой и счетчиком
```tsx
<Button 
  variant="secondary" 
  size="L"
  iconLeft={<Icon name="collection" size={24} />}
  counter={128}
>
  В коллекцию
</Button>
```

### Полная ширина
```tsx
<Button variant="primary" fullWidth>
  Применить изменения
</Button>
```

### С обработчиком события
```tsx
<Button 
  variant="primary" 
  onClick={() => console.log('Clicked!')}
>
  Нажми меня
</Button>
```

## Типы и интерфейс

```tsx
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Вариант отображения кнопки */
  variant?: 'primary' | 'secondary' | 'border' | 'ghost' | 'error' | 'warning' | 'success';
  
  /** Размер кнопки (L = большая 56px, S = малая 40px) */
  size?: 'L' | 'S';
  
  /** Полная ширина */
  fullWidth?: boolean;
  
  /** Иконка слева от текста */
  iconLeft?: ReactNode;
  
  /** Иконка справа от текста */
  iconRight?: ReactNode;
  
  /** Только иконка (без текста) */
  iconOnly?: boolean;
  
  /** Счетчик (badge) - отображается справа от текста */
  counter?: number;
  
  /** Дочерние элементы (текст кнопки) */
  children?: ReactNode;
}
```

## Особенности дизайна

### Отступы и размеры
- **L**: padding 16px 32px, gap 8px, border-radius 16px, icon 24×24px
- **S**: padding 14px 18px, gap 8px, border-radius 12px, icon 16×16px

### Цвета
Все цвета взяты из дизайн-системы и соответствуют Figma макету:
- Primary: #514f5b (тёмный)
- Secondary: #ebe9ee (светлый)
- Error: #b61a17 (красный)
- Warning: #b39027 (жёлтый)
- Success: #0f8948 (зелёный)

### Состояния hover
Каждая кнопка имеет более тёмный/насыщенный цвет при наведении

### Disabled состояние
- Светлый фон #ebe9ee для всех вариантов
- Светло-серый текст #d5d3d9
- cursor: not-allowed
- pointer-events: none

## Утилита formatCounter

Экспортируется отдельно для использования в других компонентах:

```tsx
import { formatCounter } from './Button';

formatCounter(0);      // null (не отображается)
formatCounter(42);     // "42"
formatCounter(999);    // "999"
formatCounter(1000);   // "1.0K"
formatCounter(1250);   // "1.3K"
formatCounter(99900);  // "99.9K"
formatCounter(100000); // "100K"
formatCounter(999000); // "999K"
```

