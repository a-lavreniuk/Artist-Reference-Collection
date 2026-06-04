import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import GalleryBoard from '../components/gallery/GalleryBoard';
import CardInspectModal from '../components/gallery/CardInspectModal';
import DemoAlert from '../components/layout/DemoAlert';
import MessageModal from '../components/layout/MessageModal';
import ConfirmRemoveFromMoodboardModal from '../components/moodboard/ConfirmRemoveFromMoodboardModal';
import {
  ARC_CARDS_CHANGED_EVENT,
  getAllCategories,
  getMoodboardCardIds,
  getTagsByCategory,
  isCardOnBoard,
  isLibraryConfigured,
  listCardsPage,
  listSimilarCards,
  removeCardFromMoodboard,
  addCardToMoodboard,
  type CardRecord,
  type TagRecord
} from '../services/db';
import { parseSearchCardId, parseSearchTagIds } from '../search/searchUrl';

const PAGE_INITIAL = 50;
const PAGE_MORE = 25;

function filterFromParams(raw: string | null): 'all' | 'images' | 'videos' {
  if (raw === 'images' || raw === 'videos') return raw;
  return 'all';
}

export default function GalleryPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const filter = filterFromParams(searchParams.get('gf'));
  const selectedTagIds = useMemo(() => parseSearchTagIds(searchParams), [searchParams]);
  const cardIdExact = useMemo(() => parseSearchCardId(searchParams), [searchParams]);
  const hasSearchFilters = selectedTagIds.length > 0 || Boolean(cardIdExact);
  const [ready, setReady] = useState(false);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());
  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());
  const [importModalMessage, setImportModalMessage] = useState<string | null>(null);
  const [noSimilarAlertOpen, setNoSimilarAlertOpen] = useState(false);
  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(null);

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

  const loadPage = useCallback(
    async (start: number, append: boolean) => {
      setLoading(true);
      try {
        const take = start === 0 ? PAGE_INITIAL : PAGE_MORE;
        const chunk = await listCardsPage({
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
    [filter, selectedTagIds, cardIdExact]
  );

  useEffect(() => {
    void (async () => {
      const ok = await isLibraryConfigured();
      setReady(ok);
      if (ok) {
        await loadTagsIndex();
        await loadMoodboard();
        setCards([]);
        setOffset(0);
        setHasMore(true);
        await loadPage(0, false);
      }
    })();
  }, [loadPage, loadTagsIndex, loadMoodboard]);

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
    if (!ready) return;
    setCards([]);
    setOffset(0);
    setHasMore(true);
    void loadPage(0, false);
  }, [filter, selectedTagIds, cardIdExact, ready, loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !ready || !hasMore || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadPage(offset, true);
      },
      { root: null, rootMargin: '200px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ready, hasMore, loading, offset, loadPage]);

  const overlay = useMemo(() => {
    if (!ready) {
      return (
        <div className="arc-page-empty panel elevation-default">
          <p className="typo-p-m">Сначала укажите папку библиотеки в разделе «Хранилище» (меню навбара).</p>
        </div>
      );
    }
    if (cards.length === 0 && !loading) {
      if (hasSearchFilters) {
        return (
          <div className="arc-page-empty panel elevation-default">
            <p className="typo-p-m">Карточки не найдены. Измените фильтры поиска или сбросьте метки.</p>
          </div>
        );
      }
      return (
        <div className="arc-page-empty panel elevation-default">
          <p className="typo-p-m">Карточек пока нет. Добавьте изображения через «Добавить карточки».</p>
        </div>
      );
    }
    return null;
  }, [ready, cards.length, loading, hasSearchFilters]);

  return (
    <div className="arc-gallery-page">
      {overlay}
      {ready && cards.length > 0 ? (
        <>
          <GalleryBoard
            cards={cards}
            onOpenCard={(id) => setOpenCardId(id)}
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
              setOpenCardId(sim[0].id);
            }}
          />
          <div ref={sentinelRef} className="arc-gallery-sentinel" aria-hidden />
          {loading ? <p className="hint arc-gallery-loading">Загрузка…</p> : null}
        </>
      ) : null}

      {openCardId ? (
        <CardInspectModal
          cardId={openCardId}
          tagsIndex={tagsIndex}
          onClose={() => setOpenCardId(null)}
          onDeleted={() => void loadPage(0, false)}
          onOpenCard={(cid) => setOpenCardId(cid)}
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
    </div>
  );
}
