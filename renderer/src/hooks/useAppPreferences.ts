import { useCallback, useEffect, useState } from 'react';
import type { AppPreferencesV1 } from '../services/appPreferences';
import {
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
    try {
      const next = await patchAppPreferences(patch);
      setPrefs(next);
    } catch {
      setPrefs(getAppPreferencesSync());
    }
  }, []);

  return { prefs, loading, ready: !loading && prefs !== null, update };
}
