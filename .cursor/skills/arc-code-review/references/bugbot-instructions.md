# Custom Instructions: Bugbot для ARC

Вставлять целиком в `Custom Instructions` при вызове review-bugbot.

---

Стек: **Electron** (main/preload) + **React 19** renderer (Vite) + **better-sqlite3**. Desktop app, local-first. Базовая ветка: `main`.

## Приоритет проверки

1. **Обратная совместимость** — изменились ли сигнатуры IPC-каналов, типы в preload, публичные props общих компонентов (`renderer/src/components/`). Что сломается у существующих вызовов?
2. **Edge cases** — пустые коллекции, `null`/`undefined`, пустые строки, отмена/прерывание async, повторный вызов, большие галереи (10k+ карточек), concurrent access к storage.
3. **Регрессии** — общие компоненты (`EmptyState`, `ContextMenu`, `Tooltip`, gallery hooks), код, вызываемый из нескольких страниц.

## Hot paths (особое внимание)

- `src/main/ipc.ts`, `src/main/ipcStorage.ts`, `src/main/ipcAi.ts`
- `src/preload/index.ts`
- `src/main/storage/` (db, gallery filters, embeddings)
- `renderer/src/components/gallery/` (feed, cache, pagination)
- `renderer/src/hooks/`

## Electron / React

- `useEffect` без cleanup для подписок, таймеров, IPC listeners
- Race conditions при быстрой навигации или смене library root
- Состояние после unmount (setState на размонтированном компоненте)

## Формат каждой находки

- `file:line` — конкретное место
- Серьёзность: critical / important / suggestion
- Кратко: в чём риск и как воспроизвести вручную

Если серьёзных рисков нет — явно написать «критичных находок нет» и перечислить, что проверено.

Не предлагать Next.js, web-only API или новые npm-зависимости.
