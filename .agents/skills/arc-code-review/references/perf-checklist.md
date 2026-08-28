# Performance checklist (ARC)

Точечный проход при diff в storage, gallery, main process. Одна категория за запрос.

## SQLite (`src/main/storage/`, better-sqlite3)

- [ ] Запросы **внутри циклов** по N карточкам → batch / single query
- [ ] Подготовленные statements переиспользуются, не создаются на каждую строку
- [ ] Индексы для новых WHERE/ORDER BY (или явное обоснование full scan)
- [ ] Транзакции для bulk insert/update вместо commit per row
- [ ] Backfill / migration — не блокирует UI thread без прогресса и cancel

**N+1 формат finding:** «при N карточек → M запросов; после правки → K».

## Gallery renderer

- [ ] Сортировка/фильтрация больших списков — не O(n²) без необходимости
- [ ] Derived lists — не пересчитывать в каждом render без memo
- [ ] Pagination / virtual scroll — не грузить все карточки сразу
- [ ] `galleryMediaCache` и аналоги — bounded size или eviction

## Memory / subscriptions

- [ ] `useEffect` cleanup: IPC, `window` events, intervals, AbortController
- [ ] Кэши не растут без лимита при длительной сессии
- [ ] Konva / moodboard — destroy stage/layers on unmount
- [ ] Thumbnail decode — cancel при unmount или смене selection

## Main process

- [ ] Sync fs на больших деревьях — consider async + yield/chunk
- [ ] Sharp / ffmpeg — не дублировать работу на одном файле
- [ ] AI index / embeddings — pause/resume согласованы с navigation epoch

## Когда НЕ поднимать

- O(n) на сотнях элементов при отсутствии вложенных циклов
- Микрооптимизации без профиля на hot path

## Finding format

`file:line — perf: [текущая проблема] — [сценарий масштаба] — [предложение]`
