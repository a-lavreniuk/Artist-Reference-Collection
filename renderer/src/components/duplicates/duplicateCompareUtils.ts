import type { CardRecord } from '../../services/arcSchema';
import { cardSizeToBytes } from '../../utils/cardSizeToBytes';
import { formatBytes } from '../../utils/formatBytes';
import type { DuplicateCompareSide, IncomingFileMeta } from './duplicateCompareTypes';

export function toDisplayPath(rootAbs: string | null, relativeOrAbs: string): string {
  if (/^[a-zA-Z]:\\/.test(relativeOrAbs) || relativeOrAbs.startsWith('/')) {
    return relativeOrAbs.replace(/\//g, '\\');
  }
  const rel = relativeOrAbs.replace(/\//g, '\\');
  if (!rootAbs) return rel;
  const root = rootAbs.replace(/[\\/]+$/, '');
  return `${root}\\${rel}`;
}

export function cardPreviewRel(card: CardRecord): string {
  return card.thumbLRelativePath ?? card.thumbMRelativePath ?? card.thumbRelativePath ?? card.originalRelativePath;
}

export function formatFileMeta(
  card?: CardRecord,
  incoming?: IncomingFileMeta
): { format: string; resolution: string; size: string } {
  if (incoming) {
    const format = incoming.format.toUpperCase();
    const resolution = incoming.width && incoming.height ? `${incoming.width}×${incoming.height}` : '—';
    const size = incoming.fileSize != null ? formatBytes(incoming.fileSize) : '—';
    return { format, resolution, size };
  }
  if (!card) return { format: '—', resolution: '—', size: '—' };
  const format = (card.format ?? card.originalRelativePath.split('.').pop() ?? '—').toUpperCase();
  const resolution = card.width && card.height ? `${card.width}×${card.height}` : '—';
  const size = formatBytes(cardSizeToBytes(card));
  return { format, resolution, size };
}

export function sideFromCard(
  key: 'a' | 'b',
  label: string,
  card: CardRecord,
  imageUrl: string | null,
  libraryRootAbs: string | null
): DuplicateCompareSide {
  return {
    key,
    label,
    imageUrl,
    absolutePath: toDisplayPath(libraryRootAbs, card.originalRelativePath),
    card
  };
}

export function sideFromIncoming(
  key: 'a' | 'b',
  label: string,
  absPath: string,
  imageUrl: string | null,
  meta: IncomingFileMeta
): DuplicateCompareSide {
  return {
    key,
    label,
    imageUrl,
    absolutePath: toDisplayPath(null, absPath),
    incomingMeta: meta
  };
}
