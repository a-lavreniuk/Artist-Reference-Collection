# ARC PWA Application

Progressive Web App для проекта ARC — Artist Reference Collection.

## 🚀 Быстрый старт

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev

# Сборка production версии
npm run build

# Просмотр production сборки
npm run preview
```

## 📦 Установленные пакеты

### Dependencies
- `react` ^19.1.1 — UI библиотека
- `react-dom` ^19.1.1 — React DOM рендер
- `react-router-dom` ^7.1.1 — маршрутизация
- `dexie` ^4.0.11 — ORM для IndexedDB
- `vite-plugin-pwa` ^0.21.2 — PWA плагин

### Dev Dependencies
- `typescript` ~5.9.3 — язык TypeScript
- `vite` ^7.1.7 — сборщик
- `@vitejs/plugin-react` ^5.0.4 — React плагин для Vite
- `eslint` ^9.36.0 — линтер
- `@types/react` ^19.1.16 — типы React
- `@types/react-dom` ^19.1.9 — типы React DOM
- `@types/node` ^24.6.0 — типы Node.js

## 📁 Структура

```
src/
├── components/         # React компоненты
│   ├── common/        # Базовые UI (Button, Tag, Input, Card)
│   ├── layout/        # Навигация (Sidebar, SearchBar, etc.)
│   ├── gallery/       # Компоненты галереи
│   ├── collections/   # Компоненты коллекций
│   ├── tags/          # Компоненты меток
│   ├── moodboard/     # Компоненты мудборда
│   └── settings/      # Компоненты настроек
├── pages/             # Страницы приложения
├── services/          # Сервисы (DB, FileSystem, etc.)
├── hooks/             # Custom React hooks
├── workers/           # Web Workers
├── styles/            # Глобальные стили
├── types/             # TypeScript типы
├── utils/             # Утилиты
├── App.tsx            # Главный компонент
└── main.tsx           # Точка входа
```

## 🎨 Компоненты

### Базовые (common/)
- ✅ **Button** — универсальная кнопка с 5 вариантами
- ✅ **Tag** — метка с счётчиками и удалением
- ✅ **Input** — поле ввода с валидацией
- ✅ **Card** — карточка изображения для галереи

### Навигация (layout/)
- ✅ **Sidebar** — боковое меню
- ✅ **SearchBar** — поисковая строка
- ✅ **SectionHeader** — меню раздела
- ✅ **Layout** — основной лэйаут

### Страницы (pages/)
- ✅ **CardsPage** — главная страница
- ✅ **CollectionsPage** — коллекции
- ✅ **TagsPage** — метки и категории
- ✅ **MoodboardPage** — мудборд
- ✅ **SettingsPage** — настройки
- ✅ **AddPage** — добавление карточек

## 🗄️ Сервисы

### Database (services/db.ts)
Работа с IndexedDB через Dexie.js:
- Cards — управление карточками
- Tags — управление метками
- Categories — управление категориями
- Collections — управление коллекциями
- Moodboard — управление мудбордом
- Search & View History — история
- Statistics — статистика приложения

## 🎨 Дизайн-система

### Цвета
Все цвета определены через CSS переменные в `src/styles/variables.css`:
- Grayscale (25-900)
- Red (100-900) — danger
- Yellow (100-900) — warning
- Green (100-900) — success

### Типографика
Шрифты подключены в `src/styles/typography.css`:
- **YS Music Headline Bold** — заголовки
- **Geologica Variable** — текст

### Размеры
- Spacing: xs(4px), s(8px), m(12px), l(16px), xl(24px), etc.
- Radius: xs(4px), s(8px), m(12px), l(16px), xl(24px)
- Shadows: s, m, l, xl

## 🔧 Конфигурация

### vite.config.ts
- React plugin
- PWA plugin с автообновлением
- Service Worker для офлайн работы
- Порт разработки: 3000

### tsconfig.json
- Strict mode включен
- Target: ES2020
- Module: ESNext

## 🌐 PWA

### Manifest (public/manifest.json)
- Название: ARC — Artist Reference Collection
- Display: standalone
- Orientation: landscape
- Theme color: #3B3946
- Background: #F5F4F7

### Service Worker (public/sw.js)
- Cache First стратегия для статики
- Network First для данных
- Автоматическое обновление

## 📱 Требования

- **Браузер:** Chrome, Edge, Яндекс (на базе Chromium)
- **Разрешение:** минимум 1920×1080, рекомендуется 2560×1440
- **Node.js:** 20+
- **npm:** 10+

## 🐛 Отладка

```bash
# Проверка типов
npm run build

# Линтинг
npm run lint

# Проверка Service Worker
# Открой DevTools → Application → Service Workers
```

## 📖 Документация

- [Главный README](../README.md)
- [CHANGELOG](../CHANGELOG.md)
- [Notion](https://www.notion.so/a-lavreniuk/ARC-28fbfa9fcc588038a0f6e94e58c3f4b0)
- [Figma](https://www.figma.com/design/z6IWYQQfl9qakgoHgq04pO/Artist-Reference-Collection-Site)

---

**Версия:** 0.0.0  
**Статус:** 🚧 В разработке (6 из 18 этапов завершено)
