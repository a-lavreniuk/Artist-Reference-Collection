import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType, type Location } from 'react-router-dom';

function locationKey(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export type ArcHistoryNav = {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
};

export function useArcHistoryNav(): ArcHistoryNav {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  const stackRef = useRef<string[]>([locationKey(location)]);
  const indexRef = useRef(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const syncFlags = useCallback(() => {
    setCanGoBack(indexRef.current > 0);
    setCanGoForward(indexRef.current < stackRef.current.length - 1);
  }, []);

  useEffect(() => {
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
      stackRef.current[indexRef.current] = key;
    } else {
      if (stackRef.current[indexRef.current] !== key) {
        stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
        stackRef.current.push(key);
        indexRef.current = stackRef.current.length - 1;
      }
    }

    syncFlags();
  }, [location, navigationType, syncFlags]);

  const goBack = useCallback(() => {
    if (indexRef.current <= 0) return;
    navigate(-1);
  }, [navigate]);

  const goForward = useCallback(() => {
    if (indexRef.current >= stackRef.current.length - 1) return;
    navigate(1);
  }, [navigate]);

  return { canGoBack, canGoForward, goBack, goForward };
}
