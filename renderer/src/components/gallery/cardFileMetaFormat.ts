import type { CardMediaMetaV1, CardRecord } from '../../services/arcSchema';

export type NaturalImageSize = {
  width: number;
  height: number;
};

export function formatBytes(bytes: number | undefined): string | null {
  if (bytes === undefined || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Кб`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Мб`;
}

export function formatResolution(card: CardRecord, naturalSize?: NaturalImageSize): string | null {
  if (card.type === 'video') {
    const w = card.videoWidth ?? card.width;
    const h = card.videoHeight ?? card.height;
    if (w && h) return `${w}×${h}`;
    return null;
  }
  if (card.width && card.height) return `${card.width}×${card.height}`;
  if (naturalSize?.width && naturalSize?.height) {
    return `${naturalSize.width}×${naturalSize.height}`;
  }
  return null;
}

export function formatDurationMs(ms: number | undefined): string | null {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatBitrate(bps: number | undefined): string | null {
  if (bps === undefined || !Number.isFinite(bps) || bps <= 0) return null;
  if (bps < 1000) return `${Math.round(bps)} бит/с`;
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(0)} Кбит/с`;
  return `${(bps / 1_000_000).toFixed(2)} Мбит/с`;
}

export function formatFrameRate(fps: number | undefined): string | null {
  if (fps === undefined || !Number.isFinite(fps) || fps <= 0) return null;
  const rounded = Math.round(fps * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return `${text} fps`;
}

export function formatInfoDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export type CardInfoRow = {
  label: string;
  value: string;
};

function pushRow(rows: CardInfoRow[], label: string, value: string | null | undefined): void {
  if (value) rows.push({ label, value });
}

/** Собирает строки для модалки: только непустые значения. */
export function buildCardInfoSections(card: CardRecord): CardInfoRow[][] {
  const meta: CardMediaMetaV1 | undefined = card.mediaMeta;
  const fileRows: CardInfoRow[] = [];
  pushRow(fileRows, 'Разрешение', formatResolution(card));
  pushRow(fileRows, 'Вес', formatBytes(card.fileSize));
  pushRow(fileRows, 'Тип', card.format ? card.format.toUpperCase() : null);
  pushRow(fileRows, 'Длительность', formatDurationMs(card.durationMs));
  pushRow(fileRows, 'Глубина цвета', meta?.colorDepth);
  pushRow(fileRows, 'Цветовое пространство', meta?.colorSpace);
  if (meta?.densityDpi) pushRow(fileRows, 'DPI', `${meta.densityDpi}`);

  const captureRows: CardInfoRow[] = [];
  pushRow(captureRows, 'Камера', meta?.camera);
  pushRow(captureRows, 'Объектив', meta?.lens);
  if (meta?.iso !== undefined) pushRow(captureRows, 'ISO', String(meta.iso));
  pushRow(captureRows, 'Диафрагма', meta?.aperture);
  pushRow(captureRows, 'Выдержка', meta?.shutterSpeed);
  pushRow(captureRows, 'Фокусное расстояние', meta?.focalLength);
  pushRow(captureRows, 'Дата съёмки', formatInfoDate(meta?.dateTaken));

  const videoRows: CardInfoRow[] = [];
  pushRow(videoRows, 'Кодек', meta?.videoCodec);
  pushRow(videoRows, 'Частота кадров', formatFrameRate(meta?.frameRate));
  pushRow(videoRows, 'Битрейт', formatBitrate(meta?.bitrate));

  const dateRows: CardInfoRow[] = [];
  pushRow(dateRows, 'Дата создания', formatInfoDate(card.fileCreatedAt));
  pushRow(dateRows, 'Дата добавления', formatInfoDate(card.addedAt));
  pushRow(dateRows, 'Дата изменения', formatInfoDate(card.dateModified));

  return [fileRows, captureRows, videoRows, dateRows].filter((section) => section.length > 0);
}
