# Проверка отступов в меню поиска

## Что должно быть изменено:

### Layout Header (блок поиска)
**Файл:** `renderer/src/components/layout/Layout.css`

**Было:**
```css
padding: var(--spacing-l) var(--spacing-xl);
/* = 16px сверху/снизу, 24px слева/справа */
```

**Стало:**
```css
padding: var(--spacing-2xl) var(--spacing-2xl) var(--spacing-l);
/* = 32px сверху, 32px слева, 32px справа, 16px снизу ✅ */
```

## Как проверить в DevTools:

1. Откройте приложение
2. Нажмите F12 (DevTools)
3. Выберите элемент `.layout__header`
4. В Computed стилях найдите `padding`
5. Должно быть: `32px 32px 16px 32px`

## Если изменения не видны:

### Вариант 1: Пересобрать renderer
```bash
cd renderer
npm run build
cd ..
```

### Вариант 2: Полностью перезапустить
```bash
# Закрыть приложение (Ctrl+C)
start-dev.bat
```

### Вариант 3: Очистить кэш браузера
В DevTools → Application → Clear storage → Clear site data

## Текущие отступы по дизайну:

### SearchBar область (layout__header):
- Сверху: **32px** ✅
- Слева: **32px** ✅
- Справа: **32px** ✅
- Снизу: **16px** ✅

### SectionHeader (раздел):
- Сверху: **16px** ✅
- Слева: **32px** ✅
- Справа: **32px** ✅
- Снизу: **32px** ✅

### Между ними:
- Gap: **16px + 16px = 32px** ✅

### SearchDropdown (выпадающее меню):
- Padding: **32px** со всех сторон ✅

