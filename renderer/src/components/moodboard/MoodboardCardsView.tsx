import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOpenCardUrl } from '../../search/openCardUrl';
import { parseSearchCardId, parseSearchTagIds } from '../../search/searchUrl';
import GalleryBoard from '../gallery/GalleryBoard';
import CardInspectModal from '../gallery/CardInspectModal';
import DemoAlert from '../layout/DemoAlert';
import ScrollToTopButton from '../layout/ScrollToTopButton';
import ConfirmRemoveFromMoodboardModal from './ConfirmRemoveFromMoodboardModal';
import { useGalleryFilters, useRegisterGalleryFeedScope } from '../gallery/GalleryFilterContext';
import {
  ARC_CARDS_CHANGED_EVENT,
  getAllCategories,
  getMoodboardCardIds,
  getTagsByCategory,
  isCardOnBoard,
  listMoodboardCards,
  listSimilarCards,
  removeCardFromMoodboard,
  toggleCardInMoodboard,
  addCardToMoodboard,
  type CardRecord,
  type TagRecord
} from '../../services/db';

const PAGE_INITIAL = 50;
const PAGE_MORE = 35;

export default function MoodboardCardsView() {
  const [searchParams] = useSearchParams();
  const { filters, sort } = useGalleryFilters();
  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdExact = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const hasSearchFilters = selectedTagIds.length > 0 || Boolean(cardIdExact);
  const [mbIdsForScope, setMbIdsForScope] = useState<string[]>([]);

  const [cards, setCards] = useState<CardRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const { openCardId, openCard, closeCard } = useOpenCardUrl();
  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());
  const [noSimilarAlertOpen, setNoSimilarAlertOpen] = useState(false);
  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());
  const [removeConfirm, setRemoveConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);

  const loadMoodboard = useCallback(async () => {
    const ids = await getMoodboardCardIds();
    setMoodboardCardIds(new Set(ids));
    setMbIdsForScope(ids);
  }, []);

  useRegisterGalleryFeedScope({
    selectedTagIds,
    cardIdExact,
    moodboardCardIds: mbIdsForScope
  });

  const loadTagsIndex = useCallback(async () => {
    const cats = await getAllCategories();
    const lists = await Promise.all(cats.map((c) => getTagsByCategory(c.id)));
    const m = new Map<string, TagRecord>();
    for (const list of lists) {
      for (const t of list) m.set(t.id, t);
    }
    setTagsIndex(m);
  }, []);

  const loadPage = useCallback(
    async (start: number, append: boolean) => {
      setLoading(true);
      try {
        const take = start === 0 ? PAGE_INITIAL : PAGE_MORE;
        const chunk = await listMoodboardCards({
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
    setCards([]);
    setOffset(0);
    setHasMore(true);
    void loadPage(0, false);
  }, [filters, sort, selectedTagIds, cardIdExact, loadPage]);

  useEffect(() => {
    const onCards = () => {
      void loadPage(0, false);
      void loadTagsIndex();
      void loadMoodboard();
    };
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, onCards);
    window.addEventListener('arc:library-changed', onCards);
    return () => {
      window.removeEventListener(ARC_CARDS_CHANGED_EVENT, onCards);
      window.removeEventListener('arc:library-changed', onCards);
    };
  }, [loadPage, loadTagsIndex, loadMoodboard]);

  useEffect(() => {
    const outlet = document.querySelector('.arc-app-outlet');
    if (outlet instanceof HTMLElement) scrollRootRef.current = outlet;
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const root = scrollRootRef.current ?? el.closest('.arc-app-outlet');
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadPage(offset, true);
      },
      { root: root instanceof HTMLElement ? root : null, rootMargin: '400px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, offset, loadPage]);

  const handleToggleMoodboard = async (cardId: string) => {
    const ids = await getMoodboardCardIds();
    if (!ids.includes(cardId)) {
      await addCardToMoodboard(cardId);
      await loadMoodboard();
      await loadPage(0, false);
      return;
    }
    const onBoard = await isCardOnBoard(cardId);
    setRemoveConfirm({ cardId, onBoard });
  };

  const confirmRemoveAction = async () => {
    if (!removeConfirm) return;
    await removeCardFromMoodboard(removeConfirm.cardId);
    await loadMoodboard();
    await loadPage(0, false);
  };

  return (
    <div className="arc-collection-detail arc-moodboard-cards">
      {cards.length === 0 && !loading ? (
        <div className="arc-page-empty panel elevation-default">
          <p className="typo-p-m">
            {hasSearchFilters
              ? 'Карточки не найдены. Измените фильтры поиска или сбросьте метки.'
              : 'В мудборде пока нет карточек.'}
          </p>
        </div>
      ) : (
        <>
          <GalleryBoard
            cards={cards}
            scrollRootRef={scrollRootRef}
            loadingMore={loading && hasMore}
            busy={loading}
            onOpenCard={openCard}
            moodboardCardIds={moodboardCardIds}
            onToggleMoodboard={handleToggleMoodboard}
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
      )}

      {openCardId ? (
        <CardInspectModal
          cardId={openCardId}
          tagsIndex={tagsIndex}
          onClose={closeCard}
          onDeleted={() => void loadPage(0, false)}
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

      {noSimilarAlertOpen ? (
        <DemoAlert message="Нет похожих изображений" variant="info" onClose={() => setNoSimilarAlertOpen(false)} />
      ) : null}

      <ScrollToTopButton enabled={cards.length > 0} />
    </div>
  );
}
