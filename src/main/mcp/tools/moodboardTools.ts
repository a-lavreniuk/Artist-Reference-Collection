import { z } from 'zod';

import {
  addCardsToMoodboard,
  readMoodboard,
  removeCardsFromMoodboard,
  updateMoodboardBoard
} from '../moodboardService';
import { cardIdSchema } from '../mcpSchemas';
import { runMcpRead, runMcpWrite } from '../mcpToolRuntime';
import type { McpRegisterContext } from './registerContext';

export function registerMoodboardTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_get_moodboard', () => {
    server.registerTool(
      'arc_get_moodboard',
      { description: desc('arc_get_moodboard'), inputSchema: {} },
      async () => runMcpRead(deps, (root) => readMoodboard(root))
    );
  });

  registerIfEnabled('arc_add_to_moodboard', () => {
    server.registerTool(
      'arc_add_to_moodboard',
      {
        description: desc('arc_add_to_moodboard'),
        inputSchema: {
          cardIds: z.array(cardIdSchema).min(1).describe('ID карточек для мудборда')
        }
      },
      async ({ cardIds }) => runMcpWrite(deps, (root) => addCardsToMoodboard(root, cardIds))
    );
  });

  registerIfEnabled('arc_remove_from_moodboard', () => {
    server.registerTool(
      'arc_remove_from_moodboard',
      {
        description: desc('arc_remove_from_moodboard'),
        inputSchema: {
          cardIds: z.array(cardIdSchema).min(1).describe('ID карточек для удаления')
        }
      },
      async ({ cardIds }) => runMcpWrite(deps, (root) => removeCardsFromMoodboard(root, cardIds))
    );
  });

  registerIfEnabled('arc_update_moodboard_board', () => {
    server.registerTool(
      'arc_update_moodboard_board',
      {
        description: desc('arc_update_moodboard_board'),
        inputSchema: {
          board: z.record(z.string(), z.unknown()).describe('Объект доски мудборда (version: 1)')
        }
      },
      async ({ board }) => runMcpWrite(deps, (root) => updateMoodboardBoard(root, board))
    );
  });
}
