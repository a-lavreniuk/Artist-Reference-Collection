import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { app } from 'electron';

export const LAUNCH_AT_LOGIN_ARG = '--arc-launched-at-login';
export const LAUNCH_AT_LOGIN_HIDDEN_ARG = '--arc-launched-at-login-hidden';

const WINDOWS_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const PENDING_HIDDEN_AUTOSTART_FILE = 'pending-hidden-autostart';
const WINDOWS_BOOT_WINDOW_MS = 180_000;

export function getLaunchAtLoginCliArgs(hidden: boolean): string[] {
  return hidden ? [LAUNCH_AT_LOGIN_HIDDEN_ARG] : [LAUNCH_AT_LOGIN_ARG];
}

export function allLaunchAtLoginCliArgSets(): string[][] {
  return [[], getLaunchAtLoginCliArgs(false), getLaunchAtLoginCliArgs(true)];
}

function argvIncludesFlag(argv: readonly string[], flag: string): boolean {
  return argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

export function wasLaunchedAtLoginFromArgv(argv: readonly string[]): boolean {
  return argvIncludesFlag(argv, LAUNCH_AT_LOGIN_ARG);
}

export function wasLaunchedHiddenAtLoginFromArgv(argv: readonly string[]): boolean {
  return argvIncludesFlag(argv, LAUNCH_AT_LOGIN_HIDDEN_ARG);
}

function windowsLoginItemRegistryNames(execPath: string): string[] {
  const names = new Set<string>([`electron.app.${app.getName()}`]);
  for (const item of app.getLoginItemSettings({ path: execPath }).launchItems ?? []) {
    if (item.name) names.add(item.name);
  }
  return [...names];
}

function buildWindowsRunValue(execPath: string, args: string[]): string {
  const quoted = execPath.includes(' ') ? `"${execPath}"` : execPath;
  if (args.length === 0) return quoted;
  return `${quoted} ${args.join(' ')}`;
}

export function buildWindowsRunValueForTest(execPath: string, args: string[]): string {
  return buildWindowsRunValue(execPath, args);
}

function execReg(args: string[]): void {
  execFileSync('reg', args, { stdio: 'ignore', windowsHide: true });
}

function deleteWindowsRunValue(regName: string): void {
  try {
    execReg(['delete', WINDOWS_RUN_KEY, '/v', regName, '/f']);
  } catch {
    // Missing key is fine.
  }
}

function writeWindowsRunValue(regName: string, value: string): void {
  execReg(['add', WINDOWS_RUN_KEY, '/v', regName, '/t', 'REG_SZ', '/d', value, '/f']);
}

function pendingHiddenAutostartPath(): string {
  return path.join(app.getPath('userData'), PENDING_HIDDEN_AUTOSTART_FILE);
}

export function markPendingHiddenAutostart(): void {
  if (process.platform !== 'win32') return;
  fs.writeFileSync(pendingHiddenAutostartPath(), String(Date.now()), 'utf8');
}

export function clearPendingHiddenAutostart(): void {
  if (process.platform !== 'win32') return;
  try {
    fs.unlinkSync(pendingHiddenAutostartPath());
  } catch {
    // Missing marker is fine.
  }
}

export function consumePendingHiddenAutostart(maxBootAgeMs = WINDOWS_BOOT_WINDOW_MS): boolean {
  if (process.platform !== 'win32') return false;
  try {
    fs.statSync(pendingHiddenAutostartPath());
    const bootAgeMs = os.uptime() * 1000;
    if (bootAgeMs > maxBootAgeMs) return false;
    clearPendingHiddenAutostart();
    return true;
  } catch {
    return false;
  }
}

export function syncPendingHiddenAutostartMarker(prefs: {
  launchAtLogin: boolean;
  launchAtLoginHidden: boolean;
}): void {
  if (process.platform !== 'win32') return;
  if (prefs.launchAtLogin && prefs.launchAtLoginHidden) {
    markPendingHiddenAutostart();
  } else {
    clearPendingHiddenAutostart();
  }
}

function clearWindowsAutostartEntries(execPath: string): void {
  for (const args of allLaunchAtLoginCliArgSets()) {
    app.setLoginItemSettings({
      openAtLogin: false,
      path: execPath,
      args,
      enabled: false
    });
  }
  for (const regName of windowsLoginItemRegistryNames(execPath)) {
    deleteWindowsRunValue(regName);
  }
}

function applyWindowsLaunchAtLogin(open: boolean, hidden: boolean): void {
  const execPath = process.execPath;

  clearWindowsAutostartEntries(execPath);

  if (!open) {
    clearPendingHiddenAutostart();
    return;
  }

  const args = getLaunchAtLoginCliArgs(hidden);

  // Task Manager / StartupApproved integration.
  app.setLoginItemSettings({
    openAtLogin: true,
    path: execPath,
    args,
    enabled: true
  });

  const regValue = buildWindowsRunValue(execPath, args);
  for (const regName of windowsLoginItemRegistryNames(execPath)) {
    // Electron writes the Run key without args — restore the command line last.
    writeWindowsRunValue(regName, regValue);
  }
}

export function applyLaunchAtLogin(open: boolean, hidden = false): void {
  if (process.platform === 'linux') return;

  if (process.platform === 'win32') {
    applyWindowsLaunchAtLogin(open, hidden);
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: open,
    openAsHidden: open && hidden
  });
}

function wasLaunchedHiddenAtLoginOnWindows(argv: readonly string[]): boolean {
  if (wasLaunchedHiddenAtLoginFromArgv(argv)) return true;
  return consumePendingHiddenAutostart();
}

export function shouldStartHiddenInTrayFromLaunch(
  launchAtLogin: boolean,
  launchAtLoginHidden: boolean,
  needsOnboarding: boolean,
  argv: readonly string[],
  loginItemSettings: Electron.LoginItemSettings
): boolean {
  if (process.platform === 'linux' || needsOnboarding) return false;
  if (!launchAtLogin || !launchAtLoginHidden) return false;

  if (process.platform === 'win32') {
    return wasLaunchedHiddenAtLoginOnWindows(argv);
  }

  if (!loginItemSettings.wasOpenedAtLogin) return false;
  if (process.platform === 'darwin') return loginItemSettings.wasOpenedAsHidden === true;
  return false;
}
