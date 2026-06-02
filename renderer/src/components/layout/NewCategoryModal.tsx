import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ModalCategoryColorPicker from './ModalCategoryColorPicker';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { normalizeHex } from '../../utils/colorPicker';

const DEFAULT_COLOR = '#EAB308';

type Props = {
  onClose: () => void;
  onSubmit: (name: string, colorHex: string) => Promise<void>;
};

export default function NewCategoryModal({ onClose, onSubmit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lastNonEmptyNameRef = useRef('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [colorHex, setColorHex] = useState(DEFAULT_COLOR);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeHex(colorHex) ?? DEFAULT_COLOR;
  const hasDuplicateNameError = Boolean(error && error.includes('уже есть'));

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [newCategoryName, normalized, error, isSaving]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    if (isSaving) return;
    if (!newCategoryName.trim()) {
      if (lastNonEmptyNameRef.current) {
        setNewCategoryName(lastNonEmptyNameRef.current);
      }
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(newCategoryName.trim(), normalized);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить категорию');
    } finally {
      setIsSaving(false);
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
        data-input-size="m"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcTagsCategoryModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcTagsCategoryModalTitle">
            Новая категория
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text">
              Придумайте название для категории и назначьте цвет для меток, которые к ней относятся.
            </p>
          </div>
          <div className="arc-modal__slot">
            <label
              className={`field input-live${newCategoryName.trim() ? ' has-value' : ''}${hasDuplicateNameError ? ' field-error' : ''}`}
              data-live-input
            >
              <input
                className="input"
                placeholder="Введите название…"
                value={newCategoryName}
                autoFocus
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setNewCategoryName(nextValue);
                  if (nextValue.trim()) {
                    lastNonEmptyNameRef.current = nextValue.trim();
                  }
                  if (hasDuplicateNameError) {
                    setError(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSubmit();
                    return;
                  }
                  if (event.key === 'Escape') {
                    if (!newCategoryName.trim() && lastNonEmptyNameRef.current) {
                      event.preventDefault();
                      event.stopPropagation();
                      setNewCategoryName(lastNonEmptyNameRef.current);
                      if (hasDuplicateNameError) {
                        setError(null);
                      }
                    }
                  }
                }}
              />
              <button
                className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
                type="button"
                aria-label="Очистить"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setNewCategoryName('');
                }}
              />
            </label>
          </div>
          <div className="arc-modal__slot">
            <hr className="arc-modal__separator" />
          </div>
          <ModalCategoryColorPicker value={normalized} onChange={(hex) => setColorHex(hex)} />
          {error && !hasDuplicateNameError ? <p className="hint-error arc-category-modal-error">{error}</p> : null}
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-3">
          <button type="button" className="btn btn-outline btn-ds btn-s" disabled aria-disabled="true">
            <span className="btn-ds__value">Удалить</span>
          </button>
          <div className="arc-modal__footer-right">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onClose}>
              <span className="btn-ds__value">Отмена</span>
            </button>
            <button
              type="button"
              className="btn btn-brand btn-ds btn-s"
              disabled={isSaving}
              onClick={() => void handleSubmit()}
            >
              <span className="btn-ds__value">{isSaving ? 'Добавление…' : 'Добавить'}</span>
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
