import type { CardRecord } from '../../../services/arcSchema';

/** Путь к исходнику карточки в рабочей папке библиотеки (не превью). */
export function getCardOriginalRelativePath(card: CardRecord): string | null {
  const rel = card.originalRelativePath?.trim();
  if (!rel || rel === 'legacy') return null;
  return rel;
}

/** Размеры в пикселях из файла-исходника в рабочей папке. */
export async function loadCardOriginalPixelSize(
  card: CardRecord
): Promise<{ width: number; height: number } | null> {
  const rel = getCardOriginalRelativePath(card);
  if (!rel || !window.arc) return null;

  const fileUrl = await window.arc.toFileUrl(rel);
  if (!fileUrl) return null;

  if (card.type === 'video') {
    return await new Promise((resolve) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      const done = (dim: { width: number; height: number } | null) => {
        v.removeAttribute('src');
        v.load();
        resolve(dim);
      };
      v.onloadedmetadata = () => {
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (w > 0 && h > 0) done({ width: w, height: h });
        else done(null);
      };
      v.onerror = () => done(null);
      v.src = fileUrl;
    });
  }

  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = fileUrl;
  });
}
