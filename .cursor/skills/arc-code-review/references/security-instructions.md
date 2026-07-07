# Custom Instructions: Security Review для ARC

Вставлять целиком в `Custom Instructions` при вызове review-security.

---

Контекст: **Electron desktop app**, local library on disk, **IPC** main ↔ renderer через preload. Нет классического web-backend с JWT; фокус — desktop threat model.

## Проверить в diff

### IPC и preload (`src/main/ipc*.ts`, `src/preload/`)

- Новые/изменённые `ipcMain.handle` / `invoke`: валидация **всех** аргументов от renderer (тип, диапазон, длина).
- Нет ли escalation: renderer может вызвать опасное действие без проверки контекста (путь вне library root, произвольный filesystem).
- Preload expose: минимальный surface; нет лишних Node-примитивов в renderer.
- Согласованность имён каналов preload ↔ main (см. ipc-contract).

### Файловая система

- Path traversal при импорте, сканировании, backup/restore, migrate.
- Запись/удаление вне intended library root.
- Symlink / special paths на Windows.

### Renderer

- XSS: пользовательский контент (метки, подписи, HTML) → `dangerouslySetInnerHTML`, innerHTML без санитизации.
- `shell.openExternal` — только проверенные URL.
- Утечка абсолютных путей пользователя в UI или логах без необходимости.

### Секреты и конфиги

- API keys, tokens, connection strings в коде или коммите.
- Закомментированные credentials от отладки.

### Зависимости (если в diff package.json)

- Отметить подозрительные изменения; напомнить проверить через `npm audit`, не полагаться только на память модели о CVE.

## Hot files

- `src/main/ipc.ts`, `ipcStorage.ts`, `ipcAi.ts`
- `src/preload/index.ts`
- `src/main/libraryMigrate.ts`, backup/restore
- `src/main/media/`

## Формат находки

| Severity | Location | Finding | Exploit / scenario |

Severity: critical (RCE, data loss, path escape) / high / medium / low.

Если чисто — явно указать проверенные категории.

Не предлагать JWT/session hardening там, где auth не используется.
