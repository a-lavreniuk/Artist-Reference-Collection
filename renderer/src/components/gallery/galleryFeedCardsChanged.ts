import { ARC_CARDS_CHANGED_EVENT } from '../../services/db';
import { invalidateAllGallerySnapshots } from './galleryScopeCache';

type CardsChangedListener = () => void;

const listeners = new Set<CardsChangedListener>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let windowListenerInstalled = false;

const DEBOUNCE_MS = 300;

function flushCardsChanged(): void {
  debounceTimer = null;
  invalidateAllGallerySnapshots();
  for (const listener of listeners) {
    listener();
  }
}

function onWindowCardsChanged(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushCardsChanged, DEBOUNCE_MS);
}

function ensureWindowListener(): void {
  if (windowListenerInstalled || typeof window === 'undefined') return;
  windowListenerInstalled = true;
  window.addEventListener(ARC_CARDS_CHANGED_EVENT, onWindowCardsChanged);
}

/** Один debounced flush на пачку notifyCardsChanged — без N× invalidate/warmup. */
export function subscribeGalleryCardsChanged(listener: CardsChangedListener): () => void {
  ensureWindowListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
