import { z } from 'zod';
import { app } from 'electron';

import { readAppPreferences } from '../../appPreferences';
import { searchCardsBySimilarImage } from '../../ai/similarImageSearch';
import { isModelInstalled, sanitizeSearchModelId } from '../../ai/modelManager';
import { openLibraryDb } from '../../storage/db';
import {
  countEmbeddingsForModel,
  countHybridEmbeddingsForModel
} from '../../storage/cardEmbeddings';
import { backfillPalettesBatch, searchCardsByColor } from '../../storage/colorSearch';
import { normalizeHex } from '../../storage/palette';
import type { GallerySortState } from '../../shared/galleryFilterCore';
import { serializeCardRow } from '../serializeCard';
import {
  cardIdSchema,
  galleryAdvancedFiltersSchema,
  gallerySortSchema,
  hexColorSchema,
  libraryScopeSchema,
  mergeGalleryAdvancedFilters,
  paginationLimitSchema,
  paginationOffsetSchema
} from '../mcpSchemas';
import { runMcpRead } from '../mcpToolRuntime';
import type { McpRegisterContext } from './registerContext';

export function registerVisualTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_color_search', () => {
    server.registerTool(
      'arc_color_search',
      {
        description: desc('arc_color_search'),
        inputSchema: {
          hex: hexColorSchema,
          accuracy: z
            .number()
            .min(1)
            .max(100)
            .optional()
            .describe('Точность совпадения цвета (по умолчанию 85)'),
          offset: paginationOffsetSchema,
          limit: paginationLimitSchema,
          libraryScope: libraryScopeSchema,
          advancedFilters: galleryAdvancedFiltersSchema,
          sort: gallerySortSchema
        }
      },
      async ({ hex, accuracy, offset, limit, libraryScope, advancedFilters, sort }) =>
        runMcpRead(deps, async (root) => {
          const normalized = normalizeHex(hex);
          if (!normalized) throw new Error('Некорректный цвет HEX');
          await backfillPalettesBatch(root, 64);
          const rows = searchCardsByColor(root, {
            hex: normalized,
            accuracy: accuracy ?? 85,
            libraryScope: libraryScope ?? 'all',
            advancedFilters: mergeGalleryAdvancedFilters(advancedFilters),
            sort: (sort as GallerySortState | undefined) ?? { field: 'addedAt', direction: 'desc' },
            offset: offset ?? 0,
            limit: limit ?? 50
          });
          return { count: rows.length, cards: rows.map(serializeCardRow) };
        })
    );
  });

  registerIfEnabled('arc_similar_search', () => {
    server.registerTool(
      'arc_similar_search',
      {
        description: desc('arc_similar_search'),
        inputSchema: {
          cardId: cardIdSchema.describe('ID эталонной карточки'),
          offset: paginationOffsetSchema,
          limit: paginationLimitSchema,
          libraryScope: libraryScopeSchema
        }
      },
      async ({ cardId, offset, limit, libraryScope }) =>
        runMcpRead(deps, async (root) => {
          const prefs = await readAppPreferences();
          if (!prefs.aiSearchEnabled && !prefs.aiSemanticSearchEnabled) {
            throw new Error('AI Semantic Search выключен в настройках');
          }
          const userData = app.getPath('userData');
          const modelId = sanitizeSearchModelId(prefs.aiSearchModelId);
          if (!(await isModelInstalled(userData, modelId))) {
            throw new Error('Модель не установлена');
          }
          const db = openLibraryDb(root);
          const indexed =
            prefs.aiCaptionEnabled && (modelId === 'qwen3-vl-embedding-2b' || modelId === 'qwen3-vl-embedding-8b')
              ? Math.max(countHybridEmbeddingsForModel(db, modelId), countEmbeddingsForModel(db, modelId))
              : countEmbeddingsForModel(db, modelId);
          if (indexed === 0) {
            throw new Error('Библиотека ещё не проиндексирована');
          }
          const rows = await searchCardsBySimilarImage(root, {
            cardId,
            imagePath: null,
            crop: null,
            libraryScope: libraryScope ?? 'all',
            tier: modelId === 'clip-vit-base-patch32' ? 'light' : 'heavy',
            modelId,
            strictness: prefs.aiSearchStrictness,
            offset: offset ?? 0,
            limit: limit ?? 50
          });
          return {
            count: rows.length,
            cards: rows.map(serializeCardRow)
          };
        })
    );
  });
}
