---
name: git-task-finish
description: >-
  Завершает задачу: commit, push, merge в main, удаление ветки, затем закрытие
  карточки в AnyType. Use when the user says «заверши задачу», «закрой задачу»,
  «смержи и удали ветку», or asks to push code to GitHub and merge into main.
---

# Завершить задачу (Git + AnyType)

Закрывает цикл разработки: сохранить код на GitHub, влить тестовую ветку в `main`, удалить ветку, **затем** обновить или создать карточку в AnyType.

Репозиторий: **Artist Reference Collection**, базовая ветка: **`main`**.

## 1. Проверка перед действиями

```bash
git status
git branch -a
git log -5 --oneline
git diff --stat
```

Понять: текущая ветка, незакоммиченные файлы, коммиты впереди `main`. Нужен ли git вообще (есть ли изменения в коде).

## 2. Тесты (обязательно перед merge)

```bash
npm test
```

При падении — **остановиться**, сообщить пользователю. Merge, push и AnyType **не делать**.

## 2b. Code review (перед push/merge)

По skill **arc-code-review** (`.cursor/skills/arc-code-review/`):

1. Классифицировать diff:
   - незакоммиченное на текущей ветке: `git diff --stat` (+ `git diff --stat --cached` если есть staged);
   - коммиты ветки относительно `main`: `git diff main...HEAD --stat`.
   - если на `main` без коммитов впереди — опираться на `git diff --stat`, не на `main...HEAD`.
2. Минимум: **Bugbot** (`review-bugbot` + [bugbot-instructions.md](../arc-code-review/references/bugbot-instructions.md)), кроме diff только в `.cursor/skills/` или docs — тогда Bugbot опционально.
3. Если diff затрагивает `src/main/`, `src/preload/`, `src/main/storage/` — **Security Review** (+ [security-instructions.md](../arc-code-review/references/security-instructions.md)).
4. Если diff затрагивает renderer UI — UI-проход через **arc-ui-dev** [review-template.md](../arc-ui-dev/references/review-template.md).
5. **Critical** findings — остановиться, показать пользователю, merge **не делать** без явного решения.
6. Предложить текст PR по [pr-description-template.md](../arc-code-review/references/pr-description-template.md), если PR ещё не создан.

Пропустить только если пользователь явно просит «без ревью» / «срочно merge».

## 3. Коммит (автоматически)

Если есть незакоммиченные изменения:

1. `git add` — только файлы, относящиеся к задаче (не `.env`, ключи, мусор).
2. Сообщение коммита — агент формирует сам по diff:
   - первая строка: краткий заголовок (что и зачем);
   - вторая строка (`-m` повторно): детали.
3. На Windows PowerShell — два `-m`, не heredoc:

```bash
git commit -m "Short title." -m "Longer explanation of what changed and why."
```

Коммитить **без** явной просьбы пользователя — только в рамках этого skill по триггеру «заверши задачу» / «закрой задачу».

## 4. Резюме и подтверждение

Перед `push` и `merge` показать краткое резюме:

- текущая ветка;
- список коммитов / файлов;
- план: push → merge в main → удалить ветку → AnyType.

Спросить: **«Продолжать?»** — выполнять push/merge только после согласия.

Если **git не нужен** (нет изменений в репозитории) — пропустить шаги 5a/5b, перейти сразу к шагу 6.

## 5a. Сценарий: тестовая ветка (не `main`)

Эталонный порядок (как при завершении Navbar 2.0):

```bash
git push origin <current-branch>
git checkout main
git pull origin main
```

Если `pull` не сработал — `git fetch origin main && git merge origin/main --ff-only`, затем merge ветки.

```bash
git merge <current-branch> -m "Merge branch '<current-branch>'"
git push origin main
git branch -d <current-branch>
git push origin --delete <current-branch>
```

- **Обычный merge**, не squash — все коммиты ветки сохраняются в истории.
- При **конфликте merge** — **остановиться**, не решать самому, сообщить пользователю. AnyType не трогать.

Финальная проверка:

```bash
git status
git log -3 --oneline
git branch -a
```

Ожидание: на `main`, чистое дерево, синхронизация с `origin/main`, тестовая ветка удалена локально и на GitHub.

## 5b. Сценарий: хотфикс на `main`

Если уже на `main` (ветка не создавалась):

```bash
git push origin main
```

Merge и удаление ветки **не нужны**.

## 6. AnyType (после git)

По skill **anytype-task-finish** (`.cursor/skills/anytype-task-finish/`):

1. Выполнить **после** успешного git-финала (или сразу, если git не требовался).
2. Обновить карточку по `object_id` из сессии (**anytype-task-take**) или создать новую для задачи из чата.
3. Статус → **«Готово»**; в markdown — секция **«Результат»** (ссылка на PR + 5–10 предложений).
4. Другие свойства карточки не менять.

Если пользователь закрывает задачу с **незавершённой** работой — всё равно «Готово», в «Результат» указать, что не доделано.

## 7. Запреты

- Не `push --force` в `main` без явного запроса.
- Не `git commit --amend`, если коммит уже на remote (см. user rules).
- Не обновлять `git config`.
- Не squash-merge, если пользователь не попросил явно.
- Не обновлять AnyType при остановке на тестах, конфликте или critical review (кроме явной просьбы пользователя закрыть как есть).

## 8. Связка с другими skills

- Старт задачи и `object_id` — **anytype-task-take** («возьми задачу»).
- Ревью перед merge — **arc-code-review** (шаг 2b).
- UI-ревью внутри code review — **arc-ui-dev** (review-template).
- Закрытие карточки AnyType — **anytype-task-finish** (шаг 6).

## Пример

Пользователь на `irreversible-deletions`, есть правки:

1. `npm test` — OK  
2. **arc-code-review** (шаг 2b): Bugbot + Security/UI — OK  
3. commit с сообщением от агента  
4. Резюме → «Продолжать?» → да  
5. push ветки → merge в `main` → push `main` → удалить ветку  
6. **anytype-task-finish**: статус «Готово», «Результат» с PR и выжимкой  
7. Отчёт: хеш merge-коммита, ссылка на карточку AnyType
