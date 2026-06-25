import type { MainTabKey } from '../layout/navbarLayout';
import type { CardRecord } from '../../services/db';
import type { GridSize } from '../../layout/gridSizePreference';
import { resolveThumbTier, type ThumbTier } from '@arc-main-shared/thumbConstants';
import { readGalleryThumbPixelBudget } from './galleryThumbBudget';

export type MediaSectionTab = MainTabKey;

export type CardThumbResolveOptions = {
  /** Минимальная длинная сторона превью (ширина колонки × DPR). */
  requiredMaxSidePx?: number;
};

function effectiveRequiredMaxSidePx(options?: CardThumbResolveOptions): number | undefined {
  const explicit = options?.requiredMaxSidePx;
  if (explicit != null && explicit > 0) return explicit;
  const budget = readGalleryThumbPixelBudget();
  return budget > 0 ? budget : undefined;
}

function relForThumbTier(
  card: CardRecord,
  tier: ThumbTier
): string | undefined {
  const thumbS = card.thumbSRelativePath ?? card.thumbRelativePath;
  const thumbM = card.thumbMRelativePath ?? thumbS;
  const thumbL = card.thumbLRelativePath ?? thumbM ?? thumbS;
  if (tier === 'l') return thumbL;
  if (tier === 's') return thumbS;
  return thumbM;
}

export function cardThumbRel(
  card: CardRecord,
  gridSize: GridSize = 'm',
  options?: CardThumbResolveOptions
): string | null {
  const tier = resolveThumbTier(gridSize, effectiveRequiredMaxSidePx(options));
  const rel = relForThumbTier(card, tier);

  if (!rel || rel === 'legacy') {
    const fallback = card.originalRelativePath;
    if (!fallback || fallback === 'legacy') return null;
    return fallback;
  }
  return rel;
}

/** Совпадает с main/toFileUrlHelper — URL для индексных путей без IPC. */
const LIBRARY_CARD_MEDIA_REL = /^cards\/[^/]+\/(?:thumb_[sml]|original)\.[a-z0-9]+$/i;

const urlByRel = new Map<string, string>();

let cachedMediaServerOrigin: string | null | undefined;

function mediaCacheKey(rel: string, sect?: MediaSectionTab): string {
  return sect ? `${sect}\0${rel}` : rel;
}

function mediaServerOrigin(): string {
  if (cachedMediaServerOrigin !== undefined) {
    return cachedMediaServerOrigin ?? 'arc-media://localhost';
  }
  if (typeof window !== 'undefined' && window.arc?.getMediaServerOrigin) {
    const origin = window.arc.getMediaServerOrigin();
    cachedMediaServerOrigin = origin ?? null;
    if (origin) return origin.replace(/\/$/, '');
  }
  cachedMediaServerOrigin = null;
  return 'arc-media://localhost';
}

export function buildLibraryMediaUrl(rel: string, sect?: MediaSectionTab): string | null {
  if (!rel || rel === 'legacy') return null;
  const relStable = rel.replace(/\\/g, '/');
  if (!LIBRARY_CARD_MEDIA_REL.test(relStable)) return null;
  const origin = mediaServerOrigin();
  const base = `${origin}/?rel=${encodeURIComponent(relStable)}`;
  return sect ? `${base}&sect=${sect}` : base;
}

function rememberMediaUrl(rel: string, href: string, sect?: MediaSectionTab): void {
  const key = mediaCacheKey(rel, sect);
  urlByRel.set(key, href);
  const stable = rel.replace(/\\/g, '/');
  if (stable !== rel) urlByRel.set(mediaCacheKey(stable, sect), href);
  if (!sect) {
    urlByRel.set(rel, href);
    if (stable !== rel) urlByRel.set(stable, href);
  }
}

function peekCachedMediaUrl(rel: string, sect?: MediaSectionTab): string | null {
  const stable = rel.replace(/\\/g, '/');
  if (sect) {
    return urlByRel.get(mediaCacheKey(rel, sect)) ?? urlByRel.get(mediaCacheKey(stable, sect));
  }
  return urlByRel.get(rel) ?? urlByRel.get(stable) ?? null;
}

export function peekMediaUrl(rel: string): string | null {
  return urlByRel.get(rel) ?? null;
}

export function cardOriginalRel(card: CardRecord): string | null {
  const rel = card.originalRelativePath || card.thumbRelativePath;
  if (!rel || rel === 'legacy') return null;
  return rel;
}

/** Thumb из кэша сетки, затем полный файл (оригинал). */
export async function resolveCardDetailPreviewUrls(
  card: CardRecord,
  gridSize: GridSize,
  onThumb: (url: string) => void
): Promise<string | null> {
  const thumbRel = cardThumbRel(card, gridSize);
  const originalRel = cardOriginalRel(card);

  if (thumbRel) {
    const peeked = peekMediaUrl(thumbRel);
    if (peeked) onThumb(peeked);
    else {
      const thumbHref = await resolveMediaUrl(thumbRel);
      if (thumbHref) onThumb(thumbHref);
    }
  }

  if (!originalRel) return null;
  if (originalRel === thumbRel) return peekMediaUrl(originalRel) ?? resolveMediaUrl(originalRel);
  return resolveMediaUrl(originalRel);
}

export async function resolveMediaUrl(rel: string): Promise<string | null> {
  if (!rel || rel === 'legacy') return null;
  const stable = rel.replace(/\\/g, '/');
  const cached = urlByRel.get(rel) ?? urlByRel.get(stable);
  if (cached) return cached;

  const local = buildLibraryMediaUrl(rel);
  if (local) {
    rememberMediaUrl(rel, local);
    return local;
  }

  if (!window.arc) return null;
  const href = await window.arc.toFileUrl(rel);
  if (href) rememberMediaUrl(rel, href);
  return href;
}

export function peekCardsSrcMap(
  cards: readonly CardRecord[],
  gridSize: GridSize = 'm',
  sect?: MediaSectionTab
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const card of cards) {
    const rel = cardThumbRel(card, gridSize);
    if (!rel) continue;
    const href = peekCachedMediaUrl(rel, sect) ?? buildLibraryMediaUrl(rel, sect);
    if (href) next[card.id] = href;
  }
  return next;
}

export async function resolveCardsSrcMap(
  cards: readonly CardRecord[],
  gridSize: GridSize = 'm',
  sect?: MediaSectionTab
): Promise<Record<string, string>> {
  const relByCard = new Map<string, string>();
  for (const card of cards) {
    const rel = cardThumbRel(card, gridSize);
    if (rel) relByCard.set(card.id, rel);
  }

  const next: Record<string, string> = {};
  const needIpc: string[] = [];

  for (const [cardId, rel] of relByCard) {
    const cached = peekCachedMediaUrl(rel, sect);
    if (cached) {
      next[cardId] = cached;
      continue;
    }
    const local = buildLibraryMediaUrl(rel, sect);
    if (local) {
      rememberMediaUrl(rel, local, sect);
      next[cardId] = local;
    } else {
      needIpc.push(rel);
    }
  }

  if (needIpc.length > 0 && window.arc?.toFileUrls) {
    const batch = await window.arc.toFileUrls(needIpc);
    for (const [rel, href] of Object.entries(batch)) {
      rememberMediaUrl(rel, href, sect);
    }
    for (const [cardId, rel] of relByCard) {
      if (next[cardId]) continue;
      const stable = rel.replace(/\\/g, '/');
      const href = batch[stable] ?? batch[rel];
      if (href) next[cardId] = href;
    }
  } else if (needIpc.length > 0) {
    const entries = await Promise.all(
      needIpc.map(async (rel) => {
        const href = await resolveMediaUrl(rel);
        return href ? ([rel, href] as const) : null;
      })
    );
    const hrefByRel = new Map<string, string>();
    for (const row of entries) {
      if (row) hrefByRel.set(row[0], row[1]);
    }
    for (const [cardId, rel] of relByCard) {
      if (next[cardId]) continue;
      const href = hrefByRel.get(rel);
      if (href) next[cardId] = href;
    }
  }

  return next;
}

export async function mergeCardsSrcMap(
  cards: readonly CardRecord[],
  base: Record<string, string>,
  gridSize: GridSize = 'm',
  sect?: MediaSectionTab
): Promise<Record<string, string>> {
  const resolved = await resolveCardsSrcMap(cards, gridSize, sect);
  return { ...base, ...resolved };
}

/** No-op — preload decode отключён. */
export function cancelGalleryMediaPreloads(): void {}

/** Отключено: decode через <img loading="lazy"> в GalleryThumb. */
export async function preloadDecodedImages(
  _urls: readonly string[],
  _limit = 24,
  _mediaTab?: MainTabKey
): Promise<void> {}

export function clearGalleryMediaUrlCache(): void {
  urlByRel.clear();
  cachedMediaServerOrigin = undefined;
}
