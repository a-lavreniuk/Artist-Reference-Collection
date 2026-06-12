import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent
} from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import DemoAlert, { type DemoAlertVariant } from '../layout/DemoAlert';
import { Tooltip } from '../tooltip/Tooltip';
import { TagTooltipBody } from '../tooltip/TagTooltipBody';
import CollapsibleSection from './CollapsibleSection';
import CardInfoModal from './CardInfoModal';
import CardDetailSimilarThumb from './CardDetailSimilarThumb';
import CardDetailTagsModal from './CardDetailTagsModal';
import CardDetailCollectionsModal from './CardDetailCollectionsModal';
import CardDetailCollectionStrip from './CardDetailCollectionStrip';
import ConfirmRemoveFromMoodboardModal from '../moodboard/ConfirmRemoveFromMoodboardModal';
import type { CardRecord, CategoryRecord, TagRecord } from '../../services/db';
import {
  getMoodboardCardIds,
  addCardToMoodboard,
  deleteCard,
  restoreCard,
  permanentDeleteCard,
  addCollection,
  getAllCategories,
  getAllCollections,
  getCardById,
  getCollectionCardCounts,
  getCollectionPreviewSlices,
  listSimilarCards,
  toggleCardInMoodboard,
  isCardOnBoard,
  removeCardFromMoodboard,
  updateCardPayload
} from '../../services/db';
import { parseLibraryScope } from '../../search/libraryScopeUrl';
import { getVideoPlaybackTierFromPath, videoPlaybackDescription } from '../../media/canPlayInBrowser';
import { gallerySkeletonStyle } from './gallerySkeleton';
import { mergeCardsSrcMap, peekCardsSrcMap, preloadDecodedImages, resolveCardDetailPreviewUrls } from './galleryMediaCache';
import { clearCardDetailDraft, readCardDetailDraft } from './cardDetailDraft';
import { readGridSize } from '../../layout/gridSizePreference';
import { extractImagePalette, type PaletteSwatch } from './cardDetailPalette';
import {
  clampCardDetailSettingsWidth,
  readCardDetailSettingsWidth,
  writeCardDetailSettingsWidth
} from './cardDetailSettingsWidth';
import { formatCardCountLabel } from '../../utils/formatCardCountLabel';
import CopyCardSettingsMenu from './CopyCardSettingsMenu';
import {
  buildCardSettingsSnapshot,
  syncCardDetailDraftsFromPatch,
  buildCardSettingsApplyPatch
} from './applyCardSettingsClipboard';
import {
  getCardSettingsClipboard,
  setCardSettingsClipboard,
  subscribeCardSettingsClipboard,
  type CardSettingsFieldSelection
} from './cardSettingsClipboard';

type Props = {
  cardId: string;
  tagsIndex: Map<string, TagRecord>;
  onClose: () => void;
  onDeleted: () => void;
  onOpenCard: (id: string) => void;
  moodboardRemoveConfirm?: 'gallery' | 'moodboard';
};

const DESCRIPTION_SAVE_MS = 600;
const FIELD_SAVE_MS = 600;

function normalizeExternalUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function CardDetailOverlay({
  cardId,
  tagsIndex,
  onClose,
  onDeleted,
  onOpenCard,
  moodboardRemoveConfirm = 'gallery'
}: Props) {
  const [searchParams] = useSearchParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  const inspectVideoRef = useRef<HTMLVideoElement | null>(null);
  const descriptionSaveTimerRef = useRef<number | null>(null);
  const nameSaveTimerRef = useRef<number | null>(null);
  const linkSaveTimerRef = useRef<number | null>(null);
  const copyAlertTimerRef = useRef<number | null>(null);
  const copySettingsAnchorRef = useRef<HTMLButtonElement>(null);
  const splitDragRef = useRef<{ startX: number; startW: number } | null>(null);

  const [card, setCard] = useState<CardRecord | null>(null);
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [categoriesById, setCategoriesById] = useState<Map<string, CategoryRecord>>(new Map());
  const [collectionsById, setCollectionsById] = useState<Map<string, string>>(new Map());
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [collectionPreviews, setCollectionPreviews] = useState<Record<string, CardRecord[]>>({});
  const [similar, setSimilar] = useState<CardRecord[]>([]);
  const [similarSrcMap, setSimilarSrcMap] = useState<Record<string, string>>({});
  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());
  const [inMoodboard, setInMoodboard] = useState(false);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftLink, setDraftLink] = useState('');
  const [description, setDescription] = useState('');
  const [palette, setPalette] = useState<PaletteSwatch[]>([]);
  const [settingsWidth, setSettingsWidth] = useState(readCardDetailSettingsWidth);
  const settingsWidthRef = useRef(settingsWidth);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [collectionsModalOpen, setCollectionsModalOpen] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ message: string; variant: DemoAlertVariant } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyAlertMessage, setCopyAlertMessage] = useState<string | null>(null);
  const [copySettingsMenuOpen, setCopySettingsMenuOpen] = useState(false);
  const hasSettingsClipboard = useSyncExternalStore(
    subscribeCardSettingsClipboard,
    () => getCardSettingsClipboard() !== null,
    () => false
  );
  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(
    null
  );

  const libraryScope = parseLibraryScope(searchParams);
  const inTrash = libraryScope === 'trash';

  const reloadCard = useCallback(async (id: string) => {
    let c = await getCardById(id);
    if (c) {
      const draft = readCardDetailDraft(id);
      const patch: { name?: string; linkUrl?: string } = {};
      if (!c.name?.trim() && draft.name.trim()) patch.name = draft.name.trim();
      if (!c.linkUrl?.trim() && draft.linkUrl.trim()) patch.linkUrl = draft.linkUrl.trim();
      if (patch.name !== undefined || patch.linkUrl !== undefined) {
        await updateCardPayload(id, patch);
        clearCardDetailDraft(id);
        c = (await getCardById(id)) ?? c;
      }
      setDraftName(c.name ?? draft.name ?? '');
      setDraftLink(c.linkUrl ?? draft.linkUrl ?? '');
      setDescription(c.description ?? '');
    } else {
      setDraftName('');
      setDraftLink('');
      setDescription('');
    }
    setCard(c);
    return c;
  }, []);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [
    confirmDelete,
    confirmPermanentDelete,
    busy,
    card,
    similar,
    categoriesById,
    inMoodboard,
    isBookmarkHovered,
    infoOpen,
    actionAlert,
    tagsModalOpen,
    collectionsModalOpen,
    palette,
    settingsWidth,
    thumbSrc,
    draftName,
    draftLink,
    description
  ]);

  useEffect(() => {
    let cancelled = false;
    setCard(null);
    setThumbSrc(null);
    setSrc(null);
    void (async () => {
      const c = await reloadCard(cardId);
      if (cancelled) return;

      if (c && window.arc) {
        let lastThumbHref: string | null = null;
        const gridSize = readGridSize();
        const fullHref = await resolveCardDetailPreviewUrls(c, gridSize, (thumbHref) => {
          lastThumbHref = thumbHref;
          if (!cancelled) setThumbSrc(thumbHref);
        });
        if (cancelled) return;
        if (fullHref && c.type === 'image') {
          await preloadDecodedImages([fullHref], 1);
        }
        if (!cancelled) {
          setSrc(fullHref);
          if (fullHref && fullHref === lastThumbHref) setThumbSrc(null);
        }
      } else if (!cancelled) {
        setThumbSrc(null);
        setSrc(null);
      }

      const cats = await getAllCategories();
      const cm = new Map<string, CategoryRecord>();
      for (const cat of cats) cm.set(cat.id, cat);
      if (!cancelled) setCategoriesById(cm);

      const cols = await getAllCollections();
      const colm = new Map<string, string>();
      for (const col of cols) colm.set(col.id, col.name);
      if (!cancelled) setCollectionsById(colm);

      if (!cancelled) setCollCounts(await getCollectionCardCounts());
      if (!cancelled) setCollectionPreviews(await getCollectionPreviewSlices(3));

      if (!cancelled) setSimilar(await listSimilarCards(cardId, 15));
      if (!cancelled) {
        const moodboardIds = await getMoodboardCardIds();
        setMoodboardCardIds(new Set(moodboardIds));
        setInMoodboard(moodboardIds.includes(cardId));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardId, reloadCard]);

  useEffect(() => {
    if (similar.length === 0) {
      setSimilarSrcMap({});
      return;
    }
    const gridSize = readGridSize();
    const peek = peekCardsSrcMap(similar, gridSize);
    setSimilarSrcMap(peek);
    let cancelled = false;
    void mergeCardsSrcMap(similar, peek, gridSize).then((next) => {
      if (!cancelled) setSimilarSrcMap(next);
    });
    return () => {
      cancelled = true;
    };
  }, [similar]);

  useEffect(() => {
    settingsWidthRef.current = settingsWidth;
  }, [settingsWidth]);

  useEffect(() => {
    if (!src || card?.type !== 'image') {
      setPalette([]);
      return;
    }
    let cancelled = false;
    void extractImagePalette(src)
      .then((rows) => {
        if (!cancelled) setPalette(rows);
      })
      .catch(() => {
        if (!cancelled) setPalette([]);
      });
    return () => {
      cancelled = true;
    };
  }, [src, card?.type, cardId]);

  useEffect(() => {
    document.body.classList.add('arc-card-detail-open');
    return () => {
      document.body.classList.remove('arc-card-detail-open');
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (actionAlert) setActionAlert(null);
      else if (copySettingsMenuOpen) setCopySettingsMenuOpen(false);
      else if (collectionsModalOpen) setCollectionsModalOpen(false);
      else if (tagsModalOpen) setTagsModalOpen(false);
      else if (infoOpen) setInfoOpen(false);
      else if (removeMoodboardConfirm) setRemoveMoodboardConfirm(null);
      else if (confirmPermanentDelete) setConfirmPermanentDelete(false);
      else if (confirmDelete) setConfirmDelete(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    onClose,
    confirmDelete,
    confirmPermanentDelete,
    removeMoodboardConfirm,
    infoOpen,
    actionAlert,
    tagsModalOpen,
    collectionsModalOpen,
    copySettingsMenuOpen
  ]);

  useEffect(() => {
    return () => {
      if (descriptionSaveTimerRef.current) window.clearTimeout(descriptionSaveTimerRef.current);
      if (nameSaveTimerRef.current) window.clearTimeout(nameSaveTimerRef.current);
      if (linkSaveTimerRef.current) window.clearTimeout(linkSaveTimerRef.current);
      if (copyAlertTimerRef.current) window.clearTimeout(copyAlertTimerRef.current);
    };
  }, []);

  const scheduleDescriptionSave = useCallback(
    (next: string) => {
      if (descriptionSaveTimerRef.current) window.clearTimeout(descriptionSaveTimerRef.current);
      descriptionSaveTimerRef.current = window.setTimeout(() => {
        descriptionSaveTimerRef.current = null;
        void updateCardPayload(cardId, { description: next }).then(() => reloadCard(cardId));
      }, DESCRIPTION_SAVE_MS);
    },
    [cardId, reloadCard]
  );

  const scheduleNameSave = useCallback(
    (next: string) => {
      if (nameSaveTimerRef.current) window.clearTimeout(nameSaveTimerRef.current);
      nameSaveTimerRef.current = window.setTimeout(() => {
        nameSaveTimerRef.current = null;
        void updateCardPayload(cardId, { name: next }).then(() => reloadCard(cardId));
      }, FIELD_SAVE_MS);
    },
    [cardId, reloadCard]
  );

  const scheduleLinkSave = useCallback(
    (next: string) => {
      if (linkSaveTimerRef.current) window.clearTimeout(linkSaveTimerRef.current);
      linkSaveTimerRef.current = window.setTimeout(() => {
        linkSaveTimerRef.current = null;
        void updateCardPayload(cardId, { linkUrl: next }).then(() => reloadCard(cardId));
      }, FIELD_SAVE_MS);
    },
    [cardId, reloadCard]
  );

  const clampSettingsWidth = useCallback((px: number) => clampCardDetailSettingsWidth(px), []);

  useEffect(() => {
    const onResize = () => {
      setSettingsWidth((current) => clampCardDetailSettingsWidth(current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const showCopyAlert = useCallback((message: string) => {
    setCopyAlertMessage(message);
    if (copyAlertTimerRef.current) window.clearTimeout(copyAlertTimerRef.current);
    copyAlertTimerRef.current = window.setTimeout(() => {
      setCopyAlertMessage(null);
      copyAlertTimerRef.current = null;
    }, 2400);
  }, []);

  const onSplitPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    splitDragRef.current = { startX: event.clientX, startW: settingsWidth };
  };

  const onSplitPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!splitDragRef.current) return;
    const delta = splitDragRef.current.startX - event.clientX;
    setSettingsWidth(clampSettingsWidth(splitDragRef.current.startW + delta));
  };

  const finishSplitDrag = () => {
    if (!splitDragRef.current) return;
    splitDragRef.current = null;
    writeCardDetailSettingsWidth(settingsWidthRef.current);
  };

  const tagsResolved = useMemo(() => {
    return (
      card?.tagIds
        .map((id) => {
          const t = tagsIndex.get(id);
          if (!t) return null;
          const cat = categoriesById.get(t.categoryId);
          return {
            tag: t,
            colorHex: cat?.colorHex ?? '#989aa4',
            categorySort: cat?.sortIndex ?? Number.MAX_SAFE_INTEGER
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null) ?? []
    );
  }, [card?.tagIds, tagsIndex, categoriesById]);

  const tagsSorted = useMemo(() => {
    return [...tagsResolved].sort((a, b) => {
      if (a.categorySort !== b.categorySort) return a.categorySort - b.categorySort;
      return a.tag.name.localeCompare(b.tag.name, 'ru');
    });
  }, [tagsResolved]);

  const collectionsResolved = useMemo(() => {
    return (
      card?.collectionIds
        .map((id) => ({
          id,
          name: collectionsById.get(id) ?? id,
          count: collCounts[id] ?? 0
        }))
        .filter((x) => x.name && x.count > 0) ?? []
    );
  }, [card?.collectionIds, collectionsById, collCounts]);

  const handleSoftDelete = async () => {
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

  const handleRestore = async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await restoreCard(card.id);
      onDeleted();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await permanentDeleteCard(card.id);
      onDeleted();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleCopySettings = useCallback(
    (fields: CardSettingsFieldSelection) => {
      if (!card) return;
      const values = buildCardSettingsSnapshot(fields, {
        draftName,
        draftLink,
        description,
        card
      });
      setCardSettingsClipboard({ fields, values });
      showCopyAlert('Настройки скопированы');
    },
    [card, draftName, draftLink, description, showCopyAlert]
  );

  const applySettingsClipboard = useCallback(async () => {
    const clipboard = getCardSettingsClipboard();
    if (!card || !clipboard) return;

    if (descriptionSaveTimerRef.current) {
      window.clearTimeout(descriptionSaveTimerRef.current);
      descriptionSaveTimerRef.current = null;
    }
    if (nameSaveTimerRef.current) {
      window.clearTimeout(nameSaveTimerRef.current);
      nameSaveTimerRef.current = null;
    }
    if (linkSaveTimerRef.current) {
      window.clearTimeout(linkSaveTimerRef.current);
      linkSaveTimerRef.current = null;
    }

    const patch = buildCardSettingsApplyPatch(clipboard, {
      validTagIds: new Set(tagsIndex.keys()),
      validCollectionIds: new Set(collectionsById.keys())
    });

    await updateCardPayload(card.id, patch);
    syncCardDetailDraftsFromPatch(patch, {
      setDraftName,
      setDraftLink,
      setDescription
    });

    if (patch.collectionIds !== undefined) {
      setCollectionPreviews(await getCollectionPreviewSlices(3));
      setCollCounts(await getCollectionCardCounts());
    }

    await reloadCard(card.id);
    showCopyAlert('Настройки применены');
  }, [card, tagsIndex, collectionsById, reloadCard, showCopyAlert]);

  const copyId = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.id);
      showCopyAlert('ID карточки скопирован');
    } catch {
      /* clipboard unavailable */
    }
  };

  const openInFolder = () => {
    if (!card?.originalRelativePath || !window.arc) return;
    void window.arc.showItemInFolder(card.originalRelativePath);
  };

  const openDraftLink = () => {
    const url = normalizeExternalUrl(draftLink);
    if (!url) return;
    if (window.arc?.openExternalUrl) {
      void window.arc.openExternalUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const removeTag = async (tagId: string) => {
    if (!card) return;
    const next = card.tagIds.filter((id) => id !== tagId);
    await updateCardPayload(card.id, { tagIds: next });
    await reloadCard(card.id);
  };

  const removeCollection = async (collectionId: string) => {
    if (!card) return;
    const next = card.collectionIds.filter((id) => id !== collectionId);
    await updateCardPayload(card.id, { collectionIds: next });
    setCollectionPreviews(await getCollectionPreviewSlices(3));
    setCollCounts(await getCollectionCardCounts());
    await reloadCard(card.id);
  };

  const toggleTagOnCard = async (tagId: string) => {
    if (!card) return;
    const has = card.tagIds.includes(tagId);
    const next = has ? card.tagIds.filter((id) => id !== tagId) : [...card.tagIds, tagId];
    await updateCardPayload(card.id, { tagIds: next });
    await reloadCard(card.id);
  };

  const applyCollections = async (collectionIds: string[]) => {
    if (!card) return;
    await updateCardPayload(card.id, { collectionIds });
    setCollectionPreviews(await getCollectionPreviewSlices(3));
    setCollCounts(await getCollectionCardCounts());
    await reloadCard(card.id);
  };

  const toggleCollectionOnCard = async (collectionId: string) => {
    if (!card) return;
    const has = card.collectionIds.includes(collectionId);
    const next = has
      ? card.collectionIds.filter((id) => id !== collectionId)
      : [...card.collectionIds, collectionId];
    await updateCardPayload(card.id, { collectionIds: next });
    setCollectionPreviews(await getCollectionPreviewSlices(3));
    setCollCounts(await getCollectionCardCounts());
    await reloadCard(card.id);
  };

  const createAndAssignCollection = async (name: string) => {
    if (!card) return;
    const created = await addCollection(name);
    if (!card.collectionIds.includes(created.id)) {
      await updateCardPayload(card.id, { collectionIds: [...card.collectionIds, created.id] });
      setCollectionPreviews(await getCollectionPreviewSlices(3));
      setCollCounts(await getCollectionCardCounts());
      await reloadCard(card.id);
    }
  };

  const copyPaletteHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      showCopyAlert('Цвет скопирован');
    } catch {
      /* clipboard unavailable */
    }
  };

  const videoTier =
    card?.type === 'video' && card.originalRelativePath
      ? getVideoPlaybackTierFromPath(card.originalRelativePath)
      : null;

  const bookmarkIconClass = isBookmarkHovered
    ? inMoodboard
      ? 'arc-icon-bookmark-minus'
      : 'arc-icon-bookmark-plus'
    : 'arc-icon-bookmark';

  const mainRowStyle = {
    ['--arc-card-detail-settings-w']: `${settingsWidth}px`
  } as CSSProperties;

  const handleSimilarFind = async (targetId: string) => {
    const matches = await listSimilarCards(targetId, 1);
    if (matches.length === 0) {
      setActionAlert({ message: 'Нет похожих изображений', variant: 'info' });
      return;
    }
    onOpenCard(matches[0].id);
  };

  const handleSimilarToggleMoodboard = async (targetId: string) => {
    const ids = await getMoodboardCardIds();
    if (!ids.includes(targetId)) {
      await addCardToMoodboard(targetId);
      setMoodboardCardIds((prev) => new Set(prev).add(targetId));
      if (targetId === cardId) setInMoodboard(true);
      return;
    }
    const onBoard = await isCardOnBoard(targetId);
    if (onBoard) {
      setRemoveMoodboardConfirm({ cardId: targetId, onBoard: true });
      return;
    }
    await removeCardFromMoodboard(targetId);
    setMoodboardCardIds((prev) => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
    if (targetId === cardId) setInMoodboard(false);
  };

  const addRowButton = (label: string, onClick: () => void) => (
    <div className="arc-card-detail-add-row-scope arc-ui-kit-scope" data-btn-size="m">
      <button type="button" className="btn btn-outline btn-ds arc-card-detail-add-row" onClick={onClick}>
        <span className="btn-ds__value">{label}</span>
        <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
      </button>
    </div>
  );

  const overlay = (
    <>
      <div className="arc-card-detail-backdrop" aria-hidden="true" />
      <div
        ref={hostRef}
        className="arc-card-detail-overlay arc-ui-kit-scope"
        data-elevation="sunken"
        data-input-size="l"
        data-btn-size="l"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcCardDetailHeading"
      >
      <h2 id="arcCardDetailHeading" className="sr-only">
        Карточка
      </h2>

      <div className="arc-card-detail-scroll">
        <div
          className={`arc-card-detail-shell${similar.length > 0 ? ' arc-card-detail-shell--has-similar' : ''}`}
        >
        <div className="arc-card-detail-main-row" style={mainRowStyle}>
          <div className="arc-card-detail-preview panel elevation-sunken">
            {card?.type === 'video' && videoTier && videoTier !== 'html5' ? (
              <p className="text-s arc-card-detail-video-note">{videoPlaybackDescription(videoTier)}</p>
            ) : null}
            {src && card?.type === 'video' ? (
              <div className="arc-card-detail-media-fit">
                <video
                  ref={inspectVideoRef}
                  className="arc-card-detail-media"
                  src={src}
                  poster={thumbSrc && thumbSrc !== src ? thumbSrc : undefined}
                  controls
                  preload="metadata"
                  autoPlay
                  muted
                  playsInline
                  onLoadedData={() => {
                    void inspectVideoRef.current?.play().catch(() => undefined);
                  }}
                />
              </div>
            ) : src || thumbSrc ? (
              <div className="arc-card-detail-media-fit">
                <img
                  className="arc-card-detail-media"
                  src={src ?? thumbSrc ?? ''}
                  alt=""
                  draggable={false}
                />
              </div>
            ) : (
              <div
                className="arc-gallery-skeleton arc-card-detail-skeleton"
                style={card ? gallerySkeletonStyle(card) : undefined}
                aria-hidden
              />
            )}
          </div>

          <button
            type="button"
            className="arc-card-detail-splitter"
            aria-label="Изменить ширину панелей"
            onPointerDown={onSplitPointerDown}
            onPointerMove={onSplitPointerMove}
            onPointerUp={finishSplitDrag}
            onPointerCancel={finishSplitDrag}
            onLostPointerCapture={finishSplitDrag}
          />

          <aside className="arc-card-detail-settings panel elevation-sunken">
            <div className="arc-card-detail-options">
              <div className="arc-card-detail-options-left">
                {inTrash ? (
                  <>
                    <Tooltip content="Удалить навсегда" position="top">
                      <button
                        type="button"
                        className="btn btn-outline btn-icon-only btn-ds"
                        aria-label="Удалить навсегда"
                        disabled={busy}
                        onClick={() => setConfirmPermanentDelete(true)}
                      >
                        <span className="btn-icon-only__glyph arc-icon-trash" aria-hidden="true" />
                      </button>
                    </Tooltip>
                    <Tooltip content={busy ? 'Восстановление…' : 'Восстановить'} position="top">
                      <button
                        type="button"
                        className="btn btn-outline btn-icon-only btn-ds"
                        aria-label={busy ? 'Восстановление…' : 'Восстановить'}
                        disabled={busy}
                        onClick={() => void handleRestore()}
                      >
                        <span className="btn-icon-only__glyph arc-icon-undo" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </>
                ) : (
                  <Tooltip content="Удалить карточку" position="top">
                    <button
                      type="button"
                      className="btn btn-outline btn-icon-only btn-ds"
                      aria-label="Удалить карточку"
                      disabled={!card}
                      onClick={() => setConfirmDelete(true)}
                    >
                      <span className="btn-icon-only__glyph arc-icon-trash" aria-hidden="true" />
                    </button>
                  </Tooltip>
                )}
                {!inTrash ? (
                  <div className="arc-card-detail-segmented" role="group" aria-label="Копирование настроек">
                    <Tooltip content="Копировать настройки" position="top">
                      <button
                        ref={copySettingsAnchorRef}
                        type="button"
                        className="btn btn-outline btn-icon-only btn-ds arc-card-detail-segmented-btn"
                        aria-label="Копировать настройки"
                        aria-haspopup="menu"
                        aria-expanded={copySettingsMenuOpen}
                        disabled={!card}
                        onClick={() => setCopySettingsMenuOpen((open) => !open)}
                      >
                        <span className="btn-icon-only__glyph arc-icon-copy-settings" aria-hidden="true" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Применить настройки" position="top">
                      <button
                        type="button"
                        className="btn btn-outline btn-icon-only btn-ds arc-card-detail-segmented-btn"
                        aria-label="Применить настройки"
                        disabled={!card || !hasSettingsClipboard}
                        onClick={() => void applySettingsClipboard()}
                      >
                        <span className="btn-icon-only__glyph arc-icon-paste-settings" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                ) : null}
                <div className="arc-card-detail-segmented" role="group" aria-label="Действия с карточкой">
                  {!inTrash ? (
                    <Tooltip content={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'} position="top">
                      <button
                        type="button"
                        className="btn btn-outline btn-icon-only btn-ds arc-card-detail-segmented-btn"
                        aria-label={inMoodboard ? 'Убрать из мудборда' : 'Добавить в мудборд'}
                        onMouseEnter={() => setIsBookmarkHovered(true)}
                        onMouseLeave={() => setIsBookmarkHovered(false)}
                        onFocus={() => setIsBookmarkHovered(true)}
                        onBlur={() => setIsBookmarkHovered(false)}
                        onClick={async () => {
                          if (!card) return;
                          if (!inMoodboard) {
                            const added = await toggleCardInMoodboard(card.id);
                            setInMoodboard(added);
                            if (added) {
                              setMoodboardCardIds((prev) => new Set(prev).add(card.id));
                            }
                            setActionAlert({ message: 'Карточка добавлена в мудборд', variant: 'success' });
                            return;
                          }
                          const onBoard = await isCardOnBoard(card.id);
                          if (moodboardRemoveConfirm === 'moodboard') {
                            setRemoveMoodboardConfirm({ cardId: card.id, onBoard });
                            return;
                          }
                          if (onBoard) {
                            setRemoveMoodboardConfirm({ cardId: card.id, onBoard: true });
                            return;
                          }
                          await removeCardFromMoodboard(card.id);
                          setInMoodboard(false);
                          setMoodboardCardIds((prev) => {
                            const next = new Set(prev);
                            next.delete(card.id);
                            return next;
                          });
                        }}
                        disabled={!card}
                      >
                        <span className={`btn-icon-only__glyph ${bookmarkIconClass}`} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  ) : null}
                  <Tooltip content="Открыть папку с файлом" position="top">
                    <button
                      type="button"
                      className="btn btn-outline btn-icon-only btn-ds arc-card-detail-segmented-btn"
                      onClick={() => openInFolder()}
                      disabled={!card?.originalRelativePath || !window.arc}
                      aria-label="Открыть папку с файлом"
                    >
                      <span className="btn-icon-only__glyph arc-icon-folder-open" aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Информация о файле" position="top">
                    <button
                      type="button"
                      className="btn btn-outline btn-icon-only btn-ds arc-card-detail-segmented-btn"
                      onClick={() => setInfoOpen(true)}
                      disabled={!card}
                      aria-label="Информация о файле"
                    >
                      <span className="btn-icon-only__glyph arc-icon-pie-chart" aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Скопировать ID" position="top">
                    <button
                      type="button"
                      className="btn btn-outline btn-ds arc-card-detail-id-pill arc-card-detail-segmented-btn"
                      onClick={() => void copyId()}
                      disabled={!card}
                      aria-label="Скопировать ID"
                    >
                      <span className="arc-card-detail-id-text">{card?.id ?? ''}</span>
                      <span className="btn-ds__icon arc-icon-copy" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
              </div>

              <Tooltip content="Закрыть" position="top" className="arc-card-detail-close-slot">
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds arc-card-detail-close-btn"
                  aria-label="Закрыть"
                  onClick={onClose}
                >
                  <span className="btn-icon-only__glyph arc-icon-close" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>

            <div ref={settingsScrollRef} className="arc-card-detail-settings-scroll">
              <CollapsibleSection title="Описание">
                <div
                  className="arc-card-detail-description-fields arc-ui-kit-scope"
                  data-input-size="m"
                  data-btn-size="m"
                >
                  {palette.length > 0 ? (
                    <div className="arc-card-detail-palette">
                      {palette.map((swatch) => (
                        <Tooltip
                          key={swatch.hex}
                          content={`${swatch.hex.toUpperCase()} (${swatch.pct}%)`}
                          position="top"
                        >
                          <button
                            type="button"
                            className="arc-card-detail-palette-swatch"
                            style={{ backgroundColor: swatch.hex }}
                            aria-label={`${swatch.hex}, ${swatch.pct} процентов`}
                            onClick={() => void copyPaletteHex(swatch.hex)}
                          />
                        </Tooltip>
                      ))}
                    </div>
                  ) : null}
                  <label
                    className={`field input-live${draftName.trim() ? ' has-value' : ''}`}
                    data-live-input
                  >
                    <input
                      className="input"
                      type="text"
                      placeholder="Имя"
                      value={draftName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraftName(v);
                        scheduleNameSave(v);
                      }}
                    />
                    <button
                      className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
                      type="button"
                      aria-label="Очистить"
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        setDraftName('');
                        scheduleNameSave('');
                      }}
                    />
                  </label>
                  <div className="arc-card-detail-link-row">
                    <label
                      className={`field input-live arc-card-detail-link-field${draftLink.trim() ? ' has-value' : ''}`}
                      data-live-input
                    >
                      <input
                        className="input"
                        type="text"
                        placeholder="Ссылка"
                        value={draftLink}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraftLink(v);
                          scheduleLinkSave(v);
                        }}
                      />
                      <button
                        className="input-inline-icon input-inline-icon-floating input-clear-btn input-inline-icon--close arc-icon-close"
                        type="button"
                        aria-label="Очистить"
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          setDraftLink('');
                          scheduleLinkSave('');
                        }}
                      />
                    </label>
                    <Tooltip content="Открыть ссылку" position="top">
                      <button
                        type="button"
                        className="btn btn-outline btn-icon-only btn-ds"
                        aria-label="Открыть ссылку"
                        disabled={!normalizeExternalUrl(draftLink)}
                        onClick={openDraftLink}
                      >
                        <span className="btn-icon-only__glyph arc-icon-arrow-up-right" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                  <label className="field">
                    <textarea
                      className="input textarea"
                      placeholder="Описание"
                      rows={4}
                      value={description}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDescription(v);
                        scheduleDescriptionSave(v);
                      }}
                    />
                  </label>
                </div>
              </CollapsibleSection>

              <div className="arc-card-detail-section-sep" role="separator" />

              <CollapsibleSection
                title="Метки"
                count={tagsSorted.length}
                footer={addRowButton('Добавить метку', () => setTagsModalOpen(true))}
              >
                {tagsSorted.length > 0 ? (
                  <div className="arc-card-detail-tags">
                    {tagsSorted.map(({ tag, colorHex }) => {
                      const hasTipText = Boolean(tag.description?.trim());
                      const hasTipImage = Boolean(tag.tooltipImageDataUrl?.startsWith('data:image/'));
                      const canShowTooltip = hasTipText || hasTipImage;

                      const chipButton = (
                        <button
                          type="button"
                          className="arc-card-detail-tag-chip"
                          onClick={() => void removeTag(tag.id)}
                          aria-label={`Снять метку «${tag.name}»`}
                        >
                          <span className="arc-card-detail-tag-dot" style={{ background: colorHex }} aria-hidden="true" />
                          <span className="arc-card-detail-tag-name">{tag.name}</span>
                        </button>
                      );

                      if (!canShowTooltip) {
                        return <Fragment key={tag.id}>{chipButton}</Fragment>;
                      }

                      return (
                        <Tooltip
                          key={tag.id}
                          content={
                            <TagTooltipBody description={tag.description} imageDataUrl={tag.tooltipImageDataUrl} />
                          }
                          delay={1000}
                          position="top"
                          variant="rich"
                        >
                          {chipButton}
                        </Tooltip>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-s arc-card-detail-empty">Меток пока нет</p>
                )}
              </CollapsibleSection>

              <div className="arc-card-detail-section-sep" role="separator" />

              <CollapsibleSection
                title="Коллекции"
                count={collectionsResolved.length}
                footer={addRowButton('Добавить в коллекцию', () => setCollectionsModalOpen(true))}
              >
                {collectionsResolved.length > 0 ? (
                  <ul className="arc-card-detail-collections">
                    {collectionsResolved.map((col) => (
                      <li key={col.id} className="arc-card-detail-collection-row panel elevation-sunken">
                        <CardDetailCollectionStrip
                          collectionId={col.id}
                          previews={collectionPreviews[col.id] ?? []}
                        />
                        <div className="arc-card-detail-collection-main">
                          <p className="text-l arc-card-detail-collection-name">{col.name}</p>
                          <div className="arc-card-detail-collection-meta">
                            <span className="text-s">{formatCardCountLabel(col.count)}</span>
                            <button
                              type="button"
                              className="text-s arc-card-detail-collection-remove"
                              onClick={() => void removeCollection(col.id)}
                            >
                              Снять
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-s arc-card-detail-empty">Коллекций пока нет</p>
                )}
              </CollapsibleSection>
            </div>
          </aside>
        </div>

        {similar.length > 0 ? (
          <section className="arc-card-detail-similar">
            <div className="arc-card-detail-similar-head">
              <p className="text-l">Похожие изображения</p>
              <span className="text-s arc-card-detail-section-count">{similar.length}</span>
            </div>
            <div className="arc-card-similar-masonry">
              {similar.map((sc) => (
                <CardDetailSimilarThumb
                  key={sc.id}
                  card={sc}
                  src={similarSrcMap[sc.id]}
                  onPick={() => onOpenCard(sc.id)}
                  onFindSimilar={(id) => void handleSimilarFind(id)}
                  inMoodboard={moodboardCardIds.has(sc.id)}
                  onToggleMoodboard={inTrash ? undefined : (id) => void handleSimilarToggleMoodboard(id)}
                />
              ))}
            </div>
          </section>
        ) : null}
        </div>
      </div>

      {confirmDelete ? (
        <div
          className="arc-modal-host arc-modal-host--nested arc-modal-host--card-detail-nested"
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
                <p className="arc-modal__slot-text">Карточка переместится в корзину. Её можно будет восстановить позже.</p>
              </div>
            </div>
            <footer className="arc-modal__footer arc-modal__footer--actions-3">
              <button type="button" className="btn btn-danger btn-ds btn-s" onClick={() => void handleSoftDelete()} disabled={busy}>
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

      {confirmPermanentDelete ? (
        <div
          className="arc-modal-host arc-modal-host--nested arc-modal-host--card-detail-nested"
          aria-hidden="false"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmPermanentDelete(false);
          }}
        >
          <section
            className="arc-modal"
            data-elevation="raised"
            data-input-size="s"
            data-btn-size="s"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arcCardPermanentDeleteTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="arc-modal__header arc-modal__header--title">
              <h3 className="arc-modal__title" id="arcCardPermanentDeleteTitle">
                Удалить навсегда?
              </h3>
              <button
                type="button"
                className="arc-modal__close"
                aria-label="Закрыть"
                onClick={() => setConfirmPermanentDelete(false)}
              >
                <span className="tab-icon arc-icon-close" aria-hidden="true" />
              </button>
            </header>
            <div className="arc-modal__body">
              <div className="arc-modal__slot">
                <p className="arc-modal__slot-text">
                  Карточка и все файлы будут удалены без возможности восстановления.
                </p>
              </div>
            </div>
            <footer className="arc-modal__footer arc-modal__footer--actions-3">
              <button
                type="button"
                className="btn btn-danger btn-ds btn-s"
                onClick={() => void handlePermanentDelete()}
                disabled={busy}
              >
                <span className="btn-ds__value">{busy ? 'Удаление…' : 'Удалить навсегда'}</span>
              </button>
              <div className="arc-modal__footer-right">
                <button
                  type="button"
                  className="btn btn-outline btn-ds btn-s"
                  onClick={() => setConfirmPermanentDelete(false)}
                  disabled={busy}
                >
                  <span className="btn-ds__value">Отмена</span>
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {removeMoodboardConfirm ? (
        <ConfirmRemoveFromMoodboardModal
          hostClassName="arc-modal-host--nested arc-modal-host--card-detail-nested"
          cardOnBoard={removeMoodboardConfirm.onBoard}
          onClose={() => setRemoveMoodboardConfirm(null)}
          onConfirm={async () => {
            const targetId = removeMoodboardConfirm.cardId;
            await removeCardFromMoodboard(targetId);
            setMoodboardCardIds((prev) => {
              const next = new Set(prev);
              next.delete(targetId);
              return next;
            });
            if (targetId === cardId) setInMoodboard(false);
          }}
        />
      ) : null}

      {infoOpen && card ? <CardInfoModal card={card} onClose={() => setInfoOpen(false)} /> : null}

      {tagsModalOpen && card ? (
        <CardDetailTagsModal
          selectedTagIds={card.tagIds}
          onClose={() => setTagsModalOpen(false)}
          onToggleTag={(tagId) => void toggleTagOnCard(tagId)}
        />
      ) : null}

      {collectionsModalOpen && card ? (
        <CardDetailCollectionsModal
          selectedCollectionIds={card.collectionIds}
          onClose={() => setCollectionsModalOpen(false)}
          onToggleCollection={(collectionId) => void toggleCollectionOnCard(collectionId)}
          onCreateAndAssign={(name) => createAndAssignCollection(name)}
        />
      ) : null}

      </div>

      {actionAlert ? (
        <DemoAlert
          message={actionAlert.message}
          variant={actionAlert.variant}
          hostClassName="arc-card-detail-alert-host"
          onClose={() => setActionAlert(null)}
        />
      ) : null}

      {!inTrash ? (
        <CopyCardSettingsMenu
          open={copySettingsMenuOpen}
          anchorRef={copySettingsAnchorRef}
          onClose={() => setCopySettingsMenuOpen(false)}
          onCopy={handleCopySettings}
        />
      ) : null}

      {copyAlertMessage ? (
        <DemoAlert
          message={copyAlertMessage}
          variant="success"
          hostClassName="arc-card-detail-alert-host"
          onClose={() => setCopyAlertMessage(null)}
        />
      ) : null}
    </>
  );

  return createPortal(overlay, document.body);
}
