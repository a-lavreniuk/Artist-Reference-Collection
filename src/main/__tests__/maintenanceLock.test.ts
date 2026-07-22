import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../autoImportWatcher', () => ({
  resumeAutoImportIfNeeded: vi.fn()
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => []
  }
}));

import {
  acquireMaintenanceLock,
  isMaintenanceLocked,
  releaseMaintenanceLock
} from '../maintenanceLock';

describe('maintenanceLock', () => {
  beforeEach(() => {
    while (isMaintenanceLocked()) {
      releaseMaintenanceLock();
    }
  });

  it('locks and unlocks with LIFO when no token', () => {
    expect(isMaintenanceLocked()).toBe(false);
    acquireMaintenanceLock();
    expect(isMaintenanceLocked()).toBe(true);
    releaseMaintenanceLock();
    expect(isMaintenanceLocked()).toBe(false);
  });

  it('ignores release with unknown token', () => {
    const token = acquireMaintenanceLock();
    releaseMaintenanceLock('not-the-token');
    expect(isMaintenanceLocked()).toBe(true);
    releaseMaintenanceLock(token);
    expect(isMaintenanceLocked()).toBe(false);
  });

  it('releases only matching token when nested', () => {
    const outer = acquireMaintenanceLock({ silentUi: true });
    const inner = acquireMaintenanceLock();
    expect(isMaintenanceLocked()).toBe(true);
    releaseMaintenanceLock(outer);
    expect(isMaintenanceLocked()).toBe(true);
    releaseMaintenanceLock(inner);
    expect(isMaintenanceLocked()).toBe(false);
  });
});
