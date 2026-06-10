# AGENTS.md

## Cursor Cloud specific instructions

### Product

**ARC (Artist Reference Collection)** — offline-first Electron desktop app (React + Vite renderer, TypeScript main/preload). No separate backend server, Docker, or configured test/lint scripts.

### Dependencies

- **Node.js 22** (matches CI in `.github/workflows/release-windows.yml`)
- `npm ci` at repo root (runs `postinstall` → `electron-rebuild` for `better-sqlite3` and `sharp`)

### Standard commands

| Command | Purpose |
|--------|---------|
| `npm run dev` | Vite (5173) + Electron via `concurrently` |
| `npm run renderer:dev` | Vite only on **http://localhost:5173** |
| `npm run build` | Typecheck/build `main`, `preload`, `renderer` (use as compile check) |
| `npm run electron:dev` | Electron after Vite is up (no GPU flags) |

See `README.md` for Windows packaging (`dist:win`, `publish:win`).

### Cloud VM / headless GUI caveat

On Linux cloud VMs, `npm run dev` often fails when Electron exits with **SIGTRAP** (GPU/WebGL). **Vite alone is not enough** for full IPC (`window.arc`, SQLite, media import).

**Reliable full-stack dev on Cloud Agent VMs:**

1. Start Vite in tmux: `npm run renderer:dev`
2. Build main/preload: `npm run build:main && npm run build:preload && npm run rebuild:native`
3. Launch Electron with software rendering:

```bash
export NODE_ENV=development ELECTRON_DISABLE_SANDBOX=1 LIBGL_ALWAYS_SOFTWARE=1
./node_modules/.bin/electron . \
  --disable-gpu --no-sandbox --disable-dev-shm-usage \
  --remote-debugging-port=9222 '--remote-allow-origins=*'
```

DBus/GPU warnings in stderr are usually harmless if the window stays open. DevTools may open automatically in development; close it or use CDP against the `localhost:5173` page target (not the DevTools page).

### First-run app state

Fresh runs show a **release-notes modal** and an empty gallery until a **library folder** is set under **Хранилище** (navbar menu → settings). For UI-only checks without storage, navigate to `#/ui-kit` or `#/collections`.

### Services (dev)

| Service | Required | Port / notes |
|--------|----------|----------------|
| Vite dev server | Yes (dev) | **5173** |
| Electron main | Yes (full E2E) | Loads `http://localhost:5173` in dev |
| GitHub Releases | No | Auto-update only |

### What is not in the repo

- No `npm test` / ESLint scripts
- No docker-compose or external DB server (SQLite is per-library file on disk)
