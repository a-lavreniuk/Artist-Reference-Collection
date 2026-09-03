export function mediaOpenDialogProperties(
  platform: NodeJS.Platform = process.platform
): Array<'openFile' | 'openDirectory' | 'multiSelections'> {
  if (platform === 'darwin') {
    return ['openFile', 'openDirectory', 'multiSelections'];
  }
  return ['openFile', 'multiSelections'];
}
