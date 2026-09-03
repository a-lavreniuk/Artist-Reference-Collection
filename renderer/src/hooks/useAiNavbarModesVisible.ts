import { useCallback, useEffect, useState } from 'react';
import { ARC_AI_SETUP_CHANGED_EVENT } from '../search/aiSearchEvents';
import { useAppPreferences } from './useAppPreferences';

export type AiNavbarModesReady = {
  /** Модель установлена и умный поиск включён — режимы AI / Похожие рабочие. */
  ready: boolean;
  setupReady: boolean;
  /** Prefs и aiGetStatus уже известны; до этого не сбрасывать URL. */
  resolved: boolean;
};

/**
 * Готовность вкладок AI / Похожие в navbar.
 * Сами вкладки всегда видны; этот флаг говорит, можно ли ими пользоваться.
 *
 * Не добавляйте location.pathname в зависимости refresh: aiGetStatus на main вызывает
 * detectHardware(); частый вызов при навигации блокирует sendSync list-cards (~1.6 с на Windows).
 * Обновлять статус — только при prefs, focus и событиях установки модели.
 */
export function useAiNavbarModesReady(): AiNavbarModesReady {
  const { prefs, ready: prefsReady } = useAppPreferences();
  const [setupReady, setSetupReady] = useState(false);
  const [statusFetched, setStatusFetched] = useState(false);

  const refresh = useCallback(async () => {
    const arc = window.arc;
    if (!arc?.aiGetStatus) {
      setSetupReady(false);
      setStatusFetched(true);
      return;
    }
    try {
      const status = await arc.aiGetStatus();
      setSetupReady(Boolean(status.setupReady));
    } catch {
      setSetupReady(false);
    } finally {
      setStatusFetched(true);
    }
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    void refresh();
  }, [prefsReady, prefs?.aiSemanticSearchEnabled, prefs?.aiSearchEnabled, refresh]);

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

  const prefsSearchEnabled = Boolean(prefs?.aiSearchEnabled || prefs?.aiSemanticSearchEnabled);
  const resolved = prefsReady && statusFetched;
  const ready = resolved && setupReady && prefsSearchEnabled;

  return { ready, setupReady, resolved };
}
