import { z } from 'zod';

import {
  checkImportDuplicate,
  importFromBase64,
  importFromUrlViaHandler,
  importLocalFiles
} from '../importService';
import { runMcpRead, runMcpWrite } from '../mcpToolRuntime';
import type { McpRegisterContext } from './registerContext';

export function registerImportTools(ctx: McpRegisterContext): void {
  const { server, deps, registerIfEnabled, desc } = ctx;

  registerIfEnabled('arc_import_item', () => {
    server.registerTool(
      'arc_import_item',
      {
        description: desc('arc_import_item'),
        inputSchema: {
          url: z.string().describe('Прямая HTTP(S)-ссылка на файл'),
          website: z.string().optional().describe('Страница-источник (linkUrl)'),
          pageTitle: z.string().optional().describe('Предлагаемое имя карточки'),
          name: z.string().optional().describe('Явное имя карточки')
        }
      },
      async (body) =>
        runMcpWrite(deps, (root) => importFromUrlViaHandler(root, body))
    );
  });

  registerIfEnabled('arc_import_item_base64', () => {
    server.registerTool(
      'arc_import_item_base64',
      {
        description: desc('arc_import_item_base64'),
        inputSchema: {
          base64: z.string().describe('Данные файла в base64'),
          mimeType: z.string().optional().describe('MIME-тип, например image/png'),
          name: z.string().optional(),
          website: z.string().optional()
        }
      },
      async (input) => runMcpWrite(deps, (root) => importFromBase64(root, input))
    );
  });

  registerIfEnabled('arc_import_files', () => {
    server.registerTool(
      'arc_import_files',
      {
        description: desc('arc_import_files'),
        inputSchema: {
          paths: z.array(z.string()).min(1).describe('Абсолютные пути к файлам')
        }
      },
      async ({ paths }) => runMcpWrite(deps, (root) => importLocalFiles(root, paths))
    );
  });

  registerIfEnabled('arc_check_import_duplicate', () => {
    server.registerTool(
      'arc_check_import_duplicate',
      {
        description: desc('arc_check_import_duplicate'),
        inputSchema: {
          path: z.string().describe('Абсолютный путь к проверяемому файлу')
        }
      },
      async ({ path: filePath }) => runMcpRead(deps, (root) => checkImportDuplicate(root, filePath))
    );
  });
}
