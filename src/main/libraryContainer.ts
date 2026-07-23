/** Имя родительской папки-контейнера для нескольких библиотек. */
export const LIBRARY_CONTAINER_FOLDER_NAME = 'Библиотека ARC';

export function isLibraryContainerFolderName(name: string): boolean {
  return name.trim() === LIBRARY_CONTAINER_FOLDER_NAME;
}
