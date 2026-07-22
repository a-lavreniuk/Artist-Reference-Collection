import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { addSkippedDuplicatePair } from '../../services/db';
import { buildAbsMediaUrl } from '../gallery/galleryMediaCache';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { cardPreviewRel, formatFileMeta } from '../duplicates/duplicateCompareUtils';
import type { IncomingFileMeta } from '../duplicates/duplicateCompareTypes';

export type ImportDuplicateConflict = {
  path: string;
  existingCardId: string;
  similarity: number;
  matchKind: 'exact' | 'similar';
  existingCard: CardRecord | null;
};

import { bulkAddToCollection } from '../gallery/galleryBulkActions';

type Props = {
  conflicts: ImportDuplicateConflict[];
  index: number;
  onResolved: () => void;
  onClose: () => void;
  assignToCollectionId?: string;
};

function baseName(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export default function ImportDuplicatesModal({
  conflicts,
  index,
  onResolved,
  onClose,
  assignToCollectionId
}: Props) {
  const conflict = conflicts[index];
  const modalRef = useRef<HTMLElement>(null);
  const [incomingUrl, setIncomingUrl] = useState<string | null>(null);
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [incomingMeta, setIncomingMeta] = useState<IncomingFileMeta | null>(null);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    if (modalRef.current) void hydrateArcNavbarIcons(modalRef.current);
  }, [conflict?.path, conflicts.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  useEffect(() => {
    if (!conflict || !window.arc) return;
    let cancelled = false;
    void (async () => {
      const arc = window.arc!;
      const meta = (await arc.probeIncomingFile?.(conflict.path)) ?? null;
      const incomingMediaUrl = await buildAbsMediaUrl(conflict.path);
      const existing = conflict.existingCard;
      const exUrl = existing ? await arc.toFileUrl(cardPreviewRel(existing)) : null;
      if (cancelled) return;
      setIncomingMeta(meta);
      setIncomingUrl(incomingMediaUrl);
      setExistingUrl(exUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [conflict]);

  if (!conflict || !conflict.existingCard) return null;
  const existing = conflict.existingCard;

  const incomingInfo = formatFileMeta(undefined, incomingMeta ?? undefined);
  const existingInfo = formatFileMeta(existing);
  const incomingName = baseName(conflict.path);
  const existingName = baseName(existing.originalRelativePath);

  const assignImported = async (cardId: string) => {
    if (!assignToCollectionId) return;
    await bulkAddToCollection([cardId], assignToCollectionId);
  };

  const handleReplace = async () => {
    if (busy || !window.arc?.replaceCardOriginal) return;
    setBusy(true);
    try {
      await window.arc.replaceCardOriginal(conflict.existingCardId, conflict.path);
      await assignImported(conflict.existingCardId);
      onResolved();
    } finally {
      setBusy(false);
    }
  };

  const handleKeepExisting = () => {
    if (busy) return;
    void assignImported(conflict.existingCardId).finally(onResolved);
  };

  const handleKeepBoth = async () => {
    if (busy || !window.arc) return;
    setBusy(true);
    try {
      const results = await window.arc.importFiles([conflict.path]);
      if (results[0]?.ok) {
        await addSkippedDuplicatePair(conflict.existingCardId, results[0].row.id);
        await assignImported(results[0].row.id);
      }
      onResolved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="arc-duplicates-import-overlay"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <FloatingModalPanel
        ref={modalRef}
        panelId="import-duplicates-modal"
        className="arc-modal arc-duplicates-import-modal arc-ui-kit-scope"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcImportDupTitle"
        data-elevation="raised"
        data-btn-size="m"
        defaultWidth={720}
        defaultHeight={520}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <div className="arc-modal__title-block">
            <div className="arc-duplicates-import-modal__title-row">
              <h2 className="arc-duplicates-import-modal__title" id="arcImportDupTitle">
                При импорте обнаружены дубли
              </h2>
              <span className="arc-duplicates-import-modal__count">{conflicts.length}</span>
            </div>
            <p className="arc-duplicates-import-modal__subtitle">
              При замене перезапишется исходный файл, настройки останутся без изменений
            </p>
          </div>
          <button
            type="button"
            className="arc-modal__close"
            aria-label="Закрыть"
            disabled={busy}
            onClick={() => onClose()}
          >
            <span className="tab-icon arc-icon-close" aria-hidden="true" />
          </button>
        </header>

        <div className="arc-modal__body arc-duplicates-import-modal__body">
          <div className="arc-duplicates-import-modal__body-pad">
          <p className="arc-duplicates-import-modal__sim">{Math.round(conflict.similarity)}% схожести</p>

          <div className="arc-duplicates-import-modal__pair">
            <div className="arc-duplicates-import-modal__col">
              <div className="arc-duplicates-import-modal__preview">
                {incomingUrl ? <img src={incomingUrl} alt="" draggable={false} /> : null}
                <span className="arc-duplicates-import-modal__badge">Импортируемое</span>
              </div>
              <div className="arc-duplicates-import-modal__file">
                <div className="arc-duplicates-import-modal__file-meta">
                  <span>{incomingInfo.format}</span>
                  <span>{incomingInfo.resolution}</span>
                  <span>{incomingInfo.size}</span>
                </div>
                <p className="arc-duplicates-import-modal__file-name" title={conflict.path}>
                  {incomingName}
                </p>
              </div>
            </div>

            <div className="arc-duplicates-import-modal__col">
              <div className="arc-duplicates-import-modal__preview">
                {existingUrl ? <img src={existingUrl} alt="" draggable={false} /> : null}
                <span className="arc-duplicates-import-modal__badge">Есть в системе</span>
              </div>
              <div className="arc-duplicates-import-modal__file">
                <div className="arc-duplicates-import-modal__file-meta">
                  <span>{existingInfo.format}</span>
                  <span>{existingInfo.resolution}</span>
                  <span>{existingInfo.size}</span>
                </div>
                <p className="arc-duplicates-import-modal__file-name" title={existingName}>
                  {existingName}
                </p>
              </div>
            </div>
          </div>

          <div className="arc-duplicates-import-modal__choices">
            <button type="button" className="btn btn-primary btn-ds" disabled={busy} onClick={() => void handleReplace()}>
              <span className="btn-ds__value">Заменить исходник</span>
            </button>
            <button type="button" className="btn btn-primary btn-ds" disabled={busy} onClick={handleKeepExisting}>
              <span className="btn-ds__value">Оставить исходник</span>
            </button>
            <button type="button" className="btn btn-primary btn-ds" disabled={busy} onClick={() => void handleKeepBoth()}>
              <span className="btn-ds__value">Сохранить оба</span>
            </button>
          </div>
          </div>
        </div>

        <footer className="arc-modal__footer arc-modal__footer--actions-3">
          <span className="arc-duplicates-import-modal__counter">
            {index + 1} из {conflicts.length}
          </span>
          <div className="arc-modal__footer-right">
            <button type="button" className="btn btn-outline btn-ds" disabled={busy} onClick={() => onClose()}>
              <span className="btn-ds__value">Отмена</span>
            </button>
          </div>
        </footer>
      </FloatingModalPanel>
    </div>
  );
}
