import { useLayoutEffect, useRef, useState } from 'react';
import ConfirmDeletePresetModal from '../ConfirmDeletePresetModal';
import { ArcAnimatedModalHost } from '../../../motion';
import FloatingModalPanel from '../FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../navbarIconHydrate';

type BaseProps = {
  existingLowerNames: Set<string>;
  onClose: () => void;
};

type CreateProps = BaseProps & {
  mode: 'create';
  onSubmit: (name: string) => Promise<void>;
};

type EditProps = BaseProps & {
  mode: 'edit';
  initialName: string;
  onSubmit: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

type Props = CreateProps | EditProps;

export default function FilterPresetModal(props: Props) {
  const { mode, existingLowerNames, onClose } = props;
  const isEdit = mode === 'edit';
  const initialName = isEdit ? props.initialName : '';

  const hostRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [emptySubmitted, setEmptySubmitted] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const trimmed = name.trim();
  const duplicate = Boolean(trimmed) && existingLowerNames.has(trimmed.toLowerCase());
  const fieldDanger = (!trimmed && emptySubmitted) || duplicate;
  const title = isEdit ? 'Изменить пресет' : 'Сохранить пресет';
  const placeholder = isEdit ? undefined : 'Введите название пресета';

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [name, busy, emptySubmitted, deleteConfirmOpen]);

  const handleSubmit = async () => {
    if (busy) return;
    if (!trimmed) {
      setEmptySubmitted(true);
      return;
    }
    if (duplicate) return;
    setBusy(true);
    try {
      await props.onSubmit(trimmed);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ArcAnimatedModalHost onClose={onClose} hostClassName="arc-navbar-no-drag">
        {({ requestClose }) => (
          <FloatingModalPanel
            ref={hostRef}
            panelId="filter-preset-modal"
            className="arc-modal"
            data-elevation="raised"
            data-input-size="m"
            data-btn-size="s"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arcFilterPresetTitle"
            onClick={(e) => e.stopPropagation()}
          >
          <header className="arc-modal__header arc-modal__header--title">
            <h2 id="arcFilterPresetTitle" className="arc-modal__title">
              {title}
            </h2>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <label
                className={`field input-live${trimmed ? ' has-value' : ''}${fieldDanger ? ' field-error' : ''}`}
                data-live-input
              >
                <input
                  className="input"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setEmptySubmitted(false);
                  }}
                  placeholder={placeholder}
                  aria-invalid={fieldDanger || undefined}
                  autoFocus
                />
              </label>
            </div>
          </div>
          {isEdit ? (
            <footer className="arc-modal__footer arc-modal__footer--actions-3">
              <button
                type="button"
                className="btn btn-ds btn-s btn-danger"
                disabled={busy}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <span className="btn-ds__value">Удалить</span>
              </button>
              <div className="arc-modal__footer-right">
                <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose} disabled={busy}>
                  <span className="btn-ds__value">Отмена</span>
                </button>
                <button
                  type="button"
                  className="btn btn-brand btn-ds btn-s"
                  onClick={() => void handleSubmit()}
                  disabled={busy}
                >
                  <span className="btn-ds__value">{busy ? 'Сохранение…' : 'Сохранить'}</span>
                </button>
              </div>
            </footer>
          ) : (
            <footer className="arc-modal__footer arc-modal__footer--actions-2">
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose} disabled={busy}>
                <span className="btn-ds__value">Отмена</span>
              </button>
              <button
                type="button"
                className="btn btn-brand btn-ds btn-s"
                onClick={() => void handleSubmit()}
                disabled={busy}
              >
                <span className="btn-ds__value">{busy ? 'Сохранение…' : 'Сохранить'}</span>
              </button>
            </footer>
          )}
          </FloatingModalPanel>
        )}
      </ArcAnimatedModalHost>

      {deleteConfirmOpen && isEdit ? (
        <ConfirmDeletePresetModal
          presetName={props.initialName}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={async () => {
            await props.onDelete();
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
