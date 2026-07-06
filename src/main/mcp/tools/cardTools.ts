import { z } from 'zod';

import type { GallerySortState } from '../../shared/galleryFilterCore';
import {
  deleteCardFromStorage,
  emptyTrashFromStorage,
  getCardByIdFromDb,
  listAllTags,
  listCardsFromDb,
  restoreCardFromStorage,
  softDeleteCardFromStorage,
  updateCardInStorage
} from '../../storage/libraryStorage';
import { notifyRendererExtensionImport } from '../../importApi/notifyRenderer';
import { refreshLibrarySessionSnapshotFromDisk } from '../../librarySessionSnapshot';
import { getCardDisplayPalette, resolveCardMediaUrl } from '../cardMediaService';
import { searchCardsByText } from '../cardSearch';
import { serializeCardRow } from '../serializeCard';
import {
  cardIdSchema,
  galleryAdvancedFiltersSchema,
  gallerySortSchema,
  libraryScopeSchema,
  mergeGalleryAdvancedFilters,
  paginationLimitSchema,
  paginationOffsetSchema,
  tagIdsSchema,
  mediaVariantSchema,
  collectionIdSchema
} from '../mcpSchemas';
import { runMcpRead, runMcpWrite } from '../mcpToolRuntime';
import type { McpRegisterContext } from './registerContext';

export function registerCardTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_list_cards', () => {
    server.registerTool(
      'arc_list_cards',
      {
        description: desc('arc_list_cards'),
        inputSchema: {
          offset: paginationOffsetSchema,
          limit: paginationLimitSchema,
          libraryScope: libraryScopeSchema,
          tagIds: tagIdsSchema.optional().describe('Карточки со всеми указанными метками'),
          collectionId: collectionIdSchema.optional(),
          advancedFilters: galleryAdvancedFiltersSchema,
          sort: gallerySortSchema
        }
      },
      async ({ offset, limit, libraryScope, tagIds, collectionId, advancedFilters, sort }) =>
        runMcpRead(deps, (root) => {
          const rows = listCardsFromDb(root, {
            offset: offset ?? 0,
            limit: limit ?? 50,
            libraryScope: libraryScope ?? 'all',
            ...(tagIds?.length ? { selectedTagIds: tagIds } : {}),
            ...(collectionId ? { collectionId } : {}),
            advancedFilters: mergeGalleryAdvancedFilters(advancedFilters),
            ...(sort ? { sort: sort as GallerySortState } : {})
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
        description: desc('arc_get_card'),
        inputSchema: { cardId: cardIdSchema }
      },
      async ({ cardId }) =>
        runMcpRead(deps, (root) => {
          const row = getCardByIdFromDb(root, cardId);
          if (!row) throw new Error('Карточка не найдена');
          return serializeCardRow(row);
        })
    );
  });

  registerIfEnabled('arc_search_cards', () => {
    server.registerTool(
      'arc_search_cards',
      {
        description: desc('arc_search_cards'),
        inputSchema: {
          query: z.string().describe('Поисковый запрос'),
          offset: paginationOffsetSchema,
          limit: paginationLimitSchema
        }
      },
      async ({ query, offset, limit }) =>
        runMcpRead(deps, (root) => {
          const rows = searchCardsByText(root, query, limit ?? 50, offset ?? 0);
          return { count: rows.length, cards: rows.map(serializeCardRow) };
        })
    );
  });

  registerIfEnabled('arc_get_card_palette', () => {
    server.registerTool(
      'arc_get_card_palette',
      {
        description: desc('arc_get_card_palette'),
        inputSchema: { cardId: cardIdSchema }
      },
      async ({ cardId }) => runMcpRead(deps, (root) => getCardDisplayPalette(root, cardId))
    );
  });

  registerIfEnabled('arc_get_card_media_url', () => {
    server.registerTool(
      'arc_get_card_media_url',
      {
        description: desc('arc_get_card_media_url'),
        inputSchema: {
          cardId: cardIdSchema,
          variant: mediaVariantSchema.optional()
        }
      },
      async ({ cardId, variant }) =>
        runMcpRead(deps, async (root) => {
          const url = await resolveCardMediaUrl(root, cardId, variant ?? 'thumb');
          if (!url) throw new Error('Медиа недоступно');
          return { url, variant: variant ?? 'thumb' };
        })
    );
  });

  registerIfEnabled('arc_update_card', () => {
    server.registerTool(
      'arc_update_card',
      {
        description: desc('arc_update_card'),
        inputSchema: {
          cardId: cardIdSchema,
          name: z.string().optional(),
          description: z.string().optional(),
          collectionIds: z.array(z.string()).optional()
        }
      },
      async ({ cardId, name, description, collectionIds }) =>
        runMcpWrite(deps, async (root) => {
          const patch: {
            name?: string;
            description?: string;
            collectionIds?: string[];
          } = {};
          if (name !== undefined) patch.name = name;
          if (description !== undefined) patch.description = description;
          if (collectionIds !== undefined) patch.collectionIds = collectionIds;
          if (!Object.keys(patch).length) throw new Error('Нет полей для обновления');
          await updateCardInStorage(root, cardId, patch);
          notifyRendererExtensionImport([cardId]);
          const row = getCardByIdFromDb(root, cardId);
          return row ? serializeCardRow(row) : { cardId, updated: true };
        })
    );
  });

  registerIfEnabled('arc_set_card_tags', () => {
    server.registerTool(
      'arc_set_card_tags',
      {
        description: desc('arc_set_card_tags'),
        inputSchema: {
          cardId: cardIdSchema,
          tagIds: tagIdsSchema.describe('Полный список меток на карточке')
        }
      },
      async ({ cardId, tagIds }) =>
        runMcpWrite(deps, async (root) => {
          const row = getCardByIdFromDb(root, cardId);
          if (!row) throw new Error('Карточка не найдена');
          const known = new Set(listAllTags(root).map((t) => t.id));
          for (const id of tagIds) {
            if (!known.has(id)) throw new Error(`Метка не найдена: ${id}`);
          }
          await updateCardInStorage(root, cardId, { tagIds });
          notifyRendererExtensionImport([cardId]);
          const next = getCardByIdFromDb(root, cardId);
          return next ? serializeCardRow(next) : { cardId, tagIds };
        })
    );
  });

  registerIfEnabled('arc_move_card_to_trash', () => {
    server.registerTool(
      'arc_move_card_to_trash',
      {
        description: desc('arc_move_card_to_trash'),
        inputSchema: { cardId: cardIdSchema }
      },
      async ({ cardId }) =>
        runMcpWrite(deps, async (root) => {
          await softDeleteCardFromStorage(root, cardId);
          void refreshLibrarySessionSnapshotFromDisk();
          notifyRendererExtensionImport([cardId]);
          return { cardId, trashed: true };
        })
    );
  });

  registerIfEnabled('arc_restore_card', () => {
    server.registerTool(
      'arc_restore_card',
      {
        description: desc('arc_restore_card'),
        inputSchema: { cardId: cardIdSchema }
      },
      async ({ cardId }) =>
        runMcpWrite(deps, async (root) => {
          await restoreCardFromStorage(root, cardId);
          void refreshLibrarySessionSnapshotFromDisk();
          notifyRendererExtensionImport([cardId]);
          return { cardId, restored: true };
        })
    );
  });

  registerIfEnabled('arc_permanent_delete_card', () => {
    server.registerTool(
      'arc_permanent_delete_card',
      {
        description: desc('arc_permanent_delete_card'),
        inputSchema: { cardId: cardIdSchema }
      },
      async ({ cardId }) =>
        runMcpWrite(deps, async (root) => {
          await deleteCardFromStorage(root, cardId);
          void refreshLibrarySessionSnapshotFromDisk();
          return { cardId, deleted: true };
        })
    );
  });

  registerIfEnabled('arc_empty_trash', () => {
    server.registerTool(
      'arc_empty_trash',
      { description: desc('arc_empty_trash'), inputSchema: {} },
      async () =>
        runMcpWrite(deps, async (root) => {
          const count = await emptyTrashFromStorage(root);
          void refreshLibrarySessionSnapshotFromDisk();
          return { deletedCount: count };
        })
    );
  });
}
