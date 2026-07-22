import { describe, expect, it } from 'vitest';

import {
  approximateWindowsBootIdForTest,
  buildWindowsRunValueForTest,
  getLaunchAtLoginCliArgs,
  LAUNCH_AT_LOGIN_ARG,
  LAUNCH_AT_LOGIN_HIDDEN_ARG,
  resolveWindowsHiddenAutostart,
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

  it('builds a stable boot id from now and uptime', () => {
    expect(approximateWindowsBootIdForTest(1_700_000_123_456, 45.7)).toBe('1700000077');
  });
});

describe('resolveWindowsHiddenAutostart', () => {
  it('returns true when hidden argv flag is present', () => {
    expect(
      resolveWindowsHiddenAutostart({
        argv: ['electron', '.', LAUNCH_AT_LOGIN_HIDDEN_ARG],
        wasOpenedAtLogin: false,
        pendingMarkerActive: false
      })
    ).toBe(true);
  });

  it('returns true when only the visible login argv flag is present', () => {
    expect(
      resolveWindowsHiddenAutostart({
        argv: ['electron', '.', LAUNCH_AT_LOGIN_ARG],
        wasOpenedAtLogin: false,
        pendingMarkerActive: false
      })
    ).toBe(true);
  });

  it('returns true when Electron reports wasOpenedAtLogin', () => {
    expect(
      resolveWindowsHiddenAutostart({
        argv: ['electron', '.'],
        wasOpenedAtLogin: true,
        pendingMarkerActive: false
      })
    ).toBe(true);
  });

  it('returns true from pending marker when launch signals are missing', () => {
    expect(
      resolveWindowsHiddenAutostart({
        argv: ['electron', '.'],
        wasOpenedAtLogin: false,
        pendingMarkerActive: true
      })
    ).toBe(true);
  });

  it('returns false for a manual launch with no login signals', () => {
    expect(
      resolveWindowsHiddenAutostart({
        argv: ['electron', '.'],
        wasOpenedAtLogin: false,
        pendingMarkerActive: false
      })
    ).toBe(false);
  });
});

describe('shouldStartHiddenInTrayFromLaunch', () => {
  const loginAtBoot = { wasOpenedAtLogin: true, wasOpenedAsHidden: true } as Electron.LoginItemSettings;
  const manualLaunch = { wasOpenedAtLogin: false, wasOpenedAsHidden: false } as Electron.LoginItemSettings;

  it('returns false when autostart is disabled in prefs', () => {
    expect(
      shouldStartHiddenInTrayFromLaunch(false, true, false, [LAUNCH_AT_LOGIN_HIDDEN_ARG], loginAtBoot)
    ).toBe(false);
  });

  it('returns false on Windows for a manual launch without login signals', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(shouldStartHiddenInTrayFromLaunch(true, true, false, ['electron', '.'], manualLaunch)).toBe(false);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns true on Windows when hidden argv flag is present', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(
      shouldStartHiddenInTrayFromLaunch(true, true, false, ['electron', '.', LAUNCH_AT_LOGIN_HIDDEN_ARG], manualLaunch)
    ).toBe(true);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns true on Windows when only the visible login argv flag is present', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(
      shouldStartHiddenInTrayFromLaunch(true, true, false, ['electron', '.', LAUNCH_AT_LOGIN_ARG], manualLaunch)
    ).toBe(true);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns true on Windows when Electron reports wasOpenedAtLogin', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(shouldStartHiddenInTrayFromLaunch(true, true, false, ['electron', '.'], loginAtBoot)).toBe(true);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('returns true on macOS when login item opened hidden', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    expect(shouldStartHiddenInTrayFromLaunch(true, true, false, ['electron', '.'], loginAtBoot)).toBe(true);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});
