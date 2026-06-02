import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';

type Props = {
  initialName: string;
  otherCollectionsLowerNames: Set<string>;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  onRequestDelete: () => void;
};

export default function RenameCollectionModal({
  initialName,
  otherCollectionsLowerNames,
  onClose,
  onSubmit,
  onRequestDelete
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastNonEmptyRef = useRef(initialName.trim());
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [emptySubmitted, setEmptySubmitted] = useState(false);
  const [serverDuplicate, setServerDuplicate] = useState(false);

  const trimmed = name.trim();
  const initialTrim = initialName.trim();

  const liveDuplicate =
    Boolean(trimmed) &&
    trimmed.toLowerCase() !== initialTrim.toLowerCase() &&
    otherCollectionsLowerNames.has(trimmed.toLowerCase());

  const hasDuplicateNameError = liveDuplicate || serverDuplicate;

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [name, busy, emptySubmitted, serverDuplicate]);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const fieldDanger = (!trimmed && emptySubmitted) || hasDuplicateNameError;

  const handleSubmit = async () => {
    if (busy) return;
    setServerDuplicate(false);
    if (!trimmed) {
      setEmptySubmitted(true);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('уже есть')) {
        setServerDuplicate(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={hostRef}
      className="arc-modal-host"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="arc-modal"
        data-elevation="raised"
        data-input-size="s"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcRenameCollectionTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcRenameCollectionTitle">
            Изменить название коллекции
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text">
              Введите название для новой коллекции. Оно будет отображаться при добавлении и редактировании карточек.
            </p>
          </div>
          <div className="arc-modal__slot">
            <label
              className={`field input-live${trimmed ? ' has-value' : ''}${fieldDanger ? ' field-error' : ''}`}
              data-live-input
            >
              <input
                ref={inputRef}
                className="input"
                placeholder="Название коллекции"
                type="text"
                value={name}
                aria-invalid={fieldDanger}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setName(nextValue);
                  if (nextValue.trim()) {
                    lastNonEmptyRef.current = nextValue.trim();
                  }
                  if (emptySubmitted) setEmptySubmitted(false);
                  if (serverDuplicate) setServerDuplicate(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSubmit();
                    return;
                  }
                  if (e.key === 'Escape' && !trimmed && lastNonEmptyRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    setName(lastNonEmptyRef.current);
                    setEmptySubmitted(false);
                    setServerDuplicate(false);
                  }
                }}
              />
              <button
                className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
                type="button"
                aria-label="Очистить"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  setName('');
                  setEmptySubmitted(false);
                  setServerDuplicate(false);
                }}
              />
            </label>
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-3">
          <button
            type="button"
            className="btn btn-outline btn-ds btn-s arc-rename-collection-delete-ghost"
            disabled={busy}
            onClick={() => onRequestDelete()}
          >
            <span className="btn-ds__value">Удалить</span>
          </button>
          <div className="arc-modal__footer-right">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onClose} disabled={busy}>
              <span className="btn-ds__value">Отмена</span>
            </button>
            <button type="button" className="btn btn-primary btn-ds btn-s" disabled={busy} onClick={() => void handleSubmit()}>
              <span className="btn-ds__value">{busy ? 'Сохранение…' : 'Сохранить'}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
