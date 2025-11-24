# ARC - Техническая документация

Полная техническая документация настольного приложения ARC для организации визуальных референсов дизайнеров.

---

## Содержание

1. Обзор проекта
2. Архитектура приложения
3. Технологический стек
4. Структура проекта
5. Компоненты UI
6. Страницы приложения
7. Дизайн-система
8. База данных
9. IPC коммуникация
10. Файловая система
11. Производительность
12. Сборка и развертывание

*В Notion используйте боковую панель навигации для быстрого перехода к разделам*

---

## Обзор проекта

**ARC (Artist Reference Collection)** — персональное офлайн настольное приложение для организации визуальных референсов дизайнеров.

### Основные характеристики

- **Платформа**: Windows 10/11 (настольное приложение)
- **Технологии**: Electron, Node.js, React, TypeScript
- **Архитектура**: Main Process + Renderer Process
- **Хранение данных**: IndexedDB (метаданные) + файловая система (медиафайлы)
- **Режим работы**: Полностью офлайн, без интернет-зависимостей
- **Производительность**: Оптимизировано для коллекций до 50,000 файлов
- **UI/UX**: Адаптировано под разрешение 1920×1080 — 2560×1440

### Цели проекта

- Автономный инструмент для каталогизации изображений и видео
- Быстрый и надежный поиск по меткам, категориям и коллекциям
- Эффективная организация больших коллекций референсов
- Полная офлайн-работа без зависимости от облачных сервисов

---

## Архитектура приложения

### Двухпроцессная модель Electron

ARC использует стандартную архитектуру Electron с разделением на два процесса:

#### Main Process (Главный процесс)

**Расположение**: `src/main/`

**Ответственность**:
- Управление окном приложения
- Работа с файловой системой через Node.js API
- IPC обработчики для коммуникации с renderer
- Автообновления через electron-updater
- Системные уведомления
- Горячие клавиши
- Системный трей

**Основные файлы**:
- `main.ts` — точка входа, создание окна
- `ipc-handlers.ts` — обработчики IPC запросов
- `auto-updater.ts` — логика автообновлений
- `download-manager.ts` — менеджер загрузки файлов
- `shortcuts.ts` — регистрация горячих клавиш

#### Renderer Process (Процесс отображения)

**Расположение**: `renderer/src/`

**Ответственность**:
- UI логика на React
- Работа с IndexedDB через Dexie.js
- Canvas API для генерации превью
- Виртуализация галереи
- Роутинг через React Router

**Основные директории**:
- `components/` — React компоненты
- `pages/` — страницы приложения
- `services/` — сервисы (БД, дубликаты, история)
- `hooks/` — кастомные React хуки
- `contexts/` — React контексты
- `styles/` — глобальные стили
- `types/` — TypeScript типы

### Безопасность

- `nodeIntegration: false` — отключена интеграция Node.js в renderer
- `contextIsolation: true` — включена изоляция контекста
- `preload.js` — безопасный мост через contextBridge
- `webSecurity: true` — включена веб-безопасность

---

## Технологический стек

### Основные технологии

#### Electron
- **Версия**: 28.0.0
- **Назначение**: Фреймворк для создания настольных приложений
- **Особенности**: Двухпроцессная модель, IPC коммуникация

#### React
- **Версия**: 19.1.1
- **Назначение**: UI библиотека для renderer процесса
- **Особенности**: Функциональные компоненты, хуки

#### TypeScript
- **Версия**: 5.3.3
- **Назначение**: Типизация кода
- **Особенности**: Строгая типизация всех компонентов и сервисов

#### Vite
- **Версия**: 7.1.7
- **Назначение**: Сборщик для renderer процесса
- **Особенности**: Быстрая разработка с HMR

### Библиотеки для работы с данными

#### Dexie.js
- **Версия**: 4.2.1
- **Назначение**: Обертка над IndexedDB
- **Особенности**: Упрощенный API, транзакции, миграции

### Библиотеки для UI

#### React Router DOM
- **Версия**: 7.9.5
- **Назначение**: Роутинг в приложении
- **Особенности**: HashRouter для Electron

#### React Window
- **Версия**: 2.2.3
- **Назначение**: Виртуализация списков
- **Особенности**: Оптимизация производительности

#### React Masonry CSS
- **Версия**: 1.0.16
- **Назначение**: Masonry сетка для галереи
- **Особенности**: CSS-based masonry layout

### Библиотеки для работы с медиа

#### Sharp
- **Версия**: 0.34.5
- **Назначение**: Обработка изображений
- **Особенности**: Генерация превью, ресайз

#### Fluent FFmpeg
- **Версия**: 2.1.3
- **Назначение**: Обработка видео
- **Особенности**: Генерация превью для видео

#### @ffmpeg-installer/ffmpeg
- **Версия**: 1.1.0
- **Назначение**: Бинарник FFmpeg для Windows

### Библиотеки для архивации

#### Archiver
- **Версия**: 7.0.1
- **Назначение**: Создание ZIP архивов
- **Особенности**: Резервное копирование с разделением на части

#### Extract ZIP
- **Версия**: 2.0.1
- **Назначение**: Распаковка ZIP архивов
- **Особенности**: Восстановление из резервных копий

### Инструменты сборки

#### Electron Builder
- **Версия**: 24.9.1
- **Назначение**: Сборка установщика для Windows
- **Особенности**: NSIS установщик, автообновления

#### Electron Updater
- **Версия**: 6.1.7
- **Назначение**: Автоматические обновления
- **Особенности**: Проверка и установка обновлений

---

## Структура проекта

```
ARC/
├── src/                    # Исходный код (TypeScript)
│   ├── main/               # Main Process
│   │   ├── main.ts         # Точка входа
│   │   ├── ipc-handlers.ts # IPC обработчики
│   │   ├── auto-updater.ts # Автообновления
│   │   ├── download-manager.ts # Менеджер загрузок
│   │   └── shortcuts.ts    # Горячие клавиши
│   └── preload/            # Preload скрипт
│       └── preload.ts      # Безопасный мост
│
├── renderer/               # Renderer Process (React)
│   ├── src/
│   │   ├── components/     # React компоненты
│   │   │   ├── common/     # Общие компоненты
│   │   │   ├── layout/     # Компоненты макета
│   │   │   ├── gallery/     # Галерея карточек
│   │   │   ├── tags/        # Компоненты меток
│   │   │   ├── collections/ # Компоненты коллекций
│   │   │   ├── settings/    # Компоненты настроек
│   │   │   └── duplicates/  # Поиск дубликатов
│   │   ├── pages/           # Страницы приложения
│   │   ├── services/        # Сервисы
│   │   │   ├── db.ts        # Работа с БД
│   │   │   ├── duplicateService.ts # Поиск дубликатов
│   │   │   ├── history.ts   # История действий
│   │   │   └── integrityCheck.ts # Проверка целостности
│   │   ├── hooks/           # Кастомные хуки
│   │   ├── contexts/        # React контексты
│   │   ├── styles/          # Глобальные стили
│   │   ├── types/           # TypeScript типы
│   │   ├── utils/           # Утилиты
│   │   ├── workers/         # Web Workers
│   │   └── App.tsx          # Главный компонент
│   └── package.json
│
├── main/                   # Скомпилированный Main Process (JS)
├── preload/                # Скомпилированный Preload (JS)
├── resources/              # Ресурсы (иконки)
├── release/               # Собранные установщики
├── docs/                   # Документация
├── package.json            # Корневой package.json
└── electron-builder.yml    # Конфигурация сборки
```

---

## Компоненты UI

### Структура компонентов

Компоненты организованы по функциональным областям:

#### `components/common/` - Общие компоненты

**Button** (`Button.tsx`)
- Универсальная кнопка с вариантами: primary, secondary, ghost
- Поддержка иконок, состояний loading/disabled
- Размеры: стандартный (40px высота)

**Input** (`Input.tsx`)
- Поле ввода с поддержкой placeholder, error состояния
- Интеграция с иконками

**Card** (`Card.tsx`)
- Карточка для отображения медиафайлов
- Поддержка превью, меток, действий
- Режимы: standard, compact

**Tag** (`Tag.tsx`)
- Компонент метки для отображения и фильтрации
- Кликабельный, с поддержкой удаления

**Modal** (`Modal.tsx`)
- Модальное окно с overlay
- Поддержка закрытия по ESC и клику вне области

**Dialog** (`Dialog.tsx`)
- Диалоговое окно для подтверждений
- Варианты: alert, confirm, prompt

**Toast** (`Toast.tsx`, `ToastProvider.tsx`)
- Система уведомлений
- Типы: success, error, warning, info
- Автоматическое скрытие с настраиваемой длительностью

**Alert** (`Alert.tsx`, `AlertProvider.tsx`)
- Система предупреждений
- Блокирующие уведомления

**Icon** (`Icon.tsx`)
- Компонент иконок из SVG
- 162 иконки в `assets/icons/`
- Размеры: s, m, l

**ErrorBoundary** (`ErrorBoundary.tsx`)
- Обработка ошибок React
- Graceful degradation

**OnboardingScreen** (`OnboardingScreen.tsx`)
- Экран первого запуска
- Выбор рабочей папки, восстановление из backup

**UpdateNotification** (`UpdateNotification.tsx`)
- Уведомление о доступных обновлениях

#### `components/layout/` - Компоненты макета

**Layout** (`Layout.tsx`)
- Основной макет приложения
- Объединяет Sidebar, SearchBar, SectionHeader
- Адаптивная структура

**Sidebar** (`Sidebar.tsx`)
- Боковое меню навигации
- Иконки для основных разделов
- Активное состояние

**SearchBar** (`SearchBar.tsx`)
- Поисковая строка с автодополнением
- Интеграция с SearchDropdown
- Debounce 300ms

**SearchDropdown** (`SearchDropdown.tsx`)
- Выпадающий список результатов поиска
- Поиск по ID, меткам, категориям
- Навигация клавиатурой

**SectionHeader** (`SectionHeader.tsx`)
- Заголовок раздела с действиями
- Кнопки действий, фильтры

#### `components/gallery/` - Галерея карточек

**MasonryGrid** (`MasonryGrid.tsx`)
- Виртуализированная masonry сетка
- Режимы: standard (6 колонок), compact (10 колонок)
- Ленивая загрузка превью через Intersection Observer
- Оптимизация для больших коллекций

**CardViewModal** (`CardViewModal.tsx`)
- Модальное окно просмотра карточки
- Полноразмерное изображение/видео
- Навигация между карточками
- Действия: добавление в мудборд, удаление, экспорт

**AddCardFlow** (`AddCardFlow.tsx`)
- Процесс добавления новых карточек
- Drag-and-drop + file dialog
- Лимит: 50 файлов за операцию
- Прогресс импорта

#### `components/tags/` - Компоненты меток и категорий

**CategorySection** (`CategorySection.tsx`)
- Секция категории с метками
- Развертывание/сворачивание
- Статистика использования

**TagRow** (`TagRow.tsx`)
- Строка метки в списке
- Счетчик использования, действия

**CategoryStats** (`CategoryStats.tsx`)
- Статистика по категории
- Топ меток, малоиспользуемые

**CreateCategoryModal** (`CreateCategoryModal.tsx`)
- Создание новой категории

**EditCategoryModal** (`EditCategoryModal.tsx`)
- Редактирование категории
- Переименование, удаление меток

**CreateTagModal** (`CreateTagModal.tsx`)
- Создание новой метки
- Выбор категории, описание

#### `components/collections/` - Компоненты коллекций

**CollectionCard** (`CollectionCard.tsx`)
- Карточка коллекции
- Превью первых 4 карточек
- Счетчик карточек

**CreateCollectionModal** (`CreateCollectionModal.tsx`)
- Создание новой коллекции

**EditCollectionModal** (`EditCollectionModal.tsx`)
- Редактирование коллекции
- Добавление/удаление карточек

#### `components/settings/` - Компоненты настроек

**HistorySection** (`HistorySection.tsx`)
- История действий пользователя
- Фильтрация по периодам
- Экспорт истории

#### `components/duplicates/` - Поиск дубликатов

**DuplicateComparison** (`DuplicateComparison.tsx`)
- Сравнение дубликатов
- Визуальное сравнение, выбор для удаления

---

## Страницы приложения

### Роутинг

Приложение использует **HashRouter** из React Router DOM для совместимости с Electron.

**Основные маршруты**:
- `/` или `/cards` - Главная страница (карточки)
- `/collections` - Страница коллекций
- `/collections/:id` - Детальная страница коллекции
- `/tags` - Страница меток и категорий
- `/moodboard` - Мудборд
- `/duplicates` - Поиск дубликатов
- `/add` - Добавление новых карточек
- `/settings` - Настройки приложения

### CardsPage

**Файл**: `renderer/src/pages/CardsPage.tsx`

**Функциональность**:
- Отображение всех карточек в masonry сетке
- Фильтрация по типу (все/изображения/видео)
- Режимы отображения: standard, compact
- Поиск по ID, меткам, категориям
- Добавление/удаление из мудборда
- Модальный просмотр карточек
- Выбор нескольких карточек

**Состояния**:
- `viewMode` - режим отображения
- `contentFilter` - фильтр по типу
- `selectedCards` - выбранные карточки
- `searchResults` - результаты поиска

### CollectionsPage

**Файл**: `renderer/src/pages/CollectionsPage.tsx`

**Функциональность**:
- Список всех коллекций
- Создание новых коллекций
- Редактирование коллекций
- Удаление коллекций
- Переход к детальной странице

### CollectionDetailPage

**Файл**: `renderer/src/pages/CollectionDetailPage.tsx`

**Функциональность**:
- Отображение карточек коллекции
- Добавление карточек в коллекцию
- Удаление карточек из коллекции
- Редактирование названия и описания

### TagsPage

**Файл**: `renderer/src/pages/TagsPage.tsx`

**Функциональность**:
- Управление категориями и метками
- Создание/редактирование/удаление категорий
- Создание/редактирование/удаление меток
- Статистика использования
- Фильтрация карточек по меткам

### MoodboardPage

**Файл**: `renderer/src/pages/MoodboardPage.tsx`

**Функциональность**:
- Отображение карточек мудборда
- Удаление из мудборда
- Экспорт мудборда в папку
- Очистка мудборда

### DuplicatesPage

**Файл**: `renderer/src/pages/DuplicatesPage.tsx`

**Функциональность**:
- Поиск дубликатов по хешу файлов
- Визуальное сравнение
- Удаление дубликатов
- Web Worker для фоновой обработки

### AddPage

**Файл**: `renderer/src/pages/AddPage.tsx`

**Функциональность**:
- Импорт файлов (drag-and-drop + file dialog)
- Обработка до 50 файлов
- Прогресс импорта
- Автоматическая организация по дате
- Генерация превью

### SettingsPage

**Файл**: `renderer/src/pages/SettingsPage.tsx`

**Функциональность**:
- **Вкладка Storage**:
  - Информация о рабочей папке
  - Размеры файлов (изображения, видео, кеш)
  - Перенос рабочей папки
  - Очистка кеша

- **Вкладка Statistics**:
  - Общая статистика (карточки, метки, коллекции)
  - Топ меток и коллекций
  - Малоиспользуемые метки
  - Пересчет счетчиков

- **Вкладка History**:
  - История действий пользователя
  - Фильтрация по периодам
  - Экспорт истории

- **Резервное копирование**:
  - Создание backup (1-8 частей)
  - Восстановление из backup
  - Прогресс операций

- **Проверка целостности**:
  - Валидация базы данных
  - Автоматическое исправление проблем

---

## Дизайн-система

### Цветовая палитра

**Grayscale (Основная шкала серого)**:
- `grayscale-25` - #FFFFFF (белый)
- `grayscale-50` - #F5F4F7 (фон)
- `grayscale-100` - #EBE9EE (светло-серый)
- `grayscale-200` - #D5D3D9 (границы)
- `grayscale-300` - #BFBDC4
- `grayscale-400` - #A9A7AF
- `grayscale-500` - #93919A (вторичный текст)
- `grayscale-600` - #7D7B85
- `grayscale-700` - #676570
- `grayscale-800` - #514F5B (кнопки)
- `grayscale-900` - #3B3946 (основной текст)

**Red (Danger)**:
- `red-100` до `red-900` - для ошибок и предупреждений
- Основной: `red-500` (#EC221F)

**Yellow (Warning)**:
- `yellow-100` до `yellow-900` - для предупреждений
- Основной: `yellow-500` (#E8B931)

**Green (Success)**:
- `green-100` до `green-900` - для успешных операций
- Основной: `green-500` (#14AE5C)

### Семантические цвета

**Текст**:
- `--text-primary` - основной текст (grayscale-900)
- `--text-secondary` - вторичный текст (grayscale-500)
- `--text-light` - светлый текст (grayscale-50)
- `--text-disabled` - отключенный текст (grayscale-200)

**Фоны**:
- `--bg-primary` - основной фон (grayscale-50)
- `--bg-secondary` - вторичный фон (grayscale-25)
- `--bg-overlay` - overlay для модалок (rgba(59, 57, 70, 0.48))

**Кнопки**:
- `--bg-button-primary` - основная кнопка (grayscale-800)
- `--bg-button-secondary` - вторичная кнопка (grayscale-100)

### Типографика

**Шрифты**:
- **Заголовки**: YS Music (Bold, 700)
- **Текст**: Geologica (Light 300, Regular 400, Bold 700)

**Размеры**:
- `h1`: 40px / line-height 40px
- `h2`: 32px / line-height 32px
- `h3`: 28px / line-height 28px
- `h4`: 22px / line-height 22px
- `text-l`: 18px / line-height 24px
- `text-m`: 16px / line-height 22px (основной)
- `text-s`: 12px / line-height 12px

### Отступы (Spacing)

- `spacing-2xs`: 2px
- `spacing-xs`: 4px
- `spacing-s`: 8px
- `spacing-m`: 12px
- `spacing-l`: 16px
- `spacing-xl`: 24px
- `spacing-2xl`: 32px
- `spacing-3xl`: 40px

### Скругления (Border Radius)

- `radius-xs`: 4px
- `radius-s`: 8px
- `radius-m`: 12px
- `radius-l`: 16px
- `radius-xl`: 24px
- `radius-round`: 50%

### Тени (Box Shadow)

- `shadow-s`: 0px 1px 2px rgba(59, 57, 70, 0.08)
- `shadow-m`: 0px 2px 8px rgba(59, 57, 70, 0.12)
- `shadow-l`: 0px 4px 16px rgba(59, 57, 70, 0.16)
- `shadow-xl`: 0px 8px 32px rgba(59, 57, 70, 0.24)

### Переходы (Transitions)

- `transition-fast`: 150ms ease-in-out
- `transition-base`: 250ms ease-in-out
- `transition-slow`: 350ms ease-in-out

### Размеры окна

- Минимальный: 1920×1080
- Максимальный: 2560×1440
- Система запоминает последний размер окна

### Z-Index

- `z-base`: 0
- `z-header`: 20
- `z-dropdown`: 30
- `z-sidebar`: 100
- `z-tooltip`: 110
- `z-overlay`: 200
- `z-modal`: 201
- `z-toast`: 300

---

## База данных

### IndexedDB через Dexie.js

ARC использует IndexedDB для хранения метаданных через библиотеку Dexie.js.

### Схема базы данных

**Версия 3 (текущая)**:

#### Таблица `cards`
- `id` (primary key) - уникальный ID карточки
- `fileName` - имя файла
- `filePath` - путь к файлу
- `type` - тип: image | video
- `format` - формат: jpg | jpeg | png | webp | mp4 | webm
- `dateAdded` - дата добавления
- `dateModified` - дата изменения (опционально)
- `fileSize` - размер файла в байтах
- `width`, `height` - размеры (для изображений)
- `duration` - длительность (для видео)
- `thumbnailUrl` - URL превью
- `tags` (multi-entry index) - массив ID меток
- `collections` (multi-entry index) - массив ID коллекций

#### Таблица `tags`
- `id` (primary key) - уникальный ID метки
- `name` - название метки
- `categoryId` - ID категории
- `description` - описание (опционально)
- `dateCreated` - дата создания
- `cardCount` - количество карточек с этой меткой

#### Таблица `categories`
- `id` (primary key) - уникальный ID категории
- `name` - название категории
- `dateCreated` - дата создания
- `tagIds` (multi-entry index) - массив ID меток

#### Таблица `collections`
- `id` (primary key) - уникальный ID коллекции
- `name` - название коллекции
- `description` - описание (опционально)
- `dateCreated` - дата создания
- `dateModified` - дата изменения
- `cardIds` (multi-entry index) - массив ID карточек
- `thumbnails` - массив URL превью (первые 4)

#### Таблица `moodboard`
- `id` (primary key) - всегда 'default'
- `cardIds` (multi-entry index) - массив ID карточек
- `dateModified` - дата изменения

#### Таблица `settings`
- `id` (primary key) - всегда 'settings'
- `workingDirectory` - путь к рабочей папке
- `theme` - тема (light | dark)
- `dateInstalled` - дата установки
- `version` - версия приложения

#### Таблица `searchHistory`
- `id` (primary key)
- `query` - поисковый запрос
- `timestamp` - время запроса
- `tagIds` (multi-entry index) - ID меток

#### Таблица `viewHistory`
- `id` (primary key)
- `cardId` - ID просмотренной карточки
- `timestamp` - время просмотра

#### Таблица `thumbnailCache`
- `id` (primary key)
- `cardId` - ID карточки
- `dateGenerated` - дата генерации
- `expiresAt` - дата истечения (30 дней)

### Миграции

**Версия 1 → 2**:
- Добавлено поле `description` к меткам

**Версия 2 → 3**:
- Удалено поле `inMoodboard` из карточек (используется только `moodboard.cardIds`)

### Основные операции

**CRUD для карточек**:
- `addCard()` - добавление
- `getCard()`, `getAllCards()` - получение
- `updateCard()` - обновление (с обновлением счетчиков меток)
- `deleteCard()` - удаление (с удалением файлов)

**CRUD для меток**:
- `addTag()` - добавление
- `getAllTags()` - получение
- `updateTag()` - обновление
- `deleteTag()` - удаление (с удалением из всех карточек)

**CRUD для категорий**:
- `addCategory()` - добавление
- `getAllCategories()` - получение
- `updateCategory()` - обновление
- `deleteCategory()` - удаление (с удалением всех меток)

**CRUD для коллекций**:
- `addCollection()` - добавление
- `getAllCollections()`, `getCollection()` - получение
- `updateCollection()` - обновление
- `deleteCollection()` - удаление (с удалением ссылок из карточек)

**Операции с мудбордом**:
- `getMoodboard()` - получение
- `addToMoodboard()` - добавление карточки
- `removeFromMoodboard()` - удаление карточки
- `clearMoodboard()` - очистка

**Поиск**:
- `searchCards()` - поиск по фильтрам
- `searchCardsAdvanced()` - расширенный поиск по ID, меткам, категориям
- `getSimilarCards()` - поиск похожих карточек по меткам

**Статистика**:
- `getStatistics()` - общая статистика
- `getTopTags()` - топ меток
- `getTopCollections()` - топ коллекций
- `getUnderusedTags()` - малоиспользуемые метки

**Экспорт/Импорт**:
- `exportDatabase()` - экспорт в JSON
- `importDatabase()` - импорт из JSON

**Целостность данных**:
- `recalculateTagCounts()` - пересчет счетчиков
- `findOrphanTags()` - поиск меток с несуществующими категориями
- `cleanupOrphanTags()` - очистка меток-сирот

---

## IPC коммуникация

### Preload скрипт

**Файл**: `src/preload/preload.ts`

Preload скрипт создает безопасный мост между main и renderer процессами через `contextBridge`.

### ElectronAPI интерфейс

Все методы доступны через `window.electronAPI` в renderer процессе.

#### Файловая система

- `selectWorkingDirectory()` - выбор рабочей папки
- `scanDirectory(dirPath)` - сканирование директории
- `getFileInfo(filePath)` - информация о файле
- `fileExists(filePath)` - проверка существования
- `organizeFile(sourcePath, workingDir)` - организация файла по дате
- `saveFileFromBuffer(buffer, fileName, workingDir)` - сохранение из буфера
- `generateThumbnail(filePath, workingDir)` - генерация превью
- `getFileURL(filePath)` - получение file:// URL

#### Системные операции

- `openFileLocation(filePath)` - открыть в проводнике
- `exportFile(sourcePath, defaultFileName)` - экспорт файла
- `copyToClipboard(text)` - копирование в буфер
- `deleteFile(filePath)` - удаление файла
- `getDirectorySize(workingDir)` - размеры директории
- `moveWorkingDirectory(oldDir, newDir)` - перенос папки
- `exportMoodboard(filePaths, targetDir)` - экспорт мудборда

#### Резервное копирование

- `createBackup(outputPath, workingDir, parts, databaseJson)` - создание backup
- `restoreBackup(archivePath, targetDir)` - восстановление
- `selectBackupPath(defaultFileName)` - выбор пути для backup
- `selectArchivePath()` - выбор архива для восстановления
- `onBackupProgress(callback)` - подписка на прогресс

#### Системные функции

- `showNotification(title, body)` - системное уведомление
- `getAppVersion()` - версия приложения
- `checkForUpdates()` - проверка обновлений
- `openLogsFolder()` - открыть папку с логами
- `installUpdate()` - установить обновление

#### Настройки

- `saveSetting(key, value)` - сохранение настройки
- `getSetting(key)` - получение настройки
- `removeSetting(key)` - удаление настройки

#### История действий

- `getHistory(workingDir?)` - получение истории
- `addHistoryEntry(workingDir, entry)` - добавление записи
- `clearHistory(workingDir?)` - очистка истории

#### События

- `onUpdateAvailable(callback)` - обновление доступно
- `onUpdateReady(callback)` - обновление готово
- `onNavigate(callback)` - навигация от трея
- `onExternalFileDownloaded(callback)` - файл загружен из браузера
- `onThumbnailError(callback)` - ошибка генерации превью

### IPC Handlers (Main Process)

**Файл**: `src/main/ipc-handlers.ts`

Все обработчики регистрируются в `registerIPCHandlers()`.

**Основные группы обработчиков**:
- Файловая система (диалоги, сканирование, организация)
- Генерация превью (Sharp для изображений, FFmpeg для видео)
- Резервное копирование (Archiver, разделение на части)
- Системные функции (уведомления, обновления)
- Настройки (localStorage через Electron)
- История действий (JSON файлы)

---

## Файловая система

### Структура рабочей папки

```
рабочая_папка/
├── 2024/              # Год
│   ├── 1/            # Месяц
│   │   ├── 15/       # День
│   │   │   ├── image1.jpg
│   │   │   └── video1.mp4
│   │   └── 16/
│   └── 2/
└── _cache/            # Кеш
    └── thumbs/        # Превью
        ├── image1_thumb.jpg
        └── video1_thumb.jpg
```

### Организация файлов

При импорте файлы автоматически организуются по структуре:
`{год}/{месяц}/{день}/{имя_файла}`

### Превью

Превью генерируются в папку:
`_cache/thumbs/{имя_файла}_thumb.jpg`

**Изображения**: Sharp, ресайз до 300px по большей стороне
**Видео**: FFmpeg, кадр на 1 секунде, ресайз до 300px

### Операции с файлами

**Импорт**:
1. Пользователь выбирает файлы (drag-and-drop или dialog)
2. Файлы копируются в рабочую папку по структуре даты
3. Генерируются превью
4. Создаются записи в БД

**Удаление**:
1. Удаление записи из БД
2. Удаление исходного файла
3. Удаление превью

**Экспорт**:
1. Копирование файла в выбранную папку
2. Сохранение оригинального имени

**Перенос папки**:
1. Копирование всех файлов в новую папку
2. Обновление путей в БД
3. Удаление старой папки (опционально)

---

## Производительность

### Оптимизации

#### Виртуализация

- **MasonryGrid**: Виртуализация через react-window
- Рендеринг только видимых карточек
- Динамическая высота элементов

#### Ленивая загрузка

- **Intersection Observer API**: Загрузка превью только при появлении в viewport
- **Data URLs**: Превью кешируются в IndexedDB как Blob

#### Debounce

- **Поиск**: 300ms debounce для поисковых запросов
- Предотвращение избыточных запросов к БД

#### Web Workers

- **Поиск дубликатов**: Фоновая обработка в Web Worker
- Не блокирует UI при больших коллекциях

#### Кеширование

- **Превью**: Кеш в IndexedDB (30 дней)
- **Размеры карточек**: Кеширование для masonry layout

### Ограничения

- **Импорт**: Максимум 50 файлов за операцию
- **Коллекции**: До 50,000 файлов (оптимизировано)
- **Размер окна**: 1920×1080 — 2560×1440

---

## Сборка и развертывание

### Разработка

```bash
# Запуск в режиме разработки
npm run dev

# Сборка renderer
npm run build:renderer:dev

# Запуск Electron
npm run electron:dev
```

### Сборка

```bash
# Сборка всех частей
npm run build

# Сборка main process
npm run build:main

# Сборка preload
npm run build:preload

# Сборка renderer
npm run build:renderer
```

### Создание установщика

```bash
# Сборка для Windows
npm run build:prod

# С подписью (не публикует)
npm run build:prod:signed

# С публикацией обновлений
npm run release
```

### Конфигурация Electron Builder

**Файл**: `electron-builder.yml`

- **App ID**: `com.arc.app`
- **Product Name**: `ARC`
- **Target**: NSIS установщик для Windows
- **Icon**: `resources/icon.ico`
- **Protocol**: `arc://` для импорта из браузера

### Автообновления

- **Сервис**: electron-updater
- **Конфигурация**: `release/latest.yml`
- **Проверка**: При запуске и вручную из настроек
- **Установка**: Автоматическая после загрузки

---

## Заключение

Эта документация описывает полную архитектуру и реализацию приложения ARC. Для получения дополнительной информации обращайтесь к исходному коду или создавайте issues в репозитории проекта.

