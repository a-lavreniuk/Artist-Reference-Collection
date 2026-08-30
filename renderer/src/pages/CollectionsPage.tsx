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
import { DEFAULT_GALLERY_SORT, emptyGalleryAdvancedFilters } from '../components/gallery/galleryFilterTypes';
import { listAllCardIdsForQuery } from '../components/gallery/gallerySelectAllIds';
import { useCardDetailNavIdWindow } from '../components/gallery/useCardDetailNavIdWindow';
import { useGalleryFeedSentinel } from '../components/gallery/useGalleryFeedSentinel';
import { useScopedGalleryFeed } from '../components/gallery/useScopedGalleryFeed';
import { galleryRevealResetKey } from '../motion/galleryRevealEpoch';
import { useGalleryCardContextMenu } from '../components/gallery/useGalleryCardContextMenu';
import { useGalleryMultiSelect } from '../components/gallery/useGalleryMultiSelect';
import { useCollectionContextMenu } from '../components/collections/useCollectionContextMenu';
import CollectionSettingsModal, {
  type CollectionSettingsModalState
} from '../components/collections/CollectionSettingsModal';
import CollectionPickTargetModal from '../components/collections/CollectionPickTargetModal';
import CollectionsPageSidebar from '../components/collections/CollectionsPageSidebar';
import LibraryCollectionsStrip from '../components/collections/LibraryCollectionsStrip';
import { collectionHref } from '../components/collections/collectionHref';
import {
  childSections,
  collectionParentId,
  isCollectionSection,
  rootCollections
} from '@arc-main-shared/collectionHierarchy';
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
import { useCollectionsMeta } from '../hooks/useCollectionsMeta';
import { loadCollectionsMeta } from '../hooks/collectionsMetaStore';
import { useOpenCardUrl } from '../search/openCardUrl';
import { matchesShortcut } from '../shortcuts/matchShortcutEvent';
import { isRendererShortcutBlocked } from '../shortcuts/shortcutGuards';
import { showAppNotification } from '../services/notificationService';
import { useGalleryMeta } from '../context/GalleryMetaContext';
import { parseSearchCardId, parseSearchTagIds } from '../search/searchUrl';
import { resolveGalleryFeedEmptyState } from '../components/gallery/galleryFeedEmptyState';
import { startFindSimilarSearch } from '../search/startVisualSimilarSearch';
import { TruncatedTextWithTooltip } from '../components/tooltip/TruncatedTextWithTooltip';
import {
  addCollection,
  deleteCollection,
  duplicateCollection,
  getAllCollections,
  getCollectionStats,
  getMoodboardCardIds,
  isCardOnBoard,
  mergeCollectionInto,
  moveCollectionToParent,
  reorderCollectionToIndex,
  updateCollection,
  type CollectionRecord,
  type CollectionStats
} from '../services/db';
import {
  applyMoodboardAddWithUndo,
  applyMoodboardRemoveWithUndo
} from '../components/gallery/galleryUndoToast';
import { useLibraryConfigured } from '../hooks/useLibraryConfigured';

export default function CollectionsPage() {
  const { pathname } = useLocation();
  const isCollectionsRoute = pathname.startsWith('/collections');
  const { collectionId: routeCollectionId, sectionId: routeSectionId } = useParams<{
    collectionId?: string;
    sectionId?: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { filters, sort, activeCategoryCount } = useGalleryFilters();
  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdExact = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const { resetGallerySearch } = useResetGallerySearch();

  const { collections, counts, previews, loaded: collectionsMetaLoaded } = useCollectionsMeta(
    isCollectionsRoute
  );
  const [sidebarWidth, setSidebarWidth] = useState(() => readCollectionsSidebarWidth());
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [collectionModal, setCollectionModal] = useState<CollectionSettingsModalState | null>(null);
  const [collectionModalStats, setCollectionModalStats] = useState<CollectionStats | null>(null);
  const [pickTarget, setPickTarget] = useState<{ mode: 'move' | 'merge'; sourceId: string } | null>(null);

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

  const activeCollectionId = routeSectionId ?? routeCollectionId ?? null;
  const activeCollection = useMemo(
    () => collections.find((c) => c.id === activeCollectionId) ?? null,
    [collections, activeCollectionId]
  );
  const sectionStripItems = useMemo(() => {
    if (!routeCollectionId || routeSectionId) return [];
    return childSections(collections, routeCollectionId).map((section) => ({
      collection: section,
      count: counts[section.id] ?? 0,
      previews: previews[section.id] ?? []
    }));
  }, [collections, counts, previews, routeCollectionId, routeSectionId]);

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
  const collectionQueueQuery = useMemo<GalleryFeedQuery>(
    () => ({
      libraryScope: 'all',
      selectedTagIds: [],
      cardIdExact: null,
      collectionId: activeCollectionId,
      advancedFilters: emptyGalleryAdvancedFilters(),
      sort: DEFAULT_GALLERY_SORT
    }),
    [activeCollectionId]
  );
  const previewQueueCardIds = useCardDetailNavIdWindow(
    activeCollectionId ? collectionQueueQuery : null,
    openCardId
  );

  const detailNeighborCardIds = useMemo(
    () => (openCardId ? resolveCardFeedNeighbors(openCardId, previewQueueCardIds) : undefined),
    [previewQueueCardIds, openCardId]
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
  }, [collections, counts, activeCollectionId, activeCollection?.name, feed.cards.length, collectionModal, sidebarWidth, sectionStripItems.length]);

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
        await applyMoodboardAddWithUndo(id, refreshMoodboard);
        return;
      }
      const onBoard = await isCardOnBoard(id);
      if (onBoard) {
        setRemoveMoodboardConfirm({ cardId: id, onBoard: true });
        return;
      }
      await applyMoodboardRemoveWithUndo(id, refreshMoodboard);
    },
    [refreshMoodboard]
  );

  const collectionMenuScope = activeCollectionId
    ? ({ kind: 'collection' as const, collectionId: activeCollectionId })
    : ({ kind: 'library' as const });

  const selectionResetKey = `${galleryRevealResetKey(scopedFeedQuery)}|${activeCollectionId ?? ''}`;

  const handleFindSimilar = useCallback(
    (id: string) => {
      void startFindSimilarSearch(navigate, searchParams, id);
    },
    [navigate, searchParams]
  );

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
    refreshMoodboard: () => void refreshMoodboard(),
    resolveSelectAllIds: isRemoteSearchFeed
      ? undefined
      : () => listAllCardIdsForQuery(scopedFeedQuery)
  });

  const { onCardContextMenu, contextMenuLayer: cardContextMenuLayer } = useGalleryCardContextMenu({
    scope: collectionMenuScope,
    cards: feed.cards,
    moodboardCardIds,
    onOpenCard: openCard,
    onToggleMoodboard: handleToggleMoodboard,
    onFindSimilar: handleFindSimilar,
    onCardDeleted: () => void feed.reloadFromStart(),
    getSelectedCardIds: () => multiSelect.selectedCardIds,
    isCardSelected: multiSelect.isSelected,
    selectionModeActive: multiSelect.selectionMode,
    onToggleCardSelection: multiSelect.toggleCardSelection,
    onStartMultiSelect: multiSelect.enterSelectionWithCard,
    bulkHandlers: multiSelect.bulkHandlers,
    collectionName: activeCollection?.name
  });

  const handleDeleteCollection = useCallback(
    async (id: string) => {
      const target = collections.find((c) => c.id === id);
      const parentId = target ? collectionParentId(target) : null;
      await deleteCollection(id);
      const remaining = await getAllCollections();
      const roots = rootCollections(remaining);
      if (roots.length === 0) {
        navigate('/collections', { replace: true });
      } else if (activeCollectionId === id) {
        if (parentId && remaining.some((c) => c.id === parentId)) {
          navigate(`/collections/${parentId}`, { replace: true });
        } else {
          navigate(collectionHref(roots[0]), { replace: true });
        }
      }
      await loadCollectionsMeta({ force: true });
    },
    [activeCollectionId, collections, navigate]
  );

  const resolveCollection = useCallback(
    (id: string) => {
      const collection = collections.find((item) => item.id === id);
      return collection
        ? { id: collection.id, name: collection.name, parentId: collection.parentId }
        : null;
    },
    [collections]
  );

  const canMoveSection = useCallback(
    (id: string) => {
      const source = collections.find((item) => item.id === id);
      if (!source || !isCollectionSection(source)) return false;
      const currentParent = collectionParentId(source);
      return rootCollections(collections).some((item) => item.id !== currentParent);
    },
    [collections]
  );

  const canMergeSection = useCallback(
    (id: string) => {
      const source = collections.find((item) => item.id === id);
      if (!source || !isCollectionSection(source)) return false;
      return collections.some((item) => isCollectionSection(item) && item.id !== id);
    },
    [collections]
  );

  const handleDuplicateSection = useCallback(
    async (id: string) => {
      try {
        const copy = await duplicateCollection(id);
        navigate(collectionHref(copy));
      } catch (err) {
        showAppNotification({
          message: err instanceof Error ? err.message : 'Не удалось создать копию',
          variant: 'danger'
        });
      }
    },
    [navigate]
  );

  const pickItems = useMemo(() => {
    if (!pickTarget) return [];
    const source = collections.find((item) => item.id === pickTarget.sourceId);
    if (pickTarget.mode === 'move') {
      const currentParent = source ? collectionParentId(source) : null;
      return rootCollections(collections)
        .filter((item) => item.id !== currentParent)
        .map((item) => ({ id: item.id, name: item.name }));
    }
    const sourceParent = source ? collectionParentId(source) : null;
    return collections
      .filter((item) => isCollectionSection(item) && item.id !== pickTarget.sourceId)
      .map((item) => {
        const parent = collections.find((c) => c.id === collectionParentId(item));
        const name =
          parent && parent.id !== sourceParent ? `${parent.name} / ${item.name}` : item.name;
        return { id: item.id, name };
      });
  }, [collections, pickTarget]);

  const { openCollectionContextMenu, contextMenuLayer: collectionContextMenuLayer } =
    useCollectionContextMenu({
      resolveCollection,
      canMoveSection,
      canMergeSection,
      onOpen: (id) => {
        const item = collections.find((c) => c.id === id);
        if (item) navigate(collectionHref(item));
      },
      onEdit: openEditCollection,
      onDelete: handleDeleteCollection,
      onAddSection: (parentId) => setCollectionModal({ mode: 'create', parentId }),
      onDuplicate: (id) => void handleDuplicateSection(id),
      onMove: (id) => setPickTarget({ mode: 'move', sourceId: id }),
      onMerge: (id) => setPickTarget({ mode: 'merge', sourceId: id })
    });

  useEffect(() => {
    if (!isCollectionsRoute) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isRendererShortcutBlocked(event)) return;
      if (document.querySelector('.arc-modal-host')) return;
      if (matchesShortcut(event, 'collections.create')) {
        event.preventDefault();
        setCollectionModal({ mode: 'create' });
        return;
      }
      if (matchesShortcut(event, 'collections.createSection')) {
        event.preventDefault();
        const parentId = routeCollectionId ?? null;
        if (!parentId) return;
        const parent = collections.find((item) => item.id === parentId);
        if (!parent || isCollectionSection(parent)) return;
        setCollectionModal({ mode: 'create', parentId });
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [collections, isCollectionsRoute, routeCollectionId]);

  const collectionModalNode = collectionModal ? (
    <CollectionSettingsModal
      state={collectionModal}
      stats={collectionModalStats}
      onClose={() => setCollectionModal(null)}
      onCreate={async (payload) => {
        const created = await addCollection(payload.name, {
          description: payload.description,
          parentId: payload.parentId
        });
        navigate(collectionHref(created));
      }}
      onSave={async (payload) => {
        await updateCollection(payload.collectionId, {
          name: payload.name,
          description: payload.description
        });
      }}
      onDelete={async (id) => {
        await handleDeleteCollection(id);
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
    const firstRoot = rootCollections(collections)[0];
    if (firstRoot) return <Navigate to={collectionHref(firstRoot)} replace />;
  }

  if (collectionsMetaLoaded && routeCollectionId) {
    const parent = collections.find((c) => c.id === routeCollectionId);
    if (!parent || isCollectionSection(parent)) {
      return <Navigate to="/collections" replace />;
    }
    if (routeSectionId) {
      const section = collections.find((c) => c.id === routeSectionId);
      if (!section || collectionParentId(section) !== routeCollectionId) {
        return <Navigate to={`/collections/${routeCollectionId}`} replace />;
      }
    }
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
    collectionKind: routeSectionId ? 'section' : 'collection',
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
          collapsedIds={collapsedIds}
          onToggleCollapsed={(id) => {
            setCollapsedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          }}
          onCollapseAll={() =>
            setCollapsedIds(new Set(rootCollections(collections).map((item) => item.id)))
          }
          onExpandAll={() => setCollapsedIds(new Set())}
          onSelectCollection={(id) => {
            const item = collections.find((c) => c.id === id);
            if (item) navigate(collectionHref(item));
          }}
          onReorderCollection={(id, insertIndex) => reorderCollectionToIndex(id, insertIndex)}
          onAddCollection={() => setCollectionModal({ mode: 'create' })}
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
          {activeCollection ? (
            <div className="arc-collections-page-main__fixed">
              <div className="arc-collections-page-main__inset">
                <div className="arc-collections-page-title">
                  <button
                    type="button"
                    className="arc-collections-page-title__button"
                    onClick={() => openEditCollection(activeCollection.id)}
                    aria-label={`Редактировать «${activeCollection.name}»`}
                  >
                    <TruncatedTextWithTooltip
                      text={activeCollection.name}
                      className="h1 arc-collections-page-title__text"
                      wrapClassName="arc-truncated-tooltip-wrap arc-collections-page-title__name-wrap"
                    />
                    <span className="h1 arc-collections-page-title__count">
                      {counts[activeCollection.id] ?? 0}
                    </span>
                  </button>
                </div>
              </div>
              <div className="context-menu__sep" role="separator" aria-hidden="true" />
            </div>
          ) : null}

          <div className="arc-collections-page-main__scroll">
            {sectionStripItems.length > 0 ? (
              <>
                <div className="arc-collections-page-main__scroll-pad">
                  <LibraryCollectionsStrip
                    items={sectionStripItems}
                    mediaTab="collections"
                    ariaLabel="Разделы"
                    onCollectionContextMenu={openCollectionContextMenu}
                  />
                </div>
                <div className="context-menu__sep" role="separator" aria-hidden="true" />
              </>
            ) : null}

            <div className="arc-collections-page-main__scroll-pad">
              {emptyState ? (
                <EmptyState
                  {...emptyState.copy}
                  fill
                  layout={emptyState.layout}
                  onPrimaryAction={emptyState.onPrimaryAction}
                  onSecondaryAction={emptyState.onSecondaryAction}
                />
              ) : (
                <>
                  {feed.booting && !isRemoteSearchFeed && !feed.shuffleReloading ? (
                    <div className="arc-gallery-boot panel elevation-default" role="status" aria-live="polite">
                      <span className="loader" aria-hidden="true" />
                    </div>
                  ) : null}

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
                      onFindSimilar={handleFindSimilar}
                    />
                    <div ref={sentinelRef} className="arc-gallery-sentinel" aria-hidden />
                  </div>
                </>
              )}
            </div>
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
          previewQueueCardIds={previewQueueCardIds}
          viewerOpenContext={
            activeCollection
              ? { kind: 'collection', name: activeCollection.name }
              : { kind: 'library' }
          }
        />
      ) : null}

      {removeMoodboardConfirm ? (
        <ConfirmRemoveFromMoodboardModal
          cardOnBoard={removeMoodboardConfirm.onBoard}
          onClose={() => setRemoveMoodboardConfirm(null)}
          onConfirm={async () => {
            await applyMoodboardRemoveWithUndo(removeMoodboardConfirm.cardId, refreshMoodboard);
          }}
        />
      ) : null}

      {cardContextMenuLayer}
      {collectionContextMenuLayer}

      {pickTarget ? (
        <CollectionPickTargetModal
          title={pickTarget.mode === 'move' ? 'Переместить раздел' : 'Объединить разделы'}
          confirmLabel={pickTarget.mode === 'move' ? 'Перенести' : 'Объединить'}
          searchPlaceholder={
            pickTarget.mode === 'move' ? 'Поиск по коллекциям' : 'Поиск по разделам'
          }
          emptyText={pickTarget.mode === 'move' ? 'Нет другой коллекции' : 'Нет другого раздела'}
          items={pickItems}
          onClose={() => setPickTarget(null)}
          onConfirm={async (targetId) => {
            const sourceId = pickTarget.sourceId;
            try {
              if (pickTarget.mode === 'move') {
                await moveCollectionToParent(sourceId, targetId);
                const moved = collections.find((item) => item.id === sourceId);
                setPickTarget(null);
                if (moved) {
                  navigate(collectionHref({ ...moved, parentId: targetId }));
                }
              } else {
                await mergeCollectionInto(sourceId, targetId);
                const target = collections.find((item) => item.id === targetId);
                setPickTarget(null);
                if (activeCollectionId === sourceId && target) {
                  navigate(collectionHref(target), { replace: true });
                }
              }
            } catch (err) {
              showAppNotification({
                message: err instanceof Error ? err.message : 'Не удалось выполнить действие',
                variant: 'danger'
              });
            }
          }}
        />
      ) : null}

      {multiSelect.selectionBar}
      {multiSelect.collectionsModal}
      {multiSelect.tagsModal}
      {multiSelect.marqueeOverlay}

      <ScrollToTopButton enabled={feed.cards.length > 0} />
      {collectionModalNode}
    </div>
  );
}
