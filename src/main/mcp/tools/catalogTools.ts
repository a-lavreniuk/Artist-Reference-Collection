import { z } from 'zod';

import {
  deleteCategoryFromDb,
  deleteTagFromDb,
  listAllTags,
  listCategories,
  listTagsByCategory
} from '../../storage/libraryStorage';
import { notifyRendererTagCatalogChanged } from '../notifyRenderer';
import {
  createCategory,
  createTag,
  updateCategoryRecord,
  updateTagRecord
} from '../tagCatalogService';
import { categoryIdSchema, tagIdSchema } from '../mcpSchemas';
import { runMcpRead, runMcpWrite } from '../mcpToolRuntime';
import type { McpRegisterContext } from './registerContext';

export function registerCatalogTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_list_categories', () => {
    server.registerTool(
      'arc_list_categories',
      { description: desc('arc_list_categories'), inputSchema: {} },
      async () => runMcpRead(deps, (root) => listCategories(root))
    );
  });

  registerIfEnabled('arc_list_tags', () => {
    server.registerTool(
      'arc_list_tags',
      { description: desc('arc_list_tags'), inputSchema: {} },
      async () => runMcpRead(deps, (root) => listAllTags(root))
    );
  });

  registerIfEnabled('arc_list_tags_by_category', () => {
    server.registerTool(
      'arc_list_tags_by_category',
      {
        description: desc('arc_list_tags_by_category'),
        inputSchema: { categoryId: categoryIdSchema }
      },
      async ({ categoryId }) => runMcpRead(deps, (root) => listTagsByCategory(root, categoryId))
    );
  });

  registerIfEnabled('arc_create_category', () => {
    server.registerTool(
      'arc_create_category',
      {
        description: desc('arc_create_category'),
        inputSchema: {
          name: z.string(),
          colorHex: z.string().optional().describe('Цвет HEX, по умолчанию #EAB308'),
          weight: z.enum(['neutral', 'low', 'medium', 'high']).optional(),
          description: z.string().optional()
        }
      },
      async (input) => runMcpWrite(deps, (root) => createCategory(root, input))
    );
  });

  registerIfEnabled('arc_update_category', () => {
    server.registerTool(
      'arc_update_category',
      {
        description: desc('arc_update_category'),
        inputSchema: {
          categoryId: categoryIdSchema,
          name: z.string().optional(),
          colorHex: z.string().optional(),
          weight: z.enum(['neutral', 'low', 'medium', 'high']).optional(),
          description: z.string().optional()
        }
      },
      async (input) => runMcpWrite(deps, (root) => updateCategoryRecord(root, input))
    );
  });

  registerIfEnabled('arc_delete_category', () => {
    server.registerTool(
      'arc_delete_category',
      {
        description: desc('arc_delete_category'),
        inputSchema: { categoryId: categoryIdSchema }
      },
      async ({ categoryId }) =>
        runMcpWrite(deps, async (root) => {
          await deleteCategoryFromDb(root, categoryId);
          notifyRendererTagCatalogChanged();
          return { categoryId, deleted: true };
        })
    );
  });

  registerIfEnabled('arc_create_tag', () => {
    server.registerTool(
      'arc_create_tag',
      {
        description: desc('arc_create_tag'),
        inputSchema: {
          categoryId: categoryIdSchema,
          name: z.string(),
          description: z.string().optional()
        }
      },
      async (input) => runMcpWrite(deps, (root) => createTag(root, input))
    );
  });

  registerIfEnabled('arc_update_tag', () => {
    server.registerTool(
      'arc_update_tag',
      {
        description: desc('arc_update_tag'),
        inputSchema: {
          tagId: tagIdSchema,
          name: z.string().optional(),
          categoryId: categoryIdSchema.optional(),
          description: z.string().optional()
        }
      },
      async (input) => runMcpWrite(deps, (root) => updateTagRecord(root, input))
    );
  });

  registerIfEnabled('arc_delete_tag', () => {
    server.registerTool(
      'arc_delete_tag',
      {
        description: desc('arc_delete_tag'),
        inputSchema: { tagId: tagIdSchema }
      },
      async ({ tagId }) =>
        runMcpWrite(deps, async (root) => {
          await deleteTagFromDb(root, tagId);
          notifyRendererTagCatalogChanged();
          return { tagId, deleted: true };
        })
    );
  });
}
