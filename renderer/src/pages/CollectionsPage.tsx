import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CollectionPreviewMosaic from '../components/collections/CollectionPreviewMosaic';
import NewCollectionModal from '../components/collections/NewCollectionModal';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import {
  addCollection,
  getAllCollections,
  getCollectionCardCounts,
  getCollectionPreviewSlices,
  ARC_COLLECTIONS_CHANGED_EVENT,
  type CardRecord,
  type CollectionRecord
} from '../services/db';

export default function CollectionsPage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<CollectionRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [previewByCollection, setPreviewByCollection] = useState<Record<string, CardRecord[]>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [existingLowerNames, setExistingLowerNames] = useState<Set<string>>(() => new Set());

  const reload = useCallback(async () => {
    const cols = await getAllCollections();
    setItems(cols);
    const [countsMap, prev] = await Promise.all([getCollectionCardCounts(), getCollectionPreviewSlices(3)]);
    setCounts(countsMap);
    setPreviewByCollection(prev);
    setExistingLowerNames(new Set(cols.map((c) => c.name.trim().toLowerCase()).filter(Boolean)));
  }, []);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [items]);

  useEffect(() => {
    void reload();
    const onEvt = () => void reload();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onEvt);
    const onLib = () => void reload();
    window.addEventListener('arc:library-changed', onLib);
    return () => {
      window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onEvt);
      window.removeEventListener('arc:library-changed', onLib);
    };
  }, [reload]);

  return (
    <div ref={hostRef} className="arc-collections-page">
      <div className="arc-collections-page__toolbar">
        <button
          type="button"
          className="btn btn-secondary btn-ds"
          onClick={() => setModalOpen(true)}
        >
          <span className="btn-ds__value">Добавить коллекцию</span>
          <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
        </button>
      </div>
      {items.length === 0 ? (
        <div className="arc-page-empty panel elevation-default">
          <p className="typo-p-m">Коллекций пока нет. Нажмите «Добавить коллекцию» выше.</p>
        </div>
      ) : (
        <div className="arc-collections-grid">
          {items.map((c) => {
            const previews = previewByCollection[c.id] ?? [];
            const cnt = counts[c.id] ?? 0;
            return (
              <article key={c.id} className="arc-collections-card">
                <div className="arc-collections-card-mosaic-wrap">
                  <Link className="arc-collections-card-preview-link" to={`/collections/${c.id}`}>
                    <CollectionPreviewMosaic previews={previews} />
                  </Link>
                </div>
                <Link className="arc-collections-card-footer-link" to={`/collections/${c.id}`}>
                  <footer className="arc-collections-card-footer">
                    <h3 className="arc-collections-card-name">{c.name}</h3>
                    <span className="arc-collections-card-count">{cnt}</span>
                  </footer>
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {modalOpen ? (
        <NewCollectionModal
          existingLowerNames={existingLowerNames}
          onClose={() => setModalOpen(false)}
          onSubmit={async (name) => {
            await addCollection(name);
          }}
        />
      ) : null}
    </div>
  );
}
