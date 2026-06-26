import { createContext, useContext } from 'react';
import type { NavbarSearchContextValue } from './types';

const NavbarSearchContext = createContext<NavbarSearchContextValue | null>(null);

export function NavbarSearchContextProvider({
  value,
  children
}: {
  value: NavbarSearchContextValue;
  children: React.ReactNode;
}) {
  return <NavbarSearchContext.Provider value={value}>{children}</NavbarSearchContext.Provider>;
}

export function useNavbarSearch(): NavbarSearchContextValue {
  const ctx = useContext(NavbarSearchContext);
  if (!ctx) {
    throw new Error('useNavbarSearch must be used within NavbarSearchProvider');
  }
  return ctx;
}
