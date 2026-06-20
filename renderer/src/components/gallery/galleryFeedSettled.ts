export const GALLERY_FEED_SETTLED_EVENT = 'arc:gallery-feed-settled';

let settledNotified = false;

export function notifyGalleryFeedSettledOnce(): void {
  if (settledNotified) return;
  settledNotified = true;
  window.dispatchEvent(new CustomEvent(GALLERY_FEED_SETTLED_EVENT));
}

export function onGalleryFeedSettled(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(GALLERY_FEED_SETTLED_EVENT, handler);
  return () => window.removeEventListener(GALLERY_FEED_SETTLED_EVENT, handler);
}
