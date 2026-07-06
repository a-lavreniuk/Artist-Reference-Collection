import { z } from 'zod';

import { buildAiStatus } from '../../ipcAi';
import { readHistory } from '../../libraryHistory';
import { getIndexStatus } from '../../ai/indexer';
import { readLibraryDiskStats } from '../../libraryDiskStats';
import {
  assertMcpReadAccess,
  buildMcpAppInfo,
  mcpToolError,
  mcpToolJson
} from '../mcpDeps';
import { runMcpRead } from '../mcpToolRuntime';
import {
  countCards,
  countTrashedCards
} from '../../storage/libraryStorage';
import type { McpRegisterContext } from './registerContext';

export function registerAppTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_get_app_info', () => {
    server.registerTool(
      'arc_get_app_info',
      { description: desc('arc_get_app_info'), inputSchema: {} },
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

  registerIfEnabled('arc_get_library_stats', () => {
    server.registerTool(
      'arc_get_library_stats',
      { description: desc('arc_get_library_stats'), inputSchema: {} },
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

  registerIfEnabled('arc_get_recent_history', () => {
    server.registerTool(
      'arc_get_recent_history',
      {
        description: desc('arc_get_recent_history'),
        inputSchema: {
          limit: z
            .number()
            .int()
            .min(1)
            .max(200)
            .optional()
            .describe('Сколько последних записей вернуть (по умолчанию 50)')
        }
      },
      async ({ limit }) =>
        runMcpRead(deps, async (root) => {
          const entries = await readHistory(root);
          const take = limit ?? 50;
          return entries.slice(-take).reverse();
        })
    );
  });

  registerIfEnabled('arc_get_ai_status', () => {
    server.registerTool(
      'arc_get_ai_status',
      { description: desc('arc_get_ai_status'), inputSchema: {} },
      async () => {
        try {
          assertMcpReadAccess(deps);
          return mcpToolJson(await buildAiStatus());
        } catch (err) {
          return mcpToolError(err instanceof Error ? err.message : String(err));
        }
      }
    );
  });
}
