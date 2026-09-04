import { describe, expect, it } from 'vitest';
import { LIBRARY_FOLDER_EXISTS_ERROR, isLibraryFolderExistsError } from '../shared/libraryNameCopy';
import { validateLibraryName } from '../libraryNameValidation';
import { LIBRARY_CONTAINER_FOLDER_NAME } from '../libraryContainer';

describe('validateLibraryName', () => {
  it('accepts normal names', () => {
    expect(validateLibraryName('Работа')).toEqual({ ok: true, name: 'Работа' });
    expect(validateLibraryName('  Refs  ')).toEqual({ ok: true, name: 'Refs' });
  });

  it('rejects empty and invalid', () => {
    expect(validateLibraryName('').ok).toBe(false);
    expect(validateLibraryName('a/b').ok).toBe(false);
    expect(validateLibraryName('CON').ok).toBe(false);
    expect(validateLibraryName('.').ok).toBe(false);
    expect(validateLibraryName('x'.repeat(61)).ok).toBe(false);
  });
});

describe('library container name', () => {
  it('is singular Библиотека ARC', () => {
    expect(LIBRARY_CONTAINER_FOLDER_NAME).toBe('Библиотека ARC');
  });
});

describe('library folder exists copy', () => {
  it('matches occupied-name errors', () => {
    expect(isLibraryFolderExistsError(LIBRARY_FOLDER_EXISTS_ERROR)).toBe(true);
    expect(isLibraryFolderExistsError('Библиотека с таким именем уже есть')).toBe(true);
    expect(isLibraryFolderExistsError('Некорректное имя библиотеки')).toBe(false);
  });
});
