import { useEffect, useState } from 'react';
import type { CardRecord } from '../../../services/db';
import { cardSizeToBytes } from '../../../utils/cardSizeToBytes';
import { formatBytes } from '../../../utils/formatBytes';
import { Tooltip } from '../../../components/tooltip/Tooltip';
import { loadIntegrityCardPreviews } from '../hooks/useSettingsLibraryIntegrity';

type Props = {
  cardIds: string[];
  path: string;
  libraryRootAbs: string | null;
  busy: boolean;
  onDeleteCard: (cardId: string) => void;
};

function toWindowsPath(rootAbs: string | null, relativePath: string): string {
  const rel = relativePath.replace(/\//g, '\\');
  if (!rootAbs) return rel;
  const root = rootAbs.replace(/[\\/]+$/, '');
  return `${root}\\${rel}`;
}

function formatImageInfo(card: CardRecord): { format: string; resolution: string; size: string } {
  const format = (card.format ?? card.originalRelativePath.split('.').pop() ?? '—').toUpperCase();
  const resolution = card.width && card.height ? `${card.width}×${card.height}` : '—';
  const size = formatBytes(cardSizeToBytes(card));
  return { format, resolution, size };
}

function IntegrityDupCard({
  card,
  imageUrl,
  absolutePath,
  busy,
  onDelete
}: {
  card: CardRecord;
  imageUrl: string | null;
  absolutePath: string;
  busy: boolean;
  onDelete: () => void;
}) {
  const info = formatImageInfo(card);

  return (
    <article className="arc-dup-card arc-integrity-dup-card">
      <div className="arc-dup-card__preview">
        {imageUrl ? <img className="arc-dup-card__img" src={imageUrl} alt="" /> : null}
      </div>
      <div className="arc-dup-card__body">
        <Tooltip content={absolutePath} delay={500} position="top" className="arc-dup-card__path-tooltip">
          <p className="typo-p-m arc-dup-card__path">{absolutePath}</p>
        </Tooltip>
        <div className="arc-dup-card__meta typo-p-m">
          <span>{info.format}</span>
          <span>{info.resolution}</span>
          <span>{info.size}</span>
        </div>
        <div className="arc-dup-card__actions">
          <button type="button" className="btn btn-danger btn-ds" disabled={busy} onClick={onDelete}>
            <span className="btn-ds__value">Удалить эту</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export default function IntegrityDuplicateGroup({
  cardIds,
  path,
  libraryRootAbs,
  busy,
  onDeleteCard
}: Props) {
  const [previews, setPreviews] = useState<Awaited<ReturnType<typeof loadIntegrityCardPreviews>>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void loadIntegrityCardPreviews(cardIds).then((map) => {
      if (!cancelled) setPreviews(map);
    });
    return () => {
      cancelled = true;
    };
  }, [cardIds]);

  return (
    <div className="arc-integrity-dup-group">
      <p className="typo-p-m arc-integrity-dup-group__path">{path}</p>
      <div className="arc-integrity-dup-group__grid">
        {cardIds.map((id) => {
          const preview = previews.get(id);
          if (!preview) {
            return (
              <div key={id} className="arc-integrity-dup-group__placeholder panel elevation-default">
                <p className="typo-p-m">Карточка {id}</p>
                <button type="button" className="btn btn-danger btn-ds" disabled={busy} onClick={() => onDeleteCard(id)}>
                  <span className="btn-ds__value">Удалить эту</span>
                </button>
              </div>
            );
          }
          return (
            <IntegrityDupCard
              key={id}
              card={preview.card}
              imageUrl={preview.imageUrl}
              absolutePath={toWindowsPath(libraryRootAbs, preview.card.originalRelativePath)}
              busy={busy}
              onDelete={() => onDeleteCard(id)}
            />
          );
        })}
      </div>
    </div>
  );
}
