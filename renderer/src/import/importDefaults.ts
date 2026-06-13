import type { ImportSourceFilesAction } from '../services/appPreferences';
import { getAppPreferencesSync } from '../services/appPreferencesRuntime';

export function getImportSourceFilesAction(): ImportSourceFilesAction {
  return getAppPreferencesSync().importSourceFilesAction;
}

export function getAutoImportSourceFilesAction(): ImportSourceFilesAction {
  return getAppPreferencesSync().autoImportSourceFilesAction;
}

export function getDeleteCardsUseTrash(): boolean {
  return getAppPreferencesSync().deleteCardsUseTrash;
}
