import { useCallback } from 'react';
import { useImportContext } from '../import/ImportContext';
import { useAppShortcuts } from '../../hooks/useAppShortcuts';
import { requestNavbarSearchFocus } from '../../shortcuts/focusNavbarSearch';
import { useRegisterShortcutHandlers } from './ShortcutActionContext';

export function ShortcutSearchRegistrar() {
  const focusSearch = useCallback(() => {
    requestNavbarSearchFocus();
  }, []);

  useRegisterShortcutHandlers({ focusSearch });

  return null;
}

export function ShortcutImportRegistrar() {
  const { openImportPicker } = useImportContext();

  useRegisterShortcutHandlers({ openImport: openImportPicker });

  return null;
}

export function AppShortcutsHost() {
  useAppShortcuts();
  return null;
}
