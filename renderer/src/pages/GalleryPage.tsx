import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';

import GalleryBoard from '../components/gallery/GalleryBoard';

import { useGalleryFeedSentinel } from '../components/gallery/useGalleryFeedSentinel';
import { useScopedGalleryFeed } from '../components/gallery/useScopedGalleryFeed';

import type { GalleryFeedQuery } from '../components/gallery/galleryQuery';
import { useGalleryFilters, useRegisterGalleryFeedScope } from '../components/gallery/GalleryFilterContext';

import CardInspectModal from '../components/gallery/CardInspectModal';
import { resolveCardFeedNeighbors } from '../components/gallery/cardFeedNeighbors';

import GalleryBottomShade from '../components/gallery/GalleryBottomShade';
import ScrollToTopButton from '../components/layout/ScrollToTopButton';

import MessageModal from '../components/layout/MessageModal';

import ConfirmRemoveFromMoodboardModal from '../components/moodboard/ConfirmRemoveFromMoodboardModal';

import LibraryCollectionsStrip from '../components/collections/LibraryCollectionsStrip';

import { useAppPreferences } from '../hooks/useAppPreferences';
import { useGalleryCollectionsStrip } from '../hooks/useGalleryCollectionsStrip';

import {
  getMoodboardCardIds,
  isCardOnBoard,
  removeCardFromMoodboard,
  addCardToMoodboard,
  deleteCollection,
  updateCollection
} from '../services/db';
import { useGalleryMeta } from '../context/GalleryMetaContext';
import { useLibraryConfigured } from '../hooks/useLibraryConfigured';

import { parseLibraryScope } from '../search/libraryScopeUrl';

import { useOpenCardUrl } from '../search/openCardUrl';

import { parseSearchCardId, parseSearchTagIds } from '../search/searchUrl';
import { resolveGalleryFeedEmptyState } from '../components/gallery/galleryFeedEmptyState';
import { startFindSimilarSearch } from '../search/startVisualSimilarSearch';

import { EmptyState } from '../components/empty-state';
import { useImportContext } from '../components/import/ImportContext';
import { useResetGallerySearch } from '../hooks/useResetGallerySearch';
import { galleryRevealResetKey } from '../motion/galleryRevealEpoch';
import { resolveMainTab } from '../components/layout/navbarLayout';
import { useGalleryCardContextMenu } from '../components/gallery/useGalleryCardContextMenu';
import { resolveGalleryCardContextMenuScope } from '../components/gallery/buildCardContextMenuRows';
import { useGalleryMultiSelect } from '../components/gallery/useGalleryMultiSelect';
import { useCollectionContextMenu } from '../components/collections/useCollectionContextMenu';
import CollectionSettingsModal, {
  type CollectionSettingsModalState
} from '../components/collections/CollectionSettingsModal';



export default function GalleryPage() {

  const [searchParams] = useSearchParams();

  const location = useLocation();

  const navigate = useNavigate();

  const isGalleryRoute = resolveMainTab(location.pathname) === 'gallery';

  const { filters, sort, activeCategoryCount } = useGalleryFilters();

  const feedQuery = useMemo<GalleryFeedQuery>(
    () => ({
      libraryScope: parseLibraryScope(searchParams),
      selectedTagIds: parseSearchTagIds(searchParams),
      cardIdExact: parseSearchCardId(searchParams),
      advancedFilters: filters,
      sort
    }),
    [searchParams, filters, sort]
  );

  const { resetGallerySearch } = useResetGallerySearch();
  const { openImportPicker } = useImportContext();
  const { prefs } = useAppPreferences();

  const ready = useLibraryConfigured();

  const {
    isRemoteSearchFeed,
    isAiSearch,
    feedError,
    cards,
    srcMap,
    hasMore,
    loading,
    booting,
    feedSettled,
    shuffleReloading,
    loadMore,
    reloadFromStart
  } = useScopedGalleryFeed({
    feedQuery,
    searchParams,
    sort,
    libraryReady: ready,
    mediaSection: 'gallery',
    feedActive: isGalleryRoute
  });

  const { tagsIndex, moodboardCardIds, refreshMoodboard } = useGalleryMeta();

  useRegisterGalleryFeedScope(
    {
      libraryScope: feedQuery.libraryScope,
      selectedTagIds: feedQuery.selectedTagIds,
      cardIdExact: feedQuery.cardIdExact
    },
    isGalleryRoute
  );

  const hasUrlSearch =
    feedQuery.selectedTagIds.length > 0 || Boolean(feedQuery.cardIdExact) || isRemoteSearchFeed;

  const hasSearchFilters = hasUrlSearch || activeCategoryCount > 0;

  const { openCardId, openCard, closeCard } = useOpenCardUrl();

  const feedCardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const detailNeighborCardIds = useMemo(
    () => (openCardId ? resolveCardFeedNeighbors(openCardId, feedCardIds) : undefined),
    [feedCardIds, openCardId]
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  const selectionResetKey = galleryRevealResetKey(feedQuery);

  const [importModalMessage, setImportModalMessage] = useState<string | null>(null);
  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(null);
  const [stripCollectionModal, setStripCollectionModal] = useState<CollectionSettingsModalState | null>(null);

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

  const multiSelect = useGalleryMultiSelect({
    cards,
    resetKey: selectionResetKey,
    scrollRootRef,
    boardRef,
    moodboardCardIds,
    scope: resolveGalleryCardContextMenuScope(feedQuery.libraryScope),
    enabled: ready,
    onOpenCard: openCard,
    onRefresh: () => void reloadFromStart(),
    refreshMoodboard: () => void refreshMoodboard()
  });

  const { onCardContextMenu, contextMenuLayer } = useGalleryCardContextMenu({
    scope: resolveGalleryCardContextMenuScope(feedQuery.libraryScope),
    cards,
    moodboardCardIds,
    onOpenCard: openCard,
    onToggleMoodboard: handleToggleMoodboard,
    onFindSimilar: (id) => {
      void startFindSimilarSearch(navigate, searchParams, id);
    },
    onCardDeleted: () => void reloadFromStart(),
    getSelectedCardIds: () => multiSelect.selectedCardIds,
    isCardSelected: multiSelect.isSelected,
    selectionModeActive: multiSelect.selectionMode,
    onToggleCardSelection: multiSelect.toggleCardSelection,
    onStartMultiSelect: multiSelect.enterSelectionWithCard,
    bulkHandlers: multiSelect.bulkHandlers
  });

  const stripDataEnabled =
    ready &&
    prefs?.galleryCollectionsStripEnabled !== false &&
    feedQuery.libraryScope === 'all' &&
    !hasSearchFilters;

  const { items: collectionStripItems } = useGalleryCollectionsStrip(
    stripDataEnabled,
    prefs?.galleryCollectionsSortMode ?? 'chrono'
  );

  const showCollectionsStrip = stripDataEnabled && collectionStripItems.length > 0;

  const openEditStripCollection = useCallback(
    (id: string) => {
      const collection = collectionStripItems.find((item) => item.collection.id === id)?.collection;
      if (collection) setStripCollectionModal({ mode: 'edit', collection });
    },
    [collectionStripItems]
  );

  const resolveStripCollection = useCallback(
    (id: string) => {
      const collection = collectionStripItems.find((item) => item.collection.id === id)?.collection;
      return collection ? { id: collection.id, name: collection.name } : null;
    },
    [collectionStripItems]
  );

  const { openCollectionContextMenu, contextMenuLayer: collectionContextMenuLayer } =
    useCollectionContextMenu({
      resolveCollection: resolveStripCollection,
      onOpen: (id) => navigate(`/collections/${id}`),
      onEdit: openEditStripCollection,
      onDelete: async (id) => {
        await deleteCollection(id);
      }
    });

  useEffect(() => {

    const w = (location.state as { importWarnings?: string[] } | undefined)?.importWarnings;

    if (w && w.length > 0) {

      setImportModalMessage(`Часть файлов не импортирована:\n\n${w.join('\n\n')}`);

      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });

    }

  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    const outlet = document.querySelector('.arc-app-outlet');
    if (outlet instanceof HTMLElement) scrollRootRef.current = outlet;
  }, [ready]);

  const shuffleSeedRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (sort.field !== 'shuffle') {
      shuffleSeedRef.current = undefined;
      return;
    }
    const seed = sort.shuffleSeed ?? 0;
    if (shuffleSeedRef.current !== seed) {
      scrollRootRef.current?.scrollTo({ top: 0 });
      shuffleSeedRef.current = seed;
    }
  }, [sort.field, sort.shuffleSeed]);

  useGalleryFeedSentinel({
    sentinelRef,
    scrollRootRef,
    enabled: ready,
    hasMore,
    loading,
    booting,
    loadMore
  });

  const overlay = useMemo(() => {
    const resolved = resolveGalleryFeedEmptyState({
      ready,
      loading,
      booting,
      feedSettled,
      cardCount: cards.length,
      feedError,
      hasSearchFilters,
      libraryScope: feedQuery.libraryScope,
      context: 'gallery',
      isRemoteSearch: isRemoteSearchFeed,
      isAiSearch,
      onResetSearch: resetGallerySearch,
      onOpenImport: openImportPicker,
      onNavigateSettingsLibrary: () => navigate('/settings/library'),
      onNavigateAiSettings: () => navigate('/settings/ai-search')
    });
    if (!resolved) return null;
    const { copy, onPrimaryAction, onSecondaryAction } = resolved;
    return (
      <EmptyState
        {...copy}
        fill
        onPrimaryAction={onPrimaryAction}
        onSecondaryAction={onSecondaryAction}
      />
    );
  }, [
    ready,
    booting,
    feedSettled,
    cards.length,
    loading,
    feedError,
    hasSearchFilters,
    feedQuery.libraryScope,
    isRemoteSearchFeed,
    isAiSearch,
    navigate,
    openImportPicker,
    resetGallerySearch
  ]);

  if (!isGalleryRoute) {
    return null;
  }

  return (

    <div className="arc-gallery-page" data-interface-tour-anchor="gallery-page">

      {booting && !isRemoteSearchFeed && !shuffleReloading ? (

        <div className="arc-gallery-boot panel elevation-default" role="status" aria-live="polite">

          <span className="loader" aria-hidden="true" />

        </div>

      ) : null}

      {showCollectionsStrip ? (
        <div className="arc-gallery-collections-block">
          <LibraryCollectionsStrip
            items={collectionStripItems}
            onCollectionContextMenu={openCollectionContextMenu}
          />
          <div className="arc-gallery-collections-separator" role="separator" aria-hidden="true">
            <hr className="arc-gallery-collections-separator__rule" />
          </div>
        </div>
      ) : null}

      {overlay ? <div className="arc-gallery-empty-host">{overlay}</div> : null}

      {ready && cards.length > 0 ? (

        <>

          <GalleryBoard

            cards={cards}

            srcMap={srcMap}

            mediaTab="gallery"

            scrollRootRef={scrollRootRef}

            boardRef={boardRef}

            loadingMore={loading && hasMore}

            busy={(booting && !isRemoteSearchFeed && !shuffleReloading) || loading || shuffleReloading}
            revealResetKey={galleryRevealResetKey(feedQuery)}

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

        </>

      ) : null}



      {openCardId ? (

        <CardInspectModal

          cardId={openCardId}

          tagsIndex={tagsIndex}

          onClose={closeCard}

          onDeleted={() => void reloadFromStart()}

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

      {contextMenuLayer}

      {collectionContextMenuLayer}

      {stripCollectionModal ? (
        <CollectionSettingsModal
          state={stripCollectionModal}
          stats={null}
          onClose={() => setStripCollectionModal(null)}
          onCreate={async () => {}}
          onSave={async (payload) => {
            await updateCollection(payload.collectionId, {
              name: payload.name,
              description: payload.description
            });
          }}
          onDelete={async (id) => {
            await deleteCollection(id);
            setStripCollectionModal(null);
          }}
        />
      ) : null}

      {importModalMessage ? (

        <MessageModal message={importModalMessage} onClose={() => setImportModalMessage(null)} />

      ) : null}



      {ready && cards.length > 0 ? <GalleryBottomShade /> : null}

      {multiSelect.selectionBar}
      {multiSelect.collectionsModal}
      {multiSelect.marqueeOverlay}

      <ScrollToTopButton enabled={ready && cards.length > 0} align="center-outlet" />

    </div>

  );

}

