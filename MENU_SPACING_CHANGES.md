# Изменения отступов в верхнем меню

## Текущее состояние

### Layout Header (блок поиска) ✅
**Файл:** `renderer/src/components/layout/Layout.css` → `.layout__header`

```css
padding: var(--spacing-2xl) var(--spacing-2xl) var(--spacing-l);
/* Расшифровка: 32px сверху, 32px справа, 16px снизу, 32px слева */
```

### SectionHeader (блок раздела) ✅
**Файл:** `renderer/src/components/layout/SectionHeader.css` → `.section-header`

```css
padding: var(--spacing-l) var(--spacing-2xl) var(--spacing-2xl);
/* Расшифровка: 16px сверху, 32px справа, 32px снизу, 32px слева */
```

### Убран border между блоками ✅
```css
.layout__header {
  /* border-bottom убран для единого меню */
}
```

## Как проверить изменения:

### 1. Перезапустите приложение
```bash
# Остановите текущий процесс (Ctrl+C)
start-dev.bat
```

### 2. Проверьте в DevTools (F12):

**Для блока поиска:**
- Найдите элемент `.layout__header`
- В Computed должно быть: `padding: 32px 32px 16px 32px`

**Для блока раздела:**
- Найдите элемент `.section-header`
- В Computed должно быть: `padding: 16px 32px 32px 32px`

### 3. Визуальная проверка:
- Поисковое поле должно быть на **32px** от левого края окна (после sidebar)
- Поисковое поле должно быть на **32px** от правого края окна
- Поисковое поле должно быть на **32px** от верхнего края окна
- Между поиском и заголовком раздела: **32px** визуально (16px + 16px)
- Нет разделительной линии между поиском и разделом

## Что могло пойти не так:

### Если изменения не видны:

1. **Кэш браузера не очищен**
   - В DevTools: Network → Disable cache (чекбокс)
   - Или: Application → Clear storage → Clear site data

2. **Старая сборка**
   - Я уже пересобрал: `npm run build` выполнен
   - Файлы обновлены в `dist/`

3. **Нужен hard reload**
   - Ctrl + Shift + R (Windows)
   - Или полный перезапуск приложения

## Git статус:

**Ветка:** `feature/spacing-system`

**Коммиты:**
1. `feat: Migrate icons to SVG files system` - система иконок
2. `feat: Implement spacing system with CSS variables` - базовые отступы
3. `fix: Correct Sidebar dimensions per Figma design` - sidebar 120px
4. `fix: Unified menu spacing - 32px from edges` - верхнее меню

**Изменённые файлы:**
- ✅ `Layout.css` - padding 32px/32px/16px
- ✅ `SectionHeader.css` - padding 16px/32px/32px
- ✅ `variables.css` - ширина sidebar 120px
- ✅ `Sidebar.css` - кнопки 56px, padding 32px

