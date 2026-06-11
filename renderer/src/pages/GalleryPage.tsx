import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';

import GalleryBoard from '../components/gallery/GalleryBoard';

import { useGalleryFeed } from '../components/gallery/useGalleryFeed';

import type { GalleryFeedQuery } from '../components/gallery/galleryQuery';

import CardInspectModal from '../components/gallery/CardInspectModal';

import DemoAlert from '../components/layout/DemoAlert';
import ScrollToTopButton from '../components/layout/ScrollToTopButton';

import MessageModal from '../components/layout/MessageModal';

import ConfirmRemoveFromMoodboardModal from '../components/moodboard/ConfirmRemoveFromMoodboardModal';

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

import { parseSearchCardId, parseSearchTagIds } from '../search/searchUrl';

import ConfirmModal from './settings/ConfirmModal';

import { emptyTrash } from '../services/db';



function filterFromParams(raw: string | null): GalleryFeedQuery['filter'] {

  if (raw === 'images' || raw === 'videos') return raw;

  return 'all';

}



export default function GalleryPage() {

  const [searchParams] = useSearchParams();

  const location = useLocation();

  const navigate = useNavigate();

  const feedQuery = useMemo<GalleryFeedQuery>(

    () => ({

      filter: filterFromParams(searchParams.get('gf')),

      libraryScope: parseLibraryScope(searchParams),

      selectedTagIds: parseSearchTagIds(searchParams),

      cardIdExact: parseSearchCardId(searchParams)

    }),

    [searchParams]

  );

  const hasSearchFilters = feedQuery.selectedTagIds.length > 0 || Boolean(feedQuery.cardIdExact);

  const [ready, setReady] = useState(false);

  const { openCardId, openCard, closeCard } = useOpenCardUrl();

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [tagsIndex, setTagsIndex] = useState<Map<string, TagRecord>>(new Map());

  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());

  const [importModalMessage, setImportModalMessage] = useState<string | null>(null);

  const [noSimilarAlertOpen, setNoSimilarAlertOpen] = useState(false);

  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(null);

  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);

  const [emptyTrashBusy, setEmptyTrashBusy] = useState(false);



  const { cards, srcMap, hasMore, loading, booting, loadMore, reloadFromStart } = useGalleryFeed(

    feedQuery,

    ready

  );



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

    const el = sentinelRef.current;
    const root = el?.closest('.arc-app-outlet');

    if (!el || !(root instanceof HTMLElement) || !ready || !hasMore || loading || booting) return;

    const io = new IntersectionObserver(

      (entries) => {

        const hit = entries.some((e) => e.isIntersecting);

        if (hit) void loadMore();

      },

      { root, rootMargin: '200px', threshold: 0 }

    );

    io.observe(el);

    return () => io.disconnect();

  }, [ready, hasMore, loading, booting, loadMore]);



  const overlay = useMemo(() => {

    if (!ready) {

      return (

        <div className="arc-page-empty panel elevation-default">

          <p className="typo-p-m">Сначала укажите папку библиотеки в разделе «Хранилище» (меню навбара).</p>

        </div>

      );

    }

    if (booting) return null;

    if (cards.length === 0 && !loading) {

      if (hasSearchFilters) {

        return (

          <div className="arc-page-empty panel elevation-default">

            <p className="typo-p-m">Карточки не найдены. Измените фильтры поиска или сбросьте метки.</p>

          </div>

        );

      }

      if (feedQuery.libraryScope === 'untagged') {

        return (

          <div className="arc-page-empty panel elevation-default">

            <p className="typo-p-m">Нет карточек без меток.</p>

          </div>

        );

      }

      if (feedQuery.libraryScope === 'trash') {

        return (

          <div className="arc-page-empty panel elevation-default">

            <p className="typo-p-m">Корзина пуста.</p>

          </div>

        );

      }

      return (

        <div className="arc-page-empty panel elevation-default">

          <p className="typo-p-m">Карточек пока нет. Добавьте изображения кнопкой «Добавить» или перетащите файлы в окно.</p>

        </div>

      );

    }

    return null;

  }, [ready, booting, cards.length, loading, hasSearchFilters, feedQuery.libraryScope]);



  return (

    <div className="arc-gallery-page">

      {feedQuery.libraryScope === 'trash' && ready ? (

        <div className="arc-gallery-trash-actions">

          <button

            type="button"

            className="btn btn-danger btn-ds btn-s"

            disabled={cards.length === 0}

            onClick={() => setEmptyTrashConfirm(true)}

          >

            <span className="btn-ds__value">Очистить корзину</span>

          </button>

        </div>

      ) : null}

      {booting ? (

        <div className="arc-gallery-boot panel elevation-default" role="status" aria-live="polite">

          <span className="loader" aria-hidden="true" />

        </div>

      ) : null}

      {overlay}

      {ready && cards.length > 0 ? (

        <>

          <GalleryBoard

            cards={cards}

            srcMap={srcMap}

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



      {emptyTrashConfirm ? (

        <ConfirmModal

          title="Очистить корзину?"

          message="Все карточки в корзине будут удалены навсегда вместе с файлами."

          confirmLabel={emptyTrashBusy ? 'Удаление…' : 'Очистить'}

          confirmVariant="danger"

          onCancel={() => {

            if (!emptyTrashBusy) setEmptyTrashConfirm(false);

          }}

          onConfirm={() => {

            if (emptyTrashBusy) return;

            setEmptyTrashBusy(true);

            void (async () => {

              try {

                await emptyTrash();

                setEmptyTrashConfirm(false);

                await reloadFromStart();

              } finally {

                setEmptyTrashBusy(false);

              }

            })();

          }}

        />

      ) : null}

      <ScrollToTopButton enabled={ready && cards.length > 0} />

    </div>

  );

}

