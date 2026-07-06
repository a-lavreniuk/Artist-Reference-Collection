import { z } from 'zod';

import {
  deleteFilterPreset,
  listFilterPresets,
  renameFilterPreset,
  upsertFilterPreset
} from '../../storage/filterPresets';
import { getGalleryFilterStatsAsync } from '../../storage/libraryStorage';
import type { GalleryFilterPresetPayload } from '../../shared/galleryFilterCore';
import { runMcpRead, runMcpWrite } from '../mcpToolRuntime';
import type { McpRegisterContext } from './registerContext';

export function registerFilterTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_get_filter_stats', () => {
    server.registerTool(
      'arc_get_filter_stats',
      {
        description: desc('arc_get_filter_stats'),
        inputSchema: {
          libraryScope: z.enum(['all', 'untagged', 'trash']).optional(),
          tagIds: z.array(z.string()).optional(),
          collectionId: z.string().optional()
        }
      },
      async ({ libraryScope, tagIds, collectionId }) =>
        runMcpRead(deps, (root) =>
          getGalleryFilterStatsAsync(
            root,
            {
              libraryScope: libraryScope ?? 'all',
              selectedTagIds: tagIds ?? [],
              cardIdExact: null,
              collectionId: collectionId ?? null,
              moodboardCardIds: null
            },
            () => false
          )
        )
    );
  });

  registerIfEnabled('arc_list_filter_presets', () => {
    server.registerTool(
      'arc_list_filter_presets',
      { description: desc('arc_list_filter_presets'), inputSchema: {} },
      async () => runMcpRead(deps, (root) => listFilterPresets(root))
    );
  });

  registerIfEnabled('arc_save_filter_preset', () => {
    server.registerTool(
      'arc_save_filter_preset',
      {
        description: desc('arc_save_filter_preset'),
        inputSchema: {
          id: z.string().describe('ID пресета (новый или существующий)'),
          name: z.string().describe('Имя пресета'),
          payload: z.record(z.string(), z.unknown()).describe('Содержимое пресета фильтров')
        }
      },
      async ({ id, name, payload }) =>
        runMcpWrite(deps, async (root) => {
          upsertFilterPreset(root, id, name, payload as GalleryFilterPresetPayload);
          return { id, name, saved: true };
        })
    );
  });

  registerIfEnabled('arc_delete_filter_preset', () => {
    server.registerTool(
      'arc_delete_filter_preset',
      {
        description: desc('arc_delete_filter_preset'),
        inputSchema: { id: z.string() }
      },
      async ({ id }) =>
        runMcpWrite(deps, async (root) => {
          deleteFilterPreset(root, id);
          return { id, deleted: true };
        })
    );
  });

  registerIfEnabled('arc_rename_filter_preset', () => {
    server.registerTool(
      'arc_rename_filter_preset',
      {
        description: desc('arc_rename_filter_preset'),
        inputSchema: {
          id: z.string(),
          name: z.string()
        }
      },
      async ({ id, name }) =>
        runMcpWrite(deps, async (root) => {
          renameFilterPreset(root, id, name);
          return { id, name, renamed: true };
        })
    );
  });
}
