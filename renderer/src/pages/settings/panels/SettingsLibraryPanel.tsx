import { useLayoutEffect, useRef } from 'react';
import MessageModal from '../../../components/layout/MessageModal';
import ConfirmModal from '../ConfirmModal';
import LibraryManageModal from '../LibraryManageModal';
import { useSettingsLibraries } from '../hooks/useSettingsLibraries';
import { TruncatedTextWithTooltip } from '../../../components/tooltip/TruncatedTextWithTooltip';
import { hydrateArcNavbarIcons } from '../../../components/layout/navbarIconHydrate';

/** Figma 1036:34315 — Библиотека (multi-library) */
export default function SettingsLibraryPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    libraries,
    containerName,
    parentPath,
    busy,
    modal,
    setModal,
    migrateConfirm,
    setMigrateConfirm,
    infoModal,
    setInfoModal,
    renameLibrary,
    deleteLibrary,
    migrateContainer
  } = useSettingsLibraries();

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [libraries, modal, migrateConfirm]);

  const canDelete = libraries.length > 1;

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
              Библиотеки хранятся в папке «{containerName}». Можно создать несколько библиотек и переключаться между
              ними в верхней панели.
            </p>
            {parentPath ? (
              <p className="text-s hint" title={parentPath}>
                {parentPath}
              </p>
            ) : null}
          </div>

          <aside
            className="arc-settings-library-sidebar context-menu context-menu--static panel elevation-sunken"
            data-elevation="sunken"
            role="menu"
            aria-label="Библиотеки"
          >
            <div className="arc-settings-library-sidebar__scroll context-menu__list">
              <div className="arc-settings-library-sidebar__pad">
                {libraries.map((lib) => (
                  <div key={lib.id} className="arc-settings-library-row">
                    <div className="context-menu__item arc-settings-library-row__main">
                      <span className="context-menu__item-inner">
                        <span className="context-menu__item-label-cluster">
                          <TruncatedTextWithTooltip text={lib.name} className="context-menu__item-label" />
                        </span>
                        {lib.cardCount !== undefined ? (
                          <span className="context-menu__item-counter">{lib.cardCount}</span>
                        ) : null}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-ds btn-m btn-icon-only arc-settings-library-row__edit"
                      aria-label={`Изменить «${lib.name}»`}
                      disabled={busy || !window.arc}
                      onClick={() => setModal({ mode: 'edit', library: lib })}
                    >
                      <span className="btn-icon-only__glyph arc-icon-edit" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="arc-settings-action-row arc-settings-library-migrate">
            <button
              type="button"
              className="btn btn-secondary btn-ds"
              disabled={busy || !window.arc}
              onClick={() => setMigrateConfirm(true)}
            >
              <span className="btn-ds__value">Перенести «{containerName}»</span>
            </button>
          </div>
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

      {migrateConfirm ? (
        <ConfirmModal
          title={`Перенос «${containerName}»`}
          message="Папка «Библиотека ARC» со всеми библиотеками будет перенесена в выбранное место. Продолжить?"
          confirmLabel="Выбрать папку"
          onCancel={() => setMigrateConfirm(false)}
          onConfirm={() => void migrateContainer()}
        />
      ) : null}

      {infoModal ? (
        <MessageModal title="Сообщение" message={infoModal} onClose={() => setInfoModal(null)} closeLabel="Понятно" />
      ) : null}
    </>
  );
}
