import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import MessageModal from '../layout/MessageModal';
import { Tooltip } from '../tooltip/Tooltip';
import type { CardRecord, CategoryRecord, TagRecord } from '../../services/db';
import {
  getMoodboardCardIds,
  deleteCard,
  getAllCategories,
  getAllCollections,
  getCardById,
  getCollectionCardCounts,
  listSimilarCards,
  toggleCardInMoodboard,
  isCardOnBoard,
  removeCardFromMoodboard
} from '../../services/db';
import ConfirmRemoveFromMoodboardModal from '../moodboard/ConfirmRemoveFromMoodboardModal';
import { ARC_SEARCH_QUERY_CARD, ARC_SEARCH_QUERY_TAG } from '../../search/searchUrl';
import { pushRecentTagId } from '../../search/recentSearchTags';
import { getVideoPlaybackTierFromPath, videoPlaybackDescription } from '../../media/canPlayInBrowser';

type Props = {
  cardId: string;
  tagsIndex: Map<string, TagRecord>;
  onClose: () => void;
  onDeleted: () => void;
  onOpenCard: (id: string) => void;
  /** Снятие с мудборда: из галереи — confirm только если карточка на доске; из раздела мудборд — confirm всегда */
  moodboardRemoveConfirm?: 'gallery' | 'moodboard';
};

function SimilarThumb({
  card,
  onPick
}: {
  card: CardRecord;
  onPick: () => void;
}) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!window.arc) return;
      const rel = card.thumbRelativePath || card.originalRelativePath;
      if (!rel || rel === 'legacy') return;
      const u = await window.arc.toFileUrl(rel);
      if (!cancelled) setHref(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [card]);

  return (
    <button type="button" className="arc-gallery-card-wrap arc-card-similar-tile" onClick={onPick}>
      {href ? (
        <img className="arc-gallery-thumb" src={href} alt="" loading="lazy" decoding="async" />
      ) : (
      <div
        className="arc-gallery-skeleton arc-card-similar-skeleton"
        style={card.dominantColorHex ? { backgroundColor: card.dominantColorHex } : undefined}
        aria-hidden
      />
    )}
    </button>
  );
}

function renderDescriptionWithLinks(value: string): ReactNode {
  const source = value.trim();
  if (!source) return '—';

  const parts = source.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (!/^https?:\/\/[^\s]+$/i.test(part)) {
      return <span key={`text-${index}`}>{part}</span>;
    }
    return (
      <a key={`link-${index}`} href={part} target="_blank" rel="noreferrer noopener" className="arc-card-inspect-desc-link">
        {part}
      </a>
    );
  });
}

export default function CardInspectModal({
  cardId,
  tagsIndex,
  onClose,
  onDeleted,
  onOpenCard,
  moodboardRemoveConfirm = 'gallery'
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef(0);
  const [card, setCard] = useState<CardRecord | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [categoriesById, setCategoriesById] = useState<Map<string, CategoryRecord>>(new Map());
  const [collectionsById, setCollectionsById] = useState<Map<string, string>>(new Map());
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [similar, setSimilar] = useState<CardRecord[]>([]);
  const [inMoodboard, setInMoodboard] = useState(false);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyAlertVisible, setCopyAlertVisible] = useState(false);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);
  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ onBoard: boolean } | null>(null);
  const copyAlertTimerRef = useRef<number | null>(null);
  const inspectVideoRef = useRef<HTMLVideoElement | null>(null);

  useLayoutEffect(() => {
    if (hostRef.current) {
      void hydrateArcNavbarIcons(hostRef.current);
    }
  }, [confirmDelete, busy, card, similar, categoriesById, inMoodboard, isBookmarkHovered]);

  useEffect(() => {
    setCard(null);
    setSrc(null);
    void (async () => {
      const cats = await getAllCategories();
      const cm = new Map<string, CategoryRecord>();
      for (const c of cats) cm.set(c.id, c);
      setCategoriesById(cm);

      const cols = await getAllCollections();
      const colm = new Map<string, string>();
      for (const c of cols) colm.set(c.id, c.name);
      setCollectionsById(colm);

      const counts = await getCollectionCardCounts();
      setCollCounts(counts);

      const c = await getCardById(cardId);
      setCard(c);

      if (c && window.arc) {
        const rel = c.originalRelativePath || c.thumbRelativePath;
        if (rel && rel !== 'legacy') {
          const href = await window.arc.toFileUrl(rel);
          setSrc(href);
        } else {
          setSrc(null);
        }
      } else {
        setSrc(null);
      }

      const sim = await listSimilarCards(cardId, 15);
      setSimilar(sim);

      const moodboardIds = await getMoodboardCardIds();
      setInMoodboard(moodboardIds.includes(cardId));
    })();
  }, [cardId]);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (exportErrorMessage) setExportErrorMessage(null);
        else if (removeMoodboardConfirm) setRemoveMoodboardConfirm(null);
        else if (confirmDelete) setConfirmDelete(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, confirmDelete, exportErrorMessage, removeMoodboardConfirm]);

  const tagsResolved =
    card?.tagIds
      .map((id) => {
        const t = tagsIndex.get(id);
        if (!t) return null;
        const cat = categoriesById.get(t.categoryId);
        return {
          tag: t,
          categoryId: t.categoryId,
          categoryName: cat?.name ?? 'Без категории',
          colorHex: cat?.colorHex ?? '#989aa4',
          categorySort: cat?.sortIndex ?? Number.MAX_SAFE_INTEGER
        };
      })
      .filter(
        (
          x
        ): x is {
          tag: TagRecord;
          categoryId: string;
          categoryName: string;
          colorHex: string;
          categorySort: number;
        } => x !== null
      ) ?? [];

  const tagsSorted = useMemo(() => {
    return [...tagsResolved].sort((a, b) => {
      if (a.categorySort !== b.categorySort) return a.categorySort - b.categorySort;
      return a.tag.name.localeCompare(b.tag.name, 'ru');
    });
  }, [tagsResolved]);

  const collectionsResolved =
    card?.collectionIds
      .map((id) => ({
        id,
        name: collectionsById.get(id) ?? id,
        count: collCounts[id] ?? 0
      }))
      .filter((x) => x.name) ?? [];

  const handleDelete = async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await deleteCard(card.id);
      onDeleted();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const copyId = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.id);
      setCopyAlertVisible(true);
      if (copyAlertTimerRef.current) {
        window.clearTimeout(copyAlertTimerRef.current);
      }
      copyAlertTimerRef.current = window.setTimeout(() => {
        setCopyAlertVisible(false);
        copyAlertTimerRef.current = null;
      }, 2400);
    } catch {
      /* Electron / браузер без доступа к буферу */
    }
  };

  const openInFolder = () => {
    if (!card?.originalRelativePath || !window.arc) return;
    void window.arc.showItemInFolder(card.originalRelativePath);
  };

  const saveMedia = async () => {
    if (!card?.originalRelativePath || !window.arc) return;
    const res = await window.arc.saveMediaToFolder(card.originalRelativePath);
    if (!res.ok && !res.canceled) {
      setExportErrorMessage(res.error || 'Не удалось выгрузить файл');
    }
  };

  const editCard = () => {
    if (!card) return;
    onClose();
    navigate(`/gallery/${card.id}/edit`);
  };

  const searchByTag = (tagId: string) => {
    pushRecentTagId(tagId);
    const n = new URLSearchParams(searchParams);
    n.delete(ARC_SEARCH_QUERY_TAG);
    n.append(ARC_SEARCH_QUERY_TAG, tagId);
    n.delete(ARC_SEARCH_QUERY_CARD);
    onClose();
    navigate(
      { pathname: location.pathname, search: n.toString() ? `?${n.toString()}` : '' },
      { replace: true }
    );
  };

  useEffect(() => {
    const bodyNode = bodyRef.current;
    if (!bodyNode) return;
    const onScroll = () => {
      bodyScrollRef.current = bodyNode.scrollTop;
    };
    bodyNode.addEventListener('scroll', onScroll, { passive: true });
    return () => bodyNode.removeEventListener('scroll', onScroll);
  }, [cardId]);

  useEffect(() => {
    return () => {
      if (copyAlertTimerRef.current) {
        window.clearTimeout(copyAlertTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      const bodyNode = bodyRef.current;
      if (!bodyNode) return;
      bodyNode.scrollTop = bodyScrollRef.current;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const videoTier =
    card?.type === 'video' && card.originalRelativePath
      ? getVideoPlaybackTierFromPath(card.originalRelativePath)
      : null;

  const bookmarkIconClass = isBookmarkHovered
    ? inMoodboard
      ? 'arc-icon-bookmark-minus'
      : 'arc-icon-bookmark-plus'
    : 'arc-icon-bookmark';
  const hasDescription = Boolean(card?.description?.trim());
  const hasCollections = collectionsResolved.length > 0;
  const hasTags = tagsSorted.length > 0;

  return (
    <div
      ref={hostRef}
      className="arc-modal-host arc-modal-host--card-inspect"
      aria-hidden="false"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="arc-modal arc-modal--card-detail"
        data-elevation="raised"
        data-input-size="m"
        data-btn-size="m"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcCardInspectHeading"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-card-inspect-toolbar">
          <h2 id="arcCardInspectHeading" className="sr-only">
            Просмотр карточки
          </h2>
          <div className="arc-card-inspect-toolbar-left">
            <button
              type="button"
              className="btn btn-danger btn-icon-only btn-ds"
              aria-label="Удалить карточку"
              onClick={() => setConfirmDelete(true)}
            >
              <span className="btn-icon-only__glyph arc-icon-trash" aria-hidden="true" />
            </button>
          </div>

          <div className="arc-card-inspect-toolbar-right">
            <div className="arc-card-inspect-segmented" role="group" aria-label="Действия с карточкой">
              <Tooltip content={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'} position="top">
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds arc-card-inspect-segmented-btn"
                  aria-label={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                  onMouseEnter={() => setIsBookmarkHovered(true)}
                  onMouseLeave={() => setIsBookmarkHovered(false)}
                  onFocus={() => setIsBookmarkHovered(true)}
                  onBlur={() => setIsBookmarkHovered(false)}
                  onClick={async () => {
                    if (!card) return;
                    if (!inMoodboard) {
                      const next = await toggleCardInMoodboard(card.id);
                      setInMoodboard(next);
                      return;
                    }
                    const onBoard = await isCardOnBoard(card.id);
                    if (moodboardRemoveConfirm === 'moodboard') {
                      setRemoveMoodboardConfirm({ onBoard });
                      return;
                    }
                    if (onBoard) {
                      setRemoveMoodboardConfirm({ onBoard: true });
                      return;
                    }
                    await removeCardFromMoodboard(card.id);
                    setInMoodboard(false);
                  }}
                  disabled={!card}
                >
                  <span className={`btn-icon-only__glyph ${bookmarkIconClass}`} aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip content="Выгрузить изображение" position="top">
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds arc-card-inspect-segmented-btn"
                  onClick={() => void saveMedia()}
                  disabled={!card?.originalRelativePath || !window.arc}
                  aria-label="Выгрузить изображение"
                >
                  <span className="btn-icon-only__glyph arc-icon-download" aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip content="Показать файл в папке" position="top">
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds arc-card-inspect-segmented-btn"
                  onClick={() => void openInFolder()}
                  disabled={!card?.originalRelativePath || !window.arc}
                  aria-label="Открыть папку с файлом"
                >
                  <span className="btn-icon-only__glyph arc-icon-folder-open" aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip content="Редактировать карточку" position="top">
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds arc-card-inspect-segmented-btn"
                  onClick={() => void editCard()}
                  disabled={!card}
                  aria-label="Редактировать карточку"
                >
                  <span className="btn-icon-only__glyph arc-icon-edit" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>

            <Tooltip content="Скопировать ID" position="top">
              <button
                type="button"
                className="btn btn-outline btn-ds arc-card-inspect-id-pill"
                onClick={() => void copyId()}
                disabled={!card}
                aria-label="Скопировать ID"
              >
                <span className="arc-card-inspect-id-text">{card?.id ?? ''}</span>
                <span className="btn-ds__icon arc-icon-copy" aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        </header>

        <div ref={bodyRef} className="arc-modal__body arc-card-inspect-body">
          <div className="arc-card-inspect-main">
            <div className="arc-card-inspect-preview panel">
              {card?.type === 'video' && videoTier && videoTier !== 'html5' ? (
                <p className="text-s arc-card-inspect-video-note">{videoPlaybackDescription(videoTier)}</p>
              ) : null}
              {src && card?.type === 'video' ? (
                <div className="arc-card-inspect-media-fit">
                  <video
                    ref={inspectVideoRef}
                    className="arc-card-inspect-video"
                    src={src}
                    controls
                    preload="metadata"
                    autoPlay
                    muted
                    playsInline
                    onLoadedData={() => {
                      void inspectVideoRef.current?.play().catch(() => {
                        /* автоплей может быть заблокирован политикой — остаются controls */
                      });
                    }}
                  />
                </div>
              ) : src ? (
                <div className="arc-card-inspect-media-fit">
                  <img className="arc-card-inspect-img" src={src} alt="" />
                </div>
              ) : (
                <div
                  className="arc-gallery-skeleton arc-card-inspect-skeleton"
                  style={card?.dominantColorHex ? { backgroundColor: card.dominantColorHex } : undefined}
                  aria-hidden
                />
              )}
            </div>

            <div className="arc-card-inspect-sidebar">
              <div className="arc-card-inspect-scroll">
                {hasDescription ? (
                  <section className="arc-card-inspect-section">
                    <div className="arc-card-inspect-section-head">
                      <p className="text-l">Описание</p>
                    </div>
                    <p className="text-m arc-card-inspect-description">{renderDescriptionWithLinks(card?.description ?? '')}</p>
                  </section>
                ) : null}

                {hasDescription && (hasCollections || hasTags) ? <div className="arc-card-inspect-sep" role="separator" /> : null}

                {hasCollections ? (
                  <section className="arc-card-inspect-section">
                    <div className="arc-card-inspect-section-head">
                      <p className="text-l">Коллекции</p>
                      <span className="text-s arc-card-inspect-count">{collectionsResolved.length}</span>
                    </div>
                    <div className="arc-card-meta-chips">
                      {collectionsResolved.map((col) => (
                        <button
                          key={col.id}
                          type="button"
                          className="arc-card-meta-chip arc-card-meta-chip--neutral arc-card-meta-chip-btn"
                          onClick={() => {
                            onClose();
                            navigate(`/collections/${col.id}`);
                          }}
                        >
                          <span className="arc-card-meta-chip-name">{col.name}</span>
                          <span className="arc-card-meta-chip-count">{col.count}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {hasCollections && hasTags ? <div className="arc-card-inspect-sep" role="separator" /> : null}

                {hasTags ? (
                  <section className="arc-card-inspect-section">
                    <div className="arc-card-inspect-section-head">
                      <p className="text-l">Метки</p>
                      <span className="text-s arc-card-inspect-count">{tagsSorted.length}</span>
                    </div>
                    <div className="arc-card-meta-chips arc-card-meta-chips--tags">
                      {tagsSorted.map(({ tag, colorHex }) => (
                        <button
                          key={tag.id}
                          type="button"
                          className="arc-card-meta-chip arc-card-meta-chip--tag arc-card-meta-chip-btn"
                          onClick={() => searchByTag(tag.id)}
                          aria-label={`Искать по метке «${tag.name}»`}
                        >
                          <span className="arc-card-meta-chip-dot" style={{ background: colorHex }} aria-hidden="true" />
                          <span className="arc-card-meta-chip-name">{tag.name}</span>
                          <span className="arc-card-meta-chip-count">{tag.usageCount}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>

          {similar.length > 0 ? (
            <>
              <div className="arc-card-inspect-sep arc-card-inspect-sep--full-bleed" role="separator" />
              <section className="arc-card-inspect-similar-block">
                <div className="arc-card-inspect-section-head">
                  <p className="text-l">Похожие изображения</p>
                  <span className="text-s arc-card-inspect-count">{similar.length}</span>
                </div>
                <div className="arc-card-similar-masonry">
                  {similar.map((sc) => (
                    <SimilarThumb key={sc.id} card={sc} onPick={() => onOpenCard(sc.id)} />
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>

      {confirmDelete ? (
        <div
          className="arc-modal-host arc-modal-host--nested"
          aria-hidden="false"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmDelete(false);
          }}
        >
          <section
            className="arc-modal"
            data-elevation="raised"
            data-input-size="s"
            data-btn-size="s"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arcCardDeleteTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="arc-modal__header arc-modal__header--title">
              <h3 className="arc-modal__title" id="arcCardDeleteTitle">
                Удалить карточку?
              </h3>
              <button
                type="button"
                className="arc-modal__close"
                aria-label="Закрыть"
                onClick={() => setConfirmDelete(false)}
              >
                <span className="tab-icon arc-icon-close" aria-hidden="true" />
              </button>
            </header>
            <div className="arc-modal__body">
              <div className="arc-modal__slot">
                <p className="arc-modal__slot-text">Файл будет удалён из библиотеки. Это действие нельзя отменить.</p>
              </div>
            </div>
            <footer className="arc-modal__footer arc-modal__footer--actions-3">
              <button type="button" className="btn btn-danger btn-ds btn-s" onClick={() => void handleDelete()} disabled={busy}>
                <span className="btn-ds__value">{busy ? 'Удаление…' : 'Удалить'}</span>
              </button>
              <div className="arc-modal__footer-right">
                <button
                  type="button"
                  className="btn btn-outline btn-ds btn-s"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                >
                  <span className="btn-ds__value">Отмена</span>
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {removeMoodboardConfirm && card ? (
        <ConfirmRemoveFromMoodboardModal
          hostClassName="arc-modal-host--nested"
          cardOnBoard={removeMoodboardConfirm.onBoard}
          onClose={() => setRemoveMoodboardConfirm(null)}
          onConfirm={async () => {
            await removeCardFromMoodboard(card.id);
            setInMoodboard(false);
          }}
        />
      ) : null}

      {copyAlertVisible ? (
        <div className="demo-alert-host" aria-live="polite" aria-atomic="true">
          <div className="alert alert-success" role="status">
            <p className="demo-alert__message">ID карточки скопирован</p>
            <button
              type="button"
              className="demo-alert__close"
              aria-label="Закрыть уведомление"
              onClick={() => setCopyAlertVisible(false)}
            >
              <svg className="demo-alert__close-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6L18 18" strokeWidth="2" strokeLinecap="round" />
                <path d="M18 6L6 18" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {exportErrorMessage ? (
        <MessageModal
          hostClassName="arc-modal-host--nested"
          title="Не удалось выгрузить файл"
          message={exportErrorMessage}
          onClose={() => setExportErrorMessage(null)}
        />
      ) : null}
    </div>
  );
}
