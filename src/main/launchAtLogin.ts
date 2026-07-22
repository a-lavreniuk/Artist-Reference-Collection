import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { app } from 'electron';

export const LAUNCH_AT_LOGIN_ARG = '--arc-launched-at-login';
export const LAUNCH_AT_LOGIN_HIDDEN_ARG = '--arc-launched-at-login-hidden';

const WINDOWS_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const PENDING_HIDDEN_AUTOSTART_FILE = 'pending-hidden-autostart';
const PENDING_HIDDEN_AUTOSTART_CONSUMED_BOOT_FILE = 'pending-hidden-autostart-consumed-boot';
/** Slow logon / Defender can delay Run entries past 3 minutes. */
const WINDOWS_BOOT_WINDOW_MS = 600_000;

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

function pendingHiddenAutostartConsumedBootPath(): string {
  return path.join(app.getPath('userData'), PENDING_HIDDEN_AUTOSTART_CONSUMED_BOOT_FILE);
}

/** Stable id for the current Windows boot (second precision). */
export function approximateWindowsBootIdForTest(nowMs: number, uptimeSec: number): string {
  return String(Math.floor((nowMs - uptimeSec * 1000) / 1000));
}

function approximateWindowsBootId(): string {
  return approximateWindowsBootIdForTest(Date.now(), os.uptime());
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
  try {
    fs.unlinkSync(pendingHiddenAutostartConsumedBootPath());
  } catch {
    // Missing consumed-boot marker is fine.
  }
}

/**
 * One-shot per boot: if the pending marker exists and the machine recently
 * booted, treat this start as hidden autostart. Keeps the pending marker for
 * the next reboot; records the boot id so a later manual launch in the same
 * session does not hide again.
 */
export function consumePendingHiddenAutostart(maxBootAgeMs = WINDOWS_BOOT_WINDOW_MS): boolean {
  if (process.platform !== 'win32') return false;
  try {
    fs.statSync(pendingHiddenAutostartPath());
    const bootAgeMs = os.uptime() * 1000;
    if (bootAgeMs > maxBootAgeMs) return false;

    const bootId = approximateWindowsBootId();
    const consumedPath = pendingHiddenAutostartConsumedBootPath();
    try {
      if (fs.readFileSync(consumedPath, 'utf8').trim() === bootId) return false;
    } catch {
      // Not consumed for this boot yet.
    }

    fs.writeFileSync(consumedPath, bootId, 'utf8');
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

  // Keep the marker armed while hidden autostart is on so the next boot still
  // has a fallback after argv loss or a force-killed session (no will-quit).
  if (hidden) {
    markPendingHiddenAutostart();
  } else {
    clearPendingHiddenAutostart();
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

/**
 * Prefs already require launchAtLoginHidden. Decide whether *this* process
 * start is a login autostart (vs a manual launch).
 */
export function resolveWindowsHiddenAutostart(input: {
  argv: readonly string[];
  wasOpenedAtLogin: boolean;
  pendingMarkerActive: boolean;
}): boolean {
  if (wasLaunchedHiddenAtLoginFromArgv(input.argv)) return true;
  // Registry / updater sometimes keep only the visible login flag.
  if (wasLaunchedAtLoginFromArgv(input.argv)) return true;
  if (input.wasOpenedAtLogin) return true;
  return input.pendingMarkerActive;
}

export function markHiddenAutostartConsumedForCurrentBoot(): void {
  if (process.platform !== 'win32') return;
  try {
    fs.writeFileSync(pendingHiddenAutostartConsumedBootPath(), approximateWindowsBootId(), 'utf8');
  } catch {
    // Best-effort; missing userData is unlikely after app ready.
  }
}

function wasLaunchedHiddenAtLoginOnWindows(
  argv: readonly string[],
  loginItemSettings: Electron.LoginItemSettings
): boolean {
  const fromLaunchSignals = resolveWindowsHiddenAutostart({
    argv,
    wasOpenedAtLogin: loginItemSettings.wasOpenedAtLogin === true,
    pendingMarkerActive: false
  });
  if (fromLaunchSignals) {
    markHiddenAutostartConsumedForCurrentBoot();
    return true;
  }
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
    return wasLaunchedHiddenAtLoginOnWindows(argv, loginItemSettings);
  }

  if (!loginItemSettings.wasOpenedAtLogin) return false;
  if (process.platform === 'darwin') return loginItemSettings.wasOpenedAsHidden === true;
  return false;
}
