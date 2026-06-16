import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent
} from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GalleryBoard from '../components/gallery/GalleryBoard';
import CardInspectModal from '../components/gallery/CardInspectModal';
import { useGalleryFilters, useRegisterGalleryFeedScope } from '../components/gallery/GalleryFilterContext';
import CollectionSettingsModal, {
  type CollectionSettingsModalState
} from '../components/collections/CollectionSettingsModal';
import CollectionsPageSidebar from '../components/collections/CollectionsPageSidebar';
import {
  clampCollectionsSidebarWidth,
  readCollectionsSidebarWidth,
  writeCollectionsSidebarWidth
} from '../components/collections/collectionsSidebarWidth';
import DemoAlert from '../components/layout/DemoAlert';
import ScrollToTopButton from '../components/layout/ScrollToTopButton';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import ConfirmRemoveFromMoodboardModal from '../components/moodboard/ConfirmRemoveFromMoodboardModal';
import { EmptyState } from '../components/empty-state';
import { EMPTY_STATE_COPY } from '../content/emptyStates';
import { useResetGallerySearch } from '../hooks/useResetGallerySearch';
import { useOpenCardUrl } from '../search/openCardUrl';
import { parseSearchCardId, parseSearchTagIds } from '../search/searchUrl';
import {
  ARC_CARDS_CHANGED_EVENT,
  ARC_COLLECTIONS_CHANGED_EVENT,
  addCollection,
  addCardToMoodboard,
  deleteCollection,
  getAllCategories,
  getAllCollections,
  getCollectionCardCounts,
  getCollectionStats,
  getMoodboardCardIds,
  getTagsByCategory,
  isCardOnBoard,
  listCardsInCollection,
  listSimilarCards,
  removeCardFromMoodboard,
  reorderCollectionToIndex,
  updateCollection,
  type CardRecord,
  type CollectionRecord,
  type CollectionStats,
  type TagRecord
} from '../services/db';

const PAGE_INITIAL = 50;
const PAGE_MORE = 35;

export default function CollectionsPage() {
  const { collectionId: routeCollectionId } = useParams<{ collectionId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { filters, sort, activeCategoryCount } = useGalleryFilters();
  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdExact = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const hasSearchFilters = selectedTagIds.length > 0 || Boolean(cardIdExact) || activeCategoryCount > 0;
  const { resetGallerySearch } = useResetGallerySearch();

  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sidebarWidth, setSidebarWidth] = useState(() => readCollectionsSidebarWidth());
  const [collectionModal, setCollectionModal] = useState<CollectionSettingsModalState | null>(null);
  const [collectionModalStats, setCollectionModalStats] = useState<CollectionStats | null>(null);

  const [cards, setCards] = useState<CardRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const { openCardId, openCard, closeCard } = useOpenCardUrl();
  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());
  const [noSimilarAlertOpen, setNoSimilarAlertOpen] = useState(false);
  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());
  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(
    null
  );

  const splitDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const pageRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  sidebarWidthRef.current = sidebarWidth;

  const activeCollectionId = routeCollectionId ?? null;
  const activeCollection = useMemo(
    () => collections.find((c) => c.id === activeCollectionId) ?? null,
    [collections, activeCollectionId]
  );

  useRegisterGalleryFeedScope({
    libraryScope: 'all',
    selectedTagIds,
    cardIdExact,
    collectionId: activeCollectionId
  });

  const loadMeta = useCallback(async () => {
    const cols = await getAllCollections();
    setCollections(cols);
    setCounts(await getCollectionCardCounts());
    return cols;
  }, []);

  const loadTagsIndex = useCallback(async () => {
    const cats = await getAllCategories();
    const lists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const m = new Map<string, TagRecord>();
    for (const list of lists) {
      for (const t of list) m.set(t.id, t);
    }
    setTagsIndex(m);
  }, []);

  const loadMoodboard = useCallback(async () => {
    const ids = await getMoodboardCardIds();
    setMoodboardCardIds(new Set(ids));
  }, []);

  useEffect(() => {
    void loadMeta();
    const onRefresh = () => void loadMeta();
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onRefresh);
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onRefresh);
    window.addEventListener('arc:library-changed', onRefresh);
    window.addEventListener('storage', onRefresh);
    return () => {
      window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onRefresh);
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onRefresh);
      window.removeEventListener('arc:library-changed', onRefresh);
      window.removeEventListener('storage', onRefresh);
    };
  }, [loadMeta]);

  useEffect(() => {
    const onResize = () => {
      setSidebarWidth((current) => clampCollectionsSidebarWidth(current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    if (pageRef.current) {
      void hydrateArcNavbarIcons(pageRef.current);
    }
  }, [collections, activeCollectionId, cards.length, collectionModal, sidebarWidth]);

  const loadPage = useCallback(
    async (collectionId: string, start: number, append: boolean) => {
      setLoading(true);
      try {
        const take = start === 0 ? PAGE_INITIAL : PAGE_MORE;
        const chunk = await listCardsInCollection(collectionId, {
          offset: start,
          limit: take,
          selectedTagIds,
          cardIdExact,
          advancedFilters: filters,
          sort
        });
        setHasMore(chunk.length === take);
        setOffset(start + chunk.length);
        setCards((prev) => (append ? [...prev, ...chunk] : chunk));
      } finally {
        setLoading(false);
      }
    },
    [filters, sort, selectedTagIds, cardIdExact]
  );

  useEffect(() => {
    void loadTagsIndex();
    void loadMoodboard();
  }, [loadTagsIndex, loadMoodboard]);

  useEffect(() => {
    if (!activeCollectionId) {
      setCards([]);
      return;
    }
    setCards([]);
    setOffset(0);
    setHasMore(true);
    void loadPage(activeCollectionId, 0, false);
  }, [activeCollectionId, filters, sort, selectedTagIds, cardIdExact, loadPage]);

  useEffect(() => {
    const onCards = () => {
      if (!activeCollectionId) return;
      void loadPage(activeCollectionId, 0, false);
      void loadTagsIndex();
      void loadMoodboard();
      void loadMeta();
    };
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onCards);
    window.addEventListener('arc:library-changed', onCards);
    return () => {
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onCards);
      window.removeEventListener('arc:library-changed', onCards);
    };
  }, [activeCollectionId, loadPage, loadTagsIndex, loadMoodboard, loadMeta]);

  useEffect(() => {
    const scrollEl = pageRef.current?.querySelector('.arc-collections-page-main__scroll');
    if (scrollEl instanceof HTMLElement) scrollRootRef.current = scrollEl;
  }, [activeCollectionId]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !activeCollectionId || !hasMore || loading) return;
    const root = scrollRootRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadPage(activeCollectionId, offset, true);
      },
      { root: root ?? null, rootMargin: '400px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [activeCollectionId, hasMore, loading, offset, loadPage]);

  useEffect(() => {
    if (collectionModal?.mode !== 'edit') {
      setCollectionModalStats(null);
      return;
    }
    void getCollectionStats(collectionModal.collection.id).then(setCollectionModalStats);
  }, [collectionModal]);

  const onSplitPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    splitDragRef.current = { startX: event.clientX, startW: sidebarWidth };
  };

  const onSplitPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!splitDragRef.current) return;
    const delta = event.clientX - splitDragRef.current.startX;
    setSidebarWidth(clampCollectionsSidebarWidth(splitDragRef.current.startW + delta));
  };

  const finishSplitDrag = () => {
    if (!splitDragRef.current) return;
    splitDragRef.current = null;
    writeCollectionsSidebarWidth(sidebarWidthRef.current);
  };

  const openEditCollection = (id: string) => {
    const collection = collections.find((c) => c.id === id);
    if (collection) setCollectionModal({ mode: 'edit', collection });
  };

  const collectionModalNode = collectionModal ? (
    <CollectionSettingsModal
      state={collectionModal}
      stats={collectionModalStats}
      onClose={() => setCollectionModal(null)}
      onCreate={async (payload) => {
        const created = await addCollection(payload.name, { description: payload.description });
        navigate(`/collections/${created.id}`);
      }}
      onSave={async (payload) => {
        await updateCollection(payload.collectionId, {
          name: payload.name,
          description: payload.description
        });
      }}
      onDelete={async (id) => {
        await deleteCollection(id);
        const remaining = (await getAllCollections()).filter((c) => c.id !== id);
        if (remaining.length === 0) {
          navigate('/collections', { replace: true });
        } else if (activeCollectionId === id) {
          navigate(`/collections/${remaining[0].id}`, { replace: true });
        }
      }}
    />
  ) : null;

  if (collections.length > 0 && !routeCollectionId) {
    return <Navigate to={`/collections/${collections[0].id}`} replace />;
  }

  if (collections.length > 0 && routeCollectionId && !activeCollection) {
    return <Navigate to={`/collections/${collections[0].id}`} replace />;
  }

  if (collections.length === 0) {
    return (
      <div ref={pageRef} className="arc-collections-outlet arc-collections-page arc-collections-page--solo-empty">
        <EmptyState
          {...EMPTY_STATE_COPY.collectionsNone}
          elevation="sunken"
          fill
          onPrimaryAction={() => setCollectionModal({ mode: 'create' })}
        />
        {collectionModalNode}
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      className="arc-collections-outlet arc-collections-page"
      style={{ ['--arc-collections-sidebar-w' as string]: `${sidebarWidth}px` }}
    >
      <div className="arc-collections-page-main-row">
        <CollectionsPageSidebar
          collections={collections}
          counts={counts}
          selectedCollectionId={activeCollectionId}
          onSelectCollection={(id) => navigate(`/collections/${id}`)}
          onReorderCollection={(id, insertIndex) => reorderCollectionToIndex(id, insertIndex)}
          onAddCollection={() => setCollectionModal({ mode: 'create' })}
          onEditCollection={openEditCollection}
        />

        <button
          type="button"
          className="arc-layout-splitter"
          aria-label="Изменить ширину панелей"
          onPointerDown={onSplitPointerDown}
          onPointerMove={onSplitPointerMove}
          onPointerUp={finishSplitDrag}
          onPointerCancel={finishSplitDrag}
          onLostPointerCapture={finishSplitDrag}
        />

        <main
          className="arc-collections-page-main panel elevation-sunken arc-ui-kit-scope"
          data-elevation="sunken"
          data-typo-tone="white"
        >
          <div className="arc-collections-page-main__scroll">
            {cards.length === 0 && !loading ? (
              <EmptyState
                {...(hasSearchFilters ? EMPTY_STATE_COPY.searchNoResults : EMPTY_STATE_COPY.collectionEmpty)}
                fill
                onPrimaryAction={
                  hasSearchFilters ? () => resetGallerySearch() : () => navigate('/gallery')
                }
              />
            ) : (
              <div className="arc-gallery-page arc-collections-gallery">
                <GalleryBoard
                  cards={cards}
                  variant="collections"
                  scrollRootRef={scrollRootRef}
                  loadingMore={loading && hasMore}
                  busy={loading}
                  onOpenCard={openCard}
                  moodboardCardIds={moodboardCardIds}
                  onToggleMoodboard={async (id) => {
                    const ids = await getMoodboardCardIds();
                    if (!ids.includes(id)) {
                      await addCardToMoodboard(id);
                      setMoodboardCardIds((prev) => new Set(prev).add(id));
                      return;
                    }
                    const onBoard = await isCardOnBoard(id);
                    if (onBoard) {
                      setRemoveMoodboardConfirm({ cardId: id, onBoard: true });
                      return;
                    }
                    await removeCardFromMoodboard(id);
                    setMoodboardCardIds((prev) => {
                      const copy = new Set(prev);
                      copy.delete(id);
                      return copy;
                    });
                  }}
                  onFindSimilar={async (id) => {
                    const sim = await listSimilarCards(id, 1);
                    if (sim.length === 0) {
                      setNoSimilarAlertOpen(true);
                      return;
                    }
                    openCard(sim[0].id);
                  }}
                />
                <div ref={sentinelRef} className="arc-gallery-sentinel" aria-hidden />
              </div>
            )}
          </div>
        </main>
      </div>

      {openCardId ? (
        <CardInspectModal
          cardId={openCardId}
          tagsIndex={tagsIndex}
          onClose={closeCard}
          onDeleted={() => {
            if (activeCollectionId) void loadPage(activeCollectionId, 0, false);
          }}
          onOpenCard={openCard}
          moodboardRemoveConfirm="gallery"
        />
      ) : null}

      {removeMoodboardConfirm ? (
        <ConfirmRemoveFromMoodboardModal
          cardOnBoard={removeMoodboardConfirm.onBoard}
          onClose={() => setRemoveMoodboardConfirm(null)}
          onConfirm={async () => {
            await removeCardFromMoodboard(removeMoodboardConfirm.cardId);
            setMoodboardCardIds((prev) => {
              const copy = new Set(prev);
              copy.delete(removeMoodboardConfirm.cardId);
              return copy;
            });
          }}
        />
      ) : null}

      {noSimilarAlertOpen ? (
        <DemoAlert message="Нет похожих изображений" variant="info" onClose={() => setNoSimilarAlertOpen(false)} />
      ) : null}

      <ScrollToTopButton enabled={cards.length > 0} />
      {collectionModalNode}
    </div>
  );
}
