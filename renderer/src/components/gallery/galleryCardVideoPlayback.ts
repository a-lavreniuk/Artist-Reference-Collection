type Listener = (activeId: string | null) => void;

let activeCardId: string | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener(activeCardId);
  }
}

export function subscribeGalleryCardVideoPlayback(listener: Listener): () => void {
  listeners.add(listener);
  listener(activeCardId);
  return () => {
    listeners.delete(listener);
  };
}

export function claimGalleryCardVideoPlayback(cardId: string): void {
  if (activeCardId === cardId) return;
  activeCardId = cardId;
  notify();
}

export function releaseGalleryCardVideoPlayback(cardId: string): void {
  if (activeCardId !== cardId) return;
  activeCardId = null;
  notify();
}

export function getActiveGalleryCardVideoPlayback(): string | null {
  return activeCardId;
}
