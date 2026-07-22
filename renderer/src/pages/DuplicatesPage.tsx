import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/empty-state';
import DuplicatesReadyState from '../components/duplicates/DuplicatesReadyState';
import DuplicatesSidebar from '../components/duplicates/DuplicatesSidebar';
import DuplicatesResultsView from '../components/duplicates/DuplicatesResultsView';
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
import {
  ARC_CARDS_CHANGED_EVENT,
  addSkippedDuplicatePair,
  getDuplicateSimilarityThresholdPct,
  setDuplicateSimilarityThresholdPct,
  softDeleteCard
} from '../services/db';
import { EMPTY_STATE_COPY } from '../content/emptyStates';

type Phase = 'ready' | 'scanning' | 'results';

function pairKey(pair: ScannedDuplicatePair): string {
  return `${pair.cardIdA}:${pair.cardIdB}`;
}

function smallThumbRel(card: ScannedDuplicatePair['cardA']): string | null {
  if (!card) return null;
  return card.thumbSRelativePath ?? card.thumbRelativePath ?? card.thumbMRelativePath ?? card.originalRelativePath;
}

export default function DuplicatesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const alertHandledRef = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => readDuplicatesSidebarWidth());
  const splitDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  useEffect(() => {
    void getDuplicateSimilarityThresholdPct().then(setThreshold);
    if (window.arc?.getLibraryPath) {
      void window.arc.getLibraryPath().then((p) => setLibraryRootAbs(p ?? null));
    }
  }, []);

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

      const rels = new Set<string>();
      for (const pair of scannedPairs) {
        const a = smallThumbRel(pair.cardA);
        const b = smallThumbRel(pair.cardB);
        if (a) rels.add(a);
        if (b) rels.add(b);
      }
      if (window.arc?.toFileUrls && rels.size > 0) {
        setThumbUrls(await window.arc.toFileUrls([...rels]));
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

      // Lock без плашки «Идёт операция…» — статус поиска на кнопке страницы.
      const began = await arc.maintenanceBegin?.({ silentUi: true });
      const lockToken = began && 'token' in began ? began.token : undefined;
      try {
        const res = await arc.runDuplicateScan({ thresholdPct: threshold, resetSession });
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
        await arc.maintenanceEnd?.(lockToken);
      }
    },
    [threshold, applyResults]
  );

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
      const a = currentPair.cardA ? await arc.toFileUrl(cardPreviewRel(currentPair.cardA)) : null;
      const b = currentPair.cardB ? await arc.toFileUrl(cardPreviewRel(currentPair.cardB)) : null;
      if (cancelled) return;
      setUrlA(a);
      setUrlB(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPair]);

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
      } finally {
        setBusy(false);
      }
    },
    [currentPair, busy, selectedIndex, advanceSelection]
  );

  const handleNotDuplicate = () =>
    currentPair &&
    resolvePair('notDuplicate', () => addSkippedDuplicatePair(currentPair.cardIdA, currentPair.cardIdB));

  const handleSkip = () =>
    currentPair &&
    resolvePair('skipped', async () => {
      await window.arc?.duplicateSessionSkipPair?.(currentPair.cardIdA, currentPair.cardIdB);
    });

  const handleDelete = (cardId: string) =>
    currentPair &&
    resolvePair('replaced', async () => {
      await softDeleteCard(cardId);
      await window.arc?.duplicateSessionSkipPair?.(currentPair.cardIdA, currentPair.cardIdB);
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
    resolvePair('replaced', async () => {
      await window.arc?.mergeDuplicateCards?.(primaryId, secondaryId);
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

  const dismissPair = useCallback(
    (index: number) => {
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
    },
    []
  );

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
          scanning={phase === 'scanning'}
          noResultsNotice={noResultsNotice}
          progress={phase === 'scanning' ? progress : null}
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
            libraryRootAbs={libraryRootAbs}
            busy={busy}
            queueComplete={queueComplete}
            onGoToLibrary={() => navigate('/gallery')}
            onNotDuplicate={() => void handleNotDuplicate()}
            onSkip={() => void handleSkip()}
            onDeleteA={() => currentPair && void handleDelete(currentPair.cardIdA)}
            onDeleteB={() => currentPair && void handleDelete(currentPair.cardIdB)}
            onMergeA={() => currentPair && void handleMerge(currentPair.cardIdA, currentPair.cardIdB)}
            onMergeB={() => currentPair && void handleMerge(currentPair.cardIdB, currentPair.cardIdA)}
          />
        </div>
      ) : null}
    </div>
  );
}
