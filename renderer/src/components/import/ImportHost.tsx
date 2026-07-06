import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ARC_CARDS_CHANGED_EVENT, isLibraryConfigured } from '../../services/db';
import { isImportableMediaPath } from '../../media/allowedImportExtensions';
import { getImportSourceFilesAction } from '../../import/importDefaults';
import { showAppNotification } from '../../services/notificationService';
import DemoAlert from '../layout/DemoAlert';
import SourceFilesModal from './SourceFilesModal';
import ImportDuplicatesModal, { type ImportDuplicateConflict } from './ImportDuplicatesModal';
import { ImportContext } from './ImportContext';
import { useImportDropzonePerimeterDash } from './useImportDropzonePerimeterDash';

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

const SUPPRESSED_NATIVE_MEDIA_DRAG_ROOTS = ['.arc-modal-host', '.arc-card-detail-overlay'] as const;

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

type ImportPhase = 'idle' | 'overlay' | 'importing' | 'source-modal' | 'duplicate-modal';

export default function ImportHost({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const [maintenanceLocked, setMaintenanceLocked] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [sourceModalPaths, setSourceModalPaths] = useState<string[] | null>(null);
  const [duplicateConflicts, setDuplicateConflicts] = useState<ImportDuplicateConflict[]>([]);
  const [duplicateIndex, setDuplicateIndex] = useState(0);
  const [importBusy, setImportBusy] = useState(false);
  const overlayOpenedManuallyRef = useRef(false);
  const isDraggingFilesRef = useRef(false);
  const suppressFileDragRef = useRef(false);
  const ctaWrapRef = useRef<HTMLDivElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const borderRectRef = useRef<SVGRectElement>(null);

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

  const canImport = libraryReady && !maintenanceLocked && !importBusy;

  const runImport = useCallback(async (rawPaths: string[]) => {
    if (!window.arc || !canImport) return;
    const paths = rawPaths.filter((p) => isImportableMediaPath(p));
    if (!paths.length) return;

    setImportBusy(true);
    setPhase('importing');
    setProgressMessage(`Добавлено 0 из ${paths.length}`);
    overlayOpenedManuallyRef.current = false;

    const unsub =
      window.arc.onImportFilesProgress?.((p) => {
        const msg = p.message ?? `Добавлено ${p.current} из ${p.total}`;
        setProgressMessage(msg);
      }) ?? (() => {});

    try {
      const dupMatches =
        window.arc.checkImportDuplicates != null
          ? await window.arc.checkImportDuplicates(paths)
          : [];
      const conflictPaths = new Set(dupMatches.map((m) => m.path));
      const cleanPaths = paths.filter((p) => !conflictPaths.has(p));

      let successes: Array<{ row: { id: string } }> = [];
      let sourcePaths: string[] = [];

      if (cleanPaths.length > 0) {
        const results = await window.arc.importFiles(cleanPaths);
        successes = results.flatMap((r) => (r.ok ? [{ row: { id: r.row.id } }] : []));
        sourcePaths = cleanPaths.filter((_, i) => results[i]?.ok);
      }

      const conflicts = dupMatches.filter((m): m is ImportDuplicateConflict => m.existingCard != null);

      if (conflicts.length > 0) {
        setProgressMessage(null);
        setDuplicateConflicts(conflicts);
        setDuplicateIndex(0);
        setPhase('duplicate-modal');

        if (successes.length > 0) {
          const n = successes.length;
          const word = n === 1 ? 'файл' : n < 5 ? 'файла' : 'файлов';
          void window.arc.appendHistoryLine(`Импорт ${n} ${word}`);
          window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
          showAppNotification({
            message: n === 1 ? 'Файл успешно добавлен' : `Добавлено ${n} ${word}`,
            variant: 'success',
            prefKey: 'notifyFilesAdded'
          });
        }
        return;
      }

      if (successes.length > 0) {
        const n = successes.length;
        const word = n === 1 ? 'файл' : n < 5 ? 'файла' : 'файлов';
        void window.arc.appendHistoryLine(`Импорт ${n} ${word}`);
        window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
        showAppNotification({
          message: n === 1 ? 'Файл успешно добавлен' : `Добавлено ${n} ${word}`,
          variant: 'success',
          prefKey: 'notifyFilesAdded'
        });
      }

      setProgressMessage(null);

      const sourceAction = getImportSourceFilesAction();
      if (successes.length > 0 && sourcePaths.length > 0) {
        if (sourceAction === 'ask') {
          setSourceModalPaths(sourcePaths);
          setPhase('source-modal');
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
      setProgressMessage(null);
      setPhase('idle');
    } finally {
      unsub();
      setImportBusy(false);
    }
  }, [canImport]);

  const closeDuplicateModal = useCallback(() => {
    setDuplicateConflicts([]);
    setDuplicateIndex(0);
    setPhase('idle');
  }, []);

  const onDuplicateResolved = useCallback(() => {
    if (duplicateIndex + 1 < duplicateConflicts.length) {
      setDuplicateIndex((i) => i + 1);
    } else {
      window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
      setDuplicateConflicts([]);
      setDuplicateIndex(0);
      setPhase('idle');
    }
  }, [duplicateIndex, duplicateConflicts.length]);

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
      if (paths.length) void runImport(paths);
    });
  }, [clearFileDrag, runImport]);

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
      dt.dropEffect = canImport ? 'copy' : 'none';
      if (!isDraggingFilesRef.current) {
        isDraggingFilesRef.current = true;
        setIsDraggingFiles(true);
        if (canImport) {
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
  }, [canImport, clearFileDrag]);

  const openImportPicker = useCallback(() => {
    if (!canImport) return;
    overlayOpenedManuallyRef.current = true;
    setPhase('overlay');
  }, [canImport]);

  const pickFiles = useCallback(async () => {
    if (!window.arc) return;
    try {
      const pick =
        typeof window.arc.pickMediaFiles === 'function'
          ? window.arc.pickMediaFiles
          : window.arc.pickImageFiles;
      const paths = await pick.call(window.arc);
      overlayOpenedManuallyRef.current = false;
      if (!paths.length) {
        setPhase('idle');
        return;
      }
      setPhase('idle');
      await runImport(paths);
    } catch {
      overlayOpenedManuallyRef.current = false;
      setPhase('idle');
    }
  }, [runImport]);

  const closeOverlay = useCallback(() => {
    overlayOpenedManuallyRef.current = false;
    isDraggingFilesRef.current = false;
    setPhase('idle');
    setIsDraggingFiles(false);
  }, []);

  const closeSourceModal = () => {
    setSourceModalPaths(null);
    setPhase('idle');
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

  const contextValue = useMemo(() => ({ openImportPicker }), [openImportPicker]);

  const showOverlay = phase === 'overlay' || isDraggingFiles;
  const dropzoneActive = isDraggingFiles;

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
                <span className="btn-ds__icon arc-import-dropzone-plus-icon" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {progressMessage ? (
        <DemoAlert message={progressMessage} variant="info" autoDismissMs={0} withSound={false} onClose={() => {}} />
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
        />
      ) : null}
    </ImportContext.Provider>
  );
}
