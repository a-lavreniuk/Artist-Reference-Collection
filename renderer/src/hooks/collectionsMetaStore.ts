import {
  ARC_CARDS_CHANGED_EVENT,
  ARC_COLLECTIONS_CHANGED_EVENT,
  getCollectionsSidebarMeta,
  type CollectionsSidebarMeta
} from '../services/db';

type Listener = () => void;

let snapshot: CollectionsSidebarMeta | null = null;
let inflight: Promise<CollectionsSidebarMeta> | null = null;
const listeners = new Set<Listener>();
let windowBound = false;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function bindWindow(): void {
  if (windowBound || typeof window === 'undefined') return;
  windowBound = true;
  const refresh = () => {
    void loadCollectionsMeta({ force: true });
  };
  window.addEventListener(ARC_COLLECTIONS_CHANGED_EVENT, refresh);
  window.addEventListener(ARC_CARDS_CHANGED_EVENT, refresh);
  window.addEventListener('arc:library-changed', refresh);
  window.addEventListener('storage', refresh);
}

export function getCollectionsMetaSnapshot(): CollectionsSidebarMeta | null {
  return snapshot;
}

export function subscribeCollectionsMeta(listener: Listener): () => void {
  listeners.add(listener);
  bindWindow();
  return () => {
    listeners.delete(listener);
  };
}

export async function loadCollectionsMeta(options?: {
  force?: boolean;
}): Promise<CollectionsSidebarMeta> {
  if (!options?.force && snapshot && !inflight) return snapshot;
  if (inflight) return inflight;
  inflight = getCollectionsSidebarMeta(4)
    .then((meta) => {
      snapshot = meta;
      emit();
      return meta;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
