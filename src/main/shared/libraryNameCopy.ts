/** Имя уже занято папкой на диске — ARC-библиотекой или любой другой. */
export const LIBRARY_FOLDER_EXISTS_ERROR = 'Папка с таким названием уже есть';

export function isLibraryFolderExistsError(error?: string | null): boolean {
  return Boolean(error?.includes('уже есть'));
}
