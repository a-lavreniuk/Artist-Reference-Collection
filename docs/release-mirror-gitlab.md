# Зеркало релизов: GitHub + GitLab

Запасной хостинг обновлений ARC. Задача AnyType: «Второй сервер для билдов».

## Зачем

С территории РФ GitHub иногда недоступен. Автообновление ходит в GitHub Releases; при сбое клиент один раз пробует **публичный GitLab-проект только с релизными артефактами** (не полное зеркало исходников).

## Целевая схема

```text
git tag x.y.z
    → GitHub Actions
        → electron-builder --publish always
            → GitHub Releases  (primary → app-update.yml)
            → GitLab Releases  (зеркало артефактов)

ARC (packaged)
    → checkForUpdates → GitHub
        → ok → download с GitHub
        → ошибка → setFeedURL(gitlab) → один повтор
            → ok → download с GitLab (тот же feed в сессии)
            → ошибка → arc:update-error
```

Первый provider в `electron-builder.yml` — GitHub. Переключение на GitLab делает код в `src/main/updater.ts`, не multi-feed electron-updater.

## GitLab-проект (только релизы)

| Поле | Значение |
|------|----------|
| URL | https://gitlab.com/ides07/arc |
| Project ID | `84578247` |
| Visibility | **public** |
| Содержимое | релизы / assets / `latest.yml` — не полный клон GitHub |

Константы клиента: [`src/main/updateFeedGitlab.ts`](../src/main/updateFeedGitlab.ts).  
Publish: [`electron-builder.yml`](../electron-builder.yml) (второй provider `gitlab`).

### Секрет для CI (куда вставлять токен)

Токен **не** кладут в код и **не** в приложение. Только в секреты GitHub Actions:

1. Создать токен на GitLab: [Personal Access Tokens](https://gitlab.com/-/user_settings/personal_access_tokens) — scope **`api`** (или Project Access Token у проекта `84578247` с правом релизов).
2. Открыть репозиторий на GitHub: **Artist-Reference-Collection**.
3. **Settings** → **Secrets and variables** → **Actions**.
4. **New repository secret**:
   - Name: `GITLAB_TOKEN` (имя должно совпасть один в один)
   - Secret: вставить токен
5. Save.

Этот секрет подхватывает [`.github/workflows/release-windows.yml`](../.github/workflows/release-windows.yml) при `npm run publish:win`. Без него заливка на GitLab упадёт (оба канала обязательны).

Теги по-прежнему **без** `v` (`0.1.8`). В конфиге GitLab: `vPrefixedTagName: false`.

## Что уже в коде

| Файл | Изменение |
|------|-----------|
| `package.json` | `electron-updater` ^6.8.9, `electron-builder` ^26.15.3 (GitLab provider) |
| `electron-builder.yml` | publish GitHub (primary feed) |
| `.github/workflows/release-windows.yml` | после GitHub — mirror assets на GitLab |
| `src/main/updateFeedGitlab.ts` | host / projectId |
| `src/main/updater.ts` | fallback GitHub → GitLab при ошибке check |
| `scripts/create-gitlab-releases-mirror.mjs` | создание публичного проекта |
| `scripts/upload-local-release-to-gitlab.mjs` | заливка assets через Generic Packages |

macOS publish на зеркало — позже (сейчас workflow только artifacts).

## Риски

| Риск | Митигация |
|------|-----------|
| gitlab.com недоступен из РФ | Та же схема с другим `host` позже |
| Приватный проект | Только Public |
| Неверный username в `projectId` | Скрипт с `UPDATE_FILES` или ручная правка ID |
| Нет `GITLAB_TOKEN` в Actions | Fail CI на GitLab upload |

## Критерии готовности

- [x] Проект создан: https://gitlab.com/ides07/arc (`84578247`, public)
- [x] `GITLAB_TOKEN` в GitHub Actions secrets
- [ ] Релиз по тегу появляется на GitHub и GitLab
- [ ] При недоступности GitHub клиент логирует `[updater] fallback to gitlab` и обновляется с GitLab
