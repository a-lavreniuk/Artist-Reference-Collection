import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useNavigationType, type Location } from 'react-router-dom';

function locationKey(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

function parseLocationKey(key: string): Pick<Location, 'pathname' | 'search' | 'hash'> {
  let rest = key;
  let hash = '';
  const hashIdx = rest.indexOf('#');
  if (hashIdx >= 0) {
    hash = rest.slice(hashIdx);
    rest = rest.slice(0, hashIdx);
  }
  let search = '';
  const queryIdx = rest.indexOf('?');
  if (queryIdx >= 0) {
    search = rest.slice(queryIdx);
    rest = rest.slice(0, queryIdx);
  }
  return { pathname: rest || '/', search, hash };
}

export type ArcHistoryNav = {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
};

const ArcHistoryNavContext = createContext<ArcHistoryNav | null>(null);

function useArcHistoryNavState(): ArcHistoryNav {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  const stackRef = useRef<string[]>([locationKey(location)]);
  const indexRef = useRef(0);
  const skipStackSyncRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const syncFlags = useCallback(() => {
    setCanGoBack(indexRef.current > 0);
    setCanGoForward(indexRef.current < stackRef.current.length - 1);
  }, []);

  const navigateToStackIndex = useCallback(
    (nextIndex: number) => {
      const key = stackRef.current[nextIndex];
      if (!key) return;
      indexRef.current = nextIndex;
      syncFlags();
      skipStackSyncRef.current = true;
      const target = parseLocationKey(key);
      navigate({ pathname: target.pathname, search: target.search, hash: target.hash }, { replace: true });
    },
    [navigate, syncFlags]
  );

  useEffect(() => {
    if (skipStackSyncRef.current) {
      skipStackSyncRef.current = false;
      syncFlags();
      return;
    }

    const key = locationKey(location);

    if (navigationType === 'POP') {
      const knownIndex = stackRef.current.indexOf(key);
      if (knownIndex >= 0) {
        indexRef.current = knownIndex;
      } else {
        stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
        stackRef.current.push(key);
        indexRef.current = stackRef.current.length - 1;
      }
    } else if (navigationType === 'REPLACE') {
      if (stackRef.current[indexRef.current] !== key) {
        stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
        stackRef.current.push(key);
        indexRef.current = stackRef.current.length - 1;
      }
    } else if (stackRef.current[indexRef.current] !== key) {
      stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
      stackRef.current.push(key);
      indexRef.current = stackRef.current.length - 1;
    }

    syncFlags();
  }, [location, navigationType, syncFlags]);

  const goBack = useCallback(() => {
    if (indexRef.current <= 0) return;
    navigateToStackIndex(indexRef.current - 1);
  }, [navigateToStackIndex]);

  const goForward = useCallback(() => {
    if (indexRef.current >= stackRef.current.length - 1) return;
    navigateToStackIndex(indexRef.current + 1);
  }, [navigateToStackIndex]);

  return { canGoBack, canGoForward, goBack, goForward };
}

export function ArcHistoryNavProvider({ children }: { children: ReactNode }) {
  const value = useArcHistoryNavState();
  return <ArcHistoryNavContext.Provider value={value}>{children}</ArcHistoryNavContext.Provider>;
}

export function useArcHistoryNav(): ArcHistoryNav {
  const ctx = useContext(ArcHistoryNavContext);
  if (!ctx) {
    throw new Error('useArcHistoryNav must be used within ArcHistoryNavProvider');
  }
  return ctx;
}
