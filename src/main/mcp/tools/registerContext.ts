import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpToolId } from '../../shared/mcpToolCatalog';
import { mcpToolDescription } from '../../shared/mcpToolCopy';
import type { McpDeps } from '../mcpDeps';
import { isMcpToolEnabled } from '../mcpToolAccess';

export type McpRegisterContext = {
  server: McpServer;
  deps: McpDeps;
  registerIfEnabled: (toolId: McpToolId, register: () => void) => void;
  desc: (toolId: McpToolId) => string;
};

export function createMcpRegisterContext(server: McpServer, deps: McpDeps): McpRegisterContext {
  return {
    server,
    deps,
    registerIfEnabled(toolId, register) {
      if (isMcpToolEnabled(toolId)) register();
    },
    desc: mcpToolDescription
  };
}
