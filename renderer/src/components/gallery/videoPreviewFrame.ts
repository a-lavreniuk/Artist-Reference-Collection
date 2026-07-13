import type { CardRecord } from '../../services/arcSchema';

export function canPickVideoPreviewFrame(card: CardRecord | null | undefined): boolean {
  if (!card || card.type !== 'video') return false;
  return (card.format ?? '').toLowerCase() !== 'gif';
}

export function formatPreviewFrameMs(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const totalSec = Math.floor(clamped / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function videoPreviewDurationMs(card: CardRecord): number {
  if (typeof card.durationMs === 'number' && card.durationMs > 0) return card.durationMs;
  return 0;
}
