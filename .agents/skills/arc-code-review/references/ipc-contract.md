# IPC contract review (preload ↔ main)

При изменениях в `src/preload/` или `src/main/ipc*.ts` — сверить контракт.

## Шаги

1. **Список каналов** — grep `ipcMain.handle('arc:` в main и matching invoke в preload.
2. **Имена** — один канал = одно имя; нет опечаток между слоями.
3. **Аргументы** — тип в preload совпадает с тем, что ожидает handler; лишние поля игнорируются или отклоняются явно.
4. **Return type** — renderer обрабатывает ошибки (reject) и edge cases (null, empty array).
5. **Breaking change** — если сигнатура изменилась: все call sites в renderer обновлены?

## Типичные файлы

| Слой | Путь |
|------|------|
| Preload API | `src/preload/index.ts` |
| Core IPC | `src/main/ipc.ts` |
| Storage | `src/main/ipcStorage.ts` |
| AI | `src/main/ipcAi.ts` |
| Renderer calls | `renderer/src/**/*.ts(x)` — `window.arc.*` или typed bridge |

## Breaking change checklist

- [ ] Переименование канала → обновлены preload + все invoke sites
- [ ] Новый обязательный аргумент → все callers передают его
- [ ] Изменён shape ответа → UI не читает старые поля
- [ ] Поведение при ошибке — не silent fail в gallery/settings

## Finding format

`preload:line ↔ main:line — mismatch: …`
