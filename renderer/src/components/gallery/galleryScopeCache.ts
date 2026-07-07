import type { CardRecord } from '../../services/db';
import type { LibraryScope } from '../../search/libraryScopeUrl';

export type GalleryScopeSnapshot = {
  cards: CardRecord[];
  srcMap: Record<string, string>;
  offset: number;
  hasMore: boolean;
  /** Подтверждённый fetch после готовности БД; без флага пустой snapshot не считается cache hit. */
  settled?: boolean;
};

/** Snapshot можно показать без повторного fetch (в т.ч. пустая библиотека после settled fetch). */
export function isGalleryCacheHit(snapshot: GalleryScopeSnapshot | undefined): snapshot is GalleryScopeSnapshot {
  if (!snapshot) return false;
  if (snapshot.cards.length > 0) return true;
  return snapshot.settled === true;
}

export function getGalleryCacheHit(key: string): GalleryScopeSnapshot | undefined {
  const snapshot = getGallerySnapshot(key);
  return isGalleryCacheHit(snapshot) ? snapshot : undefined;
}

const snapshots = new Map<string, GalleryScopeSnapshot>();

export function getGallerySnapshot(key: string): GalleryScopeSnapshot | undefined {
  const snap = snapshots.get(key);
  if (!snap) return undefined;
  return {
    cards: [...snap.cards],
    srcMap: { ...snap.srcMap },
    offset: snap.offset,
    hasMore: snap.hasMore,
    settled: snap.settled
  };
}

export function setGallerySnapshot(key: string, snapshot: GalleryScopeSnapshot): void {
  snapshots.set(key, {
    cards: [...snapshot.cards],
    srcMap: { ...snapshot.srcMap },
    offset: snapshot.offset,
    hasMore: snapshot.hasMore,
    settled: snapshot.settled
  });
}

export function invalidateAllGallerySnapshots(): void {
  snapshots.clear();
}

export function invalidateGallerySnapshotsForScopes(scopes: readonly LibraryScope[]): void {
  const prefixes = new Set(scopes.map((s) => `${s}|`));
  for (const key of snapshots.keys()) {
    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) snapshots.delete(key);
    }
  }
}

/** Dev-диагностика: ключи и размеры snapshot-кэша. */
export function listGallerySnapshotStats(): Record<string, { cardCount: number; offset: number; hasMore: boolean }> {
  const out: Record<string, { cardCount: number; offset: number; hasMore: boolean }> = {};
  for (const [key, snap] of snapshots.entries()) {
    out[key] = { cardCount: snap.cards.length, offset: snap.offset, hasMore: snap.hasMore };
  }
  return out;
}
