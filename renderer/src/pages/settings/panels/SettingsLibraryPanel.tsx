import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MessageModal from '../../../components/layout/MessageModal';
import LibraryManageModal from '../LibraryManageModal';
import CreateLibraryModal from '../../../components/onboarding/CreateLibraryModal';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import { useSettingsLibraries } from '../hooks/useSettingsLibraries';
import {
  useSettingsLibraryDrag,
  type SettingsLibraryDragState
} from '../hooks/useSettingsLibraryDrag';
import { TruncatedTextWithTooltip } from '../../../components/tooltip/TruncatedTextWithTooltip';
import { hydrateArcNavbarIcons } from '../../../components/layout/navbarIconHydrate';
import { ONBOARDING_DEFAULT_LIBRARY_NAME } from '../../../content/onboarding';

/**
 * Настройки → Библиотека (multi-library).
 * Блок 1 — путь контейнера; блок 2 — список библиотек с DnD-порядком.
 * Ритм: SettingsSection + SettingsSeparator, как в General.
 * DnD: механика как у списка фильтров (handle + ghost + insert line).
 */
export default function SettingsLibraryPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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
    reorderLibrary
  } = useSettingsLibraries();

  const { dragState, startDrag } = useSettingsLibraryDrag(reorderLibrary);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState(ONBOARDING_DEFAULT_LIBRARY_NAME);
  const [createBusy, setCreateBusy] = useState(false);
  const [createEmptySubmitted, setCreateEmptySubmitted] = useState(false);
  const [createFieldError, setCreateFieldError] = useState(false);

  const canReorder = libraries.length > 1;

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [libraries, modal, createOpen, canReorder]);

  useLayoutEffect(() => {
    if (!dragState) return;
    const ghost = document.querySelector('.arc-settings-library-row-ghost');
    if (ghost instanceof HTMLElement) {
      void hydrateArcNavbarIcons(ghost);
    }
    // Только при старте drag (смена dragId), не на каждом pointermove — иначе прыгают размеры SVG.
  }, [dragState?.dragId]);

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

  const dragFrom = dragState ? libraries.findIndex((l) => l.id === dragState.dragId) : -1;
  const isNoOpInsert =
    dragState != null &&
    dragFrom >= 0 &&
    (dragState.insertIndex === dragFrom || dragState.insertIndex === dragFrom + 1);
  const showDropEnd =
    dragState != null && dragState.insertIndex === libraries.length && !isNoOpInsert;

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
            <div
              ref={listRef}
              className={`arc-settings-library-list${showDropEnd ? ' is-drop-end' : ''}`}
              role="list"
            >
              {libraries.map((lib, rowIndex) => {
                const insertBefore =
                  dragState != null && dragState.insertIndex === rowIndex && !isNoOpInsert;
                const isDragging = dragState?.dragId === lib.id;
                return (
                  <div
                    key={lib.id}
                    role="listitem"
                    data-settings-library-row={lib.id}
                    className={`context-menu__item arc-settings-library-row${lib.active ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}${insertBefore ? ' is-drop-before' : ''}`}
                    aria-current={lib.active ? 'true' : undefined}
                  >
                    <div className="context-menu__item-inner arc-settings-library-row__inner">
                      {canReorder ? (
                        <button
                          type="button"
                          className="arc-settings-library-row__handle"
                          aria-label={`Переместить «${lib.name}»`}
                          disabled={busy || !window.arc}
                          onPointerDown={(e) => {
                            if (e.button !== 0 || busy || !listRef.current) return;
                            const handleEl = e.currentTarget;
                            const rowEl = handleEl.closest('[data-settings-library-row]');
                            if (!(rowEl instanceof HTMLElement)) return;
                            e.preventDefault();
                            e.stopPropagation();
                            handleEl.setPointerCapture(e.pointerId);
                            startDrag({
                              id: lib.id,
                              label: lib.name,
                              active: lib.active,
                              cardCount: lib.cardCount,
                              handleEl,
                              rowEl,
                              listEl: listRef.current
                            });
                          }}
                        >
                          <span
                            className="context-menu__item-icon tab-icon arc-icon-chevrons-up-down"
                            data-arc-icon-size="m"
                            aria-hidden="true"
                          />
                        </button>
                      ) : null}
                      <span className="context-menu__item-label-cluster">
                        <TruncatedTextWithTooltip text={lib.name} className="context-menu__item-label" />
                        {lib.active ? (
                          <span
                            className="context-menu__item-check tab-icon arc-icon-check"
                            data-arc-icon-size="m"
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                      {lib.cardCount !== undefined ? (
                        <span className="context-menu__item-counter">{lib.cardCount}</span>
                      ) : null}
                      <button
                        type="button"
                        className="arc-settings-library-row__edit"
                        aria-label={`Изменить «${lib.name}»`}
                        disabled={busy || !window.arc}
                        onClick={() => setModal({ mode: 'edit', library: lib })}
                      >
                        <span
                          className="context-menu__item-icon tab-icon arc-icon-edit"
                          data-arc-icon-size="m"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
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

      {dragState
        ? createPortal(<SettingsLibraryRowGhost dragState={dragState} />, document.body)
        : null}

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

function SettingsLibraryRowGhost({ dragState }: { dragState: SettingsLibraryDragState }) {
  return (
    <div
      className="arc-settings-library-row-ghost arc-ui-kit-scope"
      data-btn-size="m"
      style={{
        width: dragState.ghostWidth,
        transform: `translate(${dragState.ghostX}px, ${dragState.ghostY}px)`
      }}
      aria-hidden="true"
    >
      <div className="context-menu__item-inner arc-settings-library-row__inner is-ghost">
        <span className="arc-settings-library-row__handle" aria-hidden="true">
          <span
            className="context-menu__item-icon tab-icon arc-icon-chevrons-up-down"
            data-arc-icon-size="m"
          />
        </span>
        <span className="context-menu__item-label-cluster">
          <span className="context-menu__item-label">{dragState.label}</span>
          {dragState.active ? (
            <span
              className="context-menu__item-check tab-icon arc-icon-check"
              data-arc-icon-size="m"
              aria-hidden="true"
            />
          ) : null}
        </span>
        {dragState.cardCount !== undefined ? (
          <span className="context-menu__item-counter">{dragState.cardCount}</span>
        ) : null}
      </div>
    </div>
  );
}
