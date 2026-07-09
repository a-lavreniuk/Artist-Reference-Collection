# Browser Extension (Chrome MVP)

> **Чек-листы для тестеров** (актуальная версия) — в Notion KB: [Чек-листы тестирования](https://app.notion.com/p/38fbfa9fcc588169acaff89f56870b11) → **Расширение браузера**. Ниже — техническая документация и локальный manual checklist.

Companion extension for **Artist Reference Collection (ARC)** — saves images and videos from the web into the desktop library via a local HTTP API (same approach as [Eagle Web API](https://developer.eagle.cool/web-api)).

## Scope (MVP)

- Context menu on images and videos: **Add to library** / **Добавить в библиотеку**
- **Hover button** on images and videos (brand icon-only 32×32, Figma [1169:23991](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=1169-23991)) — click to save
- **Popup / page modals** in ARC modal layout (Figma [1799:15368](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=1799-15368), [1799:15407](https://www.figma.com/design/JD3pZdlV4Sz62creRMQsJV/ARC-2?node-id=1799-15407))
- **Alt + right-click** on `<img>`, `<picture>`, or `background-image` on the target element
- **Local HTTP API** in ARC on `http://127.0.0.1:47896/api/v1/`
- Offline **queue** (max 50) when ARC is not running; auto-drain when ARC is available (popup open, browser startup, periodic alarm, after each successful save)

Not in MVP: Safari/Firefox, Vimeo import, page screenshots, tags/collections at save time, Chrome Web Store publish.

## Video import

- **Hover save** on `<video>` (generic sites with direct `.mp4` / `.webm` URL) and on Pinterest / YouTube players
- **Pinterest video pins** — mp4 or HLS (`.m3u8` → ffmpeg → mp4 in ARC), max quality from available URLs
- **YouTube** — watch / Shorts / youtu.be URLs; ARC downloads via **yt-dlp** (lazy install to `~/.arc/bin/` on first use)
- **Pinterest board** — mixed boards import images and videos into one collection; each pin opens in a background tab for full-resolution resolve
- **Limits:** images — no byte cap; videos — **512 MB**; video import timeout up to **15 min**
- **No poster fallback** for failed video downloads — user sees an error instead of a thumbnail card
- Gated / auth-only video → error (ARC fetches without browser cookies)

Test video pin: `https://ru.pinterest.com/pin/675821487865257612/`

## Supported sites (site handlers)

### Pinterest — доска целиком

На странице **доски** Pinterest (`https://<locale>.pinterest.com/<user>/<board>/`):

1. Откройте доску в браузере.
2. Кликните иконку расширения ARC.
3. В popup появится блок Pinterest с кнопкой **«Скачать доску»**.
4. После клика расширение прокрутит доску, соберёт URL пинов, откроет каждый пин в фоновой вкладке, определит тип медиа (изображение или видео) и добавит карточки в **коллекцию** с названием доски.

Требования: ARC запущен, библиотека открыта, Import API включён. Импорт доски с видео-пинами заметно дольше из-за обхода каждого пина.

### Pinterest / ArtStation / YouTube — одиночное сохранение

Расширение выбирает URL и имя карточки через `browser-extension/lib/sites/`:

| Сайт | Что делает handler |
|------|-------------------|
| **Pinterest** (`*.pinterest.com`) | Изображения: апгрейд `i.pinimg.com` до `/originals/`. Видео: `v.pinimg.com` mp4/HLS, max quality; video-пины на ленте приоритетнее постера |
| **YouTube** (`*.youtube.com`, `youtu.be`) | Сохраняет canonical watch URL; ARC скачивает файл через yt-dlp |
| **ArtStation** (`*.artstation.com`) | Полноразмерный artwork (`srcset`, `data-image`, `og:image`); имя — название работы и автор |
| **Остальные сайты** | Generic: `img` / `background-image` или `<video>` с прямым https URL |

Ограничение: ARC скачивает URL **без cookies браузера** — gated-контент может сохраниться только в preview-качестве.

## Import API endpoints

| Method | Path | Назначение |
|--------|------|------------|
| GET | `/api/v1/app/info` | Health / статус Import API |
| POST | `/api/v1/item/add` | Импорт изображения или видео (`mediaKind`, `fallbackUrl`, `collectionId`, `quiet` опционально) |
| POST | `/api/v1/collection/ensure` | Создать коллекцию или вернуть существующую по имени |

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
  "pageTitle": "Page title",
  "name": "Optional explicit card name",
  "mediaKind": "image",
  "fallbackUrl": "https://cdn.example/thumb.jpg"
}
```

- `mediaKind`: `"image"` | `"video"` — явный тип; для видео `fallbackUrl` игнорируется при ошибке primary
- `website` → card `linkUrl`
- `name` (если передано расширением) или `pageTitle` (+ optional prefix from ARC Settings) → card `name`
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
8. **Pinterest** — open a pin page → hover save or context menu → card uses full-resolution `pinimg` URL (check dimensions in card detail vs page thumbnail).
9. **ArtStation** — open an artwork page → hover save or context menu → card uses full artwork asset; name includes title/author when available.
10. **Pinterest board** — open a board URL → extension popup → **Download this board** → collection appears in ARC with board name and imported pins (images + videos); progress shown in popup.
11. **Pinterest video pin** — `https://ru.pinterest.com/pin/675821487865257612/` → hover save → video card in gallery (not poster).
12. **YouTube** — open a public watch page → hover on player → video card after yt-dlp download completes.
13. **Generic video** — page with `<video src="https://...mp4">` → hover save → video card.
14. **Generic regression** — save image from a non-Pinterest site → behavior unchanged from before site handlers.

## Permissions (Chrome)

- `contextMenus` — save from image context menu
- `storage` — offline queue
- `alarms` — periodic queue drain when ARC was offline
- `host_permissions`: `http://127.0.0.1:47896/*` — ARC Import API
- `tabs` — Pinterest board pin resolve (background tabs)
- Content script + `content.css` on `<all_urls>` — hover save and Alt + right-click on any site

## Development

- Main process API: `src/main/importApi/` (includes `youtubeDownload.ts`, yt-dlp lazy install)
- Site handlers: `browser-extension/lib/sites/`
- Unit tests: `npm test` (includes `src/main/importApi/__tests__/importApiHandlers.test.ts`)
