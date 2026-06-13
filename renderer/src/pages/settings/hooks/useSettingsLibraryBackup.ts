import { useCallback, useEffect, useState } from 'react';
import type { DemoAlertVariant } from '../../../components/layout/DemoAlert';
import { listCardsSorted } from '../../../services/db';
import { formatBytesRoundedToMb } from '../../../utils/formatBytes';
import { computeLibraryMediaBytesFromCards } from '../../../utils/computeLibraryMediaBytesFromCards';
import { type BackupPart } from './settingsLibraryTypes';

type BackupAlert = { variant: DemoAlertVariant; message: string };

export function useSettingsLibraryBackup() {
  const [bytesTotal, setBytesTotal] = useState(0);
  const [confirmedParts, setConfirmedParts] = useState<BackupPart | null>(null);
  const [backupAlert, setBackupAlert] = useState<BackupAlert | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const refreshBytesTotal = useCallback(async () => {
    if (!window.arc) {
      setBytesTotal(0);
      return;
    }
    try {
      const cards = await listCardsSorted('all');
      setBytesTotal(await computeLibraryMediaBytesFromCards(window.arc, cards));
    } catch {
      setBytesTotal(0);
    }
  }, []);

  useEffect(() => {
    void refreshBytesTotal();
  }, [refreshBytesTotal]);

  useEffect(() => {
    const onLibraryChanged = () => void refreshBytesTotal();
    window.addEventListener('arc:library-changed', onLibraryChanged);
    return () => window.removeEventListener('arc:library-changed', onLibraryChanged);
  }, [refreshBytesTotal]);

  useEffect(() => {
    if (!window.arc?.onBackupProgress) return undefined;
    return window.arc.onBackupProgress((p) => {
      const o = p as { percent?: number; phase?: string; message?: string };
      if (o.phase === 'error') {
        setBackupAlert({
          variant: 'danger',
          message: o.message?.trim() ? o.message : 'Не удалось создать резервную копию.'
        });
        setConfirmedParts(null);
        return;
      }
      if (o.phase === 'done') {
        setBackupAlert({ variant: 'success', message: 'Резервная копия готова' });
        return;
      }
      const pct = typeof o.percent === 'number' && Number.isFinite(o.percent) ? Math.round(o.percent) : 0;
      setBackupAlert({
        variant: 'info',
        message: `Идёт создание резервной копии ${pct}%`
      });
    });
  }, []);

  const perPartLabel = useCallback(
    (n: BackupPart) => formatBytesRoundedToMb(bytesTotal / n),
    [bytesTotal]
  );

  const onClickBackupOption = useCallback(async (n: BackupPart) => {
    if (!window.arc) return;
    const dest = await window.arc.pickLibraryFolder();
    if (!dest) {
      setConfirmedParts(null);
      return;
    }
    setConfirmedParts(n);
    setBackupAlert({ variant: 'info', message: 'Идёт создание резервной копии 0%' });
    const res = await window.arc.backupStart({ destDir: dest, partCount: n });
    if (!res.ok) {
      setConfirmedParts(null);
      setBackupAlert({
        variant: 'danger',
        message: res.error?.trim() ? res.error : 'Не удалось создать резервную копию.'
      });
    }
  }, []);

  const runRestoreFlow = useCallback(async () => {
    setShowRestoreConfirm(false);
    if (!window.arc) return;
    const first = await window.arc.pickBackupArchive();
    if (!first) return;
    const dest = await window.arc.pickLibraryFolder();
    if (!dest) return;
    if (!(await window.arc.dirIsEmpty(dest))) {
      setBackupAlert({ variant: 'danger', message: 'Папка восстановления должна быть пустой.' });
      return;
    }
    const res = await window.arc.restoreLibrary({ firstPartPath: first, destDir: dest });
    if (!res.ok) {
      setBackupAlert({
        variant: 'danger',
        message: res.error?.trim() ? res.error : 'Не удалось восстановить библиотеку.'
      });
    }
  }, []);

  return {
    confirmedParts,
    backupAlert,
    setBackupAlert,
    showRestoreConfirm,
    setShowRestoreConfirm,
    perPartLabel,
    onClickBackupOption,
    runRestoreFlow
  };
}
