import { useEffect, useRef } from 'react';
import { ARC_CARDS_CHANGED_EVENT, isLibraryConfigured } from '../../services/db';
import { showAppNotification } from '../../services/notificationService';
import { useAppPreferences } from '../../hooks/useAppPreferences';

function pluralCardsRu(n: number): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return 'карточек';
  if (last === 1) return 'карточка';
  if (last >= 2 && last <= 4) return 'карточки';
  return 'карточек';
}

/** Автоочистка корзины при старте, смене библиотеки и смене срока хранения. */
export default function TrashPurgeHost() {
  const { prefs, ready } = useAppPreferences();
  const days = prefs?.trashRetentionDays;
  const inFlight = useRef(false);

  useEffect(() => {
    if (!ready) return;

    const run = async () => {
      if (inFlight.current) return;
      if (!window.arc?.purgeExpiredTrash) return;
      if (!(await isLibraryConfigured())) return;
      inFlight.current = true;
      try {
        const res = await window.arc.purgeExpiredTrash();
        const n = typeof res?.deleted === 'number' ? res.deleted : 0;
        if (n > 0) {
          window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
          showAppNotification({
            message: `Из корзины безвозвратно удалено ${n} ${pluralCardsRu(n)}`,
            variant: 'info',
            skipPrefCheck: true
          });
        }
      } catch {
        /* ignore */
      } finally {
        inFlight.current = false;
      }
    };

    void run();
    const onLib = () => {
      void run();
    };
    window.addEventListener('arc:library-changed', onLib);
    return () => window.removeEventListener('arc:library-changed', onLib);
  }, [ready, days]);

  return null;
}
