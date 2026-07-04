import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
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

  const normalized = normalizeHex(colorHex) ?? normalizeHex(initialHex) ?? '#c5c7cc';

  return (
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <section
          ref={hostRef}
          className="arc-modal arc-modal--board-color"
          data-elevation="raised"
          data-input-size="m"
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
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body">
            <ModalCategoryColorPicker value={normalized} onChange={(hex) => setColorHex(hex)} />
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-2">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose}>
              <span className="btn-ds__value">Отмена</span>
            </button>
            <button type="button" className="btn btn-brand btn-ds btn-s" onClick={() => onApply(normalized)}>
              <span className="btn-ds__value">Готово</span>
            </button>
          </footer>
        </section>
      )}
    </ArcAnimatedModalHost>
  );
}
