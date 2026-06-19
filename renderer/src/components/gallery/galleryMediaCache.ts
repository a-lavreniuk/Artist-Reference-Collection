import type { GridSize } from '../../layout/gridSizePreference';
import type { CardRecord } from '../../services/db';

const urlByRel = new Map<string, string>();

export function cardThumbRel(card: CardRecord, gridSize: GridSize = 'm'): string | null {
  const thumbS = card.thumbSRelativePath ?? card.thumbRelativePath;
  const thumbM = card.thumbMRelativePath ?? thumbS;
  const thumbL = card.thumbLRelativePath ?? thumbM ?? thumbS;

  let rel: string | undefined;
  if (gridSize === 'l') rel = thumbL;
  else if (gridSize === 's') rel = thumbS;
  else rel = thumbM;

  if (!rel || rel === 'legacy') {
    const fallback = card.originalRelativePath;
    if (!fallback || fallback === 'legacy') return null;
    return fallback;
  }
  return rel;
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
  const cached = urlByRel.get(rel);
  if (cached) return cached;
  if (!window.arc) return null;
  const href = await window.arc.toFileUrl(rel);
  if (href) urlByRel.set(rel, href);
  return href;
}

export function peekCardsSrcMap(cards: readonly CardRecord[], gridSize: GridSize = 'm'): Record<string, string> {
  const next: Record<string, string> = {};
  for (const card of cards) {
    const rel = cardThumbRel(card, gridSize);
    if (!rel) continue;
    const href = urlByRel.get(rel);
    if (href) next[card.id] = href;
  }
  return next;
}

export async function resolveCardsSrcMap(
  cards: readonly CardRecord[],
  gridSize: GridSize = 'm'
): Promise<Record<string, string>> {
  const relByCard = new Map<string, string>();
  for (const card of cards) {
    const rel = cardThumbRel(card, gridSize);
    if (rel) relByCard.set(card.id, rel);
  }
  const uniqueRels = [...new Set(relByCard.values())];
  const batch =
    uniqueRels.length > 0 && window.arc?.toFileUrls
      ? await window.arc.toFileUrls(uniqueRels)
      : null;

  const next: Record<string, string> = {};
  if (batch) {
    for (const [rel, href] of Object.entries(batch)) {
      urlByRel.set(rel, href);
    }
    for (const [cardId, rel] of relByCard) {
      const stable = rel.replace(/\\/g, '/');
      const href = batch[stable] ?? batch[rel];
      if (href) next[cardId] = href;
    }
    return next;
  }

  const entries = await Promise.all(
    cards.map(async (card) => {
      const rel = cardThumbRel(card, gridSize);
      if (!rel) return null;
      const href = await resolveMediaUrl(rel);
      return href ? ([card.id, href] as const) : null;
    })
  );
  for (const row of entries) {
    if (row) next[row[0]] = row[1];
  }
  return next;
}

export async function mergeCardsSrcMap(
  cards: readonly CardRecord[],
  base: Record<string, string>,
  gridSize: GridSize = 'm'
): Promise<Record<string, string>> {
  const resolved = await resolveCardsSrcMap(cards, gridSize);
  return { ...base, ...resolved };
}

export async function preloadDecodedImages(urls: readonly string[], limit = 24): Promise<void> {
  const unique = [...new Set(urls)].slice(0, limit);
  await Promise.all(
    unique.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        })
    )
  );
}

export function clearGalleryMediaUrlCache(): void {
  urlByRel.clear();
}
