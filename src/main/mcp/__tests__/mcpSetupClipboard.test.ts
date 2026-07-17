import { describe, expect, it } from 'vitest';

import { buildMcpSetupPackageText } from '../mcpSetupClipboard';
import { isMcpStdioArgv } from '../mcpStdioArgv';

describe('mcpSetupClipboard', () => {
  it('buildMcpSetupPackageText includes HTTP url and stdio absolute command', () => {
    const text = buildMcpSetupPackageText({
      launch: { command: '/Applications/ARC.app/Contents/MacOS/ARC', args: ['--mcp'] },
      port: 47897
    });
    expect(text).toContain('http://127.0.0.1:47897/mcp');
    expect(text).toContain('/Applications/ARC.app/Contents/MacOS/ARC');
    expect(text).toContain('"--mcp"');
    expect(text).toContain('## HTTP');
    expect(text).toContain('## stdio');
    expect(text).not.toMatch(/Cursor|Claude|ChatGPT/i);
  });
});

describe('isMcpStdioArgv', () => {
  it('detects --mcp flag', () => {
    expect(isMcpStdioArgv(['node', 'app', '--mcp'])).toBe(true);
    expect(isMcpStdioArgv(['node', 'app'])).toBe(false);
  });
});
