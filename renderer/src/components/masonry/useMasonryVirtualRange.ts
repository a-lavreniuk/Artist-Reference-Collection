import { useEffect, useState } from 'react';
import type { MasonryItemLayout } from './masonryTypes';

export type MasonryVirtualRange = {
  visibleIds: Set<string>;
  scrollTop: number;
  viewportHeight: number;
};

export function useMasonryVirtualRange(
  layouts: Map<string, MasonryItemLayout>,
  scrollRoot: HTMLElement | null,
  enabled: boolean,
  overscanFactor = 1
): MasonryVirtualRange {
  const [range, setRange] = useState<MasonryVirtualRange>({
    visibleIds: new Set(layouts.keys()),
    scrollTop: 0,
    viewportHeight: 0
  });

  useEffect(() => {
    if (!enabled || !scrollRoot) {
      setRange({
        visibleIds: new Set(layouts.keys()),
        scrollTop: 0,
        viewportHeight: scrollRoot?.clientHeight ?? 0
      });
      return;
    }

    const update = () => {
      const scrollTop = scrollRoot.scrollTop;
      const viewportHeight = scrollRoot.clientHeight;
      const overscan = viewportHeight * overscanFactor;
      const minY = scrollTop - overscan;
      const maxY = scrollTop + viewportHeight + overscan;
      const visibleIds = new Set<string>();

      for (const [id, layout] of layouts) {
        const bottom = layout.y + layout.height;
        if (bottom >= minY && layout.y <= maxY) {
          visibleIds.add(id);
        }
      }

      setRange({ visibleIds, scrollTop, viewportHeight });
    };

    update();
    scrollRoot.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scrollRoot);
    return () => {
      scrollRoot.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [enabled, layouts, overscanFactor, scrollRoot]);

  return range;
}
