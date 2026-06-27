import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import {
  libraryScopeLabel,
  parseLibraryScope,
  setLibraryScopeInParams,
  type LibraryScope
} from '../../search/libraryScopeUrl';
import { useTrashCardCount } from '../../hooks/useTrashCardCount';
import { emptyTrash } from '../../services/db';
import { showAppNotification } from '../../services/notificationService';
import ConfirmEmptyTrashModal from './ConfirmEmptyTrashModal';

const LIBRARY_OPTIONS: { key: LibraryScope; label: string; iconClass: string }[] = [
  { key: 'all', label: 'Вся библиотека', iconClass: 'arc-icon-folder-open' },
  { key: 'untagged', label: 'Без меток', iconClass: 'arc-icon-tag' },
  { key: 'trash', label: 'Корзина', iconClass: 'arc-icon-trash' }
];

type Props = {
  disabled?: boolean;
};

export default function NavbarLibrarySwitcher({ disabled = false }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);

  const activeScope = parseLibraryScope(searchParams);
  const activeLabel = libraryScopeLabel(activeScope);
  const { count: trashCount } = useTrashCardCount();
  const isGalleryPage = location.pathname === '/gallery';
  const isTrashScope = isGalleryPage && activeScope === 'trash';
  const showClearTrash = isTrashScope && trashCount > 0;

  useLayoutEffect(() => {
    const nodes = [anchorRef.current, clearRef.current].filter(Boolean);
    for (const node of nodes) {
      void hydrateArcNavbarIcons(node);
    }
  }, [isTrashScope, showClearTrash, activeScope, activeLabel, trashCount, disabled]);

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

  const libraryMenuButton = isTrashScope ? (
    <button
      ref={anchorRef}
      type="button"
      className={`btn btn-ghost btn-ds btn-m arc-navbar-library-btn arc-navbar-no-drag${open ? ' is-active' : ''}`}
      aria-label="Библиотека: Корзина"
      aria-expanded={open}
      aria-haspopup="menu"
      disabled={disabled}
      onClick={() => setOpen((v) => !v)}
    >
      <span className="btn-ds__icon arc-icon-trash" aria-hidden="true" />
      <span className="btn-ds__value arc-navbar-library-btn__value">Корзина</span>
    </button>
  ) : (
    <button
      ref={anchorRef}
      type="button"
      className={`btn btn-ghost btn-ds btn-m arc-navbar-library-btn arc-navbar-no-drag${open ? ' is-active' : ''}`}
      aria-label={`Библиотека: ${activeLabel}`}
      aria-expanded={open}
      aria-haspopup="menu"
      disabled={disabled}
      onClick={() => setOpen((v) => !v)}
    >
      <span className="btn-ds__icon arc-icon-folder-open" aria-hidden="true" />
      <span className="btn-ds__value arc-navbar-library-btn__value">{activeLabel}</span>
    </button>
  );

  return (
    <>
      {libraryMenuButton}
      {showClearTrash ? (
        <button
          ref={clearRef}
          type="button"
          className="btn btn-ghost btn-ds btn-m arc-navbar-no-drag"
          aria-label="Очистить корзину"
          disabled={disabled}
          onClick={() => setEmptyTrashConfirm(true)}
        >
          <span className="btn-ds__icon arc-icon-broom" aria-hidden="true" />
          <span className="btn-ds__value">Очистить</span>
        </button>
      ) : null}
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        rows={rows}
        ariaLabel="Переключение библиотек"
        noDragClassName="arc-navbar-no-drag"
      />
      {emptyTrashConfirm ? (
        <ConfirmEmptyTrashModal
          onClose={() => setEmptyTrashConfirm(false)}
          onConfirm={async () => {
            await emptyTrash();
            showAppNotification({
              message: 'Корзина очищена',
              variant: 'success',
              skipPrefCheck: true
            });
          }}
        />
      ) : null}
    </>
  );
}
