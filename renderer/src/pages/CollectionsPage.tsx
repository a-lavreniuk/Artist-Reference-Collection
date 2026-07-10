import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent
} from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GalleryBoard from '../components/gallery/GalleryBoard';
import CardInspectModal from '../components/gallery/CardInspectModal';
import { resolveCardFeedNeighbors } from '../components/gallery/cardFeedNeighbors';
import { useGalleryFilters, useRegisterGalleryFeedScope } from '../components/gallery/GalleryFilterContext';
import type { GalleryFeedQuery } from '../components/gallery/galleryQuery';
import { subscribeGalleryCardsChanged } from '../components/gallery/galleryFeedCardsChanged';
import { useGalleryFeedSentinel } from '../components/gallery/useGalleryFeedSentinel';
import { useScopedGalleryFeed } from '../components/gallery/useScopedGalleryFeed';
import { galleryRevealResetKey } from '../motion/galleryRevealEpoch';
import { useGalleryCardContextMenu } from '../components/gallery/useGalleryCardContextMenu';
import { useGalleryMultiSelect } from '../components/gallery/useGalleryMultiSelect';
import { useCollectionContextMenu } from '../components/collections/useCollectionContextMenu';
import CollectionSettingsModal, {
  type CollectionSettingsModalState
} from '../components/collections/CollectionSettingsModal';
import CollectionsPageSidebar from '../components/collections/CollectionsPageSidebar';
import {
  clampCollectionsSidebarWidth,
  readCollectionsSidebarWidth,
  writeCollectionsSidebarWidth
} from '../components/collections/collectionsSidebarWidth';
import ScrollToTopButton from '../components/layout/ScrollToTopButton';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import ConfirmRemoveFromMoodboardModal from '../components/moodboard/ConfirmRemoveFromMoodboardModal';
import { EmptyState } from '../components/empty-state';
import { EMPTY_STATE_COPY } from '../content/emptyStates';
import { useResetGallerySearch } from '../hooks/useResetGallerySearch';
import { useOpenCardUrl } from '../search/openCardUrl';
import { useGalleryMeta } from '../context/GalleryMetaContext';
import { parseSearchCardId, parseSearchTagIds } from '../search/searchUrl';
import { resolveGalleryFeedEmptyState } from '../components/gallery/galleryFeedEmptyState';
import { startFindSimilarSearch } from '../search/startVisualSimilarSearch';
import {
  ARC_COLLECTIONS_CHANGED_EVENT,
  addCollection,
  addCardToMoodboard,
  deleteCollection,
  getAllCollections,
  getCollectionStats,
  getCollectionsSidebarMeta,
  getMoodboardCardIds,
  isCardOnBoard,
  removeCardFromMoodboard,
  reorderCollectionToIndex,
  updateCollection,
  type CollectionRecord,
  type CollectionStats
} from '../services/db';
import { useLibraryConfigured } from '../hooks/useLibraryConfigured';

export default function CollectionsPage() {
  const { pathname } = useLocation();
  const isCollectionsRoute = pathname.startsWith('/collections');
  const { collectionId: routeCollectionId } = useParams<{ collectionId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { filters, sort, activeCategoryCount } = useGalleryFilters();
  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdExact = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const { resetGallerySearch } = useResetGallerySearch();

  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [collectionsMetaLoaded, setCollectionsMetaLoaded] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => readCollectionsSidebarWidth());
  const [collectionModal, setCollectionModal] = useState<CollectionSettingsModalState | null>(null);
  const [collectionModalStats, setCollectionModalStats] = useState<CollectionStats | null>(null);

  const { openCardId, openCard, closeCard } = useOpenCardUrl();
  const { tagsIndex, moodboardCardIds, refreshMoodboard } = useGalleryMeta();
  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(
    null
  );

  const splitDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  const pageRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  sidebarWidthRef.current = sidebarWidth;

  const activeCollectionId = routeCollectionId ?? null;
  const activeCollection = useMemo(
    () => collections.find((c) => c.id === activeCollectionId) ?? null,
    [collections, activeCollectionId]
  );

  const scopedFeedQuery = useMemo<GalleryFeedQuery>(
    () => ({
      libraryScope: 'all',
      selectedTagIds,
      cardIdExact,
      collectionId: activeCollectionId,
      advancedFilters: filters,
      sort
    }),
    [activeCollectionId, cardIdExact, filters, selectedTagIds, sort]
  );

  const libraryStorageReady = useLibraryConfigured();

  const feed = useScopedGalleryFeed({
    feedQuery: scopedFeedQuery,
    searchParams,
    sort,
    libraryReady: libraryStorageReady && Boolean(activeCollectionId),
    mediaSection: 'collections',
    feedActive: isCollectionsRoute && Boolean(activeCollectionId)
  });

  const feedCardIds = useMemo(() => feed.cards.map((card) => card.id), [feed.cards]);
  const detailNeighborCardIds = useMemo(
    () => (openCardId ? resolveCardFeedNeighbors(openCardId, feedCardIds) : undefined),
    [feedCardIds, openCardId]
  );

  const { isRemoteSearchFeed, feedError } = feed;
  const hasSearchFilters =
    selectedTagIds.length > 0 || Boolean(cardIdExact) || activeCategoryCount > 0 || isRemoteSearchFeed;

  useRegisterGalleryFeedScope(
    {
      libraryScope: 'all',
      selectedTagIds,
      cardIdExact,
      collectionId: activeCollectionId
    },
    isCollectionsRoute
  );

  useGalleryFeedSentinel({
    sentinelRef,
    scrollRootRef,
    enabled: Boolean(activeCollectionId),
    hasMore: feed.hasMore,
    loading: feed.loading,
    booting: feed.booting,
    loadMore: feed.loadMore
  });

  const loadMeta = useCallback(async () => {
    const meta = await getCollectionsSidebarMeta(0);
    setCollections(meta.collections);
    setCounts(meta.counts);
    setCollectionsMetaLoaded(true);
    return meta.collections;
  }, []);

  useEffect(() => {
    if (!isCollectionsRoute || !feed.feedSettled) return;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void loadMeta();
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 4000 });
    } else {
      timeoutId = window.setTimeout(run, 800);
    }
    const onRefresh = () => void loadMeta();
    const unsubCards = subscribeGalleryCardsChanged(onRefresh);
    window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onRefresh);
    window.addEventListener('arc:library-changed', onRefresh);
    window.addEventListener('storage', onRefresh);
    return () => {
      cancelled = true;
      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      unsubCards();
      window.removeEventListener(ARC_COLLECTIONS_CHANGED_EVENT, onRefresh);
      window.removeEventListener('arc:library-changed', onRefresh);
      window.removeEventListener('storage', onRefresh);
    };
  }, [feed.feedSettled, isCollectionsRoute, loadMeta]);

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
  }, [collections, activeCollectionId, feed.cards.length, collectionModal, sidebarWidth]);

  useEffect(() => {
    const scrollEl = pageRef.current?.querySelector('.arc-collections-page-main__scroll');
    if (scrollEl instanceof HTMLElement) scrollRootRef.current = scrollEl;
  }, [activeCollectionId]);

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

  const handleToggleMoodboard = useCallback(
    async (id: string) => {
      const ids = await getMoodboardCardIds();
      if (!ids.includes(id)) {
        await addCardToMoodboard(id);
        await refreshMoodboard();
        return;
      }
      const onBoard = await isCardOnBoard(id);
      if (onBoard) {
        setRemoveMoodboardConfirm({ cardId: id, onBoard: true });
        return;
      }
      await removeCardFromMoodboard(id);
      await refreshMoodboard();
    },
    [refreshMoodboard]
  );

  const collectionMenuScope = activeCollectionId
    ? ({ kind: 'collection' as const, collectionId: activeCollectionId })
    : ({ kind: 'library' as const });

  const selectionResetKey = `${galleryRevealResetKey(scopedFeedQuery)}|${activeCollectionId ?? ''}`;

  const multiSelect = useGalleryMultiSelect({
    cards: feed.cards,
    resetKey: selectionResetKey,
    scrollRootRef,
    boardRef,
    moodboardCardIds,
    scope: collectionMenuScope,
    enabled: Boolean(activeCollectionId) && libraryStorageReady,
    onOpenCard: openCard,
    onRefresh: () => void feed.reloadFromStart(),
    refreshMoodboard: () => void refreshMoodboard()
  });

  const { onCardContextMenu, contextMenuLayer: cardContextMenuLayer } = useGalleryCardContextMenu({
    scope: collectionMenuScope,
    cards: feed.cards,
    moodboardCardIds,
    onOpenCard: openCard,
    onToggleMoodboard: handleToggleMoodboard,
    onFindSimilar: (id) => {
      void startFindSimilarSearch(navigate, searchParams, id);
    },
    onCardDeleted: () => void feed.reloadFromStart(),
    getSelectedCardIds: () => multiSelect.selectedCardIds,
    isCardSelected: multiSelect.isSelected,
    selectionModeActive: multiSelect.selectionMode,
    onToggleCardSelection: multiSelect.toggleCardSelection,
    onStartMultiSelect: multiSelect.enterSelectionWithCard,
    bulkHandlers: multiSelect.bulkHandlers
  });

  const handleDeleteCollection = useCallback(
    async (id: string) => {
      await deleteCollection(id);
      const remaining = (await getAllCollections()).filter((c) => c.id !== id);
      if (remaining.length === 0) {
        navigate('/collections', { replace: true });
      } else if (activeCollectionId === id) {
        navigate(`/collections/${remaining[0].id}`, { replace: true });
      }
      await loadMeta();
    },
    [activeCollectionId, loadMeta, navigate]
  );

  const resolveCollection = useCallback(
    (id: string) => {
      const collection = collections.find((item) => item.id === id);
      return collection ? { id: collection.id, name: collection.name } : null;
    },
    [collections]
  );

  const { openCollectionContextMenu, contextMenuLayer: collectionContextMenuLayer } =
    useCollectionContextMenu({
      resolveCollection,
      onOpen: (id) => navigate(`/collections/${id}`),
      onEdit: openEditCollection,
      onDelete: handleDeleteCollection
    });

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

  if (!isCollectionsRoute) {
    return null;
  }

  if (!collectionsMetaLoaded && !routeCollectionId) {
    return <div ref={pageRef} className="arc-collections-outlet arc-collections-page" aria-busy="true" data-interface-tour-anchor="collections-page" />;
  }

  if (collectionsMetaLoaded && collections.length > 0 && !routeCollectionId) {
    return <Navigate to={`/collections/${collections[0].id}`} replace />;
  }

  if (collectionsMetaLoaded && collections.length > 0 && routeCollectionId && !activeCollection) {
    return <Navigate to={`/collections/${collections[0].id}`} replace />;
  }

  if (collectionsMetaLoaded && collections.length === 0) {
    return (
      <div ref={pageRef} className="arc-collections-outlet arc-collections-page arc-collections-page--solo-empty" data-interface-tour-anchor="collections-page">
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

  const emptyState = resolveGalleryFeedEmptyState({
    ready: Boolean(activeCollectionId),
    loading: feed.loading,
    booting: feed.booting,
    feedSettled: feed.feedSettled,
    cardCount: feed.cards.length,
    feedError,
    hasSearchFilters,
    context: 'collection',
    isRemoteSearch: isRemoteSearchFeed,
    onResetSearch: resetGallerySearch,
    onNavigateLibrary: () => navigate('/gallery'),
    onNavigateAiSettings: () => navigate('/settings/ai-search')
  });

  return (
    <div
      ref={pageRef}
      className="arc-collections-outlet arc-collections-page"
      data-interface-tour-anchor="collections-page"
      style={{ ['--arc-collections-sidebar-w' as string]: `${sidebarWidth}px` }}
    >
      <div className="arc-collections-page-main-row">
        <CollectionsPageSidebar
          collections={collectionsMetaLoaded ? collections : []}
          counts={collectionsMetaLoaded ? counts : {}}
          selectedCollectionId={activeCollectionId}
          onSelectCollection={(id) => navigate(`/collections/${id}`)}
          onReorderCollection={(id, insertIndex) => reorderCollectionToIndex(id, insertIndex)}
          onAddCollection={() => setCollectionModal({ mode: 'create' })}
          onEditCollection={openEditCollection}
          onCollectionContextMenu={openCollectionContextMenu}
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
            {feed.booting && !isRemoteSearchFeed && !feed.shuffleReloading ? (
              <div className="arc-gallery-boot panel elevation-default" role="status" aria-live="polite">
                <span className="loader" aria-hidden="true" />
              </div>
            ) : null}

            {emptyState ? (
              <EmptyState
                {...emptyState.copy}
                fill
                onPrimaryAction={emptyState.onPrimaryAction}
                onSecondaryAction={emptyState.onSecondaryAction}
              />
            ) : (
              <div className="arc-gallery-page arc-collections-gallery">
                <GalleryBoard
                  cards={feed.cards}
                  srcMap={feed.srcMap}
                  mediaTab="collections"
                  variant="collections"
                  scrollRootRef={scrollRootRef}
                  boardRef={boardRef}
                  loadingMore={feed.loading && feed.hasMore}
                  busy={feed.booting || feed.loading || feed.shuffleReloading}
                  revealResetKey={galleryRevealResetKey(scopedFeedQuery)}
                  onOpenCard={openCard}
                  moodboardCardIds={moodboardCardIds}
                  onCardContextMenu={onCardContextMenu}
                  isCardSelected={multiSelect.isSelected}
                  onCardClick={multiSelect.handleCardClick}
                  onOpenInNewWindow={multiSelect.openInNewWindowForCard}
                  onCardPointerDown={multiSelect.handleCardPointerDown}
                  onCardPointerMove={multiSelect.onCardPointerMove}
                  onCardPointerUp={multiSelect.onCardPointerUp}
                  onToggleMoodboard={handleToggleMoodboard}
                  onFindSimilar={(id) => {
                    void startFindSimilarSearch(navigate, searchParams, id);
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
          onDeleted={() => void feed.reloadFromStart()}
          onOpenCard={openCard}
          moodboardRemoveConfirm="gallery"
          neighborCardIds={detailNeighborCardIds}
          viewerNavigationCardIds={feedCardIds}
        />
      ) : null}

      {removeMoodboardConfirm ? (
        <ConfirmRemoveFromMoodboardModal
          cardOnBoard={removeMoodboardConfirm.onBoard}
          onClose={() => setRemoveMoodboardConfirm(null)}
          onConfirm={async () => {
            await removeCardFromMoodboard(removeMoodboardConfirm.cardId);
            await refreshMoodboard();
          }}
        />
      ) : null}

      {cardContextMenuLayer}
      {collectionContextMenuLayer}

      {multiSelect.selectionBar}
      {multiSelect.collectionsModal}
      {multiSelect.marqueeOverlay}

      <ScrollToTopButton enabled={feed.cards.length > 0} />
      {collectionModalNode}
    </div>
  );
}
