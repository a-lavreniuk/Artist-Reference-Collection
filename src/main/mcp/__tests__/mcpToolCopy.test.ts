import { describe, expect, it } from 'vitest';

import { MCP_TOOL_GROUPS, MCP_TOOLS } from '../../shared/mcpToolCatalog';
import { MCP_TOOL_COPY, MCP_TOOL_IDS } from '../../shared/mcpToolCopy';

describe('mcpToolCopy', () => {
  it('every catalog tool id has RU label and description', () => {
    for (const id of MCP_TOOL_IDS) {
      const entry = MCP_TOOL_COPY[id];
      expect(entry, id).toBeDefined();
      expect(entry.label.trim().length, id).toBeGreaterThan(0);
      expect(entry.description.trim().length, id).toBeGreaterThan(0);
      expect(MCP_TOOL_GROUPS.some((g) => g.id === entry.groupId), id).toBe(true);
    }
  });

  it('MCP_TOOLS mirrors MCP_TOOL_IDS', () => {
    expect(MCP_TOOLS.map((t) => t.id)).toEqual([...MCP_TOOL_IDS]);
    for (const tool of MCP_TOOLS) {
      expect(tool.label).toBe(MCP_TOOL_COPY[tool.id].label);
      expect(tool.groupId).toBe(MCP_TOOL_COPY[tool.id].groupId);
    }
  });
});
