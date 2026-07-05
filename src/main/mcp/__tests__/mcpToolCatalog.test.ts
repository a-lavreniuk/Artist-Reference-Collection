import { describe, expect, it } from 'vitest';

import {
  defaultMcpToolsEnabled,
  mergeMcpToolsEnabled,
  sanitizeMcpToolsEnabled
} from '../../shared/mcpToolCatalog';

describe('mcpToolCatalog', () => {
  it('defaultMcpToolsEnabled enables all tools', () => {
    const enabled = defaultMcpToolsEnabled();
    expect(Object.values(enabled).every(Boolean)).toBe(true);
    expect(Object.keys(enabled)).toHaveLength(15);
  });

  it('sanitizeMcpToolsEnabled fills missing keys with defaults', () => {
    const enabled = sanitizeMcpToolsEnabled({ arc_import_item: false });
    expect(enabled.arc_import_item).toBe(false);
    expect(enabled.arc_get_app_info).toBe(true);
  });

  it('mergeMcpToolsEnabled patches single tool', () => {
    const current = defaultMcpToolsEnabled();
    const merged = mergeMcpToolsEnabled(current, { arc_ai_search: false });
    expect(merged.arc_ai_search).toBe(false);
    expect(merged.arc_list_cards).toBe(true);
  });
});
