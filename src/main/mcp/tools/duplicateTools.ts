import { z } from 'zod';

import {
  addSessionSkippedPair,
  getCachedDuplicatePairs,
  scanDuplicatePairs
} from '../../duplicateScanService';
import { readSystem } from '../../storage/systemFiles';
import {
  addSkippedDuplicatePair,
  getCardByIdFromDb,
  mergeDuplicateCards
} from '../../storage/libraryStorage';
import { refreshLibrarySessionSnapshotFromDisk } from '../../librarySessionSnapshot';
import { serializeCardRow } from '../serializeCard';
import { cardIdSchema } from '../mcpSchemas';
import { runMcpRead, runMcpWrite } from '../mcpToolRuntime';
import type { McpRegisterContext } from './registerContext';

export function registerDuplicateTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_scan_duplicates', () => {
    server.registerTool(
      'arc_scan_duplicates',
      {
        description: desc('arc_scan_duplicates'),
        inputSchema: {
          thresholdPct: z
            .number()
            .int()
            .min(50)
            .max(100)
            .optional()
            .describe('Порог схожести в процентах')
        }
      },
      async ({ thresholdPct }) =>
        runMcpRead(deps, async (root) => {
          const system = await readSystem(root);
          const threshold = thresholdPct ?? system.duplicateSimilarityThresholdPct;
          const pairs = await scanDuplicatePairs(root, threshold);
          return { thresholdPct: threshold, pairCount: pairs.length, pairs };
        })
    );
  });

  registerIfEnabled('arc_list_duplicate_pairs', () => {
    server.registerTool(
      'arc_list_duplicate_pairs',
      {
        description: desc('arc_list_duplicate_pairs'),
        inputSchema: {
          rescan: z.boolean().optional().describe('Пересканировать, если кэш пуст')
        }
      },
      async ({ rescan }) =>
        runMcpRead(deps, async (root) => {
          let pairs = getCachedDuplicatePairs();
          if (pairs.length === 0 && rescan) {
            const system = await readSystem(root);
            pairs = await scanDuplicatePairs(root, system.duplicateSimilarityThresholdPct);
          }
          return { pairCount: pairs.length, pairs };
        })
    );
  });

  registerIfEnabled('arc_merge_duplicates', () => {
    server.registerTool(
      'arc_merge_duplicates',
      {
        description: desc('arc_merge_duplicates'),
        inputSchema: {
          primaryId: cardIdSchema.describe('Карточка, которая останется'),
          secondaryId: cardIdSchema.describe('Карточка, которая будет удалена')
        }
      },
      async ({ primaryId, secondaryId }) =>
        runMcpWrite(deps, async (root) => {
          if (!getCardByIdFromDb(root, primaryId)) throw new Error('Основная карточка не найдена');
          if (!getCardByIdFromDb(root, secondaryId)) throw new Error('Вторичная карточка не найдена');
          await mergeDuplicateCards(root, primaryId, secondaryId);
          void refreshLibrarySessionSnapshotFromDisk();
          const primary = getCardByIdFromDb(root, primaryId);
          return {
            primaryId,
            secondaryId,
            merged: true,
            primary: primary ? serializeCardRow(primary) : null
          };
        })
    );
  });

  registerIfEnabled('arc_skip_duplicate_pair', () => {
    server.registerTool(
      'arc_skip_duplicate_pair',
      {
        description: desc('arc_skip_duplicate_pair'),
        inputSchema: {
          idA: cardIdSchema,
          idB: cardIdSchema
        }
      },
      async ({ idA, idB }) =>
        runMcpWrite(deps, async (root) => {
          addSessionSkippedPair(idA, idB);
          addSkippedDuplicatePair(root, idA, idB);
          return { idA, idB, skipped: true };
        })
    );
  });
}
