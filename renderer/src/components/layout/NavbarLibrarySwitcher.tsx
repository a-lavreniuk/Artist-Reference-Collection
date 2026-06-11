import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import {
  libraryScopeLabel,
  parseLibraryScope,
  setLibraryScopeInParams,
  type LibraryScope
} from '../../search/libraryScopeUrl';

const LIBRARY_OPTIONS: { key: LibraryScope; label: string; iconClass: string }[] = [
  { key: 'all', label: 'Вся библиотека', iconClass: 'arc-icon-folder-open' },
  { key: 'untagged', label: 'Без меток', iconClass: 'arc-icon-tag' },
  { key: 'trash', label: 'Корзина', iconClass: 'arc-icon-trash' }
];

export default function NavbarLibrarySwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const activeScope = parseLibraryScope(searchParams);
  const activeLabel = libraryScopeLabel(activeScope);

  const selectScope = (scope: LibraryScope) => {
    setOpen(false);
    const nextParams = setLibraryScopeInParams(searchParams, scope);
    const search = nextParams.toString();
    const suffix = search ? `?${search}` : '';
    if (location.pathname === '/gallery' || location.pathname.startsWith('/gallery/')) {
      navigate({ pathname: '/gallery', search: suffix }, { replace: true });
      return;
    }
    navigate(`/gallery${suffix}`);
  };

  const rows = useMemo<ContextMenuRow[]>(
    () =>
      LIBRARY_OPTIONS.map((opt) => ({
        type: 'item' as const,
        key: opt.key,
        label: opt.label,
        iconClass: opt.iconClass,
        onSelect: () => selectScope(opt.key)
      })),
    [activeScope, searchParams, location.pathname]
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="btn btn-outline btn-ds btn-l arc-navbar-library-btn arc-navbar-no-drag"
        aria-label={`Библиотека: ${activeLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="btn-ds__icon arc-icon-folder-open" aria-hidden="true" />
        <span className="btn-ds__value arc-navbar-library-btn__value">{activeLabel}</span>
      </button>
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        rows={rows}
        ariaLabel="Переключение библиотек"
        noDragClassName="arc-navbar-no-drag"
      />
    </>
  );
}
