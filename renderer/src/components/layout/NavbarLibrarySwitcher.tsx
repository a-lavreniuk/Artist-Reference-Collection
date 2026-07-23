import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import CreateLibraryModal from '../onboarding/CreateLibraryModal';
import { useLibraries } from '../../hooks/useLibraries';
import { useLibrarySwitchDim } from './LibrarySwitchDimOverlay';
import { getNavbarMetrics, invalidateLibraryCache } from '../../services/db';
import { ONBOARDING_DEFAULT_LIBRARY_NAME } from '../../content/onboarding';

type Props = {
  disabled?: boolean;
};

export default function NavbarLibrarySwitcher({ disabled = false }: Props) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState(ONBOARDING_DEFAULT_LIBRARY_NAME);
  const [createBusy, setCreateBusy] = useState(false);
  const [createEmptySubmitted, setCreateEmptySubmitted] = useState(false);
  const [createFieldError, setCreateFieldError] = useState(false);
  const switchingRef = useRef(false);

  const { libraries, activeLibrary, refresh } = useLibraries();
  const { flashLibrarySwitchDim } = useLibrarySwitchDim();

  const activeLabel = activeLibrary?.name ?? 'Библиотека';

  useLayoutEffect(() => {
    if (anchorRef.current) void hydrateArcNavbarIcons(anchorRef.current);
  }, [open, activeLabel, libraries.length, disabled]);

  const applyLibrarySwitch = useCallback(async () => {
    invalidateLibraryCache();
    await getNavbarMetrics();
    window.dispatchEvent(new CustomEvent('arc:library-changed'));
    flashLibrarySwitchDim();
    await refresh();
  }, [flashLibrarySwitchDim, refresh]);

  const switchLibrary = useCallback(
    async (libraryId: string) => {
      if (!window.arc?.switchActiveLibrary || switchingRef.current || disabled) return;
      if (activeLibrary?.id === libraryId) {
        setOpen(false);
        return;
      }
      setOpen(false);
      switchingRef.current = true;
      try {
        const res = await window.arc.switchActiveLibrary(libraryId);
        if (!res.ok) return;
        await applyLibrarySwitch();
      } finally {
        switchingRef.current = false;
      }
    },
    [activeLibrary?.id, applyLibrarySwitch, disabled]
  );

  const openCreateModal = useCallback(() => {
    setOpen(false);
    setCreateName(ONBOARDING_DEFAULT_LIBRARY_NAME);
    setCreateEmptySubmitted(false);
    setCreateFieldError(false);
    setCreateOpen(true);
  }, []);

  const submitCreate = useCallback(async () => {
    if (!window.arc?.createLibraryInContainer || createBusy) return;
    const name = createName.trim();
    if (!name) {
      setCreateEmptySubmitted(true);
      setCreateFieldError(true);
      return;
    }
    setCreateBusy(true);
    setCreateFieldError(false);
    try {
      const res = await window.arc.createLibraryInContainer({ name });
      if (!res.ok) {
        if (res.fieldError) setCreateFieldError(true);
        return;
      }
      setCreateOpen(false);
      await applyLibrarySwitch();
    } finally {
      setCreateBusy(false);
    }
  }, [applyLibrarySwitch, createBusy, createName]);

  const rows = useMemo<ContextMenuRow[]>(() => {
    const libRows: ContextMenuRow[] = libraries.map((lib) => ({
      type: 'item' as const,
      key: lib.id,
      label: lib.name,
      iconClass: 'arc-icon-folder-open',
      counter: lib.cardCount,
      selected: lib.active,
      onSelect: () => void switchLibrary(lib.id)
    }));
    if (libRows.length > 0) {
      libRows.push({ type: 'separator', key: 'sep-create' });
    }
    libRows.push({
      type: 'item',
      key: 'create-library',
      label: 'Создать новую библиотеку',
      iconClass: 'arc-icon-plus',
      onSelect: openCreateModal
    });
    return libRows;
  }, [libraries, openCreateModal, switchLibrary]);

  return (
    <>
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
      <ContextMenu
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        rows={rows}
        ariaLabel="Переключение библиотек"
        noDragClassName="arc-navbar-no-drag"
      />
      {createOpen ? (
        <CreateLibraryModal
          folderName={createName}
          busy={createBusy}
          emptySubmitted={createEmptySubmitted || createFieldError}
          onFolderNameChange={(value) => {
            setCreateName(value);
            setCreateEmptySubmitted(false);
            setCreateFieldError(false);
          }}
          onClose={() => {
            if (!createBusy) setCreateOpen(false);
          }}
          onSubmit={() => void submitCreate()}
          inContainer
        />
      ) : null}
    </>
  );
}
