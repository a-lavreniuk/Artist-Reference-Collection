import {
  ARC_SIMILAR_UPLOAD_TOKEN,
  formatSimilarCropParam,
  FULL_SIMILAR_CROP,
  normalizeSimilarCrop,
  parseSimilarCropParam,
  type SimilarCropRect
} from './similarSearchSession';

export type { SimilarCropRect };
export { ARC_SIMILAR_UPLOAD_TOKEN, FULL_SIMILAR_CROP };

/** Повторяющиеся query-параметры `tag=` — выбранные метки (AND). */
export const ARC_SEARCH_QUERY_TAG = 'tag';
/** Один параметр `card=` — фильтр ленты по id (вместе с типом и метками). Открытие оверлея — `detail=` (см. openCardUrl.ts). */
export const ARC_SEARCH_QUERY_CARD = 'card';
/** Текстовый AI-запрос семантического поиска. */
export const ARC_SEARCH_QUERY_AI = 'ai';
/** HEX цвета без #, например FFFFFF. */
export const ARC_SEARCH_QUERY_COLOR = 'color';
/** Точность цветового поиска 0–100. */
export const ARC_SEARCH_QUERY_COLOR_TOL = 'tol';
/** ID карточки или `upload` для поиска по похожему изображению. */
export const ARC_SEARCH_QUERY_SIMILAR = 'similar';
/** Нормализованный crop: x,y,w,h (0–1). */
export const ARC_SEARCH_QUERY_SIMILAR_CROP = 'sc';

const HEX6 = /^[0-9a-fA-F]{6}$/;
const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSearchColorHex(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get(ARC_SEARCH_QUERY_COLOR)?.trim().toUpperCase();
  if (!raw || !HEX6.test(raw)) return null;
  return raw;
}

export function parseSearchColorTolerance(searchParams: URLSearchParams): number {
  const raw = searchParams.get(ARC_SEARCH_QUERY_COLOR_TOL);
  const n = raw != null ? Number.parseInt(raw, 10) : 85;
  if (!Number.isFinite(n)) return 85;
  return Math.max(0, Math.min(100, n));
}

export function setSearchColorInParams(
  prev: URLSearchParams,
  hex: string | null,
  tolerance = 85
): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(ARC_SEARCH_QUERY_COLOR);
  next.delete(ARC_SEARCH_QUERY_COLOR_TOL);
  next.delete(ARC_SEARCH_QUERY_AI);
  next.delete(ARC_SEARCH_QUERY_TAG);
  next.delete(ARC_SEARCH_QUERY_CARD);
  next.delete(ARC_SEARCH_QUERY_SIMILAR);
  next.delete(ARC_SEARCH_QUERY_SIMILAR_CROP);
  const normalized = hex?.trim().replace(/^#/, '').toUpperCase() ?? '';
  if (normalized && HEX6.test(normalized)) {
    next.set(ARC_SEARCH_QUERY_COLOR, normalized);
    next.set(ARC_SEARCH_QUERY_COLOR_TOL, String(Math.max(0, Math.min(100, Math.round(tolerance)))));
  }
  return next;
}

export function parseSearchTagIds(searchParams: URLSearchParams): string[] {
  return [...new Set(searchParams.getAll(ARC_SEARCH_QUERY_TAG).filter((id) => id.trim().length > 0))];
}

export function parseSearchCardId(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get(ARC_SEARCH_QUERY_CARD)?.trim();
  return raw || null;
}

export function parseSearchAiQuery(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get(ARC_SEARCH_QUERY_AI)?.trim();
  return raw || null;
}

export function setSearchAiInParams(prev: URLSearchParams, query: string | null): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(ARC_SEARCH_QUERY_AI);
  next.delete(ARC_SEARCH_QUERY_TAG);
  next.delete(ARC_SEARCH_QUERY_CARD);
  next.delete(ARC_SEARCH_QUERY_SIMILAR);
  next.delete(ARC_SEARCH_QUERY_SIMILAR_CROP);
  next.delete(ARC_SEARCH_QUERY_SIMILAR);
  next.delete(ARC_SEARCH_QUERY_SIMILAR_CROP);
  if (query && query.trim()) {
    next.set(ARC_SEARCH_QUERY_AI, query.trim());
  }
  return next;
}

/** Фильтр ленты по меткам (AND); сбрасывает остальные режимы поиска. */
export function setSearchTagsInParams(prev: URLSearchParams, tagIds: string[]): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(ARC_SEARCH_QUERY_TAG);
  next.delete(ARC_SEARCH_QUERY_CARD);
  next.delete(ARC_SEARCH_QUERY_AI);
  next.delete(ARC_SEARCH_QUERY_COLOR);
  next.delete(ARC_SEARCH_QUERY_COLOR_TOL);
  next.delete(ARC_SEARCH_QUERY_SIMILAR);
  next.delete(ARC_SEARCH_QUERY_SIMILAR_CROP);
  for (const id of tagIds) {
    const trimmed = id.trim();
    if (trimmed) next.append(ARC_SEARCH_QUERY_TAG, trimmed);
  }
  return next;
}

export function parseSearchSimilarRef(
  searchParams: URLSearchParams
): { kind: 'card'; cardId: string } | { kind: 'upload' } | null {
  const raw = searchParams.get(ARC_SEARCH_QUERY_SIMILAR)?.trim();
  if (!raw) return null;
  if (raw === ARC_SIMILAR_UPLOAD_TOKEN) return { kind: 'upload' };
  if (UUID_LIKE.test(raw)) return { kind: 'card', cardId: raw };
  return null;
}

export function parseSearchSimilarCrop(searchParams: URLSearchParams): SimilarCropRect {
  return parseSimilarCropParam(searchParams.get(ARC_SEARCH_QUERY_SIMILAR_CROP)) ?? FULL_SIMILAR_CROP;
}

export function setSearchSimilarInParams(
  prev: URLSearchParams,
  ref: { kind: 'card'; cardId: string } | { kind: 'upload' } | null,
  crop: SimilarCropRect = FULL_SIMILAR_CROP
): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(ARC_SEARCH_QUERY_SIMILAR);
  next.delete(ARC_SEARCH_QUERY_SIMILAR_CROP);
  next.delete(ARC_SEARCH_QUERY_AI);
  next.delete(ARC_SEARCH_QUERY_TAG);
  next.delete(ARC_SEARCH_QUERY_CARD);
  next.delete(ARC_SEARCH_QUERY_SIMILAR);
  next.delete(ARC_SEARCH_QUERY_SIMILAR_CROP);
  next.delete(ARC_SEARCH_QUERY_COLOR);
  next.delete(ARC_SEARCH_QUERY_COLOR_TOL);
  if (!ref) return next;
  next.set(
    ARC_SEARCH_QUERY_SIMILAR,
    ref.kind === 'upload' ? ARC_SIMILAR_UPLOAD_TOKEN : ref.cardId
  );
  const normalized = normalizeSimilarCrop(crop);
  next.set(ARC_SEARCH_QUERY_SIMILAR_CROP, formatSimilarCropParam(normalized));
  return next;
}
