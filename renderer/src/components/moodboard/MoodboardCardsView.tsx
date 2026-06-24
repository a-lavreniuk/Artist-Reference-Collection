import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useOpenCardUrl } from '../../search/openCardUrl';
import { parseSearchCardId, parseSearchTagIds } from '../../search/searchUrl';
import { resolveGalleryFeedEmptyState } from '../gallery/galleryFeedEmptyState';
import type { GalleryFeedQuery } from '../gallery/galleryQuery';
import { useGalleryFeedSentinel } from '../gallery/useGalleryFeedSentinel';
import { useScopedGalleryFeed } from '../gallery/useScopedGalleryFeed';
import { startFindSimilarSearch } from '../../search/startVisualSimilarSearch';
import GalleryBoard from '../gallery/GalleryBoard';
import CardInspectModal from '../gallery/CardInspectModal';
import { useGalleryCardContextMenu } from '../gallery/useGalleryCardContextMenu';
import ScrollToTopButton from '../layout/ScrollToTopButton';
import ConfirmRemoveFromMoodboardModal from './ConfirmRemoveFromMoodboardModal';
import { EmptyState } from '../empty-state';
import { useResetGallerySearch } from '../../hooks/useResetGallerySearch';
import { useGalleryFilters, useRegisterGalleryFeedScope } from '../gallery/GalleryFilterContext';
import { useGalleryMeta } from '../../context/GalleryMetaContext';
import { useLibraryConfigured } from '../../hooks/useLibraryConfigured';
import {
  getMoodboardCardIds,
  isCardOnBoard,
  removeCardFromMoodboard,
  addCardToMoodboard
} from '../../services/db';

export default function MoodboardCardsView() {
  const { pathname } = useLocation();
  const isMoodboardRoute = pathname.startsWith('/moodboard');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { filters, sort, activeCategoryCount } = useGalleryFilters();
  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdExact = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const { resetGallerySearch } = useResetGallerySearch();
  const libraryConfigured = useLibraryConfigured();
  const libraryStorageReady = libraryConfigured;
  const { tagsIndex, moodboardCardIds, moodboardIdsReady, refreshMoodboard } = useGalleryMeta();
  const mbIdsForScope = useMemo(() => Array.from(moodboardCardIds), [moodboardCardIds]);

  const { openCardId, openCard, closeCard } = useOpenCardUrl();
  const [removeConfirm, setRemoveConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);

  const feedQuery = useMemo<GalleryFeedQuery>(
    () => ({
      libraryScope: 'all',
      selectedTagIds,
      cardIdExact,
      moodboardCardIds: mbIdsForScope,
      advancedFilters: filters,
      sort
    }),
    [cardIdExact, filters, mbIdsForScope, selectedTagIds, sort]
  );

  const feed = useScopedGalleryFeed({
    feedQuery,
    searchParams,
    sort,
    libraryReady: libraryStorageReady && moodboardIdsReady,
    mediaSection: 'moodboard',
    feedActive: isMoodboardRoute
  });

  const { isRemoteSearchFeed, feedError } = feed;
  const hasSearchFilters =
    selectedTagIds.length > 0 || Boolean(cardIdExact) || activeCategoryCount > 0 || isRemoteSearchFeed;

  useRegisterGalleryFeedScope(
    {
      selectedTagIds,
      cardIdExact,
      moodboardCardIds: mbIdsForScope
    },
    isMoodboardRoute
  );

  useGalleryFeedSentinel({
    sentinelRef,
    scrollRootRef,
    enabled: moodboardIdsReady,
    hasMore: feed.hasMore,
    loading: feed.loading,
    booting: feed.booting,
    loadMore: feed.loadMore
  });

  useEffect(() => {
    const outlet = document.querySelector('.arc-app-outlet');
    if (outlet instanceof HTMLElement) scrollRootRef.current = outlet;
  }, []);

  const handleToggleMoodboard = useCallback(
    async (cardId: string) => {
      const ids = await getMoodboardCardIds();
      if (!ids.includes(cardId)) {
        await addCardToMoodboard(cardId);
        await refreshMoodboard();
        return;
      }
      const onBoard = await isCardOnBoard(cardId);
      setRemoveConfirm({ cardId, onBoard });
    },
    [refreshMoodboard]
  );

  const confirmRemoveAction = useCallback(async () => {
    if (!removeConfirm) return;
    await removeCardFromMoodboard(removeConfirm.cardId);
    await refreshMoodboard();
  }, [refreshMoodboard, removeConfirm]);

  const { onCardContextMenu, contextMenuLayer } = useGalleryCardContextMenu({
    scope: { kind: 'moodboard-cards' },
    cards: feed.cards,
    moodboardCardIds,
    onOpenCard: openCard,
    onToggleMoodboard: handleToggleMoodboard,
    onFindSimilar: (id) => {
      void startFindSimilarSearch(navigate, searchParams, id);
    },
    onCardDeleted: () => void feed.reloadFromStart()
  });

  const emptyState = useMemo(() => {
    if (!moodboardIdsReady || !feed.feedSettled) return null;
    if (feed.cards.length > 0 || feed.loading || feed.booting) return null;
    return resolveGalleryFeedEmptyState({
      ready: libraryConfigured,
      loading: feed.loading,
      booting: feed.booting,
      feedSettled: feed.feedSettled,
      cardCount: feed.cards.length,
      feedError,
      hasSearchFilters,
      context: 'moodboard',
      isRemoteSearch: isRemoteSearchFeed,
      onResetSearch: resetGallerySearch,
      onNavigateLibrary: () => navigate('/gallery'),
      onNavigateAiSettings: () => navigate('/settings/ai-search')
    });
  }, [
    feed.booting,
    feed.feedSettled,
    feed.cards.length,
    feed.loading,
    feedError,
    hasSearchFilters,
    isRemoteSearchFeed,
    libraryConfigured,
    moodboardIdsReady,
    navigate,
    resetGallerySearch
  ]);

  if (!isMoodboardRoute) {
    return null;
  }

  return (
    <div className="arc-collection-detail arc-moodboard-cards">
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
        <>
          <GalleryBoard
            cards={feed.cards}
            srcMap={feed.srcMap}
            mediaTab="moodboard"
            scrollRootRef={scrollRootRef}
            loadingMore={feed.loading && feed.hasMore}
            busy={feed.booting || feed.loading || feed.shuffleReloading}
            onOpenCard={openCard}
            moodboardCardIds={moodboardCardIds}
            onCardContextMenu={onCardContextMenu}
            onToggleMoodboard={handleToggleMoodboard}
            onFindSimilar={(id) => {
              void startFindSimilarSearch(navigate, searchParams, id);
            }}
          />
          <div ref={sentinelRef} className="arc-gallery-sentinel" aria-hidden />
        </>
      )}

      {openCardId ? (
        <CardInspectModal
          cardId={openCardId}
          tagsIndex={tagsIndex}
          onClose={closeCard}
          onDeleted={() => void feed.reloadFromStart()}
          onOpenCard={openCard}
          moodboardRemoveConfirm="moodboard"
        />
      ) : null}

      {removeConfirm ? (
        <ConfirmRemoveFromMoodboardModal
          cardOnBoard={removeConfirm.onBoard}
          onClose={() => setRemoveConfirm(null)}
          onConfirm={confirmRemoveAction}
        />
      ) : null}

      {contextMenuLayer}

      <ScrollToTopButton enabled={feed.cards.length > 0} />
    </div>
  );
}
