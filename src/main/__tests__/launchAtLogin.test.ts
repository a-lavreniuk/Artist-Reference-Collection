import { describe, expect, it } from 'vitest';

import {
  buildWindowsRunValueForTest,
  getLaunchAtLoginCliArgs,
  LAUNCH_AT_LOGIN_ARG,
  LAUNCH_AT_LOGIN_HIDDEN_ARG,
  shouldStartHiddenInTrayFromLaunch,
  wasLaunchedAtLoginFromArgv,
  wasLaunchedHiddenAtLoginFromArgv
} from '../launchAtLogin';

describe('launchAtLogin argv helpers', () => {
  it('builds hidden launch args with a single hidden flag', () => {
    expect(getLaunchAtLoginCliArgs(true)).toEqual([LAUNCH_AT_LOGIN_HIDDEN_ARG]);
  });

  it('builds visible launch args with login flag only', () => {
    expect(getLaunchAtLoginCliArgs(false)).toEqual([LAUNCH_AT_LOGIN_ARG]);
  });

  it('detects hidden login launch from argv', () => {
    expect(wasLaunchedHiddenAtLoginFromArgv(['electron', '.', LAUNCH_AT_LOGIN_HIDDEN_ARG])).toBe(true);
  });

  it('detects visible login launch without hidden flag', () => {
    expect(wasLaunchedAtLoginFromArgv(['electron', '.', LAUNCH_AT_LOGIN_ARG])).toBe(true);
    expect(wasLaunchedHiddenAtLoginFromArgv(['electron', '.', LAUNCH_AT_LOGIN_ARG])).toBe(false);
  });

  it('builds Windows Run value with quoted path and args', () => {
    expect(buildWindowsRunValueForTest('C:\\Program Files\\ARC\\ARC.exe', [LAUNCH_AT_LOGIN_HIDDEN_ARG])).toBe(
      '"C:\\Program Files\\ARC\\ARC.exe" --arc-launched-at-login-hidden'
    );
  });
});

describe('shouldStartHiddenInTrayFromLaunch', () => {
  const loginAtBoot = { wasOpenedAtLogin: true, wasOpenedAsHidden: true } as Electron.LoginItemSettings;

  it('returns false when autostart is disabled in prefs', () => {
    expect(
      shouldStartHiddenInTrayFromLaunch(false, true, false, [LAUNCH_AT_LOGIN_HIDDEN_ARG], loginAtBoot)
    ).toBe(false);
  });

  it('returns false on Windows when hidden argv flag is missing and no pending marker', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(
      shouldStartHiddenInTrayFromLaunch(true, true, false, ['electron', '.', LAUNCH_AT_LOGIN_ARG], loginAtBoot)
    ).toBe(false);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns true on Windows when hidden argv flag is present', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(
      shouldStartHiddenInTrayFromLaunch(true, true, false, ['electron', '.', LAUNCH_AT_LOGIN_HIDDEN_ARG], loginAtBoot)
    ).toBe(true);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns true on macOS when login item opened hidden', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    expect(shouldStartHiddenInTrayFromLaunch(true, true, false, ['electron', '.'], loginAtBoot)).toBe(true);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});
