import { z } from 'zod';

import {
  addCardsToCollection,
  createCollectionRecord,
  deleteCollectionRecord,
  getCollectionDetails,
  removeCardsFromCollection,
  updateCollectionRecord
} from '../collectionService';
import { listCollections } from '../../storage/libraryStorage';
import { collectionIdSchema } from '../mcpSchemas';
import { runMcpRead, runMcpWrite } from '../mcpToolRuntime';
import type { McpRegisterContext } from './registerContext';

export function registerCollectionTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_list_collections', () => {
    server.registerTool(
      'arc_list_collections',
      { description: desc('arc_list_collections'), inputSchema: {} },
      async () => runMcpRead(deps, (root) => listCollections(root))
    );
  });

  registerIfEnabled('arc_get_collection', () => {
    server.registerTool(
      'arc_get_collection',
      {
        description: desc('arc_get_collection'),
        inputSchema: {
          collectionId: collectionIdSchema,
          previewLimit: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .describe('Сколько превью-карточек вернуть')
        }
      },
      async ({ collectionId, previewLimit }) =>
        runMcpRead(deps, (root) => getCollectionDetails(root, collectionId, previewLimit ?? 8))
    );
  });

  registerIfEnabled('arc_create_collection', () => {
    server.registerTool(
      'arc_create_collection',
      {
        description: desc('arc_create_collection'),
        inputSchema: {
          name: z.string().describe('Название коллекции'),
          description: z.string().optional()
        }
      },
      async ({ name, description }) =>
        runMcpWrite(deps, (root) => createCollectionRecord(root, { name, description }))
    );
  });

  registerIfEnabled('arc_update_collection', () => {
    server.registerTool(
      'arc_update_collection',
      {
        description: desc('arc_update_collection'),
        inputSchema: {
          collectionId: collectionIdSchema,
          name: z.string().optional(),
          description: z.string().optional()
        }
      },
      async ({ collectionId, name, description }) =>
        runMcpWrite(deps, (root) =>
          updateCollectionRecord(root, { collectionId, name, description })
        )
    );
  });

  registerIfEnabled('arc_delete_collection', () => {
    server.registerTool(
      'arc_delete_collection',
      {
        description: desc('arc_delete_collection'),
        inputSchema: { collectionId: collectionIdSchema }
      },
      async ({ collectionId }) =>
        runMcpWrite(deps, async (root) => {
          await deleteCollectionRecord(root, collectionId);
          return { collectionId, deleted: true };
        })
    );
  });

  registerIfEnabled('arc_add_cards_to_collection', () => {
    server.registerTool(
      'arc_add_cards_to_collection',
      {
        description: desc('arc_add_cards_to_collection'),
        inputSchema: {
          collectionId: collectionIdSchema,
          cardIds: z.array(z.string()).min(1).describe('ID карточек')
        }
      },
      async ({ collectionId, cardIds }) =>
        runMcpWrite(deps, (root) => addCardsToCollection(root, collectionId, cardIds))
    );
  });

  registerIfEnabled('arc_remove_cards_from_collection', () => {
    server.registerTool(
      'arc_remove_cards_from_collection',
      {
        description: desc('arc_remove_cards_from_collection'),
        inputSchema: {
          collectionId: collectionIdSchema,
          cardIds: z.array(z.string()).min(1).describe('ID карточек')
        }
      },
      async ({ collectionId, cardIds }) =>
        runMcpWrite(deps, (root) => removeCardsFromCollection(root, collectionId, cardIds))
    );
  });
}
