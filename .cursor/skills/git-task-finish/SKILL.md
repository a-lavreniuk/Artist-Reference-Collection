---
name: git-task-finish
description: >-
  Завершает задачу в git: commit, push, merge в main, удаление тестовой ветки.
  Use when the user says «заверши задачу», «закрой задачу», «смержи и удали ветку»,
  or asks to push code to GitHub and merge into main. Not tied to AnyType.
---

# Завершить задачу (Git)

Закрывает цикл разработки: сохранить код на GitHub, влить тестовую ветку в `main`, удалить ветку. **Не связан с AnyType.**

Репозиторий: **Artist Reference Collection**, базовая ветка: **`main`**.

## 1. Проверка перед действиями

```bash
git status
git branch -a
git log -5 --oneline
git diff --stat
```

Понять: текущая ветка, незакоммиченные файлы, коммиты впереди `main`.

## 2. Тесты (обязательно перед merge)

```bash
npm test
```

При падении — **остановиться**, сообщить пользователю. Merge и push **не делать**.

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

Коммитить **без** явной просьбы пользователя — только в рамках этого skill по триггеру «заверши задачу».

## 4. Резюме и подтверждение

Перед `push` и `merge` показать краткое резюме:

- текущая ветка;
- список коммитов / файлов;
- план: push → merge в main → удалить ветку.

Спросить: **«Продолжать?»** — выполнять push/merge только после согласия.

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
- При **конфликте merge** — **остановиться**, не решать самому, сообщить пользователю.

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

## 6. Запреты

- Не `push --force` в `main` без явного запроса.
- Не `git commit --amend`, если коммит уже на remote (см. user rules).
- Не обновлять `git config`.
- Не squash-merge, если пользователь не попросил явно.

## 7. Связка с другими skills

- Старт задачи — **anytype-task-take** («возьми задачу»).
- Этот skill — только git-финал («заверши задачу»).

## Пример

Пользователь на `irreversible-deletions`, есть правки:

1. `npm test` — OK  
2. commit с сообщением от агента  
3. Резюме → «Продолжать?» → да  
4. push ветки → merge в `main` → push `main` → удалить ветку локально и на GitHub  
5. Отчёт: хеш merge-коммита, что на чистом `main`
