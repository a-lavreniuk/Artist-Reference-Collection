import { describe, expect, it, beforeEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'temp') return os.tmpdir();
      if (name === 'userData') return path.join(os.tmpdir(), 'arc-userdata');
      return os.tmpdir();
    }
  }
}));

vi.mock('../mediaServerHost', () => ({
  syncStagingTokenToMediaWorker: vi.fn()
}));

import {
  allowMediaStagingPaths,
  clearMediaStagingTokens,
  isAllowedStagingAbsPath,
  registerMediaStagingToken
} from '../mediaStagingTokens';

describe('mediaStagingTokens allowlist', () => {
  beforeEach(() => {
    clearMediaStagingTokens();
  });

  it('allows paths inside library root', () => {
    const lib = path.join(os.tmpdir(), 'arc-lib-root');
    const file = path.join(lib, 'cards', 'a', 'original.jpg');
    expect(isAllowedStagingAbsPath(file, lib)).toBe(true);
  });

  it('rejects arbitrary paths outside library and temp without allowlist', () => {
    const outside = path.join(os.tmpdir(), '..', 'arc-not-allowed-staging.jpg');
    // Resolve to a path that is not under tmp on some platforms; use a fake absolute
    const fake = process.platform === 'win32' ? 'C:\\Windows\\arc-fake.jpg' : '/etc/arc-fake.jpg';
    expect(isAllowedStagingAbsPath(fake, path.join(os.tmpdir(), 'lib'))).toBe(false);
    void outside;
  });

  it('allows explicitly allowlisted paths', () => {
    const picked = path.join(os.tmpdir(), 'user-picked-import.jpg');
    // picked is under tmpdir → already trusted; use a non-temp path via allowlist only
    const fake =
      process.platform === 'win32'
        ? 'D:\\Downloads\\picked-photo.jpg'
        : '/home/user/Downloads/picked-photo.jpg';
    expect(isAllowedStagingAbsPath(fake, null)).toBe(false);
    allowMediaStagingPaths([fake]);
    expect(isAllowedStagingAbsPath(fake, null)).toBe(true);
  });

  it('registers token only for allowed existing media files', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-stg-'));
    const file = path.join(dir, 'preview.jpg');
    fs.writeFileSync(file, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    const token = await registerMediaStagingToken(file, null);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');

    const denied =
      process.platform === 'win32'
        ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
        : '/etc/hosts';
    expect(await registerMediaStagingToken(denied, null)).toBeNull();
  });
});
