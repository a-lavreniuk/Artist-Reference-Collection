import { describe, expect, it } from 'vitest';
import { mediaOpenDialogProperties } from '../mediaOpenDialogProperties';

describe('mediaOpenDialogProperties', () => {
  it('allows files and folders together on macOS', () => {
    expect(mediaOpenDialogProperties('darwin')).toEqual([
      'openFile',
      'openDirectory',
      'multiSelections'
    ]);
  });

  it('keeps a file picker on Windows and Linux', () => {
    expect(mediaOpenDialogProperties('win32')).toEqual(['openFile', 'multiSelections']);
    expect(mediaOpenDialogProperties('linux')).toEqual(['openFile', 'multiSelections']);
  });
});
