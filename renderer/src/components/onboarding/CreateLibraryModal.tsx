import { useLayoutEffect, useRef } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  folderName: string;
  busy: boolean;
  emptySubmitted: boolean;
  onFolderNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  /** Без подсказки про выбор папки (создание в контейнере ARC). */
  inContainer?: boolean;
};

export default function CreateLibraryModal({
  folderName,
  busy,
  emptySubmitted,
  onFolderNameChange,
  onClose,
  onSubmit,
  inContainer = false
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const nameInvalid = emptySubmitted && !folderName.trim();

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [folderName, busy, emptySubmitted]);

  return (
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="create-library-modal"
          className="arc-modal"
        data-elevation="raised"
        data-input-size="m"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcOnboardingCreateLibraryTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcOnboardingCreateLibraryTitle">
            Создание библиотеки
          </h3>
          <button
            type="button"
            className="arc-modal__close"
            aria-label="Закрыть"
            onClick={() => {
              if (!busy) requestClose();
            }}
            disabled={busy}
          >
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text">
              {inContainer
                ? 'Придумайте название новой библиотеки в папке «Библиотека ARC»'
                : 'Придумайте библиотеке название (например, «Сохранёнки») и выберите место на диске для её хранения'}
            </p>
          </div>
          <div className="arc-modal__slot">
            <label
              className={`field input-live${folderName.trim() ? ' has-value' : ''}${nameInvalid ? ' field-error' : ''}`}
              data-live-input
            >
              <input
                className="input"
                placeholder="Название библиотеки"
                value={folderName}
                autoFocus
                aria-invalid={nameInvalid || undefined}
                disabled={busy}
                onChange={(event) => onFolderNameChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
              />
              <button
                className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
                type="button"
                aria-label="Очистить"
                disabled={busy}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onFolderNameChange('');
                }}
              />
            </label>
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <div className="arc-modal__footer-right">
            <button
              type="button"
              className="btn btn-outline btn-ds btn-s"
              onClick={() => {
                if (!busy) requestClose();
              }}
              disabled={busy}
            >
              <span className="btn-ds__value">Отмена</span>
            </button>
            <button
              type="button"
              className="btn btn-brand btn-ds btn-s"
              onClick={onSubmit}
              disabled={busy || !window.arc}
            >
              <span className="btn-ds__value">{busy ? '…' : 'Создать'}</span>
            </button>
          </div>
        </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
