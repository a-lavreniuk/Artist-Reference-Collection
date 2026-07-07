import { useCallback, useState } from 'react';
import {
  applyLibraryIntegrityFixes,
  invalidateLibraryCache,
  loadLibraryMetadataSnapshot,
  permanentDeleteCard
} from '../../../services/db';
import { resolveBackend } from '../../../services/db/backend';
import {
  analyzeIntegrity,
  applyMetadataWarningFixes,
  buildIntegrityReport,
  collectIntegrityOrphanScanInput,
  collectReferencedMediaPathsFromMeta,
  filterScanOrphanPaths,
  removeInvalidCardRowsFromMeta,
  type IntegrityReport
} from '../../../services/libraryIntegrity';

export type IntegrityPhase = 'idle' | 'scanning' | 'ready' | 'no_metadata';

export type IntegrityConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

async function scanLibrary(): Promise<IntegrityReport | null> {
  const arc = window.arc;
  if (!arc) return null;
  const meta = await loadLibraryMetadataSnapshot({ includeTrashedCards: true });
  if (!meta) return null;
  const refs = collectReferencedMediaPathsFromMeta(meta);
  const orphanScan = collectIntegrityOrphanScanInput(meta);
  const [{ missing }, { orphans }] = await Promise.all([
    arc.verifyLibraryPaths(refs),
    arc.scanLibraryOrphanFiles(orphanScan).then((r) => ({
      orphans: filterScanOrphanPaths(r.orphans)
    }))
  ]);
  const issues = analyzeIntegrity(meta, new Set(missing), orphans);
  return buildIntegrityReport(issues, orphans);
}

async function withMaintenance<T>(fn: () => Promise<T>): Promise<T> {
  const arc = window.arc;
  if (!arc?.maintenanceBegin) return fn();
  await arc.maintenanceBegin();
  try {
    return await fn();
  } finally {
    await arc.maintenanceEnd();
  }
}

export function useSettingsLibraryIntegrity() {
  const [phase, setPhase] = useState<IntegrityPhase>('idle');
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<IntegrityConfirmState | null>(null);
  const [fileBackend, setFileBackend] = useState<boolean | null>(null);

  const refreshBackend = useCallback(async () => {
    const b = await resolveBackend();
    setFileBackend(b === 'file');
  }, []);

  const runIntegrity = useCallback(async () => {
    if (!window.arc) return;
    setPhase('scanning');
    setBusyAction('scan');
    try {
      await refreshBackend();
      const next = await scanLibrary();
      if (!next) {
        setReport(null);
        setPhase('no_metadata');
        return;
      }
      setReport(next);
      setPhase('ready');
    } finally {
      setBusyAction(null);
    }
  }, [refreshBackend]);

  const rescan = useCallback(async () => {
    if (!window.arc) return;
    setBusyAction('scan');
    try {
      const next = await scanLibrary();
      if (!next) {
        setReport(null);
        setPhase('no_metadata');
        return;
      }
      setReport(next);
      setPhase('ready');
    } finally {
      setBusyAction(null);
    }
  }, []);

  const afterMutation = useCallback(async () => {
    invalidateLibraryCache();
    window.dispatchEvent(new CustomEvent('arc:library-changed'));
    await rescan();
  }, [rescan]);

  const fixMetadata = useCallback(async () => {
    if (!report || fileBackend === false) return;
    setBusyAction('fix_metadata');
    try {
      await withMaintenance(async () => {
        const meta = await loadLibraryMetadataSnapshot({ includeTrashedCards: true });
        if (!meta) return;
        const fixed = applyMetadataWarningFixes(meta);
        await applyLibraryIntegrityFixes(fixed);
        await afterMutation();
      });
    } finally {
      setBusyAction(null);
    }
  }, [afterMutation, fileBackend, report]);

  const deleteCard = useCallback(
    async (cardId: string) => {
      setBusyAction(`delete_card:${cardId}`);
      try {
        await withMaintenance(async () => {
          await permanentDeleteCard(cardId);
          await afterMutation();
        });
      } finally {
        setBusyAction(null);
      }
    },
    [afterMutation]
  );

  const requestDeleteCard = useCallback(
    (cardId: string) => {
      setConfirm({
        title: 'Удалить карточку',
        message: `Карточка ${cardId} будет удалена безвозвратно вместе с файлами в библиотеке`,
        confirmLabel: 'Удалить',
        onConfirm: async () => {
          setConfirm(null);
          await deleteCard(cardId);
        }
      });
    },
    [deleteCard]
  );

  const deleteOrphanFile = useCallback(
    async (relPath: string) => {
      const arc = window.arc;
      if (!arc?.deleteFileIfInsideLibrary) return;
      setBusyAction(`delete_orphan:${relPath}`);
      try {
        await withMaintenance(async () => {
          await arc.deleteFileIfInsideLibrary(relPath);
          await afterMutation();
        });
      } finally {
        setBusyAction(null);
      }
    },
    [afterMutation]
  );

  const requestDeleteOrphan = useCallback(
    (relPath: string) => {
      setConfirm({
        title: 'Удалить файл',
        message: `Файл будет удалён из библиотеки:\n${relPath}`,
        confirmLabel: 'Удалить',
        onConfirm: async () => {
          setConfirm(null);
          await deleteOrphanFile(relPath);
        }
      });
    },
    [deleteOrphanFile]
  );

  const deleteAllOrphans = useCallback(
    async (paths: string[]) => {
      const arc = window.arc;
      if (!arc?.deleteFileIfInsideLibrary || paths.length === 0) return;
      setBusyAction('delete_all_orphans');
      try {
        await withMaintenance(async () => {
          for (const rel of paths) {
            await arc.deleteFileIfInsideLibrary(rel);
          }
          await afterMutation();
        });
      } finally {
        setBusyAction(null);
      }
    },
    [afterMutation]
  );

  const requestDeleteAllOrphans = useCallback(
    (paths: string[]) => {
      setConfirm({
        title: 'Удалить все лишние файлы',
        message: `Будет удалено файлов: ${paths.length}. Это действие необратимо`,
        confirmLabel: 'Удалить все',
        onConfirm: async () => {
          setConfirm(null);
          await deleteAllOrphans(paths);
        }
      });
    },
    [deleteAllOrphans]
  );

  const removeInvalidRows = useCallback(
    async (indices: number[]) => {
      if (fileBackend === false || indices.length === 0) return;
      setBusyAction('remove_invalid_rows');
      try {
        await withMaintenance(async () => {
          const meta = await loadLibraryMetadataSnapshot({ includeTrashedCards: true });
          if (!meta) return;
          const fixed = removeInvalidCardRowsFromMeta(meta, indices);
          await applyLibraryIntegrityFixes(fixed);
          await afterMutation();
        });
      } finally {
        setBusyAction(null);
      }
    },
    [afterMutation, fileBackend]
  );

  const requestRemoveInvalidRows = useCallback(
    (indices: number[]) => {
      setConfirm({
        title: 'Удалить битые записи',
        message: `Из метаданных будут удалены ${indices.length} некорректных записей карточек`,
        confirmLabel: 'Удалить записи',
        onConfirm: async () => {
          setConfirm(null);
          await removeInvalidRows(indices);
        }
      });
    },
    [removeInvalidRows]
  );

  const showOrphanInFolder = useCallback(async (relPath: string) => {
    const arc = window.arc;
    if (!arc?.showItemInFolder) return;
    await arc.showItemInFolder(relPath.replace(/\\/g, '/'));
  }, []);

  return {
    phase,
    report,
    busyAction,
    confirm,
    setConfirm,
    fileBackend,
    runIntegrity,
    rescan,
    fixMetadata,
    requestDeleteCard,
    requestDeleteOrphan,
    requestDeleteAllOrphans,
    requestRemoveInvalidRows,
    showOrphanInFolder,
    isScanning: phase === 'scanning' || busyAction === 'scan',
    isBusy: busyAction !== null
  };
}

import type { CardRecord } from '../../../services/arcSchema';

export type IntegrityCardPreview = {
  card: CardRecord;
  imageUrl: string | null;
};

export async function loadIntegrityCardPreviews(cardIds: string[]): Promise<Map<string, IntegrityCardPreview>> {
  const { getCardById } = await import('../../../services/db');
  const arc = window.arc;
  const out = new Map<string, IntegrityCardPreview>();
  for (const id of cardIds) {
    const card = await getCardById(id);
    if (!card) continue;
    const imageUrl = arc ? await arc.toFileUrl(card.thumbRelativePath) : null;
    out.set(id, { card, imageUrl });
  }
  return out;
}
