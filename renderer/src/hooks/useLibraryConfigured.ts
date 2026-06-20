import { useEffect, useState } from 'react';
import { isLibraryConfigured } from '../services/db';
import { resolveBackend } from '../services/db/backend';

let libraryReadyState = false;
let initPromise: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

function notifyLibraryReadyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

async function ensureLibraryReadyOnce(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      if (!(await isLibraryConfigured())) {
        libraryReadyState = false;
        return false;
      }
      await resolveBackend();
      libraryReadyState = true;
      return true;
    } catch {
      libraryReadyState = false;
      return false;
    }
  })();
  return initPromise;
}

/** Библиотека выбрана и backend инициализирован один раз на сессию — после этого list-cards быстрый. */
export function useLibraryConfigured(): boolean {
  const [ready, setReady] = useState(libraryReadyState);

  useEffect(() => {
    let mounted = true;
    void ensureLibraryReadyOnce().then((ok) => {
      if (!mounted) return;
      setReady(ok);
      notifyLibraryReadyListeners();
    });
    const onChange = () => setReady(libraryReadyState);
    listeners.add(onChange);
    return () => {
      mounted = false;
      listeners.delete(onChange);
    };
  }, []);

  return ready;
}
