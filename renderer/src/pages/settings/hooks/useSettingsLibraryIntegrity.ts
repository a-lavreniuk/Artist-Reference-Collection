import { useCallback, useState } from 'react';
import {
  applyLibraryIntegrityFixes,
  invalidateLibraryCache,
  loadLibraryMetadataSnapshot
} from '../../../services/db';
import {
  analyzeIntegrity,
  applyMetadataWarningFixes,
  collectReferencedMediaPathsFromMeta,
  filterScanOrphanPaths,
  isWarningFixable
} from '../../../services/libraryIntegrity';

export function useSettingsLibraryIntegrity() {
  const [integrityBusy, setIntegrityBusy] = useState(false);
  const [infoModal, setInfoModal] = useState<string | null>(null);
  const [warnModal, setWarnModal] = useState<{ text: string; onFix: () => void } | null>(null);

  const runIntegrity = useCallback(async () => {
    if (!window.arc) return;
    setIntegrityBusy(true);
    try {
      const meta = await loadLibraryMetadataSnapshot();
      if (!meta) {
        setInfoModal('Нет метаданных библиотеки.');
        return;
      }
      const refs = collectReferencedMediaPathsFromMeta(meta);
      const [{ missing }, { orphans }] = await Promise.all([
        window.arc.verifyLibraryPaths(refs),
        window.arc.scanLibraryOrphanFiles(refs).then((r) => ({
          orphans: filterScanOrphanPaths(r.orphans)
        }))
      ]);
      const missSet = new Set(missing);
      const issues = analyzeIntegrity(meta, missSet, orphans);
      const errors = issues.filter((i) => i.level === 'error');
      const warnings = issues.filter((i) => i.level === 'warning');
      const fixableWarnings = warnings.filter(isWarningFixable);
      const hasNonFixableWarnings = warnings.some((w) => !isWarningFixable(w));

      if (errors.length > 0) {
        setInfoModal(errors.map((e) => e.detail).join('\n'));
        return;
      }
      if (warnings.length === 0) {
        setInfoModal('Проверка завершена: проблем не найдено.');
        return;
      }

      if (fixableWarnings.length > 0) {
        const hint = hasNonFixableWarnings
          ? '\n\nАвтоисправление затронет только метаданные (ссылки, счётчики, мудборд). Дубликаты путей к файлам и лишние файлы на диске останутся — их нужно разобрать вручную.'
          : '';
        setWarnModal({
          text: `${warnings.map((w) => w.detail).join('\n')}${hint}`,
          onFix: async () => {
            setWarnModal(null);
            const arc = window.arc;
            if (!arc) return;
            const fixed = applyMetadataWarningFixes(meta);
            await applyLibraryIntegrityFixes(fixed);
            invalidateLibraryCache();
            window.dispatchEvent(new CustomEvent('arc:library-changed'));
            const nextMeta = await loadLibraryMetadataSnapshot();
            if (!nextMeta) {
              setInfoModal('Нет метаданных библиотеки.');
              return;
            }
            const refs2 = collectReferencedMediaPathsFromMeta(nextMeta);
            const [{ missing: m2 }, { orphans: o2 }] = await Promise.all([
              arc.verifyLibraryPaths(refs2),
              arc.scanLibraryOrphanFiles(refs2).then((r) => ({
                orphans: filterScanOrphanPaths(r.orphans)
              }))
            ]);
            const again = analyzeIntegrity(nextMeta, new Set(m2), o2);
            const err2 = again.filter((i) => i.level === 'error');
            const warn2 = again.filter((i) => i.level === 'warning');
            if (err2.length > 0) {
              setInfoModal(err2.map((e) => e.detail).join('\n'));
              return;
            }
            if (warn2.length === 0) {
              setInfoModal('Исправления применены. Проблем не осталось.');
              return;
            }
            setInfoModal(`Исправления применены. Остаются предупреждения:\n\n${warn2.map((w) => w.detail).join('\n')}`);
          }
        });
        return;
      }

      setInfoModal(warnings.map((w) => w.detail).join('\n'));
    } finally {
      setIntegrityBusy(false);
    }
  }, []);

  return {
    integrityBusy,
    infoModal,
    setInfoModal,
    warnModal,
    setWarnModal,
    runIntegrity
  };
}
