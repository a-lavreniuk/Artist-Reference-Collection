# Примеры: arc-code-review

## 1. Полное ревью перед merge

**Запрос:** «Ревью PR перед merge»

**Действия:**

1. `git diff --stat` → затронуты `GalleryPage.tsx`, `useGalleryFeed.ts`, `ipcStorage.ts`
2. Router: Bugbot + Security + UI + perf (storage)
3. Bugbot с `bugbot-instructions.md`
4. Security с `security-instructions.md` + `electron-security.md`
5. UI: `arc-ui-dev/review-template.md`
6. Perf: `perf-checklist.md` только для `ipcStorage.ts` changes
7. Сводный отчёт в формате SKILL.md

## 2. Только main / IPC

**Запрос:** «Проверь diff в ipcAi»

**Действия:**

1. Security Review + `ipc-contract.md`
2. Bugbot (edge cases async AI operations)
3. UI-проход **не** нужен

## 3. Только renderer UI

**Запрос:** «Code review — правки TagsPage»

**Действия:**

1. Bugbot (regressions в общих компонентах)
2. `review-template.md` + rules EmptyState/ContextMenu если применимо
3. Security — пропустить, если diff не трогает preload/main

## 4. Перед git-task-finish

**Триггер:** пользователь «заверши задачу»

**Действия (arc-code-review):**

1. Краткий router по `git diff main...HEAD --stat`
2. Минимум Bugbot; Security если main/preload/storage
3. Список critical findings → спросить пользователя перед push
4. Предложить улучшить commit message / PR body по `pr-description-template.md`

## 5. Uncommitted changes

**Запрос:** «Проверь незакоммиченное»

**Действия:**

- Bugbot / Security с `Diff: uncommitted changes`
- Остальное как в сценарии 1 по router
