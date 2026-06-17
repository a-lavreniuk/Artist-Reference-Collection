import type { ReactNode } from 'react';

type SearchPanelSectionProps = {
  title: string;
  onClear?: () => void;
  children: ReactNode;
};

/** Секция Search Menu: заголовок + опциональная «Очистить». */
export default function SearchPanelSection({ title, onClear, children }: SearchPanelSectionProps) {
  return (
    <div className="arc-search-panel-section">
      <div className="arc-search-panel-section__header">
        <p className="text-m arc-search-panel-section__title">{title}</p>
        {onClear ? (
          <button type="button" className="text-m arc-search-panel-section__clear" onClick={onClear}>
            Очистить
          </button>
        ) : null}
      </div>
      <div className="arc-search-panel-section__body">{children}</div>
    </div>
  );
}
