---
name: arc-code-review
description: >-
  Orchestrates code review for Artist Reference Collection (Electron + React):
  routes diff/PR checks to Bugbot, Security Review, UI checklist, perf and IPC
  checklists. Use when the user asks for code review, PR review, «ревью PR»,
  «проверь diff», «code review», before merge, or when git-task-finish runs
  pre-merge review.
---

# ARC Code Review

Orchestrator ревью для **Artist Reference Collection**. Дополняет always-applied rules и **не заменяет** `arc-ui-dev` для UI-разработки.

## Границы ответственности

| Skill / tool | Когда |
|--------------|-------|
| **arc-code-review** (этот) | Ревью diff/PR, cross-cutting: main, IPC, storage, perf, описание PR |
| **arc-ui-dev** | Разработка UI + UI-ревью по [review-template.md](../arc-ui-dev/references/review-template.md) |
| **review-bugbot** | Баги, регрессии, edge cases в diff |
| **review-security** | Безопасность Electron/IPC/файлы |

При конфликте: **ARC rules (.mdc) > Figma > этот skill > generic советы ИИ**.

## Быстрый старт

1. Определить scope: `branch changes` (по умолчанию) или `uncommitted changes`.
2. Классифицировать diff — [router](#router-по-типу-diff).
3. Запустить нужные проходы **по одной цели за раз** (не один «проверь всё»).
4. Собрать findings в [единый формат](#формат-вывода).
5. Критичные находки — не merge без решения пользователя.

## Router по типу diff

Посмотреть `git diff --stat` (или stat от subagent) и выбрать проходы:

| Путь в diff | Проходы |
|-------------|---------|
| `renderer/src/components/` | Bugbot + **UI** (arc-ui-dev review-template) |
| `renderer/src/pages/`, `renderer/src/styles/` | Bugbot + UI |
| `src/main/ipc*.ts`, `src/preload/` | Bugbot + **Security** + [ipc-contract.md](references/ipc-contract.md) |
| `src/main/storage/` | Bugbot + Security + [perf-checklist.md](references/perf-checklist.md) |
| `src/main/` (прочее) | Bugbot + Security |
| `package.json`, lockfile | Security (supply chain) + напомнить `npm audit` |
| Только docs / copy | Bugbot опционально; UI-checklist если тексты UI |

**UI-проход:** прочитать [review-template.md](../arc-ui-dev/references/review-template.md) и [rules-index.md](../arc-ui-dev/references/rules-index.md) — не дублировать чеклист здесь.

**Минимум перед merge:** Bugbot + Security, если diff затрагивает `src/main/` или `src/preload/`.  
**UI-изменения:** добавить UI-проход.

## Проход 1: Bugbot

Следовать skill **review-bugbot** (`~/.cursor/skills-cursor/review-bugbot/`).

`Custom Instructions` — **целиком** из [bugbot-instructions.md](references/bugbot-instructions.md).

```text
Full Repository Path: <absolute path to ARC repo>
Diff: branch changes
Custom Instructions: <содержимое bugbot-instructions.md>
```

Для uncommitted: `Diff: uncommitted changes`.

## Проход 2: Security Review

Следовать skill **review-security**.

`Custom Instructions` — из [security-instructions.md](references/security-instructions.md).

```text
Full Repository Path: <absolute path>
Diff: branch changes
Custom Instructions: <содержимое security-instructions.md>
```

Дополнительно сверить diff с [electron-security.md](references/electron-security.md) — subagent может не покрыть все ARC-специфичные пункты.

## Проход 3: UI (renderer)

Если diff затрагивает renderer UI:

1. [review-template.md](../arc-ui-dev/references/review-template.md) — полный чеклист.
2. Figma node — если пользователь или задача его указали.
3. Findings: `path:line — issue`.

## Проход 4: Perf / storage (точечно)

Только если diff в `src/main/storage/`, gallery hooks, feed, cache:

- [perf-checklist.md](references/perf-checklist.md)
- Одна цель за запрос; привязка к `file:line`.

## Проход 5: Описание PR

Перед `gh pr create` или в git-task-finish:

- [pr-description-template.md](references/pr-description-template.md)
- Проверить глазами ревьюера без контекста: что / зачем / риски / как проверить.

## Быстрый first pass (опционально)

Если некогда на полный цикл — один проход по diff с фокусом:

1. Обратная совместимость (IPC, публичные пропсы, API preload).
2. Edge cases (пустые коллекции, null, большие галереи, отмена async).
3. Регрессии в общих компонентах и `src/main/storage/`.

Не заменяет Bugbot + Security перед merge.

## Формат вывода

```markdown
## Резюме
[1–2 предложения: scope diff, какие проходы выполнены]

## Findings

### Критично
| Severity | Location | Finding | Как проверить |
|----------|----------|---------|---------------|
| critical | src/main/ipc.ts:42 | … | … |

### Важно
...

### Рекомендации
...

## Ок
- [что проверено и чисто]

## Ручная проверка
1. …
2. …
```

Уровни: **Критично** — блокер merge (security, data loss, сломан общий компонент); **Важно** — исправить до merge или явно принять риск; **Рекомендации** — улучшения.

Finding всегда с `file:line` где возможно.

## Запреты

- Не чинить код и не коммитить — только отчёт, если пользователь не просил иначе.
- Не один мастер-промпт вместо Bugbot/Security для merge-ready ревью.
- Не дублировать UI-чеклист из arc-ui-dev в отчёте — ссылаться на проход UI.
- Не предлагать Next.js, новые npm-зависимости, паттерны вне стека ARC.
- CVE и версии пакетов — `npm audit` / OSV, не только вывод ИИ.

## Связанные skills

- [arc-ui-dev](../arc-ui-dev/SKILL.md) — UI dev и UI-ревью
- [git-task-finish](../git-task-finish/SKILL.md) — вызывает этот skill перед push/merge
- review-bugbot, review-security — subagents

## References

- [bugbot-instructions.md](references/bugbot-instructions.md)
- [security-instructions.md](references/security-instructions.md)
- [electron-security.md](references/electron-security.md)
- [ipc-contract.md](references/ipc-contract.md)
- [perf-checklist.md](references/perf-checklist.md)
- [pr-description-template.md](references/pr-description-template.md)
- [examples.md](examples.md)
