import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { Tooltip } from '../tooltip/Tooltip';
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
import ConfirmModal from '../../pages/settings/ConfirmModal';

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
  const groupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [emptyTrashBusy, setEmptyTrashBusy] = useState(false);

  const activeScope = parseLibraryScope(searchParams);
  const activeLabel = libraryScopeLabel(activeScope);
  const { count: trashCount } = useTrashCardCount();
  const isGalleryPage = location.pathname === '/gallery';
  const showClearTrash = isGalleryPage && activeScope === 'trash' && trashCount > 0;

  useLayoutEffect(() => {
    const scope = showClearTrash ? groupRef.current : anchorRef.current;
    if (scope) void hydrateArcNavbarIcons(scope);
  }, [showClearTrash, activeScope, activeLabel, trashCount, disabled]);

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

  const switcherButton = (
    <button
      ref={anchorRef}
      type="button"
      className="btn btn-outline btn-ds btn-l arc-navbar-library-btn arc-navbar-no-drag"
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
      {showClearTrash ? (
        <div ref={groupRef} className="btn-group btn-group-ds arc-navbar-library-group">
          {switcherButton}
          <Tooltip content="Очистить корзину" delay={500} position="top">
            <button
              type="button"
              className="btn btn-outline btn-ds btn-icon-only arc-navbar-no-drag"
              aria-label="Очистить корзину"
              disabled={disabled}
              onClick={() => setEmptyTrashConfirm(true)}
            >
              <span className="btn-icon-only__glyph arc-icon-broom" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      ) : (
        switcherButton
      )}
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        rows={rows}
        ariaLabel="Переключение библиотек"
        noDragClassName="arc-navbar-no-drag"
      />
      {emptyTrashConfirm ? (
        <ConfirmModal
          title="Очистить корзину?"
          message="Все карточки в корзине будут удалены навсегда вместе с файлами."
          confirmLabel={emptyTrashBusy ? 'Удаление…' : 'Очистить'}
          confirmVariant="danger"
          onCancel={() => {
            if (!emptyTrashBusy) setEmptyTrashConfirm(false);
          }}
          onConfirm={() => {
            if (emptyTrashBusy) return;
            setEmptyTrashBusy(true);
            void (async () => {
              try {
                await emptyTrash();
                showAppNotification({
                  message: 'Корзина очищена',
                  variant: 'success',
                  skipPrefCheck: true
                });
                setEmptyTrashConfirm(false);
              } finally {
                setEmptyTrashBusy(false);
              }
            })();
          }}
        />
      ) : null}
    </>
  );
}
