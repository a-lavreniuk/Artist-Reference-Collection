import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { runAiSearch } from '../ai/aiSearchService';
import { getIndexStatus } from '../ai/indexer';
import { handleItemAdd } from '../importApi/importApiHandlers';
import { downloadUrlToTempFile } from '../importApi/importFromRemote';
import { MAX_IMPORT_BODY_BYTES } from '../importApi/constants';
import type { ImportApiHandlerDeps } from '../importApi/types';
import { readLibraryDiskStats } from '../libraryDiskStats';
import { refreshLibrarySessionSnapshotFromDisk } from '../librarySessionSnapshot';
import { notifyRendererExtensionImport } from '../importApi/notifyRenderer';
import { importMediaFile, updateCardInStorage } from '../storage/libraryStorage';
import {
  countCards,
  countTrashedCards,
  ensureLibraryReady,
  getCardByIdFromDb,
  listAllTags,
  listCardsFromDb,
  listCategories,
  listCollections
} from '../storage/libraryStorage';
import { readAppPreferencesSync } from '../appPreferences';
import { queueCardsForIndexing } from '../ipcAi';
import { searchCardsByText } from './cardSearch';
import {
  assertMcpReadAccess,
  assertMcpWriteAccess,
  buildMcpAppInfo,
  buildMcpDeps,
  mcpToolError,
  mcpToolJson,
  type McpDeps
} from './mcpDeps';
import { serializeCardRow } from './serializeCard';
import {
  createCategory,
  createTag,
  updateCategoryRecord,
  updateTagRecord
} from './tagCatalogService';
import { isMcpToolEnabled } from './mcpToolAccess';
import type { McpToolId } from '../shared/mcpToolCatalog';

const CONFIRM_HINT =
  'Confirm changes with the user before bulk operations. Tag/category tools manage the catalog only — they do not attach tags to cards.';

function resolveCardNameFromPrefs(pageTitle?: string, explicitName?: string): string | undefined {
  const prefs = readAppPreferencesSync();
  const explicit = explicitName?.trim();
  if (explicit) {
    if (prefs.importApiPrefixEnabled && prefs.importApiPrefixText.trim()) {
      return `${prefs.importApiPrefixText.trim()} ${explicit}`;
    }
    return explicit;
  }
  const title = pageTitle?.trim();
  if (!title) return undefined;
  if (prefs.importApiPrefixEnabled && prefs.importApiPrefixText.trim()) {
    return `${prefs.importApiPrefixText.trim()} ${title}`;
  }
  return title;
}

function buildImportDeps(libraryRoot: string): ImportApiHandlerDeps {
  return {
    getAppVersion: () => buildMcpDeps().getAppVersion(),
    getPlatform: () => buildMcpDeps().getPlatform(),
    getLibraryRoot: () => libraryRoot,
    isApiEnabled: () => true,
    resolveCardName: resolveCardNameFromPrefs,
    importFromUrl: async ({ libraryRoot: root, url, website, name }) => {
      let cleanup: (() => Promise<void>) | null = null;
      try {
        const { tempPath, cleanup: rm } = await downloadUrlToTempFile(url, MAX_IMPORT_BODY_BYTES);
        cleanup = rm;
        const result = await importMediaFile(root, tempPath, {
          linkUrl: website,
          name
        });
        if (!result.ok) {
          return { ok: false, error: result.error };
        }
        void queueCardsForIndexing([result.row.id]);
        void refreshLibrarySessionSnapshotFromDisk();
        notifyRendererExtensionImport([result.row.id]);
        return { ok: true, id: result.row.id };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed';
        return { ok: false, error: message };
      } finally {
        if (cleanup) await cleanup();
      }
    }
  };
}

async function runMcpRead<T>(
  deps: McpDeps,
  fn: (root: string) => T | Promise<T>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: true }> {
  try {
    assertMcpReadAccess(deps);
    const root = deps.getLibraryRoot();
    if (!root) {
      return mcpToolError('Library not selected');
    }
    await ensureLibraryReady(root);
    return mcpToolJson(await fn(root));
  } catch (err) {
    return mcpToolError(err instanceof Error ? err.message : String(err));
  }
}

async function runMcpWrite<T>(
  deps: McpDeps,
  fn: (root: string) => T | Promise<T>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: true }> {
  try {
    const root = assertMcpWriteAccess(deps);
    await ensureLibraryReady(root);
    return mcpToolJson(await fn(root));
  } catch (err) {
    return mcpToolError(err instanceof Error ? err.message : String(err));
  }
}

export function registerArcMcpTools(server: McpServer, deps: McpDeps = buildMcpDeps()): void {
  const registerIfEnabled = (toolId: McpToolId, register: () => void): void => {
    if (isMcpToolEnabled(toolId)) register();
  };

  registerIfEnabled('arc_get_app_info', () => {
    server.registerTool(
      'arc_get_app_info',
      {
        description: 'Get ARC application info, MCP status, and whether a library is open.',
        inputSchema: {}
      },
      async () => {
        try {
          assertMcpReadAccess(deps);
          return mcpToolJson(buildMcpAppInfo(deps));
        } catch (err) {
          return mcpToolError(err instanceof Error ? err.message : String(err));
        }
      }
    );
  });

  registerIfEnabled('arc_list_cards', () => {
    server.registerTool(
      'arc_list_cards',
    {
      description: 'List cards in the library with optional filters and pagination.',
      inputSchema: {
        offset: z.number().int().min(0).optional().describe('Pagination offset (default 0)'),
        limit: z.number().int().min(1).max(100).optional().describe('Page size (default 50, max 100)'),
        libraryScope: z.enum(['all', 'untagged', 'trash']).optional().describe('Library scope filter'),
        tagIds: z.array(z.string()).optional().describe('Filter cards that have ALL listed tag IDs'),
        collectionId: z.string().optional().describe('Filter by collection ID')
      }
    },
    async ({ offset, limit, libraryScope, tagIds, collectionId }) =>
      runMcpRead(deps, (root) => {
        const rows = listCardsFromDb(root, {
          offset: offset ?? 0,
          limit: limit ?? 50,
          libraryScope: libraryScope ?? 'all',
          ...(tagIds?.length ? { selectedTagIds: tagIds } : {}),
          ...(collectionId ? { collectionId } : {})
        });
        return {
          count: rows.length,
          cards: rows.map(serializeCardRow)
        };
      })
    );
  });

  registerIfEnabled('arc_get_card', () => {
    server.registerTool(
      'arc_get_card',
    {
      description: 'Get a single card by ID.',
      inputSchema: {
        cardId: z.string().describe('Card ID')
      }
    },
    async ({ cardId }) =>
      runMcpRead(deps, (root) => {
        const row = getCardByIdFromDb(root, cardId);
        if (!row) {
          throw new Error('Card not found');
        }
        return serializeCardRow(row);
      })
    );
  });

  registerIfEnabled('arc_search_cards', () => {
    server.registerTool(
      'arc_search_cards',
    {
      description: 'Full-text search cards by description, link URL, or AI caption.',
      inputSchema: {
        query: z.string().describe('Search query'),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(100).optional()
      }
    },
    async ({ query, offset, limit }) =>
      runMcpRead(deps, (root) => {
        const rows = searchCardsByText(root, query, limit ?? 50, offset ?? 0);
        return {
          count: rows.length,
          cards: rows.map(serializeCardRow)
        };
      })
    );
  });

  registerIfEnabled('arc_list_categories', () => {
    server.registerTool(
      'arc_list_categories',
    {
      description: 'List all tag categories in the library.',
      inputSchema: {}
    },
    async () => runMcpRead(deps, (root) => listCategories(root))
    );
  });

  registerIfEnabled('arc_list_tags', () => {
    server.registerTool(
      'arc_list_tags',
    {
      description: 'List all tags in the library catalog.',
      inputSchema: {}
    },
    async () => runMcpRead(deps, (root) => listAllTags(root))
    );
  });

  registerIfEnabled('arc_list_collections', () => {
    server.registerTool(
      'arc_list_collections',
    {
      description: 'List all collections in the library.',
      inputSchema: {}
    },
    async () => runMcpRead(deps, (root) => listCollections(root))
    );
  });

  registerIfEnabled('arc_ai_search', () => {
    server.registerTool(
      'arc_ai_search',
    {
      description: 'Semantic AI search over indexed cards. Requires AI search enabled and models installed.',
      inputSchema: {
        query: z.string().describe('Natural language search query')
      }
    },
    async ({ query }) =>
      runMcpRead(deps, async () => {
        const results = await runAiSearch(query.trim());
        return results;
      })
    );
  });

  registerIfEnabled('arc_get_library_stats', () => {
    server.registerTool(
      'arc_get_library_stats',
    {
      description: 'Library card counts and disk usage statistics.',
      inputSchema: {}
    },
    async () =>
      runMcpRead(deps, async (root) => {
        const [disk, indexStatus] = await Promise.all([
          readLibraryDiskStats(root),
          getIndexStatus()
        ]);
        return {
          cardsTotal: countCards(root, 'all', 'all'),
          cardsImages: countCards(root, 'images', 'all'),
          cardsVideos: countCards(root, 'videos', 'all'),
          cardsTrashed: countTrashedCards(root),
          disk,
          aiIndex: indexStatus
        };
      })
    );
  });

  registerIfEnabled('arc_import_item', () => {
    server.registerTool(
      'arc_import_item',
    {
      description: `Import a media item into the library from an HTTP(S) URL. ${CONFIRM_HINT}`,
      inputSchema: {
        url: z.string().describe('Direct URL to image or video file'),
        website: z.string().optional().describe('Source page URL (stored as linkUrl)'),
        pageTitle: z.string().optional().describe('Suggested card name'),
        name: z.string().optional().describe('Explicit card name override')
      }
    },
    async ({ url, website, pageTitle, name }) => {
      try {
        const root = assertMcpWriteAccess(deps);
        await ensureLibraryReady(root);
        const result = await handleItemAdd(buildImportDeps(root), {
          url,
          website,
          pageTitle,
          name
        });
        if (result.body.status === 'error') {
          return mcpToolError(result.body.message);
        }
        return mcpToolJson(result.body.data);
      } catch (err) {
        return mcpToolError(err instanceof Error ? err.message : String(err));
      }
    }
    );
  });

  registerIfEnabled('arc_update_card', () => {
    server.registerTool(
      'arc_update_card',
    {
      description: `Update card metadata (name, description, collections). Does NOT change tag assignments. ${CONFIRM_HINT}`,
      inputSchema: {
        cardId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        collectionIds: z.array(z.string()).optional()
      }
    },
    async ({ cardId, name, description, collectionIds }) => {
      try {
        const root = assertMcpWriteAccess(deps);
        await ensureLibraryReady(root);
        const patch: {
          name?: string;
          description?: string;
          collectionIds?: string[];
        } = {};
        if (name !== undefined) patch.name = name;
        if (description !== undefined) patch.description = description;
        if (collectionIds !== undefined) patch.collectionIds = collectionIds;
        if (!Object.keys(patch).length) {
          return mcpToolError('No fields to update');
        }
        await updateCardInStorage(root, cardId, patch);
        const row = getCardByIdFromDb(root, cardId);
        return mcpToolJson(row ? serializeCardRow(row) : { cardId, updated: true });
      } catch (err) {
        return mcpToolError(err instanceof Error ? err.message : String(err));
      }
    }
    );
  });

  registerIfEnabled('arc_create_category', () => {
    server.registerTool(
      'arc_create_category',
    {
      description: `Create a tag category in the Tags catalog. ${CONFIRM_HINT}`,
      inputSchema: {
        name: z.string(),
        colorHex: z.string().optional().describe('Hex color, default #EAB308'),
        weight: z.enum(['neutral', 'low', 'medium', 'high']).optional(),
        description: z.string().optional()
      }
    },
    async ({ name, colorHex, weight, description }) =>
      runMcpWrite(deps, (root) => createCategory(root, { name, colorHex, weight, description }))
    );
  });

  registerIfEnabled('arc_update_category', () => {
    server.registerTool(
      'arc_update_category',
    {
      description: `Update a tag category in the Tags catalog. ${CONFIRM_HINT}`,
      inputSchema: {
        categoryId: z.string(),
        name: z.string().optional(),
        colorHex: z.string().optional(),
        weight: z.enum(['neutral', 'low', 'medium', 'high']).optional(),
        description: z.string().optional()
      }
    },
    async ({ categoryId, name, colorHex, weight, description }) =>
      runMcpWrite(deps, (root) =>
        updateCategoryRecord(root, { categoryId, name, colorHex, weight, description })
      )
    );
  });

  registerIfEnabled('arc_create_tag', () => {
    server.registerTool(
      'arc_create_tag',
    {
      description: `Create a tag in the Tags catalog (does not attach to cards). ${CONFIRM_HINT}`,
      inputSchema: {
        categoryId: z.string(),
        name: z.string(),
        description: z.string().optional()
      }
    },
    async ({ categoryId, name, description }) =>
      runMcpWrite(deps, (root) => createTag(root, { categoryId, name, description }))
    );
  });

  registerIfEnabled('arc_update_tag', () => {
    server.registerTool(
      'arc_update_tag',
    {
      description: `Update a tag in the Tags catalog (does not change card assignments). ${CONFIRM_HINT}`,
      inputSchema: {
        tagId: z.string(),
        name: z.string().optional(),
        categoryId: z.string().optional(),
        description: z.string().optional()
      }
    },
    async ({ tagId, name, categoryId, description }) =>
      runMcpWrite(deps, (root) => updateTagRecord(root, { tagId, name, categoryId, description }))
    );
  });
}
