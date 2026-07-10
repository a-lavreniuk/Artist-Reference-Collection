import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode
} from 'react';

export type ShortcutActionHandlers = {
  focusSearch?: () => void;
  openImport?: () => void;
};

type ShortcutActionsContextValue = {
  handlersRef: React.MutableRefObject<ShortcutActionHandlers>;
  registerHandlers: (partial: Partial<ShortcutActionHandlers>) => () => void;
};

const ShortcutActionsContext = createContext<ShortcutActionsContextValue | null>(null);

export function ShortcutActionProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef<ShortcutActionHandlers>({});

  const registerHandlers = useCallback((partial: Partial<ShortcutActionHandlers>) => {
    const keys = Object.keys(partial) as (keyof ShortcutActionHandlers)[];
    for (const key of keys) {
      handlersRef.current[key] = partial[key];
    }
    return () => {
      for (const key of keys) {
        if (handlersRef.current[key] === partial[key]) {
          delete handlersRef.current[key];
        }
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      handlersRef,
      registerHandlers
    }),
    [registerHandlers]
  );

  return <ShortcutActionsContext.Provider value={value}>{children}</ShortcutActionsContext.Provider>;
}

export function useShortcutActions(): ShortcutActionsContextValue {
  const ctx = useContext(ShortcutActionsContext);
  if (!ctx) {
    throw new Error('useShortcutActions must be used within ShortcutActionProvider');
  }
  return ctx;
}

/** Registers shortcut action handlers for the lifetime of the mounting component. */
export function useRegisterShortcutHandlers(handlers: Partial<ShortcutActionHandlers>): void {
  const { registerHandlers } = useShortcutActions();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const focusSearch = handlers.focusSearch;
  const openImport = handlers.openImport;

  useEffect(() => {
    const bound: Partial<ShortcutActionHandlers> = {};
    if (focusSearch !== undefined) {
      bound.focusSearch = () => handlersRef.current.focusSearch?.();
    }
    if (openImport !== undefined) {
      bound.openImport = () => handlersRef.current.openImport?.();
    }
    if (Object.keys(bound).length === 0) return undefined;
    return registerHandlers(bound);
  }, [focusSearch, openImport, registerHandlers]);
}
