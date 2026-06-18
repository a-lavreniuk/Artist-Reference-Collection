export const ARC_SIMILAR_UPLOAD_TOKEN = 'upload';

export type SimilarCropRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const FULL_SIMILAR_CROP: SimilarCropRect = { x: 0, y: 0, w: 1, h: 1 };

const UPLOAD_PATH_KEY = 'arc.similar.uploadPath';

export function setSimilarUploadPath(absPath: string): void {
  try {
    sessionStorage.setItem(UPLOAD_PATH_KEY, absPath);
  } catch {
    /* ignore */
  }
}

export function getSimilarUploadPath(): string | null {
  try {
    return sessionStorage.getItem(UPLOAD_PATH_KEY);
  } catch {
    return null;
  }
}

export function clearSimilarUploadPath(): void {
  try {
    sessionStorage.removeItem(UPLOAD_PATH_KEY);
  } catch {
    /* ignore */
  }
}

export function formatSimilarCropParam(crop: SimilarCropRect): string {
  const r = normalizeSimilarCrop(crop);
  return [r.x, r.y, r.w, r.h].map((n) => n.toFixed(4)).join(',');
}

export function parseSimilarCropParam(raw: string | null): SimilarCropRect | null {
  if (!raw?.trim()) return null;
  const parts = raw.split(',').map((p) => Number.parseFloat(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  return normalizeSimilarCrop({ x: parts[0], y: parts[1], w: parts[2], h: parts[3] });
}

export function normalizeSimilarCrop(crop: SimilarCropRect): SimilarCropRect {
  const w = clamp01(crop.w);
  const h = clamp01(crop.h);
  const x = clamp01(crop.x);
  const y = clamp01(crop.y);
  if (w <= 0.01 || h <= 0.01) return { ...FULL_SIMILAR_CROP };
  return { x: Math.min(x, 1 - w), y: Math.min(y, 1 - h), w, h };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
