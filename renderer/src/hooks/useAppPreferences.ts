import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppPreferencesV1 } from '../services/appPreferences';
import {
  applyAppPreferencesPatch,
  getAppPreferencesSync,
  initAppPreferencesRuntime,
  isAppPreferencesCacheReady,
  patchAppPreferences,
  subscribeAppPreferences
} from '../services/appPreferencesRuntime';

export function useAppPreferences() {
  const [prefs, setPrefs] = useState<AppPreferencesV1 | null>(() =>
    isAppPreferencesCacheReady() ? getAppPreferencesSync() : null
  );
  const [loading, setLoading] = useState(() => !isAppPreferencesCacheReady());
  const prefsRef = useRef<AppPreferencesV1 | null>(null);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    let active = true;
    void initAppPreferencesRuntime().then((loaded) => {
      if (!active) return;
      setPrefs(loaded);
      setLoading(false);
    });
    const unsub = subscribeAppPreferences(() => {
      setPrefs(getAppPreferencesSync());
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const update = useCallback(async (patch: Partial<AppPreferencesV1>) => {
    const rollback = prefsRef.current ?? getAppPreferencesSync();
    setPrefs((current) => applyAppPreferencesPatch(current ?? rollback, patch));

    try {
      const next = await patchAppPreferences(patch);
      setPrefs(next);
    } catch {
      setPrefs(rollback);
    }
  }, []);

  return { prefs, loading, ready: !loading && prefs !== null, update };
}
