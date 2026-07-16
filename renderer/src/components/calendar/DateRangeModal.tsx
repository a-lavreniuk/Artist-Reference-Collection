import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DatepickerMode } from '../datepicker/dateRangeText';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import Calendar, { type CalendarSelection } from './Calendar';

type Props = {
  open: boolean;
  mode: DatepickerMode;
  value: { from: string; to?: string } | null;
  onClose: () => void;
  onApply: (value: { from: string; to: string } | null) => void;
};

export default function DateRangeModal({ open, mode, value, onClose, onApply }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<CalendarSelection>({ from: null, to: null });

  useEffect(() => {
    if (!open) return;
    setSelection({
      from: value?.from ?? null,
      to: value?.to ?? value?.from ?? null
    });
  }, [open, value?.from, value?.to]);

  useLayoutEffect(() => {
    if (!open || !hostRef.current) return;
    void hydrateArcNavbarIcons(hostRef.current);
  }, [open, selection.from, selection.to]);

  if (!open) return null;

  const canApply = Boolean(selection.from);
  const canClear = Boolean(selection.from);

  const handleApply = () => {
    if (!selection.from) return;
    onApply({
      from: selection.from,
      to: selection.to ?? selection.from
    });
    onClose();
  };

  const handleClear = () => {
    setSelection({ from: null, to: null });
    onApply(null);
    onClose();
  };

  return createPortal(
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="date-range-modal"
          className="arc-modal arc-modal--calendar"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор даты"
          moveAllowSelectors={['.arc-modal__footer']}
          scrollBlockSelectors={['.arc-modal__body']}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <Calendar mode={mode} selection={selection} onSelectionChange={setSelection} />
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-3">
            <button
              type="button"
              className="btn btn-outline btn-ds btn-s"
              disabled={!canClear}
              onClick={handleClear}
            >
              <span className="btn-ds__value">Очистить</span>
            </button>
            <div className="arc-modal__footer-right">
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose}>
                <span className="btn-ds__value">Отмена</span>
              </button>
              <button
                type="button"
                className="btn btn-brand btn-ds btn-s"
                disabled={!canApply}
                onClick={handleApply}
              >
                <span className="btn-ds__value">Выбрать</span>
              </button>
            </div>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>,
    document.body
  );
}
