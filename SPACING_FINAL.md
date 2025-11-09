# Финальное состояние системы отступов

## ✅ Основной принцип

**Отступы НЕ меняются на разных разрешениях (1920×1080 — 2560×1440)**

В медиа-запросах меняются только:
- Размеры элементов (width, height)
- Размеры шрифтов (font-size)
- Количество колонок (grid-template-columns)
- Видимость элементов (display: none)

**НЕ меняются:**
- ❌ padding
- ❌ margin
- ❌ gap

## Константные отступы по компонентам

### Sidebar
- **Ширина:** 120px
- **Padding:** 32px со всех сторон (константа)
- **Кнопки:** 56×56px
- **Gap между кнопками:** 8px (константа)

### Layout Header (поиск)
- **Padding:** 32px сверху/слева/справа, 16px снизу (константа)
- **Border-bottom:** убран для единого меню

### SectionHeader (раздел)
- **Padding:** 16px сверху, 32px снизу/слева/справа (константа)
- **Gap:** 24px (константа)
- **Border-bottom:** есть (отделяет от контента)

### SearchDropdown
- **Padding:** 32px со всех сторон (константа)
- **Gap между секциями:** 24px (константа)
- **Gap в рядах:** 4px (константа)

### MasonryGrid
- **Gap стандартный:** 16px (константа)
- **Gap компактный:** 12px (константа)

### Card
- **Overlay padding:** 12px (константа)
- **Info padding:** 12px (константа)

### Modal
- **Header/Content/Footer padding:** 24px (константа)
- **Gap в footer:** 12px (константа)

### Button
- **Gap между иконкой и текстом:** 8px (константа)
- **Padding medium:** 16px (константа)
- **Padding small:** 12px (константа)
- **Padding large:** 24px (константа)

### Input
- **Padding:** 16px (константа)
- **Gap с label/hint:** 4px (константа)

## Что меняется в медиа-запросах

### @media (max-width: 2200px)
- Размер заголовка SectionHeader: 32px
- Max-width SearchBar: 350px

### @media (max-width: 1920px)
- Размер заголовка SectionHeader: 28px
- Скрываются тексты в кнопках фильтров (только иконки)
- Max-width SearchBar: 300px

### @media (max-height: 800px)
- Размер кнопок Sidebar: 52×52px (вместо 56×56px)

## Удалено из медиа-запросов

❌ Layout: изменения padding header/content  
❌ SectionHeader: изменения padding и gap  
❌ Sidebar: изменения padding и gap  
❌ MasonryGrid: изменения gap  
❌ Card: изменения padding overlay/info  
❌ Modal: изменения padding header/content/footer  
❌ OnboardingScreen: изменения padding и gap  
❌ CardViewModal: изменения gap  
❌ AddCardFlow: изменения gap  

## Итого

**Обновлено файлов:** 11  
**Удалено ненужных изменений отступов:** ~30  
**Отступы теперь константные на всех разрешениях** ✅

## Коммиты

1. `feat: Migrate icons to SVG files system` - иконки
2. `feat: Implement spacing system with CSS variables` - базовая система отступов
3. `fix: Correct Sidebar dimensions per Figma design` - sidebar 120px
4. `fix: Unified menu spacing - 32px from edges` - единое верхнее меню
5. `fix: Remove spacing changes from media queries` - константные отступы ✅

