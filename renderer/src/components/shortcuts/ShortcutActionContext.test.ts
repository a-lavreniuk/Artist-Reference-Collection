import { describe, expect, it } from 'vitest';

type ShortcutActionHandlers = {
  focusSearch?: () => void;
  openImport?: () => void;
};

function createRegistry() {
  const handlersRef: { current: ShortcutActionHandlers } = { current: {} };

  const registerHandlers = (partial: Partial<ShortcutActionHandlers>) => {
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
  };

  return { handlersRef, registerHandlers };
}

describe('shortcut action registry', () => {
  it('merges independent handlers without overwriting siblings', () => {
    const { handlersRef, registerHandlers } = createRegistry();
    const search = () => 'search';
    const importFn = () => 'import';

    const unregisterSearch = registerHandlers({ focusSearch: search });
    const unregisterImport = registerHandlers({ openImport: importFn });

    expect(handlersRef.current.focusSearch).toBe(search);
    expect(handlersRef.current.openImport).toBe(importFn);

    unregisterSearch();
    expect(handlersRef.current.focusSearch).toBeUndefined();
    expect(handlersRef.current.openImport).toBe(importFn);

    unregisterImport();
    expect(handlersRef.current.openImport).toBeUndefined();
  });
});
