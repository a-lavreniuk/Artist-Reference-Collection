import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const DIM_MS = 320;

type LibrarySwitchDimContextValue = {
  flashLibrarySwitchDim: () => void;
};

const LibrarySwitchDimContext = createContext<LibrarySwitchDimContextValue | null>(null);

export function LibrarySwitchDimProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const flashLibrarySwitchDim = useCallback(() => {
    setVisible(true);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, DIM_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    []
  );

  return (
    <LibrarySwitchDimContext.Provider value={{ flashLibrarySwitchDim }}>
      {children}
      {visible
        ? createPortal(<div className="arc-library-switch-dim" aria-hidden="true" />, document.body)
        : null}
    </LibrarySwitchDimContext.Provider>
  );
}

export function useLibrarySwitchDim() {
  const ctx = useContext(LibrarySwitchDimContext);
  if (!ctx) {
    return { flashLibrarySwitchDim: () => {} };
  }
  return ctx;
}
