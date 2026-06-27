import { useEffect, useState } from 'react';
import { useAppPreferences } from './useAppPreferences';
import {
  attachSystemThemeListener,
  invertResolvedUiTheme,
  resolveUiTheme,
  type ResolvedUiTheme
} from '../services/uiTheme';

/** Противоположная тема приложения — только для модалок тура «Знакомство». */
export function useInterfaceTourTheme(): ResolvedUiTheme {
  const { prefs } = useAppPreferences();
  const [theme, setTheme] = useState<ResolvedUiTheme>(() =>
    invertResolvedUiTheme(resolveUiTheme(prefs?.uiTheme ?? 'dark'))
  );

  useEffect(() => {
    if (!prefs) return;
    setTheme(invertResolvedUiTheme(resolveUiTheme(prefs.uiTheme)));
  }, [prefs?.uiTheme, prefs]);

  useEffect(() => {
    if (prefs?.uiTheme !== 'system') return undefined;
    return attachSystemThemeListener(() => {
      if (prefs) setTheme(invertResolvedUiTheme(resolveUiTheme(prefs.uiTheme)));
    });
  }, [prefs?.uiTheme, prefs]);

  return theme;
}
