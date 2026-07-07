import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { buildMcpDeps, type McpDeps } from './mcpDeps';
import { registerArcMcpPrompts } from './registerPrompts';
import { registerArcMcpResources } from './registerResources';
import { registerAiTools } from './tools/aiTools';
import { registerAppTools } from './tools/appTools';
import { registerCardTools } from './tools/cardTools';
import { registerCatalogTools } from './tools/catalogTools';
import { registerCollectionTools } from './tools/collectionTools';
import { registerDuplicateTools } from './tools/duplicateTools';
import { registerFilterTools } from './tools/filterTools';
import { registerImportTools } from './tools/importTools';
import { registerMoodboardTools } from './tools/moodboardTools';
import { createMcpRegisterContext } from './tools/registerContext';
import { registerVisualTools } from './tools/visualTools';

export function registerArcMcpTools(server: McpServer, deps: McpDeps = buildMcpDeps()): void {
  const ctx = createMcpRegisterContext(server, deps);

  registerAppTools(ctx);
  registerCardTools(ctx);
  registerCollectionTools(ctx);
  registerMoodboardTools(ctx);
  registerCatalogTools(ctx);
  registerImportTools(ctx);
  registerVisualTools(ctx);
  registerFilterTools(ctx);
  registerDuplicateTools(ctx);
  registerAiTools(ctx);

  registerArcMcpResources(server);
  registerArcMcpPrompts(server);
}
