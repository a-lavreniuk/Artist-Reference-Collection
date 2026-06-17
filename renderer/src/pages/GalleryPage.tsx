import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';

import GalleryBoard from '../components/gallery/GalleryBoard';

import { useGalleryFeed } from '../components/gallery/useGalleryFeed';

import type { GalleryFeedQuery } from '../components/gallery/galleryQuery';
import { useGalleryFilters, useRegisterGalleryFeedScope } from '../components/gallery/GalleryFilterContext';

import CardInspectModal from '../components/gallery/CardInspectModal';

import DemoAlert from '../components/layout/DemoAlert';
import GalleryBottomShade from '../components/gallery/GalleryBottomShade';
import ScrollToTopButton from '../components/layout/ScrollToTopButton';

import MessageModal from '../components/layout/MessageModal';

import ConfirmRemoveFromMoodboardModal from '../components/moodboard/ConfirmRemoveFromMoodboardModal';

import LibraryCollectionsStrip from '../components/collections/LibraryCollectionsStrip';

import { useAppPreferences } from '../hooks/useAppPreferences';
import { useGalleryCollectionsStrip } from '../hooks/useGalleryCollectionsStrip';

import {

  getAllCategories,

  getMoodboardCardIds,

  getTagsByCategory,

  isCardOnBoard,

  isLibraryConfigured,

  listSimilarCards,

  removeCardFromMoodboard,

  addCardToMoodboard,

  type TagRecord

} from '../services/db';

import { parseLibraryScope } from '../search/libraryScopeUrl';

import { useOpenCardUrl } from '../search/openCardUrl';

import { parseSearchCardId, parseSearchTagIds, parseSearchAiQuery } from '../search/searchUrl';
import { useAiGalleryFeed } from '../components/gallery/useAiGalleryFeed';

import { EmptyState } from '../components/empty-state';
import { EMPTY_STATE_COPY } from '../content/emptyStates';
import { useImportContext } from '../components/import/ImportContext';
import { useResetGallerySearch } from '../hooks/useResetGallerySearch';



export default function GalleryPage() {

  const [searchParams] = useSearchParams();

  const location = useLocation();

  const navigate = useNavigate();

  const { filters, sort, activeCategoryCount } = useGalleryFilters();

  const aiQuery = useMemo(() => parseSearchAiQuery(searchParams), [searchParams]);
  const isAiSearch = Boolean(aiQuery);

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

  useRegisterGalleryFeedScope({

    libraryScope: feedQuery.libraryScope,

    selectedTagIds: feedQuery.selectedTagIds,

    cardIdExact: feedQuery.cardIdExact

  });

  const hasUrlSearch =
    feedQuery.selectedTagIds.length > 0 || Boolean(feedQuery.cardIdExact) || isAiSearch;

  const hasSearchFilters = hasUrlSearch || activeCategoryCount > 0;

  const { resetGallerySearch } = useResetGallerySearch();
  const { openImportPicker } = useImportContext();
  const { prefs } = useAppPreferences();

  const [ready, setReady] = useState(false);

  const { openCardId, openCard, closeCard } = useOpenCardUrl();

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);

  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());

  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());

  const [importModalMessage, setImportModalMessage] = useState<string | null>(null);

  const [noSimilarAlertOpen, setNoSimilarAlertOpen] = useState(false);

  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(null);

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



  const galleryFeed = useGalleryFeed(feedQuery, ready && !isAiSearch);
  const aiFeed = useAiGalleryFeed(aiQuery, ready && isAiSearch, sort);
  const { cards, srcMap, hasMore, loading, booting, loadMore, reloadFromStart } = isAiSearch ? aiFeed : galleryFeed;



  useEffect(() => {

    const w = (location.state as { importWarnings?: string[] } | undefined)?.importWarnings;

    if (w && w.length > 0) {

      setImportModalMessage(`Часть файлов не импортирована:\n\n${w.join('\n\n')}`);

      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });

    }

  }, [location.pathname, location.search, location.state, navigate]);

  const loadMoodboard = useCallback(async () => {

    const ids = await getMoodboardCardIds();

    setMoodboardCardIds(new Set(ids));

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



  useEffect(() => {

    void (async () => {

      const ok = await isLibraryConfigured();

      setReady(ok);

      if (ok) {

        await Promise.all([loadTagsIndex(), loadMoodboard()]);

      }

    })();

  }, [loadTagsIndex, loadMoodboard]);



  useEffect(() => {

    const onCards = () => {

      void loadTagsIndex();

      void loadMoodboard();

    };

    window.addEventListener('arc:cards-changed', onCards);

    window.addEventListener('arc:library-changed', onCards);

    return () => {

      window.removeEventListener('arc:cards-changed', onCards);

      window.removeEventListener('arc:library-changed', onCards);

    };

  }, [loadTagsIndex, loadMoodboard]);



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

  useEffect(() => {

    const el = sentinelRef.current;
    const root = scrollRootRef.current ?? el?.closest('.arc-app-outlet');

    if (!el || !(root instanceof HTMLElement) || !ready || !hasMore || loading || booting) return;

    const io = new IntersectionObserver(

      (entries) => {

        const hit = entries.some((e) => e.isIntersecting);

        if (hit) void loadMore();

      },

      { root, rootMargin: '400px', threshold: 0 }

    );

    io.observe(el);

    return () => io.disconnect();

  }, [ready, hasMore, loading, booting, loadMore]);



  const overlay = useMemo(() => {

    if (!ready) {
      return (
        <EmptyState
          {...EMPTY_STATE_COPY.libraryUnconfigured}
          fill
          onPrimaryAction={() => navigate('/settings/library')}
        />
      );
    }

    if (booting) return null;

    if (cards.length === 0 && !loading) {

      if (hasSearchFilters) {
        const copy = isAiSearch ? EMPTY_STATE_COPY.aiSearchNoResults : EMPTY_STATE_COPY.searchNoResults;
        return (
          <EmptyState
            {...copy}
            fill
            onPrimaryAction={
              isAiSearch
                ? () => navigate('/settings/ai-search')
                : () => resetGallerySearch()
            }
          />
        );
      }

      if (feedQuery.libraryScope === 'untagged') {
        return <EmptyState {...EMPTY_STATE_COPY.libraryUntagged} fill />;
      }

      if (feedQuery.libraryScope === 'trash') {
        return <EmptyState {...EMPTY_STATE_COPY.libraryTrashEmpty} fill />;
      }

      return (
        <EmptyState
          {...EMPTY_STATE_COPY.libraryEmpty}
          fill
          onPrimaryAction={openImportPicker}
        />
      );
    }

    return null;

  }, [
    ready,
    booting,
    cards.length,
    loading,
    hasSearchFilters,
    feedQuery.libraryScope,
    isAiSearch,
    navigate,
    openImportPicker,
    resetGallerySearch
  ]);



  return (

    <div className="arc-gallery-page">

      {booting ? (

        <div className="arc-gallery-boot panel elevation-default" role="status" aria-live="polite">

          <span className="loader" aria-hidden="true" />

        </div>

      ) : null}

      {showCollectionsStrip ? (
        <div className="arc-gallery-collections-block">
          <LibraryCollectionsStrip items={collectionStripItems} />
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

            scrollRootRef={scrollRootRef}

            loadingMore={loading && hasMore}

            busy={booting || loading}

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



      {importModalMessage ? (

        <MessageModal message={importModalMessage} onClose={() => setImportModalMessage(null)} />

      ) : null}



      {noSimilarAlertOpen ? (

        <DemoAlert message="Нет похожих изображений" variant="info" onClose={() => setNoSimilarAlertOpen(false)} />

      ) : null}



      {ready && cards.length > 0 ? <GalleryBottomShade /> : null}

      <ScrollToTopButton enabled={ready && cards.length > 0} align="center-outlet" />

    </div>

  );

}

