import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useOpenCardUrl } from '../search/openCardUrl';
import { parseSearchCardId, parseSearchTagIds } from '../search/searchUrl';
import GalleryBoard from '../components/gallery/GalleryBoard';
import CardInspectModal from '../components/gallery/CardInspectModal';
import DemoAlert from '../components/layout/DemoAlert';
import ScrollToTopButton from '../components/layout/ScrollToTopButton';
import ConfirmRemoveFromMoodboardModal from '../components/moodboard/ConfirmRemoveFromMoodboardModal';
import {
  ARC_CARDS_CHANGED_EVENT,
  getAllCategories,
  getTagsByCategory,
  getMoodboardCardIds,
  isCardOnBoard,
  listCardsInCollection,
  listSimilarCards,
  addCardToMoodboard,
  removeCardFromMoodboard,
  type CardRecord,
  type TagRecord
} from '../services/db';

const PAGE_INITIAL = 50;
const PAGE_MORE = 25;

function filterFromParams(raw: string | null): 'all' | 'images' | 'videos' {
  if (raw === 'images' || raw === 'videos') return raw;
  return 'all';
}

export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [searchParams] = useSearchParams();
  const filter = filterFromParams(searchParams.get('gf'));
  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdExact = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const hasSearchFilters = selectedTagIds.length > 0 || Boolean(cardIdExact);

  const [cards, setCards] = useState<CardRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const { openCardId, openCard, closeCard } = useOpenCardUrl();
  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());
  const [noSimilarAlertOpen, setNoSimilarAlertOpen] = useState(false);
  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());
  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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

  const loadPage = useCallback(
    async (start: number, append: boolean) => {
      if (!collectionId) return;
      setLoading(true);
      try {
        const take = start === 0 ? PAGE_INITIAL : PAGE_MORE;
        const chunk = await listCardsInCollection(collectionId, {
          offset: start,
          limit: take,
          filter,
          selectedTagIds,
          cardIdExact
        });
        setHasMore(chunk.length === take);
        setOffset(start + chunk.length);
        setCards((prev) => (append ? [...prev, ...chunk] : chunk));
      } finally {
        setLoading(false);
      }
    },
    [collectionId, filter, selectedTagIds, cardIdExact]
  );

  useEffect(() => {
    void loadTagsIndex();
    void loadMoodboard();
  }, [loadTagsIndex, loadMoodboard]);

  useEffect(() => {
    if (!collectionId) return;
    setCards([]);
    setOffset(0);
    setHasMore(true);
    void loadPage(0, false);
  }, [collectionId, filter, selectedTagIds, cardIdExact, loadPage]);

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
    const el = sentinelRef.current;
    if (!el || !collectionId || !hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadPage(offset, true);
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [collectionId, hasMore, loading, offset, loadPage]);

  if (!collectionId) {
    return null;
  }

  return (
    <div className="arc-collection-detail">
      {cards.length === 0 && !loading ? (
        <div className="arc-page-empty panel elevation-default">
          <p className="typo-p-m">
            {hasSearchFilters
              ? 'Карточки не найдены. Измените фильтры поиска или сбросьте метки.'
              : 'В коллекции пока нет карточек.'}
          </p>
        </div>
      ) : (
        <>
          <GalleryBoard
            cards={cards}
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
          {loading ? <p className="hint arc-gallery-loading">Загрузка…</p> : null}
        </>
      )}

      {openCardId ? (
        <CardInspectModal
          cardId={openCardId}
          tagsIndex={tagsIndex}
          onClose={closeCard}
          onDeleted={() => void loadPage(0, false)}
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
    </div>
  );
}
