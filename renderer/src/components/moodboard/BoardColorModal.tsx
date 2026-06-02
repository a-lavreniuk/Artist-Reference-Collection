import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ModalCategoryColorPicker from '../layout/ModalCategoryColorPicker';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { normalizeHex } from '../../utils/colorPicker';

type Props = {
  title?: string;
  initialHex: string;
  onClose: () => void;
  onApply: (hex: string) => void;
};

export default function BoardColorModal({
  title = 'Цвет',
  initialHex,
  onClose,
  onApply
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [colorHex, setColorHex] = useState(initialHex);

  useEffect(() => {
    setColorHex(initialHex);
  }, [initialHex]);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [colorHex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const normalized = normalizeHex(colorHex) ?? normalizeHex(initialHex) ?? '#c5c7cc';

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
        className="arc-modal arc-modal--board-color"
        data-elevation="raised"
        data-input-size="s"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcBoardColorModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcBoardColorModalTitle">
            {title}
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
          <button type="button" className="btn btn-primary btn-ds btn-s" onClick={() => onApply(normalized)}>
            <span className="btn-ds__value">Готово</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
