import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ContextMenu, type ContextMenuRow } from '../context-menu';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import CreateLibraryModal from '../onboarding/CreateLibraryModal';
import MessageModal from './MessageModal';
import { useLibraries } from '../../hooks/useLibraries';
import { getNavbarMetrics, invalidateLibraryCache } from '../../services/db';
import { ONBOARDING_DEFAULT_LIBRARY_NAME } from '../../content/onboarding';
import { isLibraryFolderExistsError } from '@arc-main-shared/libraryNameCopy';

const LIBRARY_LABEL_MAX_CHARS = 16;

type Props = {
  disabled?: boolean;
  /** Brand на разделе Библиотека, Ghost на остальных. */
  isGalleryActive?: boolean;
  /** Клик по текстовой части — переход в `/gallery`. */
  onPrimaryClick?: () => void;
};

function truncateLibraryLabel(label: string, maxChars = LIBRARY_LABEL_MAX_CHARS): string {
  if (label.length <= maxChars) return label;
  return `${label.slice(0, maxChars)}…`;
}

export default function NavbarLibrarySwitcher({
  disabled = false,
  isGalleryActive = false,
  onPrimaryClick
}: Props) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [prevGalleryActive, setPrevGalleryActive] = useState(isGalleryActive);
  const [paletteInstant, setPaletteInstant] = useState(false);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState(ONBOARDING_DEFAULT_LIBRARY_NAME);
  const [createBusy, setCreateBusy] = useState(false);
  const [createEmptySubmitted, setCreateEmptySubmitted] = useState(false);
  const [createFieldError, setCreateFieldError] = useState(false);
  const [createDuplicateFolder, setCreateDuplicateFolder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const switchingRef = useRef(false);

  const { libraries, activeLibrary, refresh } = useLibraries();

  const fullLabel = libraries.length <= 1 ? 'Библиотека' : (activeLibrary?.name ?? 'Библиотека');
  const displayLabel = truncateLibraryLabel(fullLabel);

  /** Brand ↔ Ghost в одном кадре с `--instant`, иначе sep и половины расходятся. */
  if (isGalleryActive !== prevGalleryActive) {
    setPrevGalleryActive(isGalleryActive);
    setPaletteInstant(true);
  }

  useLayoutEffect(() => {
    if (!paletteInstant) return;
    let outer = 0;
    let inner = 0;
    outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setPaletteInstant(false));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [paletteInstant]);

  useLayoutEffect(() => {
    if (scopeRef.current) void hydrateArcNavbarIcons(scopeRef.current);
  }, [open, displayLabel, libraries.length, disabled, isGalleryActive]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const applyLibrarySwitch = useCallback(async () => {
    invalidateLibraryCache();
    await getNavbarMetrics();
    window.dispatchEvent(new CustomEvent('arc:library-changed'));
    await refresh();
  }, [refresh]);

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
        if (!res.ok) {
          setErrorMessage(res.error?.trim() || 'Не удалось переключить библиотеку');
          return;
        }
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
    setCreateDuplicateFolder(false);
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
    setCreateDuplicateFolder(false);
    try {
      const res = await window.arc.createLibraryInContainer({ name });
      if (!res.ok) {
        if (isLibraryFolderExistsError(res.error)) {
          setCreateDuplicateFolder(true);
          setCreateFieldError(true);
        } else if (res.fieldError) {
          setCreateFieldError(true);
        } else {
          setErrorMessage(res.error?.trim() || 'Не удалось создать библиотеку');
        }
        return;
      }
      setCreateOpen(false);
      await applyLibrarySwitch();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Не удалось создать библиотеку');
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

  const splitClass = [
    'btn-icon-split',
    'arc-navbar-library-split',
    'arc-navbar-no-drag',
    isGalleryActive ? 'btn-icon-split--brand' : 'btn-icon-split--ghost',
    paletteInstant ? 'btn-icon-split--instant' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div
        ref={scopeRef}
        className={splitClass}
        data-interface-tour-anchor="navbar-library-split"
      >
        <button
          type="button"
          className="btn-icon-split__primary"
          aria-label={fullLabel}
          aria-current={isGalleryActive ? 'page' : undefined}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen(false);
            onPrimaryClick?.();
          }}
        >
          <span className="btn-ds__value">{displayLabel}</span>
        </button>
        <span className="btn-icon-split__sep" aria-hidden="true" />
        <button
          ref={anchorRef}
          type="button"
          className={`btn-icon-split__secondary${open ? ' is-active' : ''}`}
          aria-label={`Библиотека: ${fullLabel}. Переключение библиотек`}
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="btn-icon-split__chevron arc-icon-chevron" aria-hidden="true" />
        </button>
      </div>
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
          emptySubmitted={createEmptySubmitted}
          fieldError={createFieldError}
          duplicateFolderError={createDuplicateFolder}
          onFolderNameChange={(value) => {
            setCreateName(value);
            setCreateEmptySubmitted(false);
            setCreateFieldError(false);
            setCreateDuplicateFolder(false);
          }}
          onClose={() => {
            if (!createBusy) setCreateOpen(false);
          }}
          onSubmit={() => void submitCreate()}
          inContainer
        />
      ) : null}
      {errorMessage ? (
        <MessageModal
          title="Сообщение"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
          closeLabel="Понятно"
        />
      ) : null}
    </>
  );
}
