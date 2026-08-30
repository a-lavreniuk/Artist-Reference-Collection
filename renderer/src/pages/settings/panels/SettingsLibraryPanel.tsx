import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import MessageModal from '../../../components/layout/MessageModal';
import LibraryManageModal from '../LibraryManageModal';
import CreateLibraryModal from '../../../components/onboarding/CreateLibraryModal';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import { InfoSplitCard } from '../../../components/info-card';
import { useSettingsLibraries } from '../hooks/useSettingsLibraries';
import { hydrateArcNavbarIcons } from '../../../components/layout/navbarIconHydrate';
import { ONBOARDING_DEFAULT_LIBRARY_NAME } from '../../../content/onboarding';
import { formatCardCountLabel } from '../../../utils/formatCardCountLabel';
import { invalidateLibraryCache, getNavbarMetrics } from '../../../services/db';

/** Вес библиотеки в чипе — как у AI-моделей (Мб / Гб). */
function formatLibraryWeight(bytes: number | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '0 Мб';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) {
    const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
    const label = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
    return `${label} Мб`;
  }
  const gb = mb / 1024;
  const rounded = gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  return `${label} Гб`;
}

/**
 * Настройки → Библиотека (multi-library).
 * Список: InfoSplitCard, клик переключает активную (brand-обводка), без DnD.
 */
export default function SettingsLibraryPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const switchingRef = useRef(false);
  const {
    libraries,
    containerName,
    parentPath,
    busy,
    modal,
    setModal,
    infoModal,
    setInfoModal,
    renameLibrary,
    deleteLibrary,
    pickLibraryLocation,
    createLibrary,
    refresh
  } = useSettingsLibraries();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState(ONBOARDING_DEFAULT_LIBRARY_NAME);
  const [createBusy, setCreateBusy] = useState(false);
  const [createEmptySubmitted, setCreateEmptySubmitted] = useState(false);
  const [createFieldError, setCreateFieldError] = useState(false);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [libraries, modal, createOpen]);

  const canDelete = libraries.length > 1;
  const canCreate = Boolean(parentPath || libraries.length > 0);

  const openCreateModal = useCallback(() => {
    setCreateName(ONBOARDING_DEFAULT_LIBRARY_NAME);
    setCreateEmptySubmitted(false);
    setCreateFieldError(false);
    setCreateOpen(true);
  }, []);

  const submitCreate = useCallback(async () => {
    if (createBusy) return;
    const name = createName.trim();
    if (!name) {
      setCreateEmptySubmitted(true);
      setCreateFieldError(true);
      return;
    }
    setCreateBusy(true);
    setCreateFieldError(false);
    try {
      const res = await createLibrary(name);
      if (!res.ok) {
        if (res.fieldError) setCreateFieldError(true);
        else setInfoModal(res.error?.trim() || 'Не удалось создать библиотеку');
        return;
      }
      setCreateOpen(false);
    } finally {
      setCreateBusy(false);
    }
  }, [createBusy, createLibrary, createName, setInfoModal]);

  const switchLibrary = useCallback(
    async (libraryId: string, isActive: boolean) => {
      if (!window.arc?.switchActiveLibrary || switchingRef.current || busy || isActive) return;
      switchingRef.current = true;
      try {
        const res = await window.arc.switchActiveLibrary(libraryId);
        if (!res.ok) {
          setInfoModal(res.error?.trim() || 'Не удалось переключить библиотеку');
          return;
        }
        invalidateLibraryCache();
        await getNavbarMetrics();
        window.dispatchEvent(new CustomEvent('arc:library-changed'));
        await refresh();
      } finally {
        switchingRef.current = false;
      }
    },
    [busy, refresh, setInfoModal]
  );

  return (
    <>
      <div className="arc-settings-main__scroll">
        <div
          ref={rootRef}
          className="arc-settings-main__content arc-settings-library-panel arc-ui-kit-scope"
          data-btn-size="m"
        >
          <div className="arc-settings-desc-block">
            <p className="text-m arc-settings-desc-block__text">
              Библиотеки хранятся в папке «{containerName}» рядом друг с другом. Чтобы подключить уже существующие
              данные, укажите эту папку или любую библиотеку внутри неё.
            </p>
            <div className="arc-settings-action-row">
              <button
                type="button"
                className="btn btn-secondary btn-ds"
                disabled={busy || !window.arc}
                onClick={() => void pickLibraryLocation()}
              >
                <span className="btn-ds__value">Указать папку</span>
              </button>
              <span className="text-m arc-settings-action-row__meta" title={parentPath ?? undefined}>
                {parentPath ?? 'Не указан'}
              </span>
            </div>
          </div>

          <SettingsSeparator />

          <SettingsSection title="Библиотеки">
            <div className="arc-settings-library-list arc-info-card-list" role="list">
              {libraries.map((lib) => (
                <div key={lib.id} role="listitem">
                  <InfoSplitCard
                    interactive
                    active={lib.active}
                    aria-current={lib.active ? 'true' : undefined}
                    aria-label={lib.name}
                    title={lib.name}
                    chips={
                      <>
                        <span className="chip">{formatCardCountLabel(lib.cardCount ?? 0)}</span>
                        <span className="chip">{formatLibraryWeight(lib.sizeBytes)}</span>
                      </>
                    }
                    actions={
                      <button
                        type="button"
                        className="btn btn-outline btn-ds"
                        disabled={busy || !window.arc}
                        onClick={(event) => {
                          event.stopPropagation();
                          setModal({ mode: 'edit', library: lib });
                        }}
                      >
                        <span className="btn-ds__value">Изменить</span>
                      </button>
                    }
                    onClick={() => void switchLibrary(lib.id, lib.active)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void switchLibrary(lib.id, lib.active);
                      }
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="arc-settings-action-row arc-settings-library-actions">
              <button
                type="button"
                className="btn btn-brand btn-ds"
                disabled={busy || !window.arc || !canCreate}
                onClick={openCreateModal}
              >
                <span className="btn-ds__value">Создать библиотеку</span>
              </button>
            </div>
          </SettingsSection>
        </div>
      </div>

      {modal ? (
        <LibraryManageModal
          state={modal}
          canDelete={canDelete}
          busy={busy}
          onClose={() => setModal(null)}
          onRename={renameLibrary}
          onDelete={deleteLibrary}
        />
      ) : null}

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

      {infoModal ? (
        <MessageModal title="Сообщение" message={infoModal} onClose={() => setInfoModal(null)} closeLabel="Понятно" />
      ) : null}
    </>
  );
}
