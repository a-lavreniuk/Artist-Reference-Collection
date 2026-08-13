import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DuplicatesReadyState, { type DuplicatesScanScopeMode } from '../components/duplicates/DuplicatesReadyState';
import DuplicatesSidebar from '../components/duplicates/DuplicatesSidebar';
import DuplicatesResultsView from '../components/duplicates/DuplicatesResultsView';
import ConfirmDuplicateTrashModal from '../components/duplicates/ConfirmDuplicateTrashModal';
import {
  clampDuplicatesSidebarWidth,
  readDuplicatesSidebarWidth,
  writeDuplicatesSidebarWidth
} from '../components/duplicates/duplicatesSidebarWidth';
import { cardPreviewRel } from '../components/duplicates/duplicateCompareUtils';
import type {
  DuplicatePairStatus,
  DuplicatesCompareMode,
  ScannedDuplicatePair
} from '../components/duplicates/duplicateCompareTypes';
import { isCrossLibraryPair, scannedPairKey } from '../components/duplicates/duplicateCompareTypes';
import {
  ARC_CARDS_CHANGED_EVENT,
  getDuplicateSimilarityThresholdPct,
  setDuplicateSimilarityThresholdPct
} from '../services/db';
import { useLibraries } from '../hooks/useLibraries';
import { requestDestructiveConfirm } from '../services/destructiveConfirm';
import { showAppNotification } from '../services/notificationService';

type Phase = 'ready' | 'scanning' | 'results';

function pairKey(pair: ScannedDuplicatePair): string {
  return scannedPairKey(pair);
}

function smallThumbRel(card: ScannedDuplicatePair['cardA']): string | null {
  if (!card) return null;
  return card.thumbSRelativePath ?? card.thumbRelativePath ?? card.thumbMRelativePath ?? card.originalRelativePath;
}

function mediaPathForCard(root: string | null | undefined, abs: string | null | undefined, card: ScannedDuplicatePair['cardA']): string | null {
  if (abs) return abs;
  if (!card) return null;
  const rel = cardPreviewRel(card);
  if (!rel) return null;
  if (!root) return rel;
  const trimmedRoot = root.replace(/[\\/]+$/, '');
  return `${trimmedRoot}/${rel.replace(/\\/g, '/')}`;
}

export default function DuplicatesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { libraries } = useLibraries();
  const [phase, setPhase] = useState<Phase>('ready');
  const [threshold, setThreshold] = useState(85);
  const [busy, setBusy] = useState(false);
  const [noResultsNotice, setNoResultsNotice] = useState(false);

  const [pairs, setPairs] = useState<ScannedDuplicatePair[]>([]);
  const [statuses, setStatuses] = useState<Record<string, DuplicatePairStatus>>({});
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<DuplicatesCompareMode>('sideBySide');

  const [scannedCards, setScannedCards] = useState(0);
  const [spaceSavedBytes, setSpaceSavedBytes] = useState(0);
  const [progress, setProgress] = useState({ scannedCards: 0, totalCards: 0, duplicatesFound: 0, etaMs: null as number | null });

  const [libraryRootAbs, setLibraryRootAbs] = useState<string | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [urlA, setUrlA] = useState<string | null>(null);
  const [urlB, setUrlB] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<DuplicatesScanScopeMode>('current');
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ side: 'a' | 'b' } | null>(null);

  const alertHandledRef = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => readDuplicatesSidebarWidth());
  const splitDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  useEffect(() => {
    void getDuplicateSimilarityThresholdPct().then(setThreshold);
    const refreshLibraryRoot = () => {
      if (!window.arc?.getLibraryPath) {
        setLibraryRootAbs(null);
        return;
      }
      void window.arc.getLibraryPath().then((p) => setLibraryRootAbs(p ?? null));
    };
    refreshLibraryRoot();
    const onLibraryChanged = () => {
      refreshLibraryRoot();
      setPhase('ready');
      setPairs([]);
      setStatuses({});
      setSelectedIndex(0);
      setThumbUrls({});
      setUrlA(null);
      setUrlB(null);
      setNoResultsNotice(false);
      setScannedCards(0);
      setSpaceSavedBytes(0);
      setProgress({ scannedCards: 0, totalCards: 0, duplicatesFound: 0, etaMs: null });
    };
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => window.removeEventListener('arc:library-changed', onLibraryChanged);
  }, []);

  useEffect(() => {
    if (selectedLibraryIds.length > 0) return;
    if (libraries.length === 0) return;
    setSelectedLibraryIds(libraries.map((lib) => lib.id));
  }, [libraries, selectedLibraryIds.length]);

  useEffect(() => {
    const onResize = () => {
      setSidebarWidth((current) => clampDuplicatesSidebarWidth(current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onSplitPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    splitDragRef.current = { startX: event.clientX, startW: sidebarWidth };
  };

  const onSplitPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!splitDragRef.current) return;
    const delta = event.clientX - splitDragRef.current.startX;
    setSidebarWidth(clampDuplicatesSidebarWidth(splitDragRef.current.startW + delta));
  };

  const finishSplitDrag = () => {
    if (!splitDragRef.current) return;
    splitDragRef.current = null;
    writeDuplicatesSidebarWidth(sidebarWidthRef.current);
  };

  const applyResults = useCallback(
    async (
      scannedPairs: ScannedDuplicatePair[],
      stats: { scannedCards: number; spaceSavedBytes: number }
    ) => {
      const nextStatuses: Record<string, DuplicatePairStatus> = {};
      for (const pair of scannedPairs) nextStatuses[pairKey(pair)] = 'queued';
      setPairs(scannedPairs);
      setStatuses(nextStatuses);
      setSelectedIndex(0);
      setScannedCards(stats.scannedCards);
      setSpaceSavedBytes(stats.spaceSavedBytes);

      const paths = new Set<string>();
      for (const pair of scannedPairs) {
        const a = pair.previewAbsA || smallThumbRel(pair.cardA);
        const b = pair.previewAbsB || smallThumbRel(pair.cardB);
        if (a) paths.add(a);
        if (b) paths.add(b);
      }
      if (window.arc?.toFileUrls && paths.size > 0) {
        setThumbUrls(await window.arc.toFileUrls([...paths]));
      } else {
        setThumbUrls({});
      }
      setPhase('results');
    },
    []
  );

  const startScan = useCallback(
    async (resetSession: boolean) => {
      const arc = window.arc;
      if (!arc?.runDuplicateScan) return;
      setNoResultsNotice(false);
      setProgress({ scannedCards: 0, totalCards: 0, duplicatesFound: 0, etaMs: null });
      setPhase('scanning');

      const unsub =
        arc.onDuplicateScanProgress?.((p) => {
          setProgress(p);
        }) ?? (() => {});

      const began = await arc.maintenanceBegin?.({ silentUi: true });
      const lockToken = began && 'token' in began ? began.token : undefined;
      try {
        const scope =
          libraries.length > 1
            ? {
                mode: scopeMode,
                libraryIds: scopeMode === 'ids' ? selectedLibraryIds : undefined
              }
            : { mode: 'current' as const };
        const res = await arc.runDuplicateScan({ thresholdPct: threshold, resetSession, scope });
        if (res.cancelled) {
          setPhase('ready');
          return;
        }
        if (res.pairs.length === 0) {
          setNoResultsNotice(true);
          setPhase('ready');
          return;
        }
        await applyResults(res.pairs as ScannedDuplicatePair[], {
          scannedCards: res.scannedCards,
          spaceSavedBytes: res.spaceSavedBytes
        });
      } catch {
        setPhase('ready');
      } finally {
        unsub();
        if (lockToken) await arc.maintenanceEnd?.(lockToken);
      }
    },
    [threshold, applyResults, libraries.length, scopeMode, selectedLibraryIds]
  );

  const cancelScan = useCallback(() => {
    void window.arc?.cancelDuplicateScan?.();
  }, []);

  useEffect(() => {
    if (alertHandledRef.current) return;
    if (searchParams.get('from') !== 'alert') return;
    alertHandledRef.current = true;
    void startScan(false);
  }, [searchParams, startScan]);

  const currentPair = pairs[selectedIndex] ?? null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const arc = window.arc;
      if (!arc?.toFileUrl || !currentPair) {
        setUrlA(null);
        setUrlB(null);
        return;
      }
      const aPath = mediaPathForCard(currentPair.libraryRootA ?? libraryRootAbs, currentPair.previewAbsA, currentPair.cardA);
      const bPath = mediaPathForCard(currentPair.libraryRootB ?? libraryRootAbs, currentPair.previewAbsB, currentPair.cardB);
      const a = aPath ? await arc.toFileUrl(aPath) : null;
      const b = bPath ? await arc.toFileUrl(bPath) : null;
      if (cancelled) return;
      setUrlA(a);
      setUrlB(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPair, libraryRootAbs]);

  const advanceSelection = useCallback(
    (fromIndex: number, updatedStatuses: Record<string, DuplicatePairStatus>) => {
      for (let step = 1; step <= pairs.length; step++) {
        const idx = (fromIndex + step) % pairs.length;
        const pair = pairs[idx];
        if (pair && (updatedStatuses[pairKey(pair)] ?? 'queued') === 'queued') {
          setSelectedIndex(idx);
          return;
        }
      }
      setSelectedIndex(fromIndex);
    },
    [pairs]
  );

  const resolvePair = useCallback(
    async (status: DuplicatePairStatus, action: () => Promise<void>) => {
      if (!currentPair || busy) return;
      setBusy(true);
      try {
        await action();
        const key = pairKey(currentPair);
        setStatuses((prev) => {
          const next = { ...prev, [key]: status };
          advanceSelection(selectedIndex, next);
          return next;
        });
        window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
      } catch (err) {
        showAppNotification({
          message: err instanceof Error ? err.message : 'Не удалось выполнить действие',
          variant: 'danger'
        });
      } finally {
        setBusy(false);
      }
    },
    [currentPair, busy, selectedIndex, advanceSelection]
  );

  const skipPayload = (pair: ScannedDuplicatePair) => ({
    cardIdA: pair.cardIdA,
    cardIdB: pair.cardIdB,
    libraryIdA: pair.libraryIdA,
    libraryIdB: pair.libraryIdB
  });

  const handleNotDuplicate = () =>
    currentPair &&
    resolvePair('notDuplicate', async () => {
      if (window.arc?.duplicateAddSkippedPair) {
        await window.arc.duplicateAddSkippedPair(skipPayload(currentPair));
        return;
      }
    });

  const handleSkip = () =>
    currentPair &&
    resolvePair('skipped', async () => {
      await window.arc?.duplicateSessionSkipPair?.(skipPayload(currentPair));
    });

  const handleDelete = (side: 'a' | 'b') =>
    currentPair &&
    resolvePair('replaced', async () => {
      const cardId = side === 'a' ? currentPair.cardIdA : currentPair.cardIdB;
      const libraryId = side === 'a' ? currentPair.libraryIdA : currentPair.libraryIdB;
      const token = await requestDestructiveConfirm({
        kind: 'duplicate-delete-card',
        binding: `${libraryId ?? ''}:${cardId}`
      });
      if (window.arc?.duplicateSoftDeleteCard) {
        await window.arc.duplicateSoftDeleteCard({ cardId, libraryId, confirmToken: token });
      }
      await window.arc?.duplicateSessionSkipPair?.(skipPayload(currentPair));
      const key = pairKey(currentPair);
      setPairs((prev) =>
        prev.map((p) => {
          if (pairKey(p) !== key) return p;
          return {
            ...p,
            cardA: p.cardIdA === cardId ? null : p.cardA,
            cardB: p.cardIdB === cardId ? null : p.cardB
          };
        })
      );
    });

  const handleMerge = (primaryId: string, secondaryId: string) =>
    currentPair &&
    !isCrossLibraryPair(currentPair) &&
    resolvePair('replaced', async () => {
      await window.arc?.mergeDuplicateCards?.(primaryId, secondaryId, currentPair.libraryIdA);
      const key = pairKey(currentPair);
      setPairs((prev) =>
        prev.map((p) => {
          if (pairKey(p) !== key) return p;
          return {
            ...p,
            cardA: p.cardIdA === secondaryId ? null : p.cardA,
            cardB: p.cardIdB === secondaryId ? null : p.cardB
          };
        })
      );
    });

  const dismissPair = useCallback((index: number) => {
    setPairs((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setSelectedIndex((sel) => {
        if (next.length === 0) return 0;
        if (index < sel) return sel - 1;
        if (index === sel) return Math.min(sel, next.length - 1);
        return sel;
      });
      return next;
    });
  }, []);

  const onThresholdChange = useCallback((value: number) => {
    setThreshold(value);
    void setDuplicateSimilarityThresholdPct(value);
  }, []);

  const resetToReady = useCallback(() => {
    setPhase('ready');
    setNoResultsNotice(false);
    setPairs([]);
    setStatuses({});
    setSelectedIndex(0);
    setMode('sideBySide');
    setScannedCards(0);
    setSpaceSavedBytes(0);
    setProgress({ scannedCards: 0, totalCards: 0, duplicatesFound: 0, etaMs: null });
    setThumbUrls({});
    setUrlA(null);
    setUrlB(null);
  }, []);

  const duplicatesFound = pairs.length;

  const queueComplete = useMemo(() => {
    if (phase !== 'results') return false;
    if (pairs.length === 0) return true;
    return pairs.every((pair) => (statuses[pairKey(pair)] ?? 'queued') !== 'queued');
  }, [phase, pairs, statuses]);

  const pendingLibraryName =
    pendingDelete && currentPair
      ? pendingDelete.side === 'a'
        ? currentPair.libraryNameA ?? 'библиотека'
        : currentPair.libraryNameB ?? 'библиотека'
      : '';

  return (
    <div
      className="arc-duplicates-outlet arc-duplicates-page"
      data-interface-tour-anchor="duplicates-page"
      style={{ ['--arc-duplicates-sidebar-w' as string]: `${sidebarWidth}px` }}
    >
      {phase === 'ready' || phase === 'scanning' ? (
        <DuplicatesReadyState
          threshold={threshold}
          onThresholdChange={onThresholdChange}
          onScan={() => void startScan(true)}
          onCancelScan={cancelScan}
          scanning={phase === 'scanning'}
          noResultsNotice={noResultsNotice}
          progress={phase === 'scanning' ? progress : null}
          libraries={libraries}
          scopeMode={scopeMode}
          onScopeModeChange={setScopeMode}
          selectedLibraryIds={selectedLibraryIds}
          onToggleLibraryId={(id) =>
            setSelectedLibraryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
          }
        />
      ) : null}

      {phase === 'results' ? (
        <div className="arc-duplicates-page-main-row">
          <DuplicatesSidebar
            scannedCards={scannedCards}
            duplicatesFound={duplicatesFound}
            spaceSavedBytes={spaceSavedBytes}
            mode={mode}
            onModeChange={setMode}
            pairs={pairs}
            statuses={statuses}
            thumbUrls={thumbUrls}
            selectedIndex={selectedIndex}
            onSelectPair={setSelectedIndex}
            onDismissPair={dismissPair}
            onRescan={resetToReady}
          />

          <button
            type="button"
            className="arc-layout-splitter"
            aria-label="Изменить ширину панелей"
            onPointerDown={onSplitPointerDown}
            onPointerMove={onSplitPointerMove}
            onPointerUp={finishSplitDrag}
            onPointerCancel={finishSplitDrag}
            onLostPointerCapture={finishSplitDrag}
          />

          <DuplicatesResultsView
            mode={mode}
            cardA={currentPair?.cardA ?? null}
            cardB={currentPair?.cardB ?? null}
            urlA={urlA}
            urlB={urlB}
            libraryRootA={currentPair?.libraryRootA ?? libraryRootAbs}
            libraryRootB={currentPair?.libraryRootB ?? libraryRootAbs}
            libraryNameA={currentPair?.libraryNameA}
            libraryNameB={currentPair?.libraryNameB}
            crossLibrary={currentPair ? isCrossLibraryPair(currentPair) : false}
            busy={busy}
            queueComplete={queueComplete}
            onGoToLibrary={() => navigate('/gallery')}
            onNotDuplicate={() => void handleNotDuplicate()}
            onSkip={() => void handleSkip()}
            onDeleteA={() => setPendingDelete({ side: 'a' })}
            onDeleteB={() => setPendingDelete({ side: 'b' })}
            onMergeA={() => currentPair && void handleMerge(currentPair.cardIdA, currentPair.cardIdB)}
            onMergeB={() => currentPair && void handleMerge(currentPair.cardIdB, currentPair.cardIdA)}
          />
        </div>
      ) : null}

      {pendingDelete && currentPair ? (
        <ConfirmDuplicateTrashModal
          libraryName={pendingLibraryName}
          onClose={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete.side) ?? Promise.resolve()}
        />
      ) : null}
    </div>
  );
}
