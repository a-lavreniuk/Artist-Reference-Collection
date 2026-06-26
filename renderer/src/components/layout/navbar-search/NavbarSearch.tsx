import './styles/index.css';
import NavbarSearchBar from './NavbarSearchBar';
import NavbarSearchPanel from './NavbarSearchPanel';
import { NavbarSearchProvider } from './NavbarSearchProvider';
import type { NavbarSearchProps } from './types';

export default function NavbarSearch(props: NavbarSearchProps) {
  return (
    <NavbarSearchProvider {...props}>
      <NavbarSearchBar />
      <NavbarSearchPanel />
    </NavbarSearchProvider>
  );
}
