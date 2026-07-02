# Browser Extension (Chrome MVP)

Companion extension for **Artist Reference Collection (ARC)** — saves images from the web into the desktop library via a local HTTP API (same approach as [Eagle Web API](https://developer.eagle.cool/web-api)).

## Scope (MVP)

- Context menu on images: **Add to library** / **Добавить в библиотеку**
- **Hover button** on images (brand icon-only 32×32, Figma [1169:23991](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=1169-23991)) — click to save
- **Popup / page modals** in ARC modal layout (Figma [1799:15368](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=1799-15368), [1799:15407](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=1799-15407))
- **Alt + right-click** on `<img>`, `<picture>`, or `background-image` on the target element
- **Local HTTP API** in ARC on `http://127.0.0.1:47896/api/v1/`
- Offline **queue** (max 50) when ARC is not running; auto-drain when ARC is available (popup open, browser startup, periodic alarm, after each successful save)

Not in MVP: Safari/Firefox, batch save, page screenshots, tags/collections at save time, Chrome Web Store publish.

## Eagle vs ARC

| Eagle | ARC |
|-------|-----|
| `http://localhost:41595/api/v2/` | `http://127.0.0.1:47896/api/v1/` |
| `GET /app/info` | `GET /api/v1/app/info` |
| `POST /item/add` (`url`, …) | `POST /api/v1/item/add` (`url`, `website`, `pageTitle`) |
| No queue when app closed | Queue in `chrome.storage.local` |

## API

### `GET /api/v1/app/info`

Response (JSend):

```json
{
  "status": "success",
  "data": {
    "name": "ARC",
    "version": "0.1.2",
    "platform": "win32",
    "importApiEnabled": true,
    "importApiPort": 47896
  }
}
```

### `POST /api/v1/item/add`

Request:

```json
{
  "url": "https://cdn.example/photo.jpg",
  "website": "https://example.com/page",
  "pageTitle": "Page title"
}
```

- `website` → card `linkUrl`
- `pageTitle` (+ optional prefix from ARC Settings) → card `name`
- **503** if no library is open in ARC
- **403** if Import API is disabled in Settings → **Расширение браузера**

Only requests from `127.0.0.1` are accepted.

### Deep link `arc://launch`

Installed ARC registers the custom protocol **`arc://launch`**. The extension uses it for the **Open ARC** button when the desktop app is not running.

- If ARC is already running (including in tray), the window is brought to front.
- If ARC is not running, the OS starts the application (after the user confirms the protocol handler once).
- Works on **Windows and macOS** after install via `electron-builder` (NSIS / DMG). In **dev** mode the protocol is registered only for the current Electron executable.

Browsers cannot start arbitrary `.exe` files directly — only via a registered URL scheme or a native messaging host.

**Troubleshooting**

- Extension shows «ARC не запущен» while ARC is open → restart ARC after updating (Import API must listen on `127.0.0.1:47896` even when Import is disabled in settings; disabled state returns HTTP 403 on import, not connection refused).
- «Открыть ARC» opens onboarding / second window → usually a **second copy** of the app (dev build + installed build, or stale `arc://` handler). Close extra copies; keep one ARC running. The extension re-checks the API before calling `arc://launch`.
- Only one ARC instance should own port **47896**; check with `curl http://127.0.0.1:47896/api/v1/app/info`.

## Install extension (unpacked)

1. Run ARC desktop and open a library.
2. Enable **Import API** in Settings → **Расширение браузера**.
3. Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → select `browser-extension/` in this repo.

## Manual checklist

1. **API** — with ARC running: `curl http://127.0.0.1:47896/api/v1/app/info` returns `"status":"success"`.
2. **Context menu** — right-click an image → **Add to library** → card appears in ARC with `linkUrl` = page URL.
3. **Alt + ПКМ** — Alt + right-click on an image → same result.
4. **Hover save** — hover an image → click **ARC** badge → card appears in the gallery immediately.
5. **ARC offline** — quit ARC, save images → status **Queued**; start ARC → queue drains automatically (or reopen popup).
6. **No library** — ARC running without library → POST returns 503.
7. **API disabled** — toggle off in Settings → extension shows **Import API disabled**.

## Permissions (Chrome)

- `contextMenus` — save from image context menu
- `storage` — offline queue
- `alarms` — periodic queue drain when ARC was offline
- `host_permissions`: `http://127.0.0.1:47896/*` — ARC Import API
- Content script + `content.css` on `<all_urls>` — hover save and Alt + right-click on any site

## Development

- Main process API: `src/main/importApi/`
- Unit tests: `npm test` (includes `src/main/importApi/__tests__/importApiHandlers.test.ts`)
