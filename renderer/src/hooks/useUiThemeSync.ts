import { useEffect } from 'react';
import { useAppPreferences } from './useAppPreferences';
import { attachSystemThemeListener, syncUiThemeFromPreferences } from '../services/uiTheme';

/** Синхронизирует `data-theme` / typo-tone с prefs и системной темой ОС. */
export function useUiThemeSync(): void {
  const { prefs } = useAppPreferences();

  useEffect(() => {
    if (!prefs) return;
    syncUiThemeFromPreferences(prefs.uiTheme);
  }, [prefs?.uiTheme]);

  useEffect(() => {
    if (prefs?.uiTheme !== 'system') return undefined;
    return attachSystemThemeListener(() => {
      if (prefs) syncUiThemeFromPreferences(prefs.uiTheme);
    });
  }, [prefs?.uiTheme, prefs]);
}
