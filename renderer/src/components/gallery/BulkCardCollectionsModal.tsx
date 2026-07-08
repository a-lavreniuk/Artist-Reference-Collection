import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArcAnimatedModalHost } from '../../motion';
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
import { resolveBulkCollectionState } from './galleryBulkActions';

type Props = {
  cardIds: readonly string[];
  cardsById: ReadonlyMap<string, CardRecord>;
  onClose: () => void;
  onToggleCollection: (collectionId: string, nextSelected: boolean) => Promise<number>;
  onCreateAndAssign: (name: string) => Promise<void>;
  onApplied: () => void | Promise<void>;
};

export default function BulkCardCollectionsModal({
  cardIds,
  cardsById,
  onClose,
  onToggleCollection,
  onCreateAndAssign,
  onApplied
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [colSearch, setColSearch] = useState('');
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [collectionPreviews, setCollectionPreviews] = useState<Record<string, CardRecord[]>>({});
  const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(null);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [localStates, setLocalStates] = useState<Record<string, 'none' | 'some' | 'all'>>({});

  const reloadCatalog = async () => {
    const [cols, counts, previews] = await Promise.all([
      getAllCollections(),
      getCollectionCardCounts(),
      getCollectionPreviewSlices(3)
    ]);
    setCollections(cols);
    setCollCounts(counts);
    setCollectionPreviews(previews);
    const nextStates: Record<string, 'none' | 'some' | 'all'> = {};
    for (const collection of cols) {
      nextStates[collection.id] = resolveBulkCollectionState(cardIds, cardsById, collection.id);
    }
    setLocalStates(nextStates);
  };

  useEffect(() => {
    void reloadCatalog();
    const onCatalog = () => void reloadCatalog();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onCatalog);
    return () => window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onCatalog);
  }, [cardIds, cardsById]);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [collections, localStates, colSearch, collectionPreviews, newCollectionOpen]);

  const filteredCols = useMemo(() => {
    const q = colSearch.trim().toLowerCase();
    return collections.filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [collections, colSearch]);

  const handleToggle = async (collectionId: string) => {
    if (pendingCollectionId) return;
    const prevState = localStates[collectionId] ?? 'none';
    const nextSelected = prevState !== 'all';
    const optimistic: 'none' | 'some' | 'all' = nextSelected ? 'all' : 'none';
    setPendingCollectionId(collectionId);
    setLocalStates((prev) => ({ ...prev, [collectionId]: optimistic }));
    try {
      await onToggleCollection(collectionId, nextSelected);
    } catch {
      setLocalStates((prev) => ({ ...prev, [collectionId]: prevState }));
    } finally {
      setPendingCollectionId(null);
    }
  };

  const showEmptyCatalog = collections.length === 0;
  const showEmptySearch = !showEmptyCatalog && filteredCols.length === 0;

  const picker = (
    <ArcAnimatedModalHost
      onClose={onClose}
      closeDisabled={newCollectionOpen}
      hostClassName="arc-modal-host--nested arc-modal-host--card-detail-nested"
    >
      {() => (
        <>
          <div
            ref={hostRef}
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
                  {filteredCols.map((collection) => {
                    const state = localStates[collection.id] ?? 'none';
                    return (
                      <CollectionPickerRow
                        key={collection.id}
                        collection={collection}
                        previews={collectionPreviews[collection.id] ?? []}
                        count={collCounts[collection.id] ?? 0}
                        selected={state === 'all'}
                        indeterminate={state === 'some'}
                        disabled={pendingCollectionId !== null}
                        onToggle={() => void handleToggle(collection.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="arc-card-detail-collections-picker__footer">
              <div className="context-menu__sep" role="separator" aria-hidden="true" />
              <div className="arc-card-detail-collections-picker__inset arc-card-detail-collections-picker__footer-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-ds arc-card-detail-collections-picker__new"
                  onClick={() => setNewCollectionOpen(true)}
                >
                  <span className="btn-ds__value">Новая коллекция</span>
                  <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-brand btn-ds"
                  onClick={() => void onApplied()}
                >
                  <span className="btn-ds__value">Готово</span>
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
        </>
      )}
    </ArcAnimatedModalHost>
  );

  return createPortal(picker, document.body);
}
