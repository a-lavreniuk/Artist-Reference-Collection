import type { CardRecord } from '../../services/arcSchema';

export type NaturalImageSize = {
  width: number;
  height: number;
};

export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Кб`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Мб`;
}

export function formatResolution(card: CardRecord, naturalSize?: NaturalImageSize): string {
  if (card.type === 'video') {
    const w = card.videoWidth ?? card.width;
    const h = card.videoHeight ?? card.height;
    if (w && h) return `${w}×${h}`;
    return '—';
  }
  if (card.width && card.height) return `${card.width}×${card.height}`;
  if (naturalSize?.width && naturalSize?.height) {
    return `${naturalSize.width}×${naturalSize.height}`;
  }
  return '—';
}
