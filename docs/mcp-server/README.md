# ARC MCP Server

Local [Model Context Protocol](https://modelcontextprotocol.io) server embedded in ARC main process. AI agents (Cursor, Claude Desktop, etc.) can read the library and perform allowed write operations while ARC is running.

## Requirements

- ARC desktop app is running (tray is OK).
- A library is open in ARC.
- **Settings → MCP server →** enable «Разрешить подключение MCP-клиентов» and choose which tools are allowed.
- MCP client configured with the endpoint below.

## Endpoint

| | |
|---|---|
| URL | `http://127.0.0.1:47897/mcp` |
| Transport | Streamable HTTP |
| Host | `127.0.0.1` only (not reachable from the network) |

Import API for the browser extension remains on port **47896** — separate service.

## Cursor setup

1. Open **Cursor Settings → Tools & MCP → Add Custom MCP**.
2. Paste into `mcp.json`:

```json
{
  "mcpServers": {
    "arc-mcp": {
      "transport": "http",
      "type": "streamable-http",
      "streamable": true,
      "url": "http://127.0.0.1:47897/mcp"
    }
  }
}
```

3. Ensure ARC is running with MCP enabled.
4. Ask the agent: «What version is ARC?» — it should call `arc_get_app_info`.

If Cursor shows **No Tools**, toggle `arc-mcp` off and on, or restart Cursor.

## Tools (MVP)

### Read

| Tool | Description |
|------|-------------|
| `arc_get_app_info` | App version, platform, MCP status, library open |
| `arc_list_cards` | Paginated cards; filters: tags, collection, scope |
| `arc_get_card` | Single card by ID |
| `arc_search_cards` | FTS search (description, link, AI caption) |
| `arc_list_categories` | Tag categories |
| `arc_list_tags` | Tag catalog |
| `arc_list_collections` | Collections |
| `arc_ai_search` | Semantic search (AI must be enabled + indexed) |
| `arc_get_library_stats` | Counts, disk usage, AI index status |

### Write — cards

| Tool | Description |
|------|-------------|
| `arc_import_item` | Import media from HTTP(S) URL |
| `arc_update_card` | Update `name`, `description`, `collectionIds` only (**not** `tagIds`) |

### Write — tag catalog (Tags section only)

| Tool | Description |
|------|-------------|
| `arc_create_category` | New category |
| `arc_update_category` | Edit category name, color, weight, description |
| `arc_create_tag` | New tag in category (does not attach to cards) |
| `arc_update_tag` | Edit tag name, category, description |

No delete tools in MVP. No batch operations.

## Example prompts

**Read-only**

```
List my tag categories and how many tags each has.
```

```
Search cards for "sunset landscape" and show the first 10 results.
```

**Tag catalog**

```
Create a category "Animals" and tags "cat" and "dog" in it. Show the plan first.
```

**Import**

```
Import this image URL into my library: https://example.com/photo.jpg
```

## Privacy

MCP itself does not send data to the cloud. If you use a **cloud LLM** in Cursor, tool results (file names, tags, search hits) become part of the model context and may be sent to the provider. Use a local model or read-only prompts for sensitive libraries.

## Troubleshooting

| Problem | Check |
|---------|--------|
| Connection refused | ARC not running, or port 47897 blocked by another process |
| HTTP 403 | MCP disabled in Settings, or wrong host (must be localhost) |
| No Tools in Cursor | Invalid `mcp.json`, toggle server in Cursor, restart ARC |
| AI search errors | Enable AI Search in settings, install model, wait for indexing |
| Library errors | Open a library in ARC first |

## Development

- Main module: `src/main/mcp/`
- Unit tests: `src/main/mcp/*.test.ts`
- Toggle preference: `mcpServerEnabled` in `appPreferences`
- Per-tool toggles: `mcpToolsEnabled` in **Settings → MCP server** (groups match the UI). Disabled tools are not registered until the server restarts (automatic on save).

```bash
npm run build:main
npm test
```
