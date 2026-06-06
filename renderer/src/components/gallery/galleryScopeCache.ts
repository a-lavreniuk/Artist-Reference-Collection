import type { CardRecord } from '../../services/db';
import type { LibraryScope } from '../../search/libraryScopeUrl';

export type GalleryScopeSnapshot = {
  cards: CardRecord[];
  srcMap: Record<string, string>;
  offset: number;
  hasMore: boolean;
};

const snapshots = new Map<string, GalleryScopeSnapshot>();

export function getGallerySnapshot(key: string): GalleryScopeSnapshot | undefined {
  const snap = snapshots.get(key);
  if (!snap) return undefined;
  return {
    cards: [...snap.cards],
    srcMap: { ...snap.srcMap },
    offset: snap.offset,
    hasMore: snap.hasMore
  };
}

export function setGallerySnapshot(key: string, snapshot: GalleryScopeSnapshot): void {
  snapshots.set(key, {
    cards: [...snapshot.cards],
    srcMap: { ...snapshot.srcMap },
    offset: snapshot.offset,
    hasMore: snapshot.hasMore
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
