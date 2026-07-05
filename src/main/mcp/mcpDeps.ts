import { app } from 'electron';

import { readAppPreferencesSync } from '../appPreferences';
import { readLibraryRootSync } from '../libraryRootConfig';
import { isMaintenanceLocked } from '../maintenanceLock';
import { getEnabledMcpToolIds } from './mcpToolAccess';
import { ARC_MCP_PORT } from './constants';

export type McpDeps = {
  getAppVersion: () => string;
  getPlatform: () => string;
  getLibraryRoot: () => string | null;
  isMcpEnabled: () => boolean;
  assertWritable: () => void;
};

export function buildMcpDeps(): McpDeps {
  return {
    getAppVersion: () => app.getVersion(),
    getPlatform: () => process.platform,
    getLibraryRoot: () => readLibraryRootSync(),
    isMcpEnabled: () => readAppPreferencesSync().mcpServerEnabled,
    assertWritable: () => {
      if (isMaintenanceLocked()) {
        throw new Error('Библиотека в режиме обслуживания');
      }
    }
  };
}

export function buildMcpAppInfo(deps: McpDeps): Record<string, unknown> {
  const libraryRoot = deps.getLibraryRoot();
  return {
    name: 'ARC',
    version: deps.getAppVersion(),
    platform: deps.getPlatform(),
    mcpServerEnabled: deps.isMcpEnabled(),
    mcpServerPort: ARC_MCP_PORT,
    enabledMcpTools: getEnabledMcpToolIds(),
    libraryOpen: Boolean(libraryRoot),
    ...(libraryRoot ? { libraryPath: libraryRoot } : {})
  };
}

export function assertMcpReadAccess(deps: McpDeps): void {
  if (!deps.isMcpEnabled()) {
    throw new Error('MCP server disabled');
  }
}

export function assertMcpWriteAccess(deps: McpDeps): string {
  assertMcpReadAccess(deps);
  deps.assertWritable();
  const root = deps.getLibraryRoot();
  if (!root) {
    throw new Error('Library not selected');
  }
  return root;
}

export function mcpToolError(message: string): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  return {
    content: [{ type: 'text', text: message }],
    isError: true
  };
}

export function mcpToolJson(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
  };
}
