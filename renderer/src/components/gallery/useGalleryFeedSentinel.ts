import { useEffect, type RefObject } from 'react';

type Options = {
  sentinelRef: RefObject<HTMLElement | null>;
  scrollRootRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  hasMore: boolean;
  loading: boolean;
  booting?: boolean;
  loadMore: () => void | Promise<void>;
};

/** Infinite scroll sentinel — тот же паттерн, что на GalleryPage. */
export function useGalleryFeedSentinel({
  sentinelRef,
  scrollRootRef,
  enabled,
  hasMore,
  loading,
  booting = false,
  loadMore
}: Options): void {
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRootRef.current ?? el?.closest('.arc-app-outlet');

    if (!el || !(root instanceof HTMLElement) || !enabled || !hasMore || loading || booting) return;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit) void loadMore();
      },
      { root, rootMargin: '400px', threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [booting, enabled, hasMore, loadMore, loading, scrollRootRef, sentinelRef]);
}
