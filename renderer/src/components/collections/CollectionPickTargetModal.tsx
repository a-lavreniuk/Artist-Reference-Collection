import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArcAnimatedModalHost } from '../../motion';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

export type CollectionPickTargetItem = {
  id: string;
  name: string;
};

type Props = {
  title: string;
  confirmLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  items: CollectionPickTargetItem[];
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
};

export default function CollectionPickTargetModal({
  title,
  confirmLabel,
  searchPlaceholder,
  emptyText,
  items,
  onClose,
  onConfirm
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.name.toLowerCase().includes(needle));
  }, [items, query]);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [visibleItems, pickedId, query]);

  const submit = async () => {
    if (!pickedId || isSaving) return;
    setIsSaving(true);
    try {
      await onConfirm(pickedId);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="collection-pick-target-modal"
          className="arc-modal arc-ui-kit-scope"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcCollectionPickTargetTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcCollectionPickTargetTitle">
              {title}
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>

          <div className="arc-modal__body">
            <div className="arc-modal__slot">
              <div className={`field field-full search-live${query ? ' has-value' : ''}`}>
                <div className="input search-field input-slots">
                  <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    className="search-inner slot-value"
                    placeholder={searchPlaceholder}
                    value={query}
                    autoFocus
                    aria-label={searchPlaceholder}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      void submit();
                    }}
                  />
                  <button
                    type="button"
                    className="input-inline-icon search-clear-btn input-inline-icon--close slot-trailing arc-icon-close"
                    aria-label="Очистить"
                    onClick={() => {
                      setQuery('');
                      searchInputRef.current?.focus();
                    }}
                  />
                </div>
              </div>
            </div>

            {visibleItems.length > 0 ? (
              <div className="arc-tag-move-list">
                <div className="arc-tag-move-list__pad">
                  {visibleItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`dropdown-row${item.id === pickedId ? ' is-checked' : ''}`}
                      aria-pressed={item.id === pickedId}
                      onClick={() => setPickedId(item.id)}
                    >
                      <span className="arc-tag-move-row__name">{item.name}</span>
                      <span
                        className="dropdown-row-check tab-icon arc-icon-check"
                        data-arc-icon-size="s"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="arc-modal__slot">
                <p className="text-s arc-tag-move-empty">{emptyText}</p>
              </div>
            )}
          </div>

          <footer className="arc-modal__footer arc-modal__footer--actions-2">
            <div className="arc-modal__footer-right">
              <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose} disabled={isSaving}>
                <span className="btn-ds__value">Отмена</span>
              </button>
              <button
                type="button"
                className="btn btn-brand btn-ds btn-s"
                disabled={!pickedId || isSaving}
                onClick={() => void submit()}
              >
                <span className="btn-ds__value">{confirmLabel}</span>
              </button>
            </div>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
