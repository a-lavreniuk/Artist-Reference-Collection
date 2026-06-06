import { createContext, useContext } from 'react';

type ImportContextValue = {
  openImportPicker: () => void;
};

export const ImportContext = createContext<ImportContextValue | null>(null);

export function useImportContext(): ImportContextValue {
  const ctx = useContext(ImportContext);
  if (!ctx) {
    return {
      openImportPicker: () => {}
    };
  }
  return ctx;
}
