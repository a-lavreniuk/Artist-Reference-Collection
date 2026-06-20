import { useCallback, useEffect, useState } from 'react';
import { ARC_AI_SETUP_CHANGED_EVENT } from '../search/aiSearchEvents';
import { useAppPreferences } from './useAppPreferences';

/**
 * Вкладки AI / Похожие в navbar — только при включённом AI-поиске и установленной модели.
 *
 * Не добавляйте location.pathname в зависимости refresh: aiGetStatus на main вызывает
 * detectHardware(); частый вызов при навигации блокирует sendSync list-cards (~1.6 с на Windows).
 * Обновлять статус — только при prefs, focus и событиях установки модели.
 */
export function useAiNavbarModesVisible(): boolean {
  const { prefs, ready: prefsReady } = useAppPreferences();
  const [setupReady, setSetupReady] = useState(false);

  const refresh = useCallback(async () => {
    const arc = window.arc;
    if (!arc?.aiGetStatus) {
      setSetupReady(false);
      return;
    }
    try {
      const status = await arc.aiGetStatus();
      setSetupReady(Boolean(status.setupReady));
    } catch {
      setSetupReady(false);
    }
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    void refresh();
  }, [prefsReady, prefs?.aiSemanticSearchEnabled, refresh]);

  useEffect(() => {
    const arc = window.arc;
    const unsubs: Array<() => void> = [];
    if (arc?.onAiDownloadComplete) {
      unsubs.push(arc.onAiDownloadComplete(() => void refresh()));
    }
    const onSetupChanged = () => void refresh();
    window.addEventListener(ARC_AI_SETUP_CHANGED_EVENT, onSetupChanged);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      for (const unsub of unsubs) unsub();
      window.removeEventListener(ARC_AI_SETUP_CHANGED_EVENT, onSetupChanged);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return prefsReady && setupReady;
}
