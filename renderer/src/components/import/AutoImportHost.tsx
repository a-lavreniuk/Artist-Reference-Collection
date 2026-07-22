import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ARC_CARDS_CHANGED_EVENT } from '../../services/db';
import { getAutoImportSourceFilesAction } from '../../import/importDefaults';
import { getAppPreferencesSync } from '../../services/appPreferencesRuntime';
import { showAppNotification } from '../../services/notificationService';
import ToastAlert from '../alert/ToastAlert';
import SourceFilesModal from './SourceFilesModal';

function formatImportedMessage(imported: number, attempted: number): string {
  if (imported <= 0) return '';
  const word = imported === 1 ? 'файл' : imported < 5 ? 'файла' : 'файлов';
  if (attempted > imported) {
    return `Автоимпорт: добавлено ${imported} из ${attempted}`;
  }
  return imported === 1 ? 'Автоимпорт: добавлен 1 файл' : `Автоимпорт: добавлено ${imported} ${word}`;
}

export default function AutoImportHost({ children }: { children: ReactNode }) {
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [sourceModalPaths, setSourceModalPaths] = useState<string[] | null>(null);
  const pendingSourcePathsRef = useRef<string[]>([]);

  const handleSourcePaths = useCallback(async (sourcePaths: string[]) => {
    if (!sourcePaths.length) return;
    const sourceAction = getAutoImportSourceFilesAction();
    if (sourceAction === 'ask') {
      setSourceModalPaths(sourcePaths);
    } else if (sourceAction === 'trash' && window.arc) {
      for (const abs of sourcePaths) {
        await window.arc.trashPath(abs);
      }
    }
  }, []);

  useEffect(() => {
    if (!window.arc?.onAutoImportProgress) return undefined;
    return window.arc.onAutoImportProgress((p) => {
      if (getAppPreferencesSync().notifyAutoImport !== true) return;
      const msg = p.message ?? `Автоимпорт: добавлено ${p.current} из ${p.total}`;
      setProgressMessage(msg);
    });
  }, []);

  useEffect(() => {
    if (!window.arc?.onAutoImportBatchDone) return undefined;
    return window.arc.onAutoImportBatchDone((p) => {
      if (p.sourcePaths.length > 0) {
        pendingSourcePathsRef.current.push(...p.sourcePaths);
      }
    });
  }, []);

  useEffect(() => {
    if (!window.arc?.onAutoImportFinished) return undefined;
    return window.arc.onAutoImportFinished((p) => {
      setProgressMessage(null);

      const sourcePaths = pendingSourcePathsRef.current;
      pendingSourcePathsRef.current = [];

      if (p.imported > 0) {
        const n = p.imported;
        const word = n === 1 ? 'файл' : n < 5 ? 'файла' : 'файлов';
        void window.arc?.appendHistoryLine?.(`Автоимпорт ${n} ${word}`);
        window.dispatchEvent(new Event(ARC_CARDS_CHANGED_EVENT));

        const message = formatImportedMessage(p.imported, p.attempted);
        if (message) {
          showAppNotification({
            message,
            variant: 'success',
            prefKey: 'notifyAutoImport'
          });
        }
      }

      if (sourcePaths.length > 0) {
        void handleSourcePaths(sourcePaths);
      }
    });
  }, [handleSourcePaths]);

  const closeSourceModal = () => {
    setSourceModalPaths(null);
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

  const dismissProgress = useCallback(() => {
    setProgressMessage(null);
  }, []);

  const showProgress = progressMessage && getAppPreferencesSync().notifyAutoImport === true;

  return (
    <>
      {children}
      {showProgress ? (
        <ToastAlert
          message={progressMessage}
          variant="info"
          autoDismissMs={0}
          withSound={false}
          onClose={dismissProgress}
        />
      ) : null}
      {sourceModalPaths && sourceModalPaths.length > 0 ? (
        <SourceFilesModal
          fileCount={sourceModalPaths.length}
          onKeep={closeSourceModal}
          onTrashSources={() => void trashSources()}
        />
      ) : null}
    </>
  );
}
