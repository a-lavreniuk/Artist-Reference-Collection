import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ARC_CARDS_CHANGED_EVENT,
  isLibraryConfigured,
  addCollection,
  getAllCollections,
  softDeleteCard
} from '../../services/db';
import { isImportableMediaPath } from '../../media/allowedImportExtensions';
import { getImportSourceFilesAction } from '../../import/importDefaults';
import {
  pluralFilesRu,
  tryEnqueueImportJob,
  type EnqueueImportResult,
  type ImportQueueJob
} from '../../import/importQueue';
import {
  collectionIdFromPathname,
  droppedPathsFromClipboard,
  isPasteImportBlocked
} from '../../import/pasteImport';
import type { FolderImportPlan } from '../../import/folderImportPlan';
import {
  folderBaseName,
  resolveFolderCollectionTarget,
  SINGLE_FOLDER_IMPORT_PLAN
} from '../../import/folderImportPlan';
import { showAppNotification } from '../../services/notificationService';
import SourceFilesModal from './SourceFilesModal';
import ImportDuplicatesModal, { type ImportDuplicateConflict } from './ImportDuplicatesModal';
import ImportFolderCollectionsModal, {
  type FolderImportDropContext
} from './ImportFolderCollectionsModal';
import ImportQueueToast, { type ImportQueueProgress } from './ImportQueueToast';
import ImportFailuresModal, { type ImportFailureItem } from './ImportFailuresModal';
import ImportCancelKeepModal from './ImportCancelKeepModal';
import MessageModal from '../layout/MessageModal';
import { ImportContext } from './ImportContext';
import { useImportDropzonePerimeterDash } from './useImportDropzonePerimeterDash';
import { bulkAddToCollection } from '../gallery/galleryBulkActions';
import type { CollectionRecord } from '../../services/arcSchema';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import {
  APP_MENU_IMPORT_FILES_EVENT,
  takeStashedAppMenuImportPaths
} from '../../hooks/useAppMenuActions';

function isFileDragEvent(e: DragEvent): boolean {
  const dt = e.dataTransfer;
  if (!dt) return false;
  if (dt.files && dt.files.length > 0) return true;
  const types = Array.from(dt.types);
  return types.includes('Files') || types.includes('application/x-moz-file');
}

function isDragLeavingWindow(e: DragEvent): boolean {
  const { clientX, clientY } = e;
  return (
    clientX <= 0 ||
    clientY <= 0 ||
    clientX >= window.innerWidth ||
    clientY >= window.innerHeight
  );
}

const SUPPRESSED_NATIVE_MEDIA_DRAG_ROOTS = [
  '.arc-modal-host',
  '.arc-card-detail-overlay',
  '.arc-gallery-collections-strip'
] as const;

function isSuppressedNativeMediaDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const inSuppressedRoot = SUPPRESSED_NATIVE_MEDIA_DRAG_ROOTS.some((selector) =>
    target.closest(selector)
  );
  if (!inSuppressedRoot) return false;
  return (
    target instanceof HTMLImageElement ||
    target instanceof HTMLVideoElement ||
    !!target.closest('img, video')
  );
}

type ImportPhase =
  | 'idle'
  | 'overlay'
  | 'importing'
  | 'source-modal'
  | 'duplicate-modal'
  | 'folder-modal'
  | 'failures-modal'
  | 'cancel-keep-modal';

export default function ImportHost({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const [maintenanceLocked, setMaintenanceLocked] = useState(false);
  const [progress, setProgress] = useState<ImportQueueProgress | null>(null);
  const [sourceModalPaths, setSourceModalPaths] = useState<string[] | null>(null);
  const [duplicateConflicts, setDuplicateConflicts] = useState<ImportDuplicateConflict[]>([]);
  const [duplicateIndex, setDuplicateIndex] = useState(0);
  const [importBusy, setImportBusy] = useState(false);
  const [folderDropContext, setFolderDropContext] = useState<FolderImportDropContext | null>(null);
  const [emptyFolderName, setEmptyFolderName] = useState<string | null>(null);
  const [duplicateAssignCollectionId, setDuplicateAssignCollectionId] = useState<string | undefined>(
    undefined
  );
  const [failures, setFailures] = useState<ImportFailureItem[]>([]);
  const [failuresAddedCount, setFailuresAddedCount] = useState(0);
  const [cancelKeepCount, setCancelKeepCount] = useState(0);
  const [cancelKeepIds, setCancelKeepIds] = useState<string[]>([]);

  const assignCollectionIdRef = useRef<string | null>(null);
  const emptyFolderResolverRef = useRef<(() => void) | null>(null);
  const importFlowResolverRef = useRef<(() => void) | null>(null);
  const overlayOpenedManuallyRef = useRef(false);
  const pendingMenuImportRef = useRef<string[] | null>(null);
  const isDraggingFilesRef = useRef(false);
  const suppressFileDragRef = useRef(false);
  const ctaWrapRef = useRef<HTMLDivElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const borderRectRef = useRef<SVGRectElement>(null);
  const queueRef = useRef<ImportQueueJob[]>([]);
  const drainingRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const modalBlockingRef = useRef(false);
  const phaseRef = useRef<ImportPhase>('idle');

  useEffect(() => {
    phaseRef.current = phase;
    modalBlockingRef.current =
      phase === 'source-modal' ||
      phase === 'duplicate-modal' ||
      phase === 'folder-modal' ||
      phase === 'failures-modal' ||
      phase === 'cancel-keep-modal' ||
      emptyFolderName != null;
  }, [phase, emptyFolderName]);

  useEffect(() => {
    void (async () => {
      setLibraryReady(await isLibraryConfigured());
    })();
    const onLib = () => {
      void (async () => setLibraryReady(await isLibraryConfigured()))();
    };
    window.addEventListener('arc:library-changed', onLib);
    return () => window.removeEventListener('arc:library-changed', onLib);
  }, []);

  useEffect(() => {
    if (!window.arc?.onMaintenance) return undefined;
    return window.arc.onMaintenance((v) => setMaintenanceLocked(v));
  }, []);

  const libraryOpen = libraryReady && !maintenanceLocked;

  const assignImportedCards = useCallback(async (cardIds: string[]) => {
    const collectionId = assignCollectionIdRef.current;
    if (!collectionId || cardIds.length === 0) return;
    await bulkAddToCollection(cardIds, collectionId);
  }, []);

  const showEmptyFolderModal = useCallback((folderName: string) => {
    return new Promise<void>((resolve) => {
      emptyFolderResolverRef.current = resolve;
      setEmptyFolderName(folderName);
    });
  }, []);

  const closeEmptyFolderModal = useCallback(() => {
    setEmptyFolderName(null);
    const resolve = emptyFolderResolverRef.current;
    emptyFolderResolverRef.current = null;
    resolve?.();
  }, []);

  const waitForImportFlow = useCallback(() => {
    return new Promise<void>((resolve) => {
      importFlowResolverRef.current = resolve;
    });
  }, []);

  const resolveImportFlow = useCallback(() => {
    const resolve = importFlowResolverRef.current;
    importFlowResolverRef.current = null;
    resolve?.();
  }, []);

  const requestCancelImport = useCallback(() => {
    cancelRequestedRef.current = true;
    setProgress((prev) => (prev ? { ...prev, cancelling: true } : prev));
    window.arc?.abortImportFiles?.();
  }, []);

  const finishWithFailures = useCallback(
    async (added: number, items: ImportFailureItem[]) => {
      if (items.length === 0) return false;
      setFailures(items);
      setFailuresAddedCount(added);
      setPhase('failures-modal');
      await waitForImportFlow();
      return true;
    },
    [waitForImportFlow]
  );

  const finishWithCancelKeep = useCallback(
    async (cardIds: string[]) => {
      if (cardIds.length === 0) return false;
      setCancelKeepIds(cardIds);
      setCancelKeepCount(cardIds.length);
      setPhase('cancel-keep-modal');
      await waitForImportFlow();
      return true;
    },
    [waitForImportFlow]
  );

  const runImportBatch = useCallback(
    async (rawPaths: string[], options?: { skipSourceFiles?: boolean }) => {
      if (!window.arc || !libraryOpen) return;
      const skipSourceFiles = Boolean(options?.skipSourceFiles);
      const paths = rawPaths.filter((p) => isImportableMediaPath(p));
      if (!paths.length) return;

      setImportBusy(true);
      setPhase('importing');
      setProgress({ current: 0, total: paths.length, etaMs: null, cancelling: cancelRequestedRef.current });
      overlayOpenedManuallyRef.current = false;

      const unsub =
        window.arc.onImportFilesProgress?.((p) => {
          setProgress({
            current: p.current,
            total: p.total,
            etaMs: p.etaMs ?? null,
            cancelling: cancelRequestedRef.current
          });
        }) ?? (() => {});

      try {
        const dupMatches =
          window.arc.checkImportDuplicates != null
            ? await window.arc.checkImportDuplicates(paths)
            : [];
        const conflictPaths = new Set(dupMatches.map((m) => m.path));
        const cleanPaths = paths.filter((p) => !conflictPaths.has(p));

        let successes: Array<{ row: { id: string }; path: string }> = [];
        let batchFailures: ImportFailureItem[] = [];
        let cancelled = cancelRequestedRef.current;

        if (!cancelled && cleanPaths.length > 0) {
          const outcome = await window.arc.importFiles(cleanPaths);
          cancelled = outcome.cancelled;
          for (const r of outcome.results) {
            if (r.ok) successes.push({ row: { id: r.row.id }, path: r.path });
            else batchFailures.push({ path: r.path, error: r.error });
          }
          const importedIds = successes.map((s) => s.row.id);
          await assignImportedCards(importedIds);
        }

        const conflicts = dupMatches.filter((m): m is ImportDuplicateConflict => m.existingCard != null);

        if (cancelled) {
          const n = successes.length;
          const word = pluralFilesRu(n);
          void window.arc.appendHistoryLine(
            n > 0 ? `Импорт отменён: добавлено ${n} ${word}` : 'Импорт отменён'
          );
          if (n > 0) {
            window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
            showAppNotification({
              message: `Добавлено ${n} ${word} до отмены`,
              variant: 'warning',
              prefKey: 'notifyFilesAdded'
            });
          } else {
            showAppNotification({
              message: 'Импорт отменён',
              variant: 'info',
              prefKey: 'notifyFilesAdded'
            });
          }
          setProgress(null);
          const showedKeep = await finishWithCancelKeep(successes.map((s) => s.row.id));
          if (!showedKeep) setPhase('idle');
          return;
        }

        if (conflicts.length > 0) {
          setProgress(null);
          setDuplicateConflicts(conflicts);
          setDuplicateIndex(0);
          setDuplicateAssignCollectionId(assignCollectionIdRef.current ?? undefined);
          setPhase('duplicate-modal');

          if (successes.length > 0) {
            const n = successes.length;
            const word = pluralFilesRu(n);
            void window.arc.appendHistoryLine(`Импорт ${n} ${word}`);
            window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
            showAppNotification({
              message: n === 1 ? 'Файл успешно добавлен' : `Добавлено ${n} ${word}`,
              variant: 'success',
              prefKey: 'notifyFilesAdded'
            });
          }
          await waitForImportFlow();
          return;
        }

        const n = successes.length;
        const failed = batchFailures.length;
        if (n > 0 || failed > 0) {
          const word = pluralFilesRu(n);
          if (failed > 0) {
            void window.arc.appendHistoryLine(
              n > 0
                ? `Импорт: добавлено ${n}, не удалось ${failed}`
                : `Импорт: не удалось ${failed}`
            );
          } else if (n > 0) {
            void window.arc.appendHistoryLine(`Импорт ${n} ${word}`);
          }
          if (n > 0) {
            window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
          }
        }

        setProgress(null);

        if (failed > 0) {
          if (n > 0) {
            showAppNotification({
              message: `Добавлено ${n}, не удалось ${failed}`,
              variant: 'warning',
              prefKey: 'notifyFilesAdded'
            });
          } else {
            showAppNotification({
              message: failed === 1 ? 'Не удалось добавить файл' : `Не удалось добавить ${failed} файлов`,
              variant: 'danger',
              prefKey: 'notifyFilesAdded'
            });
          }
          await finishWithFailures(n, batchFailures);
          return;
        }

        if (n > 0) {
          showAppNotification({
            message: n === 1 ? 'Файл успешно добавлен' : `Добавлено ${n} ${pluralFilesRu(n)}`,
            variant: 'success',
            prefKey: 'notifyFilesAdded'
          });
        }

        const sourceAction = getImportSourceFilesAction();
        const sourcePaths = successes.map((s) => s.path);
        if (!skipSourceFiles && n > 0 && sourcePaths.length > 0) {
          if (sourceAction === 'ask') {
            setSourceModalPaths(sourcePaths);
            setPhase('source-modal');
            await waitForImportFlow();
          } else if (sourceAction === 'trash') {
            for (const abs of sourcePaths) {
              await window.arc.trashPath(abs);
            }
            setPhase('idle');
          } else {
            setPhase('idle');
          }
        } else {
          setPhase('idle');
        }
      } catch {
        setProgress(null);
        setPhase('idle');
        showAppNotification({
          message: 'Не удалось выполнить импорт',
          variant: 'danger',
          prefKey: 'notifyFilesAdded'
        });
      } finally {
        unsub();
        setImportBusy(false);
        setProgress(null);
      }
    },
    [assignImportedCards, finishWithCancelKeep, finishWithFailures, libraryOpen, waitForImportFlow]
  );

  const executeFolderImports = useCallback(
    async (folderPaths: string[], plan: FolderImportPlan, looseFiles: string[]) => {
      if (!window.arc?.listImportableFilesInDirectory || !libraryOpen) return;

      setImportBusy(true);
      let collections: CollectionRecord[] = await getAllCollections();
      const pendingNames = new Set<string>();

      try {
        for (const folderPath of folderPaths) {
          if (cancelRequestedRef.current) break;

          const filePaths = await window.arc.listImportableFilesInDirectory(folderPath);
          const folderName = folderBaseName(folderPath);

          if (filePaths.length === 0) {
            await showEmptyFolderModal(folderName);
            continue;
          }

          const resolved = resolveFolderCollectionTarget(
            folderName,
            collections,
            plan,
            pendingNames
          );
          if (resolved.kind === 'skip') continue;

          let collectionId = resolved.collectionId;
          if (!collectionId) {
            const createName = resolved.createName?.trim();
            if (!createName) continue;
            const created = await addCollection(createName);
            collectionId = created.id;
            collections = [...collections, created];
            pendingNames.add(createName.toLowerCase());
          }

          assignCollectionIdRef.current = collectionId;
          await runImportBatch(filePaths);
          assignCollectionIdRef.current = null;

          if (cancelRequestedRef.current) break;
        }
      } finally {
        assignCollectionIdRef.current = null;
        setImportBusy(false);
      }

      if (!cancelRequestedRef.current && looseFiles.length > 0) {
        await runImportBatch(looseFiles);
      }
    },
    [libraryOpen, runImportBatch, showEmptyFolderModal]
  );

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        if (modalBlockingRef.current) break;
        const job = queueRef.current.shift();
        if (!job) break;
        cancelRequestedRef.current = false;

        if (job.kind === 'files') {
          assignCollectionIdRef.current = job.assignCollectionId ?? null;
          try {
            await runImportBatch(job.paths, { skipSourceFiles: Boolean(job.skipSourceFiles) });
          } finally {
            assignCollectionIdRef.current = null;
            if (job.deleteAfterImport) {
              for (const abs of job.paths) {
                try {
                  await window.arc?.deleteClipboardImportTemp?.(abs);
                } catch {
                  /* ignore */
                }
              }
            }
          }
        } else {
          await executeFolderImports(
            job.folderPaths,
            job.plan as FolderImportPlan,
            job.looseFiles
          );
        }
      }
    } finally {
      drainingRef.current = false;
      if (queueRef.current.length > 0 && !modalBlockingRef.current) {
        void drainQueue();
      } else if (queueRef.current.length === 0) {
        window.arc?.notifyImportQueueIdle?.();
      }
    }
  }, [executeFolderImports, runImportBatch]);

  const enqueueJob = useCallback(
    (job: ImportQueueJob): EnqueueImportResult | null => {
      if (!libraryOpen) return null;
      const blocked =
        phaseRef.current === 'source-modal' ||
        phaseRef.current === 'duplicate-modal' ||
        phaseRef.current === 'folder-modal' ||
        phaseRef.current === 'failures-modal' ||
        phaseRef.current === 'cancel-keep-modal' ||
        emptyFolderName != null;

      const result = tryEnqueueImportJob(queueRef.current, job, { blocked });

      if (!result.ok && result.reason === 'blocked') {
        showAppNotification({
          message: 'Дождитесь закрытия окна, затем добавьте файлы снова',
          variant: 'warning',
          prefKey: 'notifyFilesAdded'
        });
        return result;
      }
      if (!result.ok && result.reason === 'limit') {
        showAppNotification({
          message:
            result.accepted > 0
              ? `В очередь принято ${result.accepted}, лимит ${result.queuedTotal} файлов`
              : 'Очередь заполнена (лимит 500 файлов)',
          variant: 'warning',
          withSound: false
        });
        if (result.accepted === 0) return result;
      }
      void drainQueue();
      return result;
    },
    [drainQueue, emptyFolderName, libraryOpen]
  );

  const handleDroppedPaths = useCallback(
    async (paths: string[]) => {
      if (!window.arc || !libraryOpen || paths.length === 0) return;

      const blocked =
        phaseRef.current === 'source-modal' ||
        phaseRef.current === 'duplicate-modal' ||
        phaseRef.current === 'folder-modal' ||
        phaseRef.current === 'failures-modal' ||
        phaseRef.current === 'cancel-keep-modal' ||
        emptyFolderName != null;
      if (blocked) {
        showAppNotification({
          message: 'Дождитесь закрытия окна, затем добавьте файлы снова',
          variant: 'warning',
          prefKey: 'notifyFilesAdded'
        });
        return;
      }

      let looseFiles = paths.filter((p) => isImportableMediaPath(p));
      let folderPaths: string[] = [];

      if (window.arc.classifyDroppedPaths) {
        const classified = await window.arc.classifyDroppedPaths(paths);
        looseFiles = classified.files.filter((p) => isImportableMediaPath(p));
        folderPaths = classified.directories;
      }

      if (folderPaths.length > 0) {
        if (folderPaths.length === 1) {
          enqueueJob({
            kind: 'folders',
            folderPaths,
            plan: SINGLE_FOLDER_IMPORT_PLAN,
            looseFiles
          });
          return;
        }
        setFolderDropContext({ folderPaths, looseFiles });
        setPhase('folder-modal');
        return;
      }

      if (looseFiles.length > 0) {
        enqueueJob({ kind: 'files', paths: looseFiles });
      }
    },
    [emptyFolderName, enqueueJob, libraryOpen]
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (!libraryOpen) return;
      if (isPasteImportBlocked(event)) return;
      const assignCollectionId = collectionIdFromPathname(location.pathname) ?? undefined;
      const droppedPaths = droppedPathsFromClipboard(
        window.arc?.getPathsForDroppedDataTransfer,
        event.clipboardData
      );
      if (droppedPaths.length > 0) {
        const importable = droppedPaths.filter((p) => isImportableMediaPath(p));
        if (importable.length === 0) return;
        event.preventDefault();
        enqueueJob({
          kind: 'files',
          paths: importable,
          skipSourceFiles: true,
          assignCollectionId
        });
        return;
      }
      if (!window.arc?.writeClipboardImageTemp && !window.arc?.readClipboardFilePaths) return;
      const arc = window.arc;
      void (async () => {
        const osRaw = await arc.readClipboardFilePaths?.();
        const osPaths = Array.isArray(osRaw) ? osRaw : [];
        if (osPaths.length > 0) {
          const importableOs = osPaths.filter((p) => isImportableMediaPath(p));
          if (importableOs.length === 0) return;
          enqueueJob({
            kind: 'files',
            paths: importableOs,
            skipSourceFiles: true,
            assignCollectionId
          });
          return;
        }
        const written = await arc.writeClipboardImageTemp?.();
        if (!written?.ok) return;
        const queued = enqueueJob({
          kind: 'files',
          paths: [written.path],
          skipSourceFiles: true,
          deleteAfterImport: true,
          assignCollectionId
        });
        if (!queued || queued.accepted === 0) {
          await arc.deleteClipboardImportTemp?.(written.path);
        }
      })();
    };
    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [enqueueJob, libraryOpen, location.pathname]);

  const startMenuImport = useCallback(
    (paths: string[]) => {
      if (paths.length === 0) return;
      if (!libraryOpen) {
        pendingMenuImportRef.current = paths;
        void window.arc?.showMainWindowFromMenu?.();
        return;
      }
      pendingMenuImportRef.current = null;
      enqueueJob({ kind: 'files', paths });
    },
    [enqueueJob, libraryOpen]
  );

  useEffect(() => {
    const onMenuImport = (event: Event) => {
      takeStashedAppMenuImportPaths();
      const paths = (event as CustomEvent<string[]>).detail;
      if (!Array.isArray(paths) || paths.length === 0) return;
      startMenuImport(paths);
    };
    window.addEventListener(APP_MENU_IMPORT_FILES_EVENT, onMenuImport);
    return () => window.removeEventListener(APP_MENU_IMPORT_FILES_EVENT, onMenuImport);
  }, [startMenuImport]);

  useEffect(() => {
    const stashed = takeStashedAppMenuImportPaths();
    if (stashed) pendingMenuImportRef.current = stashed;
    const paths = pendingMenuImportRef.current;
    if (!paths || !libraryOpen) return;
    pendingMenuImportRef.current = null;
    enqueueJob({ kind: 'files', paths });
  }, [enqueueJob, libraryOpen]);

  useEffect(() => {
    const needsWindow =
      phase === 'source-modal' ||
      phase === 'duplicate-modal' ||
      phase === 'folder-modal' ||
      phase === 'failures-modal' ||
      phase === 'cancel-keep-modal' ||
      emptyFolderName != null;
    if (!needsWindow) return;
    void window.arc?.showMainWindowFromMenu?.();
  }, [emptyFolderName, phase]);

  const closeDuplicateModal = useCallback(() => {
    setDuplicateConflicts([]);
    setDuplicateIndex(0);
    setDuplicateAssignCollectionId(undefined);
    setPhase('idle');
    resolveImportFlow();
  }, [resolveImportFlow]);

  const onDuplicateResolved = useCallback(() => {
    if (duplicateIndex + 1 < duplicateConflicts.length) {
      setDuplicateIndex((i) => i + 1);
    } else {
      window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
      setDuplicateConflicts([]);
      setDuplicateIndex(0);
      setPhase('idle');
      resolveImportFlow();
    }
  }, [duplicateIndex, duplicateConflicts.length, resolveImportFlow]);

  const clearFileDrag = useCallback(() => {
    isDraggingFilesRef.current = false;
    setIsDraggingFiles(false);
    if (!overlayOpenedManuallyRef.current) {
      setPhase((p) => (p === 'overlay' ? 'idle' : p));
    }
  }, []);

  useEffect(() => {
    if (!window.arc?.onFileDrop) return undefined;
    return window.arc.onFileDrop((paths) => {
      if (document.body.classList.contains('arc-similar-search-panel-open')) return;
      clearFileDrag();
      if (paths.length) void handleDroppedPaths(paths);
    });
  }, [clearFileDrag, handleDroppedPaths]);

  useEffect(() => {
    const onDragStart = (e: DragEvent) => {
      if (!isSuppressedNativeMediaDragTarget(e.target)) return;
      suppressFileDragRef.current = true;
      e.preventDefault();
    };

    const onDragOver = (e: DragEvent) => {
      if (document.body.classList.contains('arc-similar-search-panel-open')) return;
      if (e.target instanceof Element && e.target.closest('.arc-search-panel-similar-dropzone')) return;
      if (suppressFileDragRef.current) return;
      if (!isFileDragEvent(e)) return;
      e.preventDefault();
      const dt = e.dataTransfer;
      if (!dt) return;

      const blocked =
        phaseRef.current === 'source-modal' ||
        phaseRef.current === 'duplicate-modal' ||
        phaseRef.current === 'folder-modal' ||
        phaseRef.current === 'failures-modal' ||
        phaseRef.current === 'cancel-keep-modal' ||
        emptyFolderName != null;
      const accept = libraryOpen && !blocked;
      dt.dropEffect = accept ? 'copy' : 'none';

      if (!isDraggingFilesRef.current) {
        isDraggingFilesRef.current = true;
        setIsDraggingFiles(true);
        if (accept && !importBusy) {
          setPhase((p) => (p === 'importing' || p === 'source-modal' ? p : 'overlay'));
        }
      }
    };

    const onDragLeave = (e: DragEvent) => {
      if (!isFileDragEvent(e)) return;
      if (!isDragLeavingWindow(e)) return;
      clearFileDrag();
    };

    const onDragEnd = () => {
      suppressFileDragRef.current = false;
      clearFileDrag();
    };

    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('dragleave', onDragLeave, true);
    document.addEventListener('dragend', onDragEnd, true);
    return () => {
      document.removeEventListener('dragstart', onDragStart, true);
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('dragleave', onDragLeave, true);
      document.removeEventListener('dragend', onDragEnd, true);
    };
  }, [clearFileDrag, emptyFolderName, importBusy, libraryOpen]);

  const openImportPicker = useCallback(() => {
    if (!libraryOpen || importBusy) return;
    if (modalBlockingRef.current) return;
    overlayOpenedManuallyRef.current = true;
    setPhase('overlay');
  }, [importBusy, libraryOpen]);

  const pickFiles = useCallback(async () => {
    if (!window.arc || !libraryOpen) return;
    try {
      const pick =
        typeof window.arc.pickMediaFiles === 'function'
          ? window.arc.pickMediaFiles
          : window.arc.pickImageFiles;
      const paths = await pick.call(window.arc);
      overlayOpenedManuallyRef.current = false;
      if (!paths.length) {
        setPhase((p) => (p === 'overlay' ? 'idle' : p));
        return;
      }
      setPhase((p) => (p === 'overlay' ? 'idle' : p));
      enqueueJob({ kind: 'files', paths });
    } catch {
      overlayOpenedManuallyRef.current = false;
      setPhase((p) => (p === 'overlay' ? 'idle' : p));
    }
  }, [enqueueJob, libraryOpen]);

  const closeOverlay = useCallback(() => {
    overlayOpenedManuallyRef.current = false;
    isDraggingFilesRef.current = false;
    setPhase('idle');
    setIsDraggingFiles(false);
  }, []);

  const closeSourceModal = () => {
    setSourceModalPaths(null);
    setPhase('idle');
    resolveImportFlow();
  };

  const trashSources = async () => {
    if (!window.arc || !sourceModalPaths?.length) {
      closeSourceModal();
      return;
    }
    for (const abs of sourceModalPaths) {
      await window.arc.trashPath(abs);
    }
    closeSourceModal();
  };

  const closeFailuresModal = () => {
    setFailures([]);
    setFailuresAddedCount(0);
    setPhase('idle');
    resolveImportFlow();
  };

  const closeCancelKeepModal = () => {
    setCancelKeepIds([]);
    setCancelKeepCount(0);
    setPhase('idle');
    resolveImportFlow();
  };

  const deleteCancelledImports = async () => {
    const ids = [...cancelKeepIds];
    closeCancelKeepModal();
    for (const id of ids) {
      try {
        await softDeleteCard(id);
      } catch {
        /* ignore single delete errors */
      }
    }
    window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
  };

  const contextValue = useMemo(() => ({ openImportPicker }), [openImportPicker]);

  const showOverlay = (phase === 'overlay' || isDraggingFiles) && !importBusy;
  const dropzoneActive = isDraggingFiles;

  useLayoutEffect(() => {
    if (!showOverlay || !ctaWrapRef.current) return;
    void hydrateArcNavbarIcons(ctaWrapRef.current);
  }, [showOverlay]);

  useImportDropzonePerimeterDash({
    enabled: showOverlay,
    dropzoneRef,
    borderRectRef
  });

  useEffect(() => {
    if (!showOverlay) return undefined;
    const el = ctaWrapRef.current;
    if (!el || typeof el.animate !== 'function') return undefined;

    const anim = el.animate(
      [
        { transform: 'translateY(0)' },
        { transform: 'translateY(-6px)' },
        { transform: 'translateY(0)' }
      ],
      { duration: 700, iterations: Infinity, easing: 'ease-in-out' }
    );

    return () => anim.cancel();
  }, [showOverlay]);

  return (
    <ImportContext.Provider value={contextValue}>
      {children}
      {showOverlay ? (
        <div
          className="arc-import-overlay"
          role="presentation"
          onClick={() => closeOverlay()}
          onDragOver={(e) => {
            e.preventDefault();
          }}
        >
          <div
            ref={dropzoneRef}
            className={`arc-import-dropzone arc-import-dropzone--animated-border${dropzoneActive ? ' arc-import-dropzone--dropping' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
            }}
          >
            <svg className="arc-import-dropzone-border" aria-hidden="true">
              <rect ref={borderRectRef} />
            </svg>
            <div ref={ctaWrapRef} className="arc-import-dropzone-cta-wrap">
              <button
                type="button"
                className="btn btn-brand btn-ds arc-import-dropzone-cta"
                aria-label="Выбрать файлы для добавления"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void pickFiles();
                }}
              >
                <span className="btn-ds__value">Перетащите файлы в это окно</span>
                <span className="btn-ds__icon arc-icon-plus" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {progress ? (
        <ImportQueueToast progress={progress} onCancel={requestCancelImport} />
      ) : null}

      {sourceModalPaths && sourceModalPaths.length > 0 ? (
        <SourceFilesModal
          fileCount={sourceModalPaths.length}
          onKeep={closeSourceModal}
          onTrashSources={() => void trashSources()}
        />
      ) : null}

      {phase === 'duplicate-modal' && duplicateConflicts.length > 0 ? (
        <ImportDuplicatesModal
          conflicts={duplicateConflicts}
          index={duplicateIndex}
          onResolved={onDuplicateResolved}
          onClose={closeDuplicateModal}
          assignToCollectionId={duplicateAssignCollectionId}
        />
      ) : null}

      {folderDropContext && folderDropContext.folderPaths.length > 0 ? (
        <ImportFolderCollectionsModal
          drop={folderDropContext}
          onClose={() => {
            setFolderDropContext(null);
            setPhase('idle');
          }}
          onConfirm={(plan) => {
            const drop = folderDropContext;
            setFolderDropContext(null);
            setPhase('idle');
            enqueueJob({
              kind: 'folders',
              folderPaths: drop.folderPaths,
              plan,
              looseFiles: drop.looseFiles
            });
          }}
        />
      ) : null}

      {phase === 'failures-modal' && failures.length > 0 ? (
        <ImportFailuresModal
          failures={failures}
          addedCount={failuresAddedCount}
          onClose={closeFailuresModal}
        />
      ) : null}

      {phase === 'cancel-keep-modal' && cancelKeepCount > 0 ? (
        <ImportCancelKeepModal
          addedCount={cancelKeepCount}
          onKeep={closeCancelKeepModal}
          onDelete={() => void deleteCancelledImports()}
        />
      ) : null}

      {emptyFolderName ? (
        <MessageModal
          title="В папке нет подходящих файлов"
          message={`В корне папки «${emptyFolderName}» нет изображений или видео для импорта. Подпапки не просматриваются.`}
          onClose={closeEmptyFolderModal}
        />
      ) : null}
    </ImportContext.Provider>
  );
}
