# Прокси обратной связи ARC → GitHub Issues

Тонкий Cloudflare Worker принимает отчёты из приложения и создаёт Issues в приватном репозитории. PAT GitHub хранится только на сервере.

## 1. Labels в GitHub

```bash
node scripts/setup-beta-feedback-labels.mjs
```

Или вручную через GitHub → Issues → Labels:

| Label | Цвет | Назначение |
|-------|------|------------|
| `beta-feedback` | `#7057ff` | Все отчёты из приложения |
| `from-app` | `#0e8a16` | Отправлено через in-app форму |
| `type:bug` | `#d73a4a` | Баг |
| `type:ui` | `#fbca04` | Визуальная неточность |
| `type:ux` | `#0075ca` | UX |
| `type:performance` | `#e99695` | Производительность |
| `type:feature` | `#a2eeef` | Идея |
| `type:content` | `#cfd3d7` | Тексты |

## 2. GitHub Project (канбан)

1. Repository → **Projects** → **New project** → **Board**
2. Название: **Beta Feedback**
3. Колонки статусов: **Новый** → **В работе** → **Исправлено** / **Отклонено**
4. Workflow: автоматически добавлять issues с label `beta-feedback`

## 3. Fine-grained PAT

1. GitHub → Settings → Developer settings → Fine-grained tokens
2. Repository access: только `Artist-Reference-Collection`
3. Permissions: **Issues** — Read and write

## 4. Deploy Worker

```bash
cd scripts/feedback-proxy
npm install -g wrangler   # если ещё нет
wrangler login
wrangler secret put GITHUB_TOKEN
wrangler secret put FEEDBACK_API_KEY   # придумайте длинный случайный ключ
npm run deploy
```

После deploy скопируйте URL worker (например `https://arc-feedback-proxy.<account>.workers.dev`).

## 5. Переменные для сборки ARC

Перед `npm run dist:win` или в `.env` для dev:

```env
ARC_FEEDBACK_PROXY_URL=https://arc-feedback-proxy.<account>.workers.dev
ARC_FEEDBACK_API_KEY=<тот же ключ, что FEEDBACK_API_KEY в Worker>
```

В dev-сессии Electron переменные читаются из окружения процесса main.

## 6. Проверка

```bash
curl -X POST "%ARC_FEEDBACK_PROXY_URL%" ^
  -H "Authorization: Bearer %ARC_FEEDBACK_API_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"[Bug] Test\",\"body\":\"Test from curl\",\"labels\":[\"beta-feedback\"]}"
```

Ожидается JSON с `issueNumber` и `issueUrl`.
