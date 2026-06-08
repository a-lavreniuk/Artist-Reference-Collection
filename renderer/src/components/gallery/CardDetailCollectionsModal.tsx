import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ARC_COLLECTIONS_CHANGED_EVENT,
  getAllCollections,
  getCollectionCardCounts,
  type CollectionRecord
} from '../../services/db';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  selectedCollectionIds: string[];
  onClose: () => void;
  onApply: (collectionIds: string[]) => void;
};

export default function CardDetailCollectionsModal({ selectedCollectionIds, onClose, onApply }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [colSearch, setColSearch] = useState('');
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [draftIds, setDraftIds] = useState<string[]>(selectedCollectionIds);

  useEffect(() => {
    setDraftIds(selectedCollectionIds);
  }, [selectedCollectionIds]);

  useEffect(() => {
    const reload = async () => {
      setCollections(await getAllCollections());
      setCollCounts(await getCollectionCardCounts());
    };
    void reload();
    const onCatalog = () => void reload();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onCatalog);
    return () => window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onCatalog);
  }, []);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [collections, draftIds, colSearch]);

  const filteredCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    return collections.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [collections, colSearch]);

  const toggleCollection = (colId: string) => {
    setDraftIds((prev) => {
      const set = new Set(prev);
      if (set.has(colId)) set.delete(colId);
      else set.add(colId);
      return [...set];
    });
  };

  return (
    <div
      ref={hostRef}
      className="arc-modal-host arc-modal-host--nested arc-modal-host--card-detail-nested"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="arc-modal arc-card-detail-collections-modal arc-ui-kit-scope"
        data-elevation="raised"
        data-input-size="m"
        data-btn-size="m"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcCardDetailCollectionsTitle"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <h3 className="arc-modal__title" id="arcCardDetailCollectionsTitle">
            Коллекции
          </h3>
          <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={onClose}>
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>
        <div className="arc-modal__body arc-card-detail-collections-modal-body">
          <div className="field field-full input-live arc-card-detail-tags-modal-search">
            <div className="input input--size-m input-slots search-live">
              <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
              <input
                className="search-inner slot-value"
                placeholder="Поиск коллекции"
                value={colSearch}
                onChange={(e) => setColSearch(e.target.value)}
                aria-label="Поиск коллекции"
              />
            </div>
          </div>
          <div className="arc-add-collection-chips arc-card-detail-collections-modal-chips">
            {filteredCols.map((c) => {
              const sel = draftIds.includes(c.id);
              const n = collCounts[c.id] ?? 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`arc-add-collection-chip${sel ? ' is-selected' : ''}`}
                  onClick={() => toggleCollection(c.id)}
                >
                  <span className="arc-add-collection-chip-name">{c.name}</span>
                  <span className="arc-add-collection-chip-count">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <footer className="arc-modal__footer arc-modal__footer--actions-2">
          <button type="button" className="btn btn-outline btn-ds" onClick={onClose}>
            <span className="btn-ds__value">Отмена</span>
          </button>
          <button
            type="button"
            className="btn btn-brand btn-ds"
            onClick={() => {
              onApply(draftIds);
              onClose();
            }}
          >
            <span className="btn-ds__value">Готово</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
