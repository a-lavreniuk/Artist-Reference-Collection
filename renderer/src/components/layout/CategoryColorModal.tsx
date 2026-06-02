import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ModalCategoryColorPicker from './ModalCategoryColorPicker';
import { hydrateArcNavbarIcons } from './navbarIconHydrate';
import { normalizeHex } from '../../utils/colorPicker';

type Props = {
  initialHex: string;
  onClose: () => void;
  onSave: (hex: string) => Promise<void>;
};

export default function CategoryColorModal({ initialHex, onClose, onSave }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [colorHex, setColorHex] = useState(initialHex);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setColorHex(initialHex);
  }, [initialHex]);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [colorHex, isSaving]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const normalized = normalizeHex(colorHex) ?? normalizeHex(initialHex) ?? '#EAB308';

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(normalized);
      onClose();
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
        aria-labelledby="arcCategoryColorModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcCategoryColorModalTitle">
            Цвет меток категории
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body">
          <ModalCategoryColorPicker value={normalized} onChange={(hex) => setColorHex(hex)} />
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onClose}>
            <span className="btn-ds__value">Отмена</span>
          </button>
          <button
            type="button"
            className="btn btn-brand btn-ds btn-s"
            disabled={isSaving}
            onClick={() => void handleSave()}
          >
            <span className="btn-ds__value">{isSaving ? 'Сохранение…' : 'Сохранить'}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
