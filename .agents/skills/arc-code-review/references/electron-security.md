# Electron security checklist (ARC)

Ручная сверка diff с этим списком — дополнение к Security Review subagent.

## IPC contract

- [ ] Каждый новый канал `arc:*` зарегистрирован и в main, и в preload typings
- [ ] Payload validated (`unknown` → narrow type + guards) до использования
- [ ] Ошибки IPC не отдают stack trace / internal paths в renderer без нужды
- [ ] Maintenance lock (`assertNotMaintenance`) там, где длительные операции с library

## Preload boundary

- [ ] `contextBridge.exposeInMainWorld` — только необходимый API
- [ ] Renderer не получает прямой доступ к `fs`, `path`, `child_process`
- [ ] Нет `nodeIntegration: true` в webPreferences (не менять без явного решения)

## Filesystem

- [ ] Пути нормализуются и проверяются относительно library root
- [ ] Import / scan / delete не следуют за symlink вне sandbox
- [ ] Dialog paths (`dialog.showOpenDialog`) проверяются перед записью в config

## Media server

- [ ] Local media URLs не раскрывают произвольные file:// вне library
- [ ] CORS / origin checks в media server host согласованы с изменениями

## AI / external (если затронут ipcAi)

- [ ] Download model paths — только intended directories
- [ ] User query не попадает в shell commands
- [ ] Rate limiting / cancellation для тяжёлых операций

## Renderer

- [ ] Нет `eval`, `new Function`, dynamic script injection
- [ ] User-generated HTML escaped or sanitized
- [ ] External links через безопасный helper, не raw `window.open` с user input

## Secrets

- [ ] Нет ключей в `renderer/`, `src/main/`, `.env` в коммите
- [ ] Логи не пишут full paths с PII без необходимости

## После находки critical

Секрет в истории git → считать скомпрометированным; ротация на стороне сервиса, не только удаление из кода.
