import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ARC_CARDS_CHANGED_EVENT, isLibraryConfigured } from '../../services/db';
import { isImportableMediaPath } from '../../media/allowedImportExtensions';
import { IMPORT_SOURCE_FILES_DEFAULT } from '../../import/importDefaults';
import DemoAlert from '../layout/DemoAlert';
import SourceFilesModal from './SourceFilesModal';
import { ImportContext } from './ImportContext';

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

type ImportPhase = 'idle' | 'overlay' | 'importing' | 'source-modal';

export default function ImportHost({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const [maintenanceLocked, setMaintenanceLocked] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sourceModalPaths, setSourceModalPaths] = useState<string[] | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const overlayOpenedManuallyRef = useRef(false);
  const isDraggingFilesRef = useRef(false);
  const ctaWrapRef = useRef<HTMLDivElement>(null);

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
    setSuccessMessage(null);
    overlayOpenedManuallyRef.current = false;

    const unsub =
      window.arc.onImportFilesProgress?.((p) => {
        const msg = p.message ?? `Добавлено ${p.current} из ${p.total}`;
        setProgressMessage(msg);
      }) ?? (() => {});

    try {
      const results = await window.arc.importFiles(paths);
      const successes = results.filter((r) => r.ok);
      const sourcePaths = paths.filter((_, i) => results[i]?.ok);

      if (successes.length > 0) {
        const n = successes.length;
        const word = n === 1 ? 'файл' : n < 5 ? 'файла' : 'файлов';
        void window.arc.appendHistoryLine(`Импорт ${n} ${word}`);
        window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));
        setSuccessMessage(
          n === 1 ? 'Файл успешно добавлен' : `Добавлено ${n} ${word}`
        );
      }

      setProgressMessage(null);

      if (successes.length > 0 && IMPORT_SOURCE_FILES_DEFAULT === 'ask' && sourcePaths.length > 0) {
        setSourceModalPaths(sourcePaths);
        setPhase('source-modal');
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
      clearFileDrag();
      if (paths.length) void runImport(paths);
    });
  }, [clearFileDrag, runImport]);

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
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
      clearFileDrag();
    };

    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('dragleave', onDragLeave, true);
    document.addEventListener('dragend', onDragEnd, true);
    return () => {
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
            className={`arc-import-dropzone${dropzoneActive ? ' arc-import-dropzone--dropping' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
            }}
          >
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
        <DemoAlert message={progressMessage} variant="info" autoDismissMs={0} onClose={() => {}} />
      ) : null}

      {successMessage ? (
        <DemoAlert message={successMessage} variant="success" onClose={() => setSuccessMessage(null)} />
      ) : null}

      {sourceModalPaths && sourceModalPaths.length > 0 ? (
        <SourceFilesModal
          fileCount={sourceModalPaths.length}
          onKeep={closeSourceModal}
          onTrashSources={() => void trashSources()}
        />
      ) : null}
    </ImportContext.Provider>
  );
}
