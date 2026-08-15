import {
  Fragment,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { Loader } from '../loader';
import ToastAlert, { type ToastAlertVariant } from '../alert/ToastAlert';
import { Tooltip } from '../tooltip/Tooltip';
import { TagTooltipBody } from '../tooltip/TagTooltipBody';
import CollapsibleSection from './CollapsibleSection';
import CardRatingStars from './CardRatingStars';
import { useCardRatingShortcuts } from './useCardRatingShortcuts';
import CardDetailImageViewport from './CardDetailImageViewport';
import type { CardDetailImageChrome } from './CardDetailImageViewport';
import CardDetailPreviewOptionsBar from './CardDetailPreviewOptionsBar';
import CardDetailPreviewQueue, { peekQueueThumbSrcMap } from './CardDetailPreviewQueue';
import { loadCardsInOrder } from './cardDetailQueueCards';
import { getDetailQueueOpen, setDetailQueueOpen } from './cardDetailPreviewQueueSession';
import CardInfoModal from './CardInfoModal';
import RestoreTrashDestinationModal from './RestoreTrashDestinationModal';
import { useLibraries } from '../../hooks/useLibraries';
import CardDetailVideoPlayer from './CardDetailVideoPlayer';
import type { CardDetailVideoPlayerHandle } from './cardDetailVideoPlayerTypes';
import { useCardDetailVideoShortcuts } from './useCardDetailVideoShortcuts';
import SimilarCardsMasonry from './SimilarCardsMasonry';
import { useGalleryCardContextMenu } from './useGalleryCardContextMenu';
import CardDetailTagsModal from './CardDetailTagsModal';
import CardDetailCollectionsModal from './CardDetailCollectionsModal';
import CardDetailCollectionStrip from './CardDetailCollectionStrip';
import ConfirmRemoveFromMoodboardModal from '../moodboard/ConfirmRemoveFromMoodboardModal';
import { clampCardRating } from '@arc-main-shared/cardRating';
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
  isCardOnBoard,
  removeCardFromMoodboard,
  updateCardPayload
} from '../../services/db';
import {
  formatCollectionAddToast,
  formatCollectionRemoveToast,
  formatMoodboardAddToast,
  formatMoodboardRemoveToast
} from './gallerySelectionCopy';
import {
  notifyGalleryMutation,
  notifyPermanentDelete,
  notifyRestoreWithUndo,
  notifyTrashWithUndo,
  undoCollectionAdd,
  undoCollectionRemove,
  undoMoodboardAdd,
  undoMoodboardRemove
} from './galleryUndoToast';
import { getDeleteCardsUseTrash } from '../../import/importDefaults';
import { parseLibraryScope } from '../../search/libraryScopeUrl';
import { startFindSimilarSearch } from '../../search/startVisualSimilarSearch';
import { startColorSearch } from '../../search/startColorSearch';
import { startTagSearch } from '../../search/startTagSearch';
import { pushRecentViewedCardId, RECENT_VIEWED_MIN_MS } from '../../search/recentViewedCards';
import { gallerySkeletonStyle } from './gallerySkeleton';
import {
  arcMotionTokens,
  ensureGsapSetup,
  getPrefersReducedMotion,
  motionDuration,
  useOverlayMotionPair
} from '../../motion';
import {
  mergeCardsSrcMap,
  peekCardsSrcMap,
  peekPreloadedCardDetailOriginal,
  preloadCardDetailOriginals,
  resolveCardDetailPreviewUrls,
  resolveCardsSrcMap
} from './galleryMediaCache';
import { ARC_THUMB_BUDGET_CHANGED_EVENT } from './galleryThumbBudget';
import { clearCardDetailDraft, readCardDetailDraft } from './cardDetailDraft';
import { readGridSize } from '../../layout/gridSizePreference';
import { loadCardDetailPalette, type PaletteSwatch } from './cardDetailPalette';
import {
  CARD_DETAIL_SETTINGS_WIDTH_MIN,
  clampCardDetailSettingsWidth,
  readCardDetailSettingsWidth,
  writeCardDetailSettingsWidth
} from './cardDetailSettingsWidth';
import { measureCardDetailToolbarMinWidth } from './measureCardDetailToolbarMinWidth';
import { getAppPreferences } from '../../services/appPreferences';
import { formatCardCountLabel } from '../../utils/formatCardCountLabel';
import CopyCardSettingsMenu from './CopyCardSettingsMenu';
import {
  buildCardSettingsSnapshot,
  syncCardDetailDraftsFromPatch,
  buildCardSettingsApplyPatch
} from './applyCardSettingsClipboard';
import {
  getCardSettingsClipboard,
  getLastCardSettingsFieldSelection,
  setCardSettingsClipboard,
  subscribeCardSettingsClipboard,
  type CardSettingsFieldSelection
} from './cardSettingsClipboard';
import { matchesShortcut } from '../../shortcuts/matchShortcutEvent';
import { isEditableTarget } from '../../shortcuts/shortcutGuards';
import {
  collectDetailPrefetchCardIds,
  resolveCardFeedNeighbors,
  shouldShowDetailNavButtons,
  type CardFeedNeighbors
} from './cardFeedNeighbors';
import { getShortcutById } from '../../shortcuts/shortcutRegistry';
import { shortcutMenuLabel } from '../../shortcuts/shortcutLabels';
import { openCardsInNewWindow, type CardViewerOpenContext } from '../../card-viewer/openCardsInNewWindow';

type Props = {
  cardId: string;
  tagsIndex: Map<string, TagRecord>;
  onClose: () => void;
  onDeleted: () => void;
  onOpenCard: (id: string) => void;
  moodboardRemoveConfirm?: 'gallery' | 'moodboard';
  neighborCardIds?: CardFeedNeighbors;
  viewerNavigationCardIds?: readonly string[];
  viewerOpenContext?: CardViewerOpenContext;
  previewQueueCardIds?: readonly string[];
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
  cardId: urlCardId,
  tagsIndex,
  onClose,
  onDeleted,
  onOpenCard,
  moodboardRemoveConfirm = 'gallery',
  neighborCardIds: neighborCardIdsFromUrl,
  viewerNavigationCardIds,
  viewerOpenContext,
  previewQueueCardIds
}: Props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  const optionsLeftRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<CardDetailVideoPlayerHandle | null>(null);
  const descriptionSaveTimerRef = useRef<number | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionFitLockRef = useRef(false);
  const nameSaveTimerRef = useRef<number | null>(null);
  const linkSaveTimerRef = useRef<number | null>(null);
  const copyAlertTimerRef = useRef<number | null>(null);
  const copySettingsAnchorRef = useRef<HTMLButtonElement>(null);
  const splitDragRef = useRef<{ startX: number; startW: number } | null>(null);

  const [card, setCard] = useState<CardRecord | null>(null);
  const cardRef = useRef<CardRecord | null>(null);
  const cardCacheRef = useRef<Map<string, CardRecord>>(new Map());
  const tagPatchQueueRef = useRef<Promise<void>>(Promise.resolve());
  const collectionPatchQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [categoriesById, setCategoriesById] = useState<Map<string, CategoryRecord>>(new Map());
  const [collectionsById, setCollectionsById] = useState<Map<string, string>>(new Map());
  const [collCounts, setCollCounts] = useState<Record<string, number>>({});
  const [collectionPreviews, setCollectionPreviews] = useState<Record<string, CardRecord[]>>({});
  const [similar, setSimilar] = useState<CardRecord[]>([]);
  const [similarSrcMap, setSimilarSrcMap] = useState<Record<string, string>>({});
  const [thumbBudgetEpoch, setThumbBudgetEpoch] = useState(0);
  const [moodboardCardIds, setMoodboardCardIds] = useState<Set<string>>(new Set());
  const [inMoodboard, setInMoodboard] = useState(false);
  const [isBookmarkHovered, setIsBookmarkHovered] = useState(false);

  const [draftName, setDraftName] = useState('');
  const [draftLink, setDraftLink] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState(0);
  const [palette, setPalette] = useState<PaletteSwatch[]>([]);
  const [settingsWidth, setSettingsWidth] = useState(readCardDetailSettingsWidth);
  const [settingsMinWidth, setSettingsMinWidth] = useState(CARD_DETAIL_SETTINGS_WIDTH_MIN);
  const settingsWidthRef = useRef(settingsWidth);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [restoreDestinationOpen, setRestoreDestinationOpen] = useState(false);
  const [confirmOverwriteDescription, setConfirmOverwriteDescription] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [suggestTagsBusy, setSuggestTagsBusy] = useState(false);
  const [generateDescriptionBusy, setGenerateDescriptionBusy] = useState(false);
  const [autoTagEnabled, setAutoTagEnabled] = useState(false);
  const [aiCaptionEnabled, setAiCaptionEnabled] = useState(false);
  const [pendingTagSearchIds, setPendingTagSearchIds] = useState<string[]>([]);
  const pendingTagSearchIdsRef = useRef<string[]>([]);
  pendingTagSearchIdsRef.current = pendingTagSearchIds;
  const [collectionsModalOpen, setCollectionsModalOpen] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ message: string; variant: ToastAlertVariant } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyAlertMessage, setCopyAlertMessage] = useState<string | null>(null);
  const [copySettingsMenuOpen, setCopySettingsMenuOpen] = useState(false);
  const [videoLoop, setVideoLoop] = useState(false);
  const [queueOpen, setQueueOpen] = useState(getDetailQueueOpen);
  const [imageChrome, setImageChrome] = useState<CardDetailImageChrome | null>(null);
  const [queueCards, setQueueCards] = useState<CardRecord[]>([]);
  const [queueSrcMap, setQueueSrcMap] = useState<Record<string, string>>({});
  const hasSettingsClipboard = useSyncExternalStore(
    subscribeCardSettingsClipboard,
    () => getCardSettingsClipboard() !== null,
    () => false
  );
  const [removeMoodboardConfirm, setRemoveMoodboardConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(
    null
  );
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => setClosing(true), []);
  const { panelRef, backdropRef, render } = useOverlayMotionPair(!closing, {
    preset: 'fade-slide-up',
    backdropPreset: 'fade-scale',
    onExitComplete: onClose
  });

  const libraryScope = parseLibraryScope(searchParams);
  const inTrash = libraryScope === 'trash';
  const { libraries } = useLibraries();
  const originLibraryMissing = Boolean(
    card?.libraryId && !libraries.some((lib) => lib.id === card.libraryId)
  );
  const cardIdRef = useRef(urlCardId);
  const [viewingCardId, setViewingCardId] = useState(urlCardId);
  const [seenUrlCardId, setSeenUrlCardId] = useState(urlCardId);
  if (urlCardId !== seenUrlCardId) {
    setSeenUrlCardId(urlCardId);
    setViewingCardId(urlCardId);
  }
  const cardId = urlCardId !== seenUrlCardId ? urlCardId : viewingCardId;
  cardIdRef.current = cardId;
  const canGenerateDescription =
    aiCaptionEnabled && (card?.type === 'image' || card?.type === 'video');

  const reloadCard = useCallback(async (id: string) => {
    const scopedLibraryId = cardRef.current?.id === id ? cardRef.current.libraryId : undefined;
    let c = await getCardById(id, scopedLibraryId);
    if (c) {
      const draft = readCardDetailDraft(id);
      const patch: { name?: string; linkUrl?: string } = {};
      if (!c.name?.trim() && draft.name.trim()) patch.name = draft.name.trim();
      if (!c.linkUrl?.trim() && draft.linkUrl.trim()) patch.linkUrl = draft.linkUrl.trim();
      if (patch.name !== undefined || patch.linkUrl !== undefined) {
        await updateCardPayload(id, patch);
        clearCardDetailDraft(id);
        c = (await getCardById(id, scopedLibraryId)) ?? c;
      }
      setDraftName(c.name ?? draft.name ?? '');
      setDraftLink(c.linkUrl ?? draft.linkUrl ?? '');
      setDescription(c.description ?? '');
      setRating(clampCardRating(c.rating));
      cardCacheRef.current.set(c.id, c);
    } else {
      setDraftName('');
      setDraftLink('');
      setDescription('');
      setRating(0);
    }
    setCard(c);
    return c;
  }, []);

  const applyInstantCardPreview = useCallback((c: CardRecord) => {
    const draft = readCardDetailDraft(c.id);
    setDraftName(c.name ?? draft.name ?? '');
    setDraftLink(c.linkUrl ?? draft.linkUrl ?? '');
    setDescription(c.description ?? '');
    setRating(clampCardRating(c.rating));
    setCard(c);
    cardRef.current = c;
    const gridSize = readGridSize();
    if (c.type === 'video') {
      void resolveCardDetailPreviewUrls(c, gridSize, () => undefined).then((href) => {
        if (cardIdRef.current === c.id && href) {
          setSrc(href);
          setThumbSrc(null);
        }
      });
      return;
    }
    const prefetched = peekPreloadedCardDetailOriginal(c.id);
    if (prefetched) {
      setThumbSrc(null);
      setSrc(prefetched);
      return;
    }
    const thumb = peekCardsSrcMap([c], gridSize)[c.id];
    if (thumb) {
      setThumbSrc(thumb);
      setSrc(thumb);
    }
  }, []);

  const openViewingCard = useCallback(
    (id: string) => {
      if (!id || id === cardIdRef.current) return;
      cardIdRef.current = id;
      setViewingCardId(id);
      const cached = cardCacheRef.current.get(id);
      if (cached) applyInstantCardPreview(cached);
      startTransition(() => {
        onOpenCard(id);
      });
    },
    [applyInstantCardPreview, onOpenCard]
  );

  const refreshAiCaption = useCallback(async (id: string) => {
    const c = await getCardById(id);
    if (!c) return null;
    setCard((prev) => (prev?.id === id ? { ...prev, aiCaption: c.aiCaption } : prev));
    return c;
  }, []);

  useEffect(() => {
    setPendingTagSearchIds([]);
    setConfirmOverwriteDescription(false);
    setGenerateDescriptionBusy(false);
  }, [cardId]);

  useLayoutEffect(() => {
    if (card?.type !== 'image') {
      setImageChrome(null);
      return;
    }
    setImageChrome((prev) =>
      prev
        ? {
            ...prev,
            displayScalePct: 100,
            isFitActive: true,
            isActualActive: false
          }
        : prev
    );
  }, [card?.id, card?.type]);

  const canShowQueue = Boolean(previewQueueCardIds && previewQueueCardIds.length > 0);
  const queueVisible = canShowQueue && queueOpen;
  const feedIdsForNav =
    previewQueueCardIds && previewQueueCardIds.length > 0
      ? previewQueueCardIds
      : viewerNavigationCardIds;
  const neighborCardIds = useMemo(() => {
    if (feedIdsForNav && feedIdsForNav.length > 0 && feedIdsForNav.includes(cardId)) {
      return resolveCardFeedNeighbors(cardId, feedIdsForNav);
    }
    return neighborCardIdsFromUrl;
  }, [cardId, feedIdsForNav, neighborCardIdsFromUrl]);
  const showNavButtons = shouldShowDetailNavButtons(neighborCardIds);
  const prevShortcut = getShortcutById('detail.previous');
  const nextShortcut = getShortcutById('detail.next');
  const prevNavLabel = prevShortcut?.label ?? 'Предыдущая карточка';
  const nextNavLabel = nextShortcut?.label ?? 'Следующая карточка';
  const prevNavHint = `${prevNavLabel} (${shortcutMenuLabel('detail.previous')})`;
  const nextNavHint = `${nextNavLabel} (${shortcutMenuLabel('detail.next')})`;

  useEffect(() => {
    if (!canShowQueue || !previewQueueCardIds?.length) {
      setQueueCards([]);
      setQueueSrcMap({});
      return;
    }
    let cancelled = false;
    void loadCardsInOrder(previewQueueCardIds).then((rows) => {
      if (cancelled) return;
      for (const row of rows) cardCacheRef.current.set(row.id, row);
      setQueueCards(rows);
      const peek = peekQueueThumbSrcMap(rows);
      setQueueSrcMap(peek);
      void resolveCardsSrcMap(rows, 's').then((next) => {
        if (!cancelled) setQueueSrcMap((prev) => ({ ...prev, ...next }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [canShowQueue, previewQueueCardIds]);

  const toggleQueueOpen = useCallback(() => {
    setQueueOpen((prev) => {
      const next = !prev;
      setDetailQueueOpen(next);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getAppPreferences().then((prefs) => {
      if (!cancelled) {
        setAutoTagEnabled(Boolean(prefs.aiAutoTagEnabled));
        setAiCaptionEnabled(Boolean(prefs.aiCaptionEnabled));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onProgress = window.arc?.onAiIndexProgress?.((payload) => {
      if (payload.currentCardId !== cardId) return;
      if ((payload.currentCardProgress ?? 0) < 55) return;
      void refreshAiCaption(cardId);
    });
    const onComplete = window.arc?.onAiIndexComplete?.(() => {
      void refreshAiCaption(cardId);
    });
    // Видео-caption после импорта шлёт quiet extension-import — подтянуть скрытый aiCaption в модели карточки.
    const onImportSaved = window.arc?.onExtensionImportSaved?.(({ cardIds }) => {
      if (!cardIds.includes(cardId)) return;
      void refreshAiCaption(cardId);
    });
    return () => {
      onProgress?.();
      onComplete?.();
      onImportSaved?.();
    };
  }, [cardId, refreshAiCaption]);

  useLayoutEffect(() => {
    if (panelRef.current) void hydrateArcNavbarIcons(panelRef.current);
  }, [
    confirmDelete,
    confirmPermanentDelete,
    confirmOverwriteDescription,
    busy,
    card?.type,
    similar.length,
    categoriesById,
    inMoodboard,
    infoOpen,
    actionAlert,
    tagsModalOpen,
    collectionsModalOpen,
    autoTagEnabled,
    aiCaptionEnabled,
    suggestTagsBusy,
    generateDescriptionBusy,
    settingsWidth,
    queueOpen,
    queueCards.length,
    videoLoop,
    showNavButtons
  ]);

  useLayoutEffect(() => {
    const cached = cardCacheRef.current.get(cardId);
    if (!cached || cardRef.current?.id === cardId) return;
    applyInstantCardPreview(cached);
  }, [applyInstantCardPreview, cardId, queueCards]);

  useEffect(() => {
    const ids = collectDetailPrefetchCardIds(cardId, neighborCardIds, previewQueueCardIds);
    let cancelled = false;
    void (async () => {
      const images: CardRecord[] = [];
      for (const id of ids) {
        let cached = cardCacheRef.current.get(id);
        if (!cached) {
          cached = (await getCardById(id)) ?? undefined;
          if (cached) cardCacheRef.current.set(cached.id, cached);
        }
        if (cancelled) return;
        if (cached?.type === 'image') images.push(cached);
      }
      if (images.length === 0) return;
      await preloadCardDetailOriginals(images, readGridSize());
    })();
    return () => {
      cancelled = true;
    };
  }, [cardId, neighborCardIds, previewQueueCardIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cats = await getAllCategories();
      const cm = new Map<string, CategoryRecord>();
      for (const cat of cats) cm.set(cat.id, cat);
      if (!cancelled) setCategoriesById(cm);

      const cols = await getAllCollections();
      const colm = new Map<string, string>();
      for (const col of cols) colm.set(col.id, col.name);
      if (!cancelled) setCollectionsById(colm);

      if (!cancelled) setCollCounts(await getCollectionCardCounts());
      if (!cancelled) setCollectionPreviews(await getCollectionPreviewSlices(1));

      const moodboardIds = await getMoodboardCardIds();
      if (!cancelled) setMoodboardCardIds(new Set(moodboardIds));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setInMoodboard(moodboardCardIds.has(cardId));
  }, [cardId, moodboardCardIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const c = await reloadCard(cardId);
      if (cancelled) return;

      if (c && window.arc) {
        const prefetched = c.type === 'image' ? peekPreloadedCardDetailOriginal(c.id) : undefined;
        if (prefetched) {
          setThumbSrc(null);
          setSrc(prefetched);
        }
        let lastThumbHref: string | null = null;
        const gridSize = readGridSize();
        const fullHref = await resolveCardDetailPreviewUrls(c, gridSize, (thumbHref) => {
          if (prefetched) return;
          lastThumbHref = thumbHref;
          if (!cancelled) setThumbSrc(thumbHref);
        });
        if (cancelled) return;
        if (!cancelled) {
          setSrc(fullHref);
          if (fullHref && (fullHref === lastThumbHref || fullHref === prefetched)) setThumbSrc(null);
        }
      } else if (!cancelled && !c) {
        setThumbSrc(null);
        setSrc(null);
      }

      if (!cancelled) {
        if (c?.type === 'video') {
          setSimilar([]);
        } else {
          const rows = await listSimilarCards(cardId, 15);
          if (!cancelled) setSimilar(rows);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardId, reloadCard]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      pushRecentViewedCardId(cardId);
    }, RECENT_VIEWED_MIN_MS);
    return () => window.clearTimeout(timer);
  }, [cardId]);

  useEffect(() => {
    cardRef.current = card;
  }, [card]);

  useEffect(() => {
    const onBudget = () => setThumbBudgetEpoch((v) => v + 1);
    window.addEventListener(ARC_THUMB_BUDGET_CHANGED_EVENT, onBudget);
    return () => window.removeEventListener(ARC_THUMB_BUDGET_CHANGED_EVENT, onBudget);
  }, []);

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
  }, [similar, thumbBudgetEpoch]);

  useEffect(() => {
    settingsWidthRef.current = settingsWidth;
  }, [settingsWidth]);

  useEffect(() => {
    if (card?.type !== 'image' && card?.type !== 'video') {
      setPalette([]);
      return;
    }
    let cancelled = false;
    void loadCardDetailPalette(cardId)
      .then((rows) => {
        if (!cancelled) setPalette(rows);
      })
      .catch(() => {
        // Оставляем предыдущую палитру, пока не придёт ответ по новой карточке.
      });
    return () => {
      cancelled = true;
    };
  }, [card?.type, cardId]);

  useEffect(() => {
    document.body.classList.add('arc-card-detail-open');
    return () => {
      document.body.classList.remove('arc-card-detail-open');
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pendingTagSearchIdsRef.current.length > 0) {
        setPendingTagSearchIds([]);
        return;
      }
      if (actionAlert) setActionAlert(null);
      else if (copySettingsMenuOpen) setCopySettingsMenuOpen(false);
      else if (collectionsModalOpen) setCollectionsModalOpen(false);
      else if (tagsModalOpen) setTagsModalOpen(false);
      else if (infoOpen) setInfoOpen(false);
      else if (removeMoodboardConfirm) setRemoveMoodboardConfirm(null);
      else if (confirmPermanentDelete) setConfirmPermanentDelete(false);
      else if (confirmDelete) setConfirmDelete(false);
      else requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    requestClose,
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

  const fitDescriptionTextarea = useCallback((opts?: { animate?: boolean }) => {
    const el = descriptionTextareaRef.current;
    if (!el) return;
    const animate = Boolean(opts?.animate);
    // ResizeObserver во время tween не должен срывать анимацию вкладок.
    if (descriptionFitLockRef.current && !animate) return;

    const gsap = ensureGsapSetup();
    gsap.killTweensOf(el);
    descriptionFitLockRef.current = false;

    const styles = getComputedStyle(el);
    const minH = Number.parseFloat(styles.minHeight) || 0;
    const maxH = Number.parseFloat(styles.maxHeight) || Number.POSITIVE_INFINITY;
    const from = el.getBoundingClientRect().height;

    descriptionFitLockRef.current = true;
    el.style.height = `${minH}px`;
    const next = Math.min(Math.max(el.scrollHeight, minH), maxH);
    el.style.height = `${from}px`;
    descriptionFitLockRef.current = false;

    if (Math.abs(from - next) < 1) {
      el.style.height = `${next}px`;
      return;
    }

    const reduced = getPrefersReducedMotion();
    const duration = motionDuration('base', reduced);
    const shouldAnimate = animate && duration > 0;

    if (!shouldAnimate) {
      el.style.height = `${next}px`;
      return;
    }

    descriptionFitLockRef.current = true;
    gsap.fromTo(
      el,
      { height: from },
      {
        height: next,
        duration,
        ease: arcMotionTokens.ease,
        onComplete: () => {
          descriptionFitLockRef.current = false;
          // Контент/ширина могли измениться за время tween — добить без анимации.
          fitDescriptionTextarea({ animate: false });
        }
      }
    );
  }, []);

  useLayoutEffect(() => {
    fitDescriptionTextarea({ animate: false });
  }, [fitDescriptionTextarea, description]);

  useEffect(() => {
    const el = descriptionTextareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const gsap = ensureGsapSetup();
    const ro = new ResizeObserver(() => fitDescriptionTextarea({ animate: false }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      gsap.killTweensOf(el);
      descriptionFitLockRef.current = false;
    };
  }, [fitDescriptionTextarea]);

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

  const applyRating = useCallback(
    (next: number) => {
      const value = clampCardRating(next);
      setRating(value);
      void updateCardPayload(cardId, { rating: value }).then(() => {
        // Пока шла запись, карточку могли переключить — не подменять открытую деталку.
        setCard((prev) => (prev && prev.id === cardId ? { ...prev, rating: value || undefined } : prev));
      });
    },
    [cardId]
  );

  const clampSettingsWidth = useCallback(
    (px: number) => clampCardDetailSettingsWidth(px, settingsMinWidth),
    [settingsMinWidth]
  );

  const remeasureToolbarMinWidth = useCallback(() => {
    const next = measureCardDetailToolbarMinWidth(optionsLeftRef.current);
    setSettingsMinWidth((current) => (current === next ? current : next));
  }, []);

  useLayoutEffect(() => {
    remeasureToolbarMinWidth();
  }, [remeasureToolbarMinWidth, inTrash, card?.id, hasSettingsClipboard]);

  useLayoutEffect(() => {
    const el = optionsLeftRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => remeasureToolbarMinWidth());
    observer.observe(el);
    window.addEventListener('resize', remeasureToolbarMinWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', remeasureToolbarMinWidth);
    };
  }, [remeasureToolbarMinWidth]);

  useEffect(() => {
    setSettingsWidth((current) => clampCardDetailSettingsWidth(current, settingsMinWidth));
  }, [settingsMinWidth]);

  useEffect(() => {
    const onResize = () => {
      setSettingsWidth((current) => clampCardDetailSettingsWidth(current, settingsMinWidth));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [settingsMinWidth]);

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
      const id = card.id;
      await deleteCard(id);
      notifyTrashWithUndo(id, onDeleted);
      onDeleted();
      requestClose();
    } finally {
      setBusy(false);
    }
  };

  const restoreTrashOptions = (destinationLibraryId?: string) =>
    card
      ? {
          libraryId: card.libraryId,
          sourceLibraryRoot: card.libraryRoot,
          destinationLibraryId
        }
      : undefined;

  const finishRestore = async (destinationLibraryId?: string) => {
    if (!card || busy) return;
    setBusy(true);
    try {
      const id = card.id;
      const result = await restoreCard(id, restoreTrashOptions(destinationLibraryId));
      if (!result.ok) {
        if (result.error === 'origin-missing') {
          setRestoreDestinationOpen(true);
          return;
        }
        setActionAlert({
          message:
            result.error === 'files-unavailable'
              ? 'Файлы карточки недоступны — восстановить нельзя'
              : 'Не удалось восстановить карточку',
          variant: 'danger'
        });
        return;
      }
      notifyRestoreWithUndo(id, onDeleted, destinationLibraryId ?? card.libraryId);
      onDeleted();
      requestClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!card || busy) return;
    if (originLibraryMissing) {
      setRestoreDestinationOpen(true);
      return;
    }
    await finishRestore();
  };

  const handlePermanentDelete = async () => {
    if (!card || busy) return;
    setBusy(true);
    try {
      await permanentDeleteCard(card.id, undefined, card.libraryId);
      notifyPermanentDelete(1);
      onDeleted();
      requestClose();
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
      setCollectionPreviews(await getCollectionPreviewSlices(1));
      setCollCounts(await getCollectionCardCounts());
    }

    await reloadCard(card.id);
    showCopyAlert('Настройки применены');
  }, [card, tagsIndex, collectionsById, reloadCard, showCopyAlert]);

  useCardDetailVideoShortcuts({
    enabled: card?.type === 'video',
    playerRef: videoPlayerRef
  });

  // Клавиши 0–5 меняют данные молча — при открытом модальном слое их глушим.
  const detailLayerOpen =
    infoOpen ||
    tagsModalOpen ||
    collectionsModalOpen ||
    copySettingsMenuOpen ||
    confirmDelete ||
    confirmPermanentDelete ||
    confirmOverwriteDescription ||
    removeMoodboardConfirm !== null;

  useCardRatingShortcuts({
    enabled: Boolean(card) && !inTrash && !detailLayerOpen,
    onRate: applyRating
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (matchesShortcut(e, 'detail.previous') && neighborCardIds?.prev) {
        e.preventDefault();
        openViewingCard(neighborCardIds.prev);
        return;
      }

      if (matchesShortcut(e, 'detail.next') && neighborCardIds?.next) {
        e.preventDefault();
        openViewingCard(neighborCardIds.next);
        return;
      }

      if (matchesShortcut(e, 'detail.copySettings')) {
        e.preventDefault();
        handleCopySettings(getLastCardSettingsFieldSelection());
        return;
      }

      if (matchesShortcut(e, 'detail.pasteSettings')) {
        e.preventDefault();
        void applySettingsClipboard();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [applySettingsClipboard, handleCopySettings, neighborCardIds, openViewingCard]);

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

  const patchCardTagIds = (computeNext: (tagIds: string[]) => string[]): Promise<void> => {
    const task = tagPatchQueueRef.current.then(async () => {
      const current = cardRef.current;
      if (!current) return;
      const prevTagIds = current.tagIds;
      const nextTagIds = computeNext(prevTagIds);
      const nextCard = { ...current, tagIds: nextTagIds };
      setCard(nextCard);
      cardRef.current = nextCard;
      try {
        await updateCardPayload(current.id, { tagIds: nextTagIds });
      } catch {
        const rolledBack = { ...current, tagIds: prevTagIds };
        setCard((c) => (c?.id === current.id ? rolledBack : c));
        if (cardRef.current?.id === current.id) cardRef.current = rolledBack;
      }
    });
    tagPatchQueueRef.current = task.catch(() => undefined);
    return task;
  };

  const patchCardCollectionIds = (computeNext: (collectionIds: string[]) => string[]): Promise<void> => {
    const task = collectionPatchQueueRef.current.then(async () => {
      const current = cardRef.current;
      if (!current) return;
      const prevCollectionIds = current.collectionIds;
      const nextCollectionIds = computeNext(prevCollectionIds);
      const nextCard = { ...current, collectionIds: nextCollectionIds };
      setCard(nextCard);
      cardRef.current = nextCard;
      try {
        await updateCardPayload(current.id, { collectionIds: nextCollectionIds });
        setCollectionPreviews(await getCollectionPreviewSlices(1));
        setCollCounts(await getCollectionCardCounts());
      } catch {
        const rolledBack = { ...current, collectionIds: prevCollectionIds };
        setCard((c) => (c?.id === current.id ? rolledBack : c));
        if (cardRef.current?.id === current.id) cardRef.current = rolledBack;
      }
    });
    collectionPatchQueueRef.current = task.catch(() => undefined);
    return task;
  };

  const openTagSearch = useCallback(
    (tagIds: string | string[]) => {
      // Не вызывать onClose() отдельно — гонка с navigate(tag=), как у color search.
      startTagSearch(navigate, searchParams, tagIds, { pathname: '/gallery' });
    },
    [navigate, searchParams]
  );

  useEffect(() => {
    const flushPendingTagSearch = () => {
      const ids = pendingTagSearchIdsRef.current;
      if (ids.length === 0) return;
      setPendingTagSearchIds([]);
      openTagSearch(ids);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') {
        flushPendingTagSearch();
      }
    };
    const onBlur = () => {
      if (pendingTagSearchIdsRef.current.length > 0) {
        flushPendingTagSearch();
      }
    };

    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [openTagSearch]);

  const handleDetailTagClick = (event: ReactMouseEvent<HTMLButtonElement>, tagId: string) => {
    if (event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      void patchCardTagIds((ids) => ids.filter((id) => id !== tagId));
      setPendingTagSearchIds((prev) => prev.filter((id) => id !== tagId));
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      setPendingTagSearchIds((prev) =>
        prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
      );
      return;
    }

    if (pendingTagSearchIds.length > 0) {
      setPendingTagSearchIds([]);
    }
    openTagSearch(tagId);
  };

  const openCollectionPage = useCallback(
    (collectionId: string) => {
      onClose();
      navigate(`/collections/${collectionId}`);
    },
    [navigate, onClose]
  );

  const removeCollection = async (collectionId: string) => {
    if (!card) return;
    const cardId = card.id;
    await patchCardCollectionIds((ids) => ids.filter((id) => id !== collectionId));
    notifyGalleryMutation({
      message: formatCollectionRemoveToast(1),
      undo: async () => {
        await undoCollectionRemove([cardId], collectionId)();
        await patchCardCollectionIds((ids) =>
          ids.includes(collectionId) ? ids : [...ids, collectionId]
        );
      },
      onAfterUndo: onDeleted
    });
  };

  const toggleTagOnCard = (tagId: string) =>
    patchCardTagIds((ids) =>
      ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]
    );

  const applyCollections = (collectionIds: string[]) => patchCardCollectionIds(() => collectionIds);

  const toggleCollectionOnCard = async (collectionId: string) => {
    if (!card) return;
    const cardId = card.id;
    const wasIn = card.collectionIds.includes(collectionId);
    await patchCardCollectionIds((ids) =>
      ids.includes(collectionId) ? ids.filter((id) => id !== collectionId) : [...ids, collectionId]
    );
    notifyGalleryMutation({
      message: wasIn ? formatCollectionRemoveToast(1) : formatCollectionAddToast(1),
      undo: async () => {
        if (wasIn) {
          await undoCollectionRemove([cardId], collectionId)();
          await patchCardCollectionIds((ids) =>
            ids.includes(collectionId) ? ids : [...ids, collectionId]
          );
        } else {
          await undoCollectionAdd([cardId], collectionId)();
          await patchCardCollectionIds((ids) => ids.filter((id) => id !== collectionId));
        }
      },
      onAfterUndo: onDeleted
    });
  };

  const createAndAssignCollection = async (name: string) => {
    if (!card) return;
    const cardId = card.id;
    const created = await addCollection(name);
    const already = card.collectionIds.includes(created.id);
    await patchCardCollectionIds((ids) =>
      ids.includes(created.id) ? ids : [...ids, created.id]
    );
    if (!already) {
      notifyGalleryMutation({
        message: formatCollectionAddToast(1),
        undo: async () => {
          await undoCollectionAdd([cardId], created.id)();
          await patchCardCollectionIds((ids) => ids.filter((id) => id !== created.id));
        },
        onAfterUndo: onDeleted
      });
    }
  };

  const openPaletteColorSearch = (hex: string) => {
    // Не вызывать onClose() отдельно — он пишет URL с tag= и гоняется с color=.
    startColorSearch(navigate, searchParams, hex, { pathname: '/gallery' });
  };

  const bookmarkIconClass = inMoodboard
    ? isBookmarkHovered
      ? 'arc-icon-bookmark-off'
      : 'arc-icon-bookmark-on'
    : 'arc-icon-bookmark';

  const overlayStyle = {
    ['--arc-card-detail-settings-min-w']: `${settingsMinWidth}px`
  } as CSSProperties;

  const mainRowStyle = {
    ['--arc-card-detail-settings-w']: `${settingsWidth}px`
  } as CSSProperties;

  const handleSimilarFind = (targetId: string) => {
    void startFindSimilarSearch(navigate, searchParams, targetId);
  };

  const handleSimilarToggleMoodboard = async (targetId: string) => {
    const ids = await getMoodboardCardIds();
    if (!ids.includes(targetId)) {
      await addCardToMoodboard(targetId);
      setMoodboardCardIds((prev) => new Set(prev).add(targetId));
      if (targetId === cardId) setInMoodboard(true);
      notifyGalleryMutation({
        message: formatMoodboardAddToast(1),
        undo: async () => {
          await undoMoodboardAdd([targetId])();
          setMoodboardCardIds((prev) => {
            const next = new Set(prev);
            next.delete(targetId);
            return next;
          });
          if (targetId === cardId) setInMoodboard(false);
        }
      });
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
    notifyGalleryMutation({
      message: formatMoodboardRemoveToast(1),
      undo: async () => {
        await undoMoodboardRemove([targetId])();
        setMoodboardCardIds((prev) => new Set(prev).add(targetId));
        if (targetId === cardId) setInMoodboard(true);
      }
    });
  };

  const { onCardContextMenu: onSimilarCardContextMenu, contextMenuLayer: similarContextMenuLayer } =
    useGalleryCardContextMenu({
      scope: inTrash ? { kind: 'trash' } : { kind: 'library' },
      cards: similar,
      moodboardCardIds,
      onOpenCard: openViewingCard,
      onToggleMoodboard: (id) => void handleSimilarToggleMoodboard(id),
      onFindSimilar: handleSimilarFind,
      onCardDeleted: async () => {
        if (card?.type === 'video') {
          setSimilar([]);
          return;
        }
        setSimilar(await listSimilarCards(cardId, 15));
      }
    });

  const addRowButton = (label: string, iconClass: string, onClick: () => void) => (
    <div className="arc-card-detail-add-row-scope arc-ui-kit-scope" data-btn-size="m">
      <button type="button" className="btn btn-outline btn-ds arc-card-detail-add-row" onClick={onClick}>
        <span className="btn-ds__value">{label}</span>
        <span className={`btn-ds__icon ${iconClass}`} aria-hidden="true" />
      </button>
    </div>
  );

  const runGenerateDescription = async () => {
    if (!card || generateDescriptionBusy) return;
    if (!window.arc?.aiGenerateCardDescription) {
      setActionAlert({ message: 'Генерация описания недоступна', variant: 'danger' });
      return;
    }
    if (descriptionSaveTimerRef.current != null) {
      window.clearTimeout(descriptionSaveTimerRef.current);
      descriptionSaveTimerRef.current = null;
    }
    const requestCardId = card.id;
    setGenerateDescriptionBusy(true);
    try {
      const result = await window.arc.aiGenerateCardDescription(requestCardId);
      if (cardIdRef.current !== requestCardId) return;
      if (!result.ok) {
        setActionAlert({ message: result.error, variant: 'danger' });
        return;
      }
      setDescription(result.description);
      setCard((prev) =>
        prev && prev.id === requestCardId ? { ...prev, description: result.description } : prev
      );
      setActionAlert({ message: 'Описание сгенерировано', variant: 'brand' });
    } catch (err) {
      if (cardIdRef.current !== requestCardId) return;
      setActionAlert({
        message: err instanceof Error ? err.message : 'Не удалось сгенерировать описание',
        variant: 'danger'
      });
    } finally {
      if (cardIdRef.current === requestCardId) setGenerateDescriptionBusy(false);
    }
  };

  const handleGenerateDescriptionClick = () => {
    if (!card || generateDescriptionBusy) return;
    if (description.trim()) {
      setConfirmOverwriteDescription(true);
      return;
    }
    void runGenerateDescription();
  };

  const handleConfirmOverwriteDescription = () => {
    setConfirmOverwriteDescription(false);
    void runGenerateDescription();
  };

  const handleSuggestTags = async () => {
    if (!card || suggestTagsBusy) return;
    if (!window.arc?.aiSuggestTags) {
      setActionAlert({ message: 'Автотегирование недоступно', variant: 'danger' });
      return;
    }
    setSuggestTagsBusy(true);
    try {
      const result = await window.arc.aiSuggestTags(card.id);
      if (!result.ok) {
        setActionAlert({ message: result.error, variant: 'danger' });
        return;
      }
      if (result.tagIds.length === 0) {
        const proposed = result.proposedNew?.length ?? 0;
        setActionAlert({
          message:
            proposed > 0
              ? 'Модель предложила метки, но ни одна не совпала с каталогом. Включите «Создавать новые метки» в настройках автотегирования или добавьте метки вручную'
              : 'Не удалось сопоставить предложения с каталогом меток',
          variant: 'warning'
        });
        setTagsModalOpen(true);
        return;
      }
      const existing = new Set(card.tagIds);
      const toAdd = result.tagIds.filter((id) => !existing.has(id));
      if (toAdd.length > 0) {
        await patchCardTagIds((prev) => [...new Set([...prev, ...toAdd])]);
      }
      const createdNote =
        result.createdCount > 0 ? ` (новых в каталоге: ${result.createdCount})` : '';
      setActionAlert({
        message:
          toAdd.length > 0
            ? `Добавлено меток: ${toAdd.length}${createdNote}. Проверьте и при необходимости снимите лишние`
            : `Подходящие метки уже были на карточке${createdNote}`,
        variant: 'brand'
      });
      setTagsModalOpen(true);
    } catch (err) {
      setActionAlert({
        message: err instanceof Error ? err.message : 'Не удалось предложить метки',
        variant: 'danger'
      });
    } finally {
      setSuggestTagsBusy(false);
    }
  };

  const descriptionSectionFooter = canGenerateDescription ? (
    <div className="arc-card-detail-add-row-scope arc-ui-kit-scope" data-btn-size="m">
      <div className="btn-group btn-group-ds arc-card-detail-desc-gen">
        <button
          type="button"
          className="btn btn-outline btn-ds"
          aria-label={generateDescriptionBusy ? 'Генерация описания' : 'Сгенерировать описание'}
          disabled={busy || generateDescriptionBusy}
          onClick={handleGenerateDescriptionClick}
        >
          {generateDescriptionBusy ? (
            <>
              <span className="btn-ds__icon" aria-hidden="true">
                <Loader decorative />
              </span>
              <span className="btn-ds__value">Генерирую…</span>
            </>
          ) : (
            <>
              <span className="btn-ds__value">Сгенерировать описание</span>
              <span className="btn-ds__icon arc-icon-description" aria-hidden="true" />
            </>
          )}
        </button>
        <Tooltip content="Настройки AI Описания" position="top" as="span">
          <button
            type="button"
            className="btn btn-outline btn-icon-only"
            aria-label="Настройки AI Описания"
            disabled={busy || generateDescriptionBusy}
            onClick={() => navigate('/settings/ai?tab=caption')}
          >
            <span className="btn-icon-only__glyph arc-icon-options" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </div>
  ) : null;

  const tagsSectionFooter = (
    <div
      className={[
        'arc-card-detail-tag-actions',
        'arc-ui-kit-scope',
        suggestTagsBusy ? 'arc-card-detail-tag-actions--busy' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      data-btn-size="m"
    >
      {!suggestTagsBusy ? (
        <button
          type="button"
          className="btn btn-outline btn-ds arc-card-detail-add-row"
          onClick={() => setTagsModalOpen(true)}
          disabled={busy}
        >
          <span className="btn-ds__value">Добавить метки</span>
          <span className="btn-ds__icon arc-icon-tag-plus" aria-hidden="true" />
        </button>
      ) : null}
      {autoTagEnabled && (card?.type === 'image' || card?.type === 'video') ? (
        <button
          type="button"
          className="btn btn-outline btn-ds arc-card-detail-add-row"
          onClick={() => void handleSuggestTags()}
          disabled={busy || suggestTagsBusy}
        >
          {suggestTagsBusy ? (
            <>
              <span className="btn-ds__icon" aria-hidden="true">
                <Loader decorative />
              </span>
              <span className="btn-ds__value">Предлагаю…</span>
            </>
          ) : (
            <>
              <span className="btn-ds__value">Предложить</span>
              <span className="btn-ds__icon arc-icon-ai" aria-hidden="true" />
            </>
          )}
        </button>
      ) : null}
    </div>
  );

  const overlay = (
    <>
      <div ref={backdropRef} className="arc-card-detail-backdrop" aria-hidden="true" />
      <div
        ref={panelRef}
        className="arc-card-detail-overlay arc-ui-kit-scope"
        data-elevation="sunken"
        data-input-size="l"
        data-btn-size="l"
        style={overlayStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcCardDetailHeading"
      >
      <h2 id="arcCardDetailHeading" className="sr-only">
        Карточка
      </h2>

      <div className="arc-card-detail-scroll">
        <div
          className={`arc-card-detail-shell${card?.type !== 'video' && similar.length > 0 ? ' arc-card-detail-shell--has-similar' : ''}`}
        >
        <div className="arc-card-detail-main-row" style={mainRowStyle}>
          <div
            className={`arc-card-detail-preview arc-card-detail-preview--video panel elevation-sunken${queueVisible ? ' arc-card-detail-preview--queue-open' : ''}`}
          >
            <div className="arc-card-detail-preview__stage">
              {src && card?.type === 'video' ? (
                <CardDetailVideoPlayer
                  cardId={card.id}
                  src={src}
                  autoplay={true}
                  loop={videoLoop}
                  onLoopChange={setVideoLoop}
                  flushToQueue={queueVisible}
                  playerRef={videoPlayerRef}
                  onCardUpdated={(updated) => {
                    setCard(updated);
                    cardRef.current = updated;
                    setThumbBudgetEpoch((epoch) => epoch + 1);
                    void reloadCard(updated.id);
                    const paletteCardId = updated.id;
                    void loadCardDetailPalette(paletteCardId)
                      .then((rows) => {
                        if (cardRef.current?.id === paletteCardId) setPalette(rows);
                      })
                      .catch(() => {
                        if (cardRef.current?.id === paletteCardId) setPalette([]);
                      });
                  }}
                  onToast={showCopyAlert}
                />
              ) : src || (thumbSrc && card?.type !== 'video') ? (
                card?.type === 'image' && card ? (
                  <CardDetailImageViewport
                    card={card}
                    src={src ?? thumbSrc ?? ''}
                    onChromeChange={setImageChrome}
                  />
                ) : (
                  <div className="arc-card-detail-media-fit">
                    <img
                      className="arc-card-detail-media"
                      src={src ?? thumbSrc ?? ''}
                      alt=""
                      draggable={false}
                    />
                  </div>
                )
              ) : (
                <div
                  className="arc-gallery-skeleton arc-card-detail-skeleton"
                  style={card ? gallerySkeletonStyle(card) : undefined}
                  aria-hidden
                />
              )}

              {showNavButtons ? (
                <>
                  <div className="arc-card-detail-preview-nav arc-card-detail-preview-nav--prev">
                    <Tooltip content={prevNavHint} position="right">
                      <span className={!neighborCardIds?.prev ? 'arc-tooltip-anchor-inline' : undefined}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon-only btn-ds btn-l"
                          aria-label={prevNavLabel}
                          disabled={!neighborCardIds?.prev}
                          onClick={() => {
                            if (neighborCardIds?.prev) openViewingCard(neighborCardIds.prev);
                          }}
                        >
                          <span
                            className="btn-icon-only__glyph arc-icon-chevron arc-chevron-point-left"
                            data-arc-icon-size="m"
                            aria-hidden="true"
                          />
                        </button>
                      </span>
                    </Tooltip>
                  </div>
                  <div className="arc-card-detail-preview-nav arc-card-detail-preview-nav--next">
                    <Tooltip content={nextNavHint} position="left">
                      <span className={!neighborCardIds?.next ? 'arc-tooltip-anchor-inline' : undefined}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon-only btn-ds btn-l"
                          aria-label={nextNavLabel}
                          disabled={!neighborCardIds?.next}
                          onClick={() => {
                            if (neighborCardIds?.next) openViewingCard(neighborCardIds.next);
                          }}
                        >
                          <span
                            className="btn-icon-only__glyph arc-icon-chevron arc-chevron-point-right"
                            data-arc-icon-size="m"
                            aria-hidden="true"
                          />
                        </button>
                      </span>
                    </Tooltip>
                  </div>
                </>
              ) : null}
            </div>

            {queueVisible && queueCards.length > 0 && card ? (
              <CardDetailPreviewQueue
                cards={queueCards}
                activeCardId={card.id}
                srcMap={queueSrcMap}
                onSelectCard={openViewingCard}
              />
            ) : null}

            {card ? (
              <CardDetailPreviewOptionsBar
                card={card}
                naturalSize={
                  imageChrome?.naturalSize ?? {
                    width: card.width ?? 0,
                    height: card.height ?? 0
                  }
                }
                displayScalePct={imageChrome?.displayScalePct ?? 100}
                isFitActive={imageChrome?.isFitActive ?? true}
                isActualActive={imageChrome?.isActualActive ?? false}
                disabled={card.type === 'video'}
                showQueueToggle={canShowQueue}
                queueOpen={queueOpen}
                onQueueToggle={toggleQueueOpen}
                onInfoClick={() => setInfoOpen(true)}
                onFitClick={() => imageChrome?.onFitClick()}
                onActualClick={() => imageChrome?.onActualClick()}
                onZoomOut={() => imageChrome?.onZoomOut()}
                onZoomIn={() => imageChrome?.onZoomIn()}
                onDisplayPctChange={(pct) => imageChrome?.onDisplayPctChange(pct)}
              />
            ) : null}
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

          <aside className="arc-card-detail-settings panel elevation-sunken" data-interface-tour-anchor="card-detail-fields">
            <div className="arc-card-detail-options" data-interface-tour-anchor="card-detail-toolbar">
              <div ref={optionsLeftRef} className="arc-card-detail-options-left">
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
                      onClick={() => {
                        if (getDeleteCardsUseTrash()) {
                          setConfirmDelete(true);
                          return;
                        }
                        setConfirmPermanentDelete(true);
                      }}
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
                <Tooltip content="Открыть в новом окне" position="top">
                  <button
                    type="button"
                    className="btn btn-outline btn-icon-only btn-ds"
                    aria-label="Открыть в новом окне"
                    disabled={!card}
                    onClick={() => {
                      if (!card) return;
                      const ids = viewerNavigationCardIds?.length ? viewerNavigationCardIds : [card.id];
                      const startIndex = Math.max(0, ids.indexOf(card.id));
                      void openCardsInNewWindow({
                        cardIds: ids.length > 1 ? ids : [card.id],
                        startIndex,
                        context: viewerOpenContext ?? { kind: 'library' }
                      });
                      requestClose();
                    }}
                  >
                    <span className="btn-icon-only__glyph arc-icon-picture-in-picture" aria-hidden="true" />
                  </button>
                </Tooltip>
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
                            await addCardToMoodboard(card.id);
                            setInMoodboard(true);
                            setMoodboardCardIds((prev) => new Set(prev).add(card.id));
                            notifyGalleryMutation({
                              message: formatMoodboardAddToast(1),
                              undo: async () => {
                                await undoMoodboardAdd([card.id])();
                                setInMoodboard(false);
                                setMoodboardCardIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(card.id);
                                  return next;
                                });
                              }
                            });
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
                          notifyGalleryMutation({
                            message: formatMoodboardRemoveToast(1),
                            undo: async () => {
                              await undoMoodboardRemove([card.id])();
                              setInMoodboard(true);
                              setMoodboardCardIds((prev) => new Set(prev).add(card.id));
                            }
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
                  onClick={requestClose}
                >
                  <span className="btn-icon-only__glyph arc-icon-close" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>

            <div ref={settingsScrollRef} className="arc-card-detail-settings-scroll">
              <div className="arc-card-detail-settings-scroll__pad">
              {inTrash && card?.libraryName ? (
                <p className="text-s arc-card-detail-library-name">{card.libraryName}</p>
              ) : null}
              <CollapsibleSection title="Описание" footer={descriptionSectionFooter}>
                <div
                  className="arc-card-detail-description-fields arc-ui-kit-scope"
                  data-input-size="m"
                  data-btn-size="m"
                >
                  <CardRatingStars value={rating} onChange={applyRating} disabled={!card || inTrash} />
                  {palette.length > 0 ? (
                    <div className="arc-card-detail-palette">
                      {palette.map((swatch, index) => (
                        <Tooltip
                          key={`${swatch.hex}-${index}`}
                          content={`Поиск по цвету · ${swatch.hex.toUpperCase()} (${swatch.pct}%)`}
                          position="top"
                        >
                          <button
                            type="button"
                            className="arc-card-detail-palette-swatch"
                            style={{ backgroundColor: swatch.hex }}
                            aria-label={`Поиск по цвету ${swatch.hex}, ${swatch.pct} процентов`}
                            onClick={() => openPaletteColorSearch(swatch.hex)}
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
                        <span className="btn-icon-only__glyph arc-icon-external-link" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                  <label className="field">
                    <textarea
                      ref={descriptionTextareaRef}
                      className="input textarea arc-card-detail-description-textarea"
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
                collapsible={tagsSorted.length > 0}
                footer={tagsSectionFooter}
              >
                {tagsSorted.length > 0 && (
                  <div className="arc-card-detail-tags">
                    {tagsSorted.map(({ tag, colorHex }) => {
                      const hasTipText = Boolean(tag.description?.trim());
                      const hasTipImage = Boolean(tag.tooltipImageDataUrl?.startsWith('data:image/'));
                      const canShowTooltip = hasTipText || hasTipImage;
                      const searchPending = pendingTagSearchIds.includes(tag.id);

                      const chipButton = (
                        <button
                          type="button"
                          className={[
                            'arc-card-detail-tag-chip',
                            searchPending ? 'arc-card-detail-tag-chip--search-pending' : ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={(event) => handleDetailTagClick(event, tag.id)}
                          aria-label={`Метка «${tag.name}». Клик — поиск, Ctrl+клик — выбрать несколько, Alt+клик — снять`}
                          aria-pressed={searchPending || undefined}
                        >
                          <span className="arc-card-detail-tag-dot" style={{ background: colorHex }} aria-hidden="true" />
                          <span className="arc-card-detail-tag-name">{tag.name}</span>
                        </button>
                      );

                      if (!canShowTooltip || searchPending) {
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
                )}
              </CollapsibleSection>

              <div className="arc-card-detail-section-sep" role="separator" />

              <CollapsibleSection
                title="Коллекции"
                count={collectionsResolved.length}
                collapsible={collectionsResolved.length > 0}
                footer={addRowButton('Добавить в коллекцию', 'arc-icon-collection', () => setCollectionsModalOpen(true))}
              >
                {collectionsResolved.length > 0 && (
                  <ul className="arc-card-detail-collections">
                    {collectionsResolved.map((col) => (
                      <li
                        key={col.id}
                        className="arc-card-detail-collection-row arc-card-detail-collection-row--navigable panel elevation-sunken"
                        role="button"
                        tabIndex={0}
                        onClick={() => openCollectionPage(col.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openCollectionPage(col.id);
                          }
                        }}
                      >
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
                              onClick={(event) => {
                                event.stopPropagation();
                                void removeCollection(col.id);
                              }}
                            >
                              Снять
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleSection>
              </div>
            </div>
          </aside>
        </div>

        {card?.type !== 'video' && similar.length > 0 ? (
          <section className="arc-card-detail-similar" data-interface-tour-anchor="card-detail-similar">
            <div className="arc-card-detail-similar-head">
              <h2 className="h1">Похожие изображения</h2>
              <span className="h1 arc-card-detail-similar-count">{similar.length}</span>
            </div>
            <SimilarCardsMasonry
              cards={similar}
              srcMap={similarSrcMap}
              moodboardCardIds={moodboardCardIds}
              inTrash={inTrash}
              onOpenCard={openViewingCard}
              onFindSimilar={(id) => void handleSimilarFind(id)}
              onToggleMoodboard={inTrash ? undefined : (id) => void handleSimilarToggleMoodboard(id)}
              onCardContextMenu={onSimilarCardContextMenu}
            />
          </section>
        ) : null}
        </div>
      </div>

      {confirmOverwriteDescription ? (
        <div
          className="arc-modal-host arc-modal-host--nested arc-modal-host--card-detail-nested"
          aria-hidden="false"
          onClick={(event) => {
            if (event.target === event.currentTarget && !generateDescriptionBusy) {
              setConfirmOverwriteDescription(false);
            }
          }}
        >
          <section
            className="arc-modal"
            data-elevation="raised"
            data-input-size="s"
            data-btn-size="s"
            role="dialog"
            aria-modal="true"
            aria-labelledby="arcCardOverwriteDescriptionTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="arc-modal__header arc-modal__header--title">
              <h3 className="arc-modal__title" id="arcCardOverwriteDescriptionTitle">
                Заменить описание?
              </h3>
              <button
                type="button"
                className="arc-modal__close"
                aria-label="Закрыть"
                onClick={() => setConfirmOverwriteDescription(false)}
                disabled={generateDescriptionBusy}
              >
                <span className="tab-icon arc-icon-close" aria-hidden="true" />
              </button>
            </header>
            <div className="arc-modal__body">
              <div className="arc-modal__slot">
                <p className="arc-modal__slot-text">
                  Текущее описание будет удалено и заменено сгенерированным текстом.
                </p>
              </div>
            </div>
            <footer className="arc-modal__footer arc-modal__footer--actions-2">
              <button
                type="button"
                className="btn btn-outline btn-ds btn-s"
                onClick={() => setConfirmOverwriteDescription(false)}
                disabled={generateDescriptionBusy}
              >
                <span className="btn-ds__value">Отмена</span>
              </button>
              <button
                type="button"
                className="btn btn-brand btn-ds btn-s"
                onClick={handleConfirmOverwriteDescription}
                disabled={busy || generateDescriptionBusy}
              >
                <span className="btn-ds__value">Заменить</span>
              </button>
            </footer>
          </section>
        </div>
      ) : null}

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

      {restoreDestinationOpen && card ? (
        <RestoreTrashDestinationModal
          libraries={libraries}
          hostClassName="arc-modal-host--nested arc-modal-host--card-detail-nested"
          onClose={() => setRestoreDestinationOpen(false)}
          onConfirm={(destinationLibraryId) => finishRestore(destinationLibraryId)}
        />
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
            notifyGalleryMutation({
              message: formatMoodboardRemoveToast(1),
              undo: async () => {
                await undoMoodboardRemove([targetId])();
                setMoodboardCardIds((prev) => new Set(prev).add(targetId));
                if (targetId === cardId) setInMoodboard(true);
              }
            });
          }}
        />
      ) : null}

      {infoOpen && card ? <CardInfoModal card={card} onClose={() => setInfoOpen(false)} /> : null}

      {tagsModalOpen && card ? (
        <CardDetailTagsModal
          selectedTagIds={card.tagIds}
          onClose={() => setTagsModalOpen(false)}
          onToggleTag={toggleTagOnCard}
        />
      ) : null}

      {collectionsModalOpen && card ? (
        <CardDetailCollectionsModal
          selectedCollectionIds={card.collectionIds}
          onClose={() => setCollectionsModalOpen(false)}
          onToggleCollection={toggleCollectionOnCard}
          onCreateAndAssign={(name) => createAndAssignCollection(name)}
        />
      ) : null}

      </div>

      {actionAlert ? (
        <ToastAlert
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
        <ToastAlert
          message={copyAlertMessage}
          variant="success"
          hostClassName="arc-card-detail-alert-host"
          onClose={() => setCopyAlertMessage(null)}
        />
      ) : null}

      {similarContextMenuLayer}
    </>
  );

  if (!render) return null;

  return createPortal(overlay, document.body);
}
