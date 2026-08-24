import { describe, expect, it } from 'vitest';

import {
  appMenuCommandFlag,
  isSilentStartupAppMenuCommand,
  parseAppMenuCommandFromArgv
} from '../appMenuCommandParse';

describe('parseAppMenuCommandFromArgv', () => {
  it('reads --arc-command from argv', () => {
    expect(parseAppMenuCommandFromArgv(['electron', '.', '--arc-command=add'])).toBe('add');
    expect(parseAppMenuCommandFromArgv(['ARC.exe', '--arc-command=gallery'])).toBe('gallery');
  });

  it('returns null for missing or unknown flags', () => {
    expect(parseAppMenuCommandFromArgv(['electron', '.'])).toBeNull();
    expect(parseAppMenuCommandFromArgv(['--arc-command=nope'])).toBeNull();
  });

  it('builds a flag that the parser understands', () => {
    expect(parseAppMenuCommandFromArgv([appMenuCommandFlag('settings')])).toBe('settings');
  });
});

describe('isSilentStartupAppMenuCommand', () => {
  it('hides the window for add, hide and screenshot', () => {
    expect(isSilentStartupAppMenuCommand('add')).toBe(true);
    expect(isSilentStartupAppMenuCommand('hide')).toBe(true);
    expect(isSilentStartupAppMenuCommand('screenshot')).toBe(true);
    expect(isSilentStartupAppMenuCommand('open')).toBe(false);
    expect(isSilentStartupAppMenuCommand(null)).toBe(false);
  });
});
