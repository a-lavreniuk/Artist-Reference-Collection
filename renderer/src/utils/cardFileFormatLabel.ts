import type { CardRecord } from '../services/db';

/** Подпись формата для бейджа карточки галереи (JPG, MP4, …). */
export function cardFileFormatLabel(card: CardRecord): string | null {
  const fromMeta = card.format?.trim();
  if (fromMeta) return fromMeta.replace(/^\./, '').toUpperCase();

  const path = card.originalRelativePath.trim();
  if (!path) return null;

  const lastSegment = path.split(/[/\\]/).pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) return null;

  const ext = lastSegment.slice(dotIndex + 1).trim();
  return ext ? ext.toUpperCase() : null;
}
