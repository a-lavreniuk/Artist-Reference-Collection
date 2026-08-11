import path from 'path';
import os from 'os';
import { describe, expect, it, vi } from 'vitest';

const tmpRoot = path.join(os.tmpdir(), `arc-mcp-secret-prefs-test-${process.pid}`);

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return path.join(tmpRoot, 'userData');
      return path.join(tmpRoot, name);
    },
    getVersion: () => '0.0.0-test'
  },
  ipcMain: {
    handle: vi.fn()
  }
}));

vi.mock('../launchAtLogin', () => ({
  applyLaunchAtLogin: vi.fn(),
  shouldStartHiddenInTrayFromLaunch: vi.fn(() => false)
}));

vi.mock('../screenshotShortcut', () => ({
  registerScreenshotShortcut: vi.fn()
}));

import { defaultAppPreferences, sanitizeAppPreferencesFromDisk } from '../appPreferences';

describe('appPreferences mcpApiSecret', () => {
  it('defaults generate independent local and MCP secrets', () => {
    const prefs = defaultAppPreferences();
    expect(prefs.localApiSecret.length).toBeGreaterThanOrEqual(16);
    expect(prefs.mcpApiSecret.length).toBeGreaterThanOrEqual(16);
    expect(prefs.mcpApiSecret).not.toBe(prefs.localApiSecret);
  });

  it('migration B: missing mcpApiSecret gets a new secret, not a copy of localApiSecret', () => {
    const local = 'a'.repeat(32);
    const sanitized = sanitizeAppPreferencesFromDisk({
      version: 1,
      localApiSecret: local
    });
    expect(sanitized.localApiSecret).toBe(local);
    expect(sanitized.mcpApiSecret.length).toBeGreaterThanOrEqual(16);
    expect(sanitized.mcpApiSecret).not.toBe(local);
  });

  it('keeps a valid mcpApiSecret from disk', () => {
    const local = 'b'.repeat(32);
    const mcp = 'c'.repeat(32);
    const sanitized = sanitizeAppPreferencesFromDisk({
      version: 1,
      localApiSecret: local,
      mcpApiSecret: mcp
    });
    expect(sanitized.localApiSecret).toBe(local);
    expect(sanitized.mcpApiSecret).toBe(mcp);
  });
});
