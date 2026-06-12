import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ARC_COLLECTIONS_CHANGED_EVENT,
  getAllCollections,
  getCollectionCardCounts,
  getCollectionPreviewSlices,
  type CardRecord,
  type CollectionRecord
} from '../../services/db';
import CollectionSettingsModal from '../collections/CollectionSettingsModal';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import CollectionPickerRow from './CollectionPickerRow';

type Props = {
  selectedCollectionIds: string[];
  onClose: () => void;
  onToggleCollection: (collectionId: string) => void | Promise<void>;
  onCreateAndAssign: (name: string) => Promise<void>;
};

export default function CardDetailCollectionsModal({
  selectedCollectionIds,
  onClose,
  onToggleCollection,
  onCreateAndAssign
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [colSearch, setColSearch] = useState('');
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [collectionPreviews, setCollectionPreviews] = useState<Record<string, CardRecord[]>>({});
  const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(null);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);

  const reloadCatalog = async () => {
    const [cols, counts, previews] = await Promise.all([
      getAllCollections(),
      getCollectionCardCounts(),
      getCollectionPreviewSlices(3)
    ]);
    setCollections(cols);
    setCollCounts(counts);
    setCollectionPreviews(previews);
  };

  useEffect(() => {
    void reloadCatalog();
    const onCatalog = () => void reloadCatalog();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onCatalog);
    return () => window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onCatalog);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !newCollectionOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, newCollectionOpen]);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [collections, selectedCollectionIds, colSearch, collectionPreviews, newCollectionOpen]);

  const filteredCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    return collections.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [collections, colSearch]);

  const handleToggle = async (collectionId: string) => {
    if (pendingCollectionId) return;
    setPendingCollectionId(collectionId);
    try {
      await onToggleCollection(collectionId);
    } finally {
      setPendingCollectionId(null);
    }
  };

  const showEmptyCatalog = collections.length === 0;
  const showEmptySearch = !showEmptyCatalog && filteredCols.length === 0;

  const picker = (
    <div
      ref={hostRef}
      className="arc-modal-host arc-modal-host--nested arc-modal-host--card-detail-nested"
      aria-hidden="false"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="arc-card-detail-collections-picker panel elevation-raised arc-ui-kit-scope"
        data-elevation="raised"
        data-input-size="m"
        data-btn-size="m"
        role="dialog"
        aria-modal="true"
        aria-label="Коллекции"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="arc-card-detail-collections-picker__fixed">
          <div className="arc-card-detail-collections-picker__inset">
            <div
              className={`field field-full search-live arc-card-detail-collections-picker__search${colSearch.length > 0 ? ' has-value' : ''}`}
            >
              <div className="input search-field input-slots">
                <span className="search-icon slot-leading arc-icon-search" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  className="search-inner slot-value"
                  placeholder="Поиск по коллекциям"
                  value={colSearch}
                  onChange={(e) => setColSearch(e.target.value)}
                  aria-label="Поиск по коллекциям"
                />
                <button
                  type="button"
                  className="input-inline-icon search-clear-btn input-inline-icon--close slot-trailing arc-icon-close"
                  aria-label="Очистить"
                  onClick={() => {
                    setColSearch('');
                    searchInputRef.current?.focus();
                  }}
                />
              </div>
            </div>
          </div>
          <div className="context-menu__sep" role="separator" aria-hidden="true" />
        </div>

        <div className="arc-card-detail-collections-picker__scroll">
          {showEmptyCatalog ? (
            <p className="text-s arc-card-detail-collections-picker__empty">Коллекций пока нет.</p>
          ) : showEmptySearch ? (
            <p className="text-s arc-card-detail-collections-picker__empty">Нет совпадений по запросу.</p>
          ) : (
            <div className="arc-card-detail-collections-picker__list">
              {filteredCols.map((collection) => (
                <CollectionPickerRow
                  key={collection.id}
                  collection={collection}
                  previews={collectionPreviews[collection.id] ?? []}
                  count={collCounts[collection.id] ?? 0}
                  selected={selectedCollectionIds.includes(collection.id)}
                  disabled={pendingCollectionId !== null}
                  onToggle={() => void handleToggle(collection.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="arc-card-detail-collections-picker__footer">
          <div className="context-menu__sep" role="separator" aria-hidden="true" />
          <div className="arc-card-detail-collections-picker__inset">
            <button
              type="button"
              className="btn btn-outline btn-ds arc-card-detail-collections-picker__new"
              onClick={() => setNewCollectionOpen(true)}
            >
              <span className="btn-ds__value">Новая коллекция</span>
              <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {newCollectionOpen ? (
        <CollectionSettingsModal
          state={{ mode: 'create' }}
          stats={null}
          hostClassName="arc-modal-host--card-detail-nested arc-add-tags-picker-nested-modal"
          onClose={() => setNewCollectionOpen(false)}
          onCreate={async (payload) => {
            await onCreateAndAssign(payload.name);
            await reloadCatalog();
          }}
          onSave={async () => {}}
          onDelete={async () => {}}
        />
      ) : null}
    </div>
  );

  return createPortal(picker, document.body);
}
