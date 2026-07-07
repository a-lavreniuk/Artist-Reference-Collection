import { describe, expect, it } from 'vitest';

import { buildMcpAppInfo } from '../mcpDeps';

describe('mcpDeps', () => {
  it('buildMcpAppInfo reflects library and toggle state', () => {
    const info = buildMcpAppInfo({
      getAppVersion: () => '0.1.4',
      getPlatform: () => 'win32',
      getLibraryRoot: () => 'C:\\Library',
      isMcpEnabled: () => true,
      assertWritable: () => undefined
    });
    expect(info.name).toBe('ARC');
    expect(info.mcpServerEnabled).toBe(true);
    expect(info.libraryOpen).toBe(true);
    expect(info.libraryPath).toBe('C:\\Library');
  });
});
