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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import DemoAlert, { type ToastAlertVariant } from '../layout/DemoAlert';
import { Tooltip } from '../tooltip/Tooltip';
import { TagTooltipBody } from '../tooltip/TagTooltipBody';
import CollapsibleSection from './CollapsibleSection';
import CardDetailImageViewport from './CardDetailImageViewport';
import CardInfoModal from './CardInfoModal';
import CardDetailVideoPlayer from './CardDetailVideoPlayer';
import type { CardDetailVideoPlayerHandle } from './cardDetailVideoPlayerTypes';
import { useCardDetailVideoShortcuts } from './useCardDetailVideoShortcuts';
import SimilarCardsMasonry from './SimilarCardsMasonry';
import { useGalleryCardContextMenu } from './useGalleryCardContextMenu';
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
  isCardOnBoard,
  removeCardFromMoodboard,
  updateCardPayload
} from '../../services/db';
import { getDeleteCardsUseTrash } from '../../import/importDefaults';
import { parseLibraryScope } from '../../search/libraryScopeUrl';
import { ARC_SEARCH_QUERY_TAG } from '../../search/searchUrl';
import { startFindSimilarSearch } from '../../search/startVisualSimilarSearch';
import { startColorSearch } from '../../search/startColorSearch';
import { pushRecentViewedCardId, RECENT_VIEWED_MIN_MS } from '../../search/recentViewedCards';
import { getVideoPlaybackTierFromPath, videoPlaybackDescription } from '../../media/canPlayInBrowser';
import { gallerySkeletonStyle } from './gallerySkeleton';
import { useOverlayMotionPair } from '../../motion';
import { mergeCardsSrcMap, peekCardsSrcMap, preloadDecodedImages, resolveCardDetailPreviewUrls } from './galleryMediaCache';
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
import type { CardFeedNeighbors } from './cardFeedNeighbors';
import { openCardsInNewWindow, type CardViewerOpenContext } from '../../card-viewer/openCardsInNewWindow';
import { useAppPreferences } from '../../hooks/useAppPreferences';

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
};

const DESCRIPTION_SAVE_MS = 600;
const FIELD_SAVE_MS = 600;

type DescriptionTab = 'description' | 'ai';

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
  moodboardRemoveConfirm = 'gallery',
  neighborCardIds,
  viewerNavigationCardIds,
  viewerOpenContext
}: Props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  const optionsLeftRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<CardDetailVideoPlayerHandle | null>(null);
  const descriptionSaveTimerRef = useRef<number | null>(null);
  const nameSaveTimerRef = useRef<number | null>(null);
  const linkSaveTimerRef = useRef<number | null>(null);
  const copyAlertTimerRef = useRef<number | null>(null);
  const copySettingsAnchorRef = useRef<HTMLButtonElement>(null);
  const splitDragRef = useRef<{ startX: number; startW: number } | null>(null);

  const [card, setCard] = useState<CardRecord | null>(null);
  const cardRef = useRef<CardRecord | null>(null);
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
  const [descriptionTab, setDescriptionTab] = useState<DescriptionTab>('description');
  const [palette, setPalette] = useState<PaletteSwatch[]>([]);
  const [settingsWidth, setSettingsWidth] = useState(readCardDetailSettingsWidth);
  const [settingsMinWidth, setSettingsMinWidth] = useState(CARD_DETAIL_SETTINGS_WIDTH_MIN);
  const settingsWidthRef = useRef(settingsWidth);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [tagsModalOpen, setTagsModalOpen] = useState(false);
  const [collectionsModalOpen, setCollectionsModalOpen] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ message: string; variant: ToastAlertVariant } | null>(null);
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
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => setClosing(true), []);
  const { panelRef, backdropRef, render } = useOverlayMotionPair(!closing, {
    preset: 'fade-slide-up',
    backdropPreset: 'fade-scale',
    onExitComplete: onClose
  });

  const libraryScope = parseLibraryScope(searchParams);
  const inTrash = libraryScope === 'trash';
  const hasAiCaption = Boolean(card?.type === 'image' && card.aiCaption?.trim());

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

  const refreshAiCaption = useCallback(async (id: string) => {
    const c = await getCardById(id);
    if (!c) return null;
    setCard((prev) => (prev?.id === id ? { ...prev, aiCaption: c.aiCaption } : prev));
    return c;
  }, []);

  useEffect(() => {
    setDescriptionTab('description');
  }, [cardId]);

  useEffect(() => {
    if (!hasAiCaption && descriptionTab === 'ai') {
      setDescriptionTab('description');
    }
  }, [hasAiCaption, descriptionTab]);

  useEffect(() => {
    const onProgress = window.arc?.onAiIndexProgress?.((payload) => {
      if (payload.currentCardId !== cardId) return;
      if ((payload.currentCardProgress ?? 0) < 55) return;
      void refreshAiCaption(cardId);
    });
    const onComplete = window.arc?.onAiIndexComplete?.(() => {
      void refreshAiCaption(cardId);
    });
    return () => {
      onProgress?.();
      onComplete?.();
    };
  }, [cardId, refreshAiCaption]);

  useLayoutEffect(() => {
    if (panelRef.current) void hydrateArcNavbarIcons(panelRef.current);
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
    if (card?.type !== 'image') {
      setPalette([]);
      return;
    }
    let cancelled = false;
    void loadCardDetailPalette(cardId)
      .then((rows) => {
        if (!cancelled) setPalette(rows);
      })
      .catch(() => {
        if (!cancelled) setPalette([]);
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
      await deleteCard(card.id);
      onDeleted();
      requestClose();
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
      requestClose();
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
      setCollectionPreviews(await getCollectionPreviewSlices(3));
      setCollCounts(await getCollectionCardCounts());
    }

    await reloadCard(card.id);
    showCopyAlert('Настройки применены');
  }, [card, tagsIndex, collectionsById, reloadCard, showCopyAlert]);

  useCardDetailVideoShortcuts({
    enabled: card?.type === 'video',
    playerRef: videoPlayerRef
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (matchesShortcut(e, 'detail.previous') && neighborCardIds?.prev) {
        e.preventDefault();
        onOpenCard(neighborCardIds.prev);
        return;
      }

      if (matchesShortcut(e, 'detail.next') && neighborCardIds?.next) {
        e.preventDefault();
        onOpenCard(neighborCardIds.next);
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
  }, [applySettingsClipboard, handleCopySettings, neighborCardIds, onOpenCard]);

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
        setCollectionPreviews(await getCollectionPreviewSlices(3));
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
    (tagId: string) => {
      const next = new URLSearchParams();
      next.append(ARC_SEARCH_QUERY_TAG, tagId);
      onClose();
      navigate({ pathname: '/gallery', search: `?${next.toString()}` });
    },
    [navigate, onClose]
  );

  const openCollectionPage = useCallback(
    (collectionId: string) => {
      onClose();
      navigate(`/collections/${collectionId}`);
    },
    [navigate, onClose]
  );

  const removeCollection = (collectionId: string) =>
    patchCardCollectionIds((ids) => ids.filter((id) => id !== collectionId));

  const toggleTagOnCard = (tagId: string) =>
    patchCardTagIds((ids) =>
      ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]
    );

  const applyCollections = (collectionIds: string[]) => patchCardCollectionIds(() => collectionIds);

  const toggleCollectionOnCard = (collectionId: string) =>
    patchCardCollectionIds((ids) =>
      ids.includes(collectionId) ? ids.filter((id) => id !== collectionId) : [...ids, collectionId]
    );

  const createAndAssignCollection = async (name: string) => {
    if (!card) return;
    const created = await addCollection(name);
    await patchCardCollectionIds((ids) =>
      ids.includes(created.id) ? ids : [...ids, created.id]
    );
  };

  const openPaletteColorSearch = (hex: string) => {
    startColorSearch(navigate, searchParams, hex);
  };

  const videoTier =
    card?.type === 'video' && card.originalRelativePath
      ? getVideoPlaybackTierFromPath(card.originalRelativePath)
      : null;

  const { prefs } = useAppPreferences();
  const videoAutoplay = prefs?.videoAutoplay !== false;

  const bookmarkIconClass = isBookmarkHovered
    ? inMoodboard
      ? 'arc-icon-bookmark-minus'
      : 'arc-icon-bookmark-plus'
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

  const { onCardContextMenu: onSimilarCardContextMenu, contextMenuLayer: similarContextMenuLayer } =
    useGalleryCardContextMenu({
      scope: inTrash ? { kind: 'trash' } : { kind: 'library' },
      cards: similar,
      moodboardCardIds,
      onOpenCard,
      onToggleMoodboard: (id) => void handleSimilarToggleMoodboard(id),
      onFindSimilar: handleSimilarFind,
      onCardDeleted: async () => {
        setSimilar(await listSimilarCards(cardId, 15));
      }
    });

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
          className={`arc-card-detail-shell${similar.length > 0 ? ' arc-card-detail-shell--has-similar' : ''}`}
        >
        <div className="arc-card-detail-main-row" style={mainRowStyle}>
          <div className="arc-card-detail-preview arc-card-detail-preview--video panel elevation-sunken">
            {src && card?.type === 'video' ? (
              <CardDetailVideoPlayer
                cardId={card.id}
                src={src}
                autoplay={videoAutoplay}
                videoWidth={card.width}
                videoHeight={card.height}
                fileSizeBytes={card.fileSize}
                onOpenInfo={() => setInfoOpen(true)}
                videoNote={
                  videoTier && videoTier !== 'html5' ? videoPlaybackDescription(videoTier) : null
                }
                playerRef={videoPlayerRef}
                onCardUpdated={(updated) => {
                  setCard(updated);
                  cardRef.current = updated;
                  setThumbBudgetEpoch((epoch) => epoch + 1);
                  void reloadCard(updated.id);
                }}
                onToast={showCopyAlert}
              />
            ) : src || (thumbSrc && card?.type !== 'video') ? (
              card?.type === 'image' && card ? (
                <CardDetailImageViewport
                  card={card}
                  src={src ?? thumbSrc ?? ''}
                  onInfoClick={() => setInfoOpen(true)}
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
                    }}
                  >
                    <span className="btn-icon-only__glyph arc-icon-external-link" aria-hidden="true" />
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
                            setActionAlert({ message: 'Карточка добавлена в мудборд', variant: 'brand' });
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
                          setActionAlert({ message: 'Карточка убрана из мудборда', variant: 'brand' });
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
                        <span className="btn-icon-only__glyph arc-icon-arrow-up-right" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                  {hasAiCaption ? (
                    <div className="arc-card-detail-description-editor">
                      <div
                        className="arc-card-detail-description-tabs tabs arc-ui-kit-scope"
                        data-btn-size="s"
                        role="tablist"
                        aria-label="Описание карточки"
                      >
                        <button
                          type="button"
                          className={`tab-button${descriptionTab === 'description' ? ' is-active' : ''}`}
                          role="tab"
                          aria-selected={descriptionTab === 'description'}
                          id="arc-card-detail-desc-tab-description"
                          aria-controls="arc-card-detail-desc-panel"
                          onClick={() => setDescriptionTab('description')}
                        >
                          Описание
                        </button>
                        <button
                          type="button"
                          className={`tab-button${descriptionTab === 'ai' ? ' is-active' : ''}`}
                          role="tab"
                          aria-selected={descriptionTab === 'ai'}
                          id="arc-card-detail-desc-tab-ai"
                          aria-controls="arc-card-detail-desc-panel"
                          onClick={() => setDescriptionTab('ai')}
                        >
                          AI описание
                        </button>
                      </div>
                      <label className="field">
                        <textarea
                          id="arc-card-detail-desc-panel"
                          className="input textarea"
                          role="tabpanel"
                          aria-labelledby={
                            descriptionTab === 'ai'
                              ? 'arc-card-detail-desc-tab-ai'
                              : 'arc-card-detail-desc-tab-description'
                          }
                          placeholder={descriptionTab === 'ai' ? 'AI описание' : 'Описание'}
                          rows={4}
                          value={descriptionTab === 'ai' ? (card?.aiCaption ?? '') : description}
                          readOnly={descriptionTab === 'ai'}
                          onChange={
                            descriptionTab === 'ai'
                              ? undefined
                              : (e) => {
                                  const v = e.target.value;
                                  setDescription(v);
                                  scheduleDescriptionSave(v);
                                }
                          }
                        />
                      </label>
                    </div>
                  ) : (
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
                  )}
                </div>
              </CollapsibleSection>

              <div className="arc-card-detail-section-sep" role="separator" />

              <CollapsibleSection
                title="Метки"
                count={tagsSorted.length}
                footer={addRowButton('Добавить метку', () => setTagsModalOpen(true))}
              >
                {tagsSorted.length > 0 && (
                  <div className="arc-card-detail-tags">
                    {tagsSorted.map(({ tag, colorHex }) => {
                      const hasTipText = Boolean(tag.description?.trim());
                      const hasTipImage = Boolean(tag.tooltipImageDataUrl?.startsWith('data:image/'));
                      const canShowTooltip = hasTipText || hasTipImage;

                      const chipButton = (
                        <button
                          type="button"
                          className="arc-card-detail-tag-chip"
                          onClick={() => openTagSearch(tag.id)}
                          aria-label={`Искать по метке «${tag.name}»`}
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
                )}
              </CollapsibleSection>

              <div className="arc-card-detail-section-sep" role="separator" />

              <CollapsibleSection
                title="Коллекции"
                count={collectionsResolved.length}
                footer={addRowButton('Добавить в коллекцию', () => setCollectionsModalOpen(true))}
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
          </aside>
        </div>

        {similar.length > 0 ? (
          <section className="arc-card-detail-similar" data-interface-tour-anchor="card-detail-similar">
            <div className="arc-card-detail-similar-head">
              <p className="text-l">Похожие изображения</p>
              <span className="text-s arc-card-detail-section-count">{similar.length}</span>
            </div>
            <SimilarCardsMasonry
              cards={similar}
              srcMap={similarSrcMap}
              moodboardCardIds={moodboardCardIds}
              inTrash={inTrash}
              onOpenCard={onOpenCard}
              onFindSimilar={(id) => void handleSimilarFind(id)}
              onToggleMoodboard={inTrash ? undefined : (id) => void handleSimilarToggleMoodboard(id)}
              onCardContextMenu={onSimilarCardContextMenu}
            />
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

      {similarContextMenuLayer}
    </>
  );

  if (!render) return null;

  return createPortal(overlay, document.body);
}
