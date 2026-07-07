import { z } from 'zod';

import { runAiSearch } from '../../ai/aiSearchService';
import { runFullReindex } from '../../ai/indexer';
import { runMcpRead } from '../mcpToolRuntime';
import { mcpToolError, mcpToolJson } from '../mcpDeps';
import type { McpRegisterContext } from './registerContext';

export function registerAiTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_ai_search', () => {
    server.registerTool(
      'arc_ai_search',
      {
        description: desc('arc_ai_search'),
        inputSchema: {
          query: z.string().describe('Запрос на естественном языке')
        }
      },
      async ({ query }) => runMcpRead(deps, async () => runAiSearch(query.trim()))
    );
  });

  registerIfEnabled('arc_trigger_reindex', () => {
    server.registerTool(
      'arc_trigger_reindex',
      { description: desc('arc_trigger_reindex'), inputSchema: {} },
      async () => {
        try {
          void runFullReindex().catch(() => undefined);
          return mcpToolJson({ ok: true, message: 'Переиндексация запущена' });
        } catch (err) {
          return mcpToolError(err instanceof Error ? err.message : String(err));
        }
      }
    );
  });
}
