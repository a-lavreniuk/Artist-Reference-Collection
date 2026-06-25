/** macOS: кастомная иконка папки — отдельная задача. */
export async function applyLibraryFolderIconWin32(_libraryRoot: string, _iconSourcePath: string): Promise<boolean> {
  return false;
}

export async function notifyFolderIconChanged(): Promise<void> {
  /* noop */
}
