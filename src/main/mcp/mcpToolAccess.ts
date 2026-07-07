import { readAppPreferencesSync } from '../appPreferences';
import {
  listEnabledMcpToolIds,
  sanitizeMcpToolsEnabled,
  type McpToolId,
  type McpToolsEnabledMap
} from '../shared/mcpToolCatalog';

export function getMcpToolsEnabled(): McpToolsEnabledMap {
  return sanitizeMcpToolsEnabled(readAppPreferencesSync().mcpToolsEnabled);
}

export function isMcpToolEnabled(toolId: McpToolId): boolean {
  return getMcpToolsEnabled()[toolId];
}

export function getEnabledMcpToolIds(): McpToolId[] {
  return listEnabledMcpToolIds(getMcpToolsEnabled());
}
