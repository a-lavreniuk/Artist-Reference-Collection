import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from 'react';
import { useMasonryReveal, resetMasonryRevealCache, isMasonryItemRevealed } from '../../motion';
import {
  canIncrementalAppend,
  layoutMasonryAppend,
  layoutMasonryFull,
  layoutMasonryResizeItem
} from './masonryLayoutEngine';
import { handleMasonryArrowKey } from './masonryKeyboard';
import {
  useContainerWidth,
  useMasonryColumnCount,
  useScrollRatioCapture
} from './useMasonryColumnCount';
import { useMasonryVirtualRange } from './useMasonryVirtualRange';
import { recordMeasuredMasonryHeight } from './masonryItemHeight';
import {
  MASONRY_GAP_PX,
  MASONRY_LOADING_SKELETON_COUNT,
  MASONRY_OVERSCAN_FACTOR,
  type MasonryItemLayout,
  type MasonryLayoutState,
  type MasonryVariant
} from './masonryTypes';

export type MasonryGridItem = {
  id: string;
  height: number;
};

export type MasonryGridProps = {
  items: MasonryGridItem[];
  variant?: MasonryVariant;
  scrollRootRef?: RefObject<HTMLElement | null>;
  gap?: number;
  layoutEpoch?: number;
  /** Меняется при фильтрах / сортировке — перезапускает reveal. */
  revealResetKey?: string;
  loadingMore?: boolean;
  loadingSkeletonCount?: number;
  busy?: boolean;
  virtualize?: boolean;
  className?: string;
  skeletonClassName?: string;
  renderItem: (id: string, index: number) => ReactNode;
  renderSkeleton?: (index: number, layout: MasonryItemLayout) => ReactNode;
};

const SKELETON_PREFIX = '__masonry_skeleton__';

function buildSkeletonItems(count: number, columnWidth: number, gap: number): MasonryGridItem[] {
  const aspect = 4 / 3;
  const height = columnWidth / aspect;
  return Array.from({ length: count }, (_, i) => ({
    id: `${SKELETON_PREFIX}${i}`,
    height
  }));
}

export default function MasonryGrid({
  items,
  variant = 'gallery',
  scrollRootRef,
  gap = MASONRY_GAP_PX,
  layoutEpoch: layoutEpochProp = 0,
  revealResetKey = '',
  loadingMore = false,
  loadingSkeletonCount = MASONRY_LOADING_SKELETON_COUNT,
  busy = false,
  virtualize = true,
  className = '',
  skeletonClassName = 'arc-gallery-skeleton',
  renderItem,
  renderSkeleton
}: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const layoutStateRef = useRef<MasonryLayoutState | null>(null);
  const prevIdsRef = useRef<string[]>([]);
  const prevLayoutKeyRef = useRef('');
  const knownIdsRef = useRef<Set<string>>(new Set());
  const [layoutTick, setLayoutTick] = useState(0);
  const [appendIds, setAppendIds] = useState<Set<string>>(() => new Set());
  const [isResizing, setIsResizing] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);

  const containerWidth = useContainerWidth(containerRef);
  const { columnCount, layoutEpoch: gridEpoch } = useMasonryColumnCount(containerWidth, variant);
  const layoutEpoch = layoutEpochProp + gridEpoch;
  const { captureRatio, restoreRatio } = useScrollRatioCapture(scrollRoot);

  useEffect(() => {
    const fromProp = scrollRootRef?.current ?? null;
    if (fromProp) {
      setScrollRoot(fromProp);
      return;
    }
    const el = containerRef.current?.closest('.arc-app-outlet');
    setScrollRoot(el instanceof HTMLElement ? el : null);
  }, [scrollRootRef, containerWidth]);

  const skeletonItems = useMemo(() => {
    if (!loadingMore || containerWidth <= 0) return [];
    const columnWidth = (containerWidth - gap * (columnCount - 1)) / columnCount;
    return buildSkeletonItems(loadingSkeletonCount, columnWidth, gap);
  }, [loadingMore, loadingSkeletonCount, containerWidth, columnCount, gap]);

  const allItems = useMemo(() => [...items, ...skeletonItems], [items, skeletonItems]);

  const layoutKey = `${layoutEpoch}|${columnCount}|${containerWidth}|${gap}`;
  const revealResetKeyFull = `${layoutKey}|${revealResetKey}`;

  useLayoutEffect(() => {
    if (containerWidth <= 0 || columnCount <= 0) return;

    const ids = allItems.map((item) => item.id);
    const layoutChanged = layoutKey !== prevLayoutKeyRef.current;
    const needsFull = layoutChanged || !layoutStateRef.current || !canIncrementalAppend(prevIdsRef.current, ids);

    if (layoutChanged && layoutStateRef.current) {
      captureRatio();
      setIsResizing(true);
    }

    if (needsFull) {
      layoutStateRef.current = layoutMasonryFull(allItems, columnCount, containerWidth, gap);
    } else {
      const appended = allItems.slice(prevIdsRef.current.length);
      layoutStateRef.current = layoutMasonryAppend(
        layoutStateRef.current!,
        appended,
        columnCount,
        containerWidth,
        gap
      );
    }

    const newEntering = new Set<string>();
    const wasAppend = !needsFull && prevIdsRef.current.length > 0;
    if (wasAppend) {
      for (const id of ids) {
        if (!knownIdsRef.current.has(id) && !id.startsWith(SKELETON_PREFIX)) {
          newEntering.add(id);
        }
      }
    }
    knownIdsRef.current = new Set(ids.filter((id) => !id.startsWith(SKELETON_PREFIX)));

    prevIdsRef.current = ids;
    prevLayoutKeyRef.current = layoutKey;
    setLayoutTick((t) => t + 1);

    if (newEntering.size > 0) {
      setAppendIds(new Set(newEntering));
    }

    if (layoutChanged) {
      restoreRatio();
      window.setTimeout(() => setIsResizing(false), 260);
    }
  }, [allItems, layoutKey, columnCount, containerWidth, gap, captureRatio, restoreRatio]);

  const layoutState = layoutStateRef.current;
  const layouts = layoutState?.items ?? new Map<string, MasonryItemLayout>();
  const totalHeight = layoutState?.totalHeight ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  layoutTick;

  const virtualRange = useMasonryVirtualRange(
    layouts,
    scrollRoot,
    virtualize && layouts.size > 0,
    MASONRY_OVERSCAN_FACTOR
  );

  const visibleIds = useMemo(() => {
    const set = new Set(virtualRange.visibleIds);
    if (focusedId) set.add(focusedId);
    return set;
  }, [virtualRange.visibleIds, focusedId]);

  const motionEnabled = variant === 'gallery' || variant === 'similar';

  useMasonryReveal({
    visibleIds,
    itemRefs,
    layouts,
    appendIds,
    resetKey: revealResetKeyFull,
    enabled: motionEnabled
  });

  useEffect(() => {
    if (appendIds.size === 0) return;
    const id = window.setTimeout(() => setAppendIds(new Set()), 0);
    return () => window.clearTimeout(id);
  }, [appendIds]);

  useEffect(() => () => resetMasonryRevealCache(), []);

  const updateItemHeight = useCallback((id: string, height: number) => {
    if (!layoutStateRef.current || id.startsWith(SKELETON_PREFIX)) return;
    const rounded = Math.round(height);
    const layout = layoutStateRef.current.items.get(id);
    if (layout) {
      recordMeasuredMasonryHeight(id, layout.width, rounded);
    }
    const next = layoutMasonryResizeItem(layoutStateRef.current, id, rounded);
    if (next !== layoutStateRef.current) {
      layoutStateRef.current = next;
      setLayoutTick((t) => t + 1);
    }
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.masonryItemId;
        if (!id) continue;
        const height = entry.contentRect.height;
        if (height > 0) updateItemHeight(id, height);
      }
    });
    resizeObserverRef.current = ro;
    return () => {
      ro.disconnect();
      resizeObserverRef.current = null;
    };
  }, [updateItemHeight]);

  const bindItemRef = useCallback(
    (id: string, el: HTMLElement | null) => {
      const ro = resizeObserverRef.current;
      const prev = itemRefs.current.get(id);
      if (prev && ro) ro.unobserve(prev);
      if (el) {
        itemRefs.current.set(id, el);
        if (!motionEnabled || isMasonryItemRevealed(id)) {
          el.setAttribute('data-revealed', 'true');
        } else {
          el.removeAttribute('data-revealed');
        }
        ro?.observe(el);
      } else {
        itemRefs.current.delete(id);
      }
    },
    [motionEnabled]
  );

  const focusItem = useCallback((id: string) => {
    const el = itemRefs.current.get(id);
    const focusable = el?.querySelector<HTMLElement>('.arc-gallery-card-wrap[role="button"]');
    (focusable ?? el)?.focus();
    setFocusedId(id);
  }, []);

  const onGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const mountedIds = allItems.map((item) => item.id).filter((id) => visibleIds.has(id));
      handleMasonryArrowKey(event, layouts, mountedIds, focusItem);
    },
    [allItems, focusItem, layouts, visibleIds]
  );

  const rootClass = [
    'arc-masonry-grid',
    className,
    isResizing ? 'arc-masonry-grid--resizing' : '',
    busy ? 'arc-masonry-grid--busy' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={rootClass}
      role="grid"
      aria-busy={busy || loadingMore}
      aria-rowcount={items.length}
      onKeyDown={onGridKeyDown}
    >
      <div className="arc-masonry-grid__inner" style={{ height: totalHeight, position: 'relative' }}>
        {allItems.map((item, index) => {
          const layout = layouts.get(item.id);
          if (!layout) return null;
          const isSkeleton = item.id.startsWith(SKELETON_PREFIX);
          if (virtualize && !isSkeleton && !visibleIds.has(item.id)) return null;

          const style: React.CSSProperties = {
            position: 'absolute',
            left: layout.x,
            top: layout.y,
            width: layout.width
          };

          if (isSkeleton) {
            return (
              <div
                key={item.id}
                className="arc-masonry-item arc-masonry-item--skeleton"
                style={style}
                aria-hidden
              >
                {renderSkeleton ? (
                  renderSkeleton(index, layout)
                ) : (
                  <div className={skeletonClassName} style={{ width: '100%', height: layout.height }} />
                )}
              </div>
            );
          }

          return (
            <div
              key={item.id}
              ref={(el) => bindItemRef(item.id, el)}
              className="arc-masonry-item"
              style={style}
              data-masonry-item-id={item.id}
              role="gridcell"
              onFocus={() => setFocusedId(item.id)}
              onBlur={() => setFocusedId((prev) => (prev === item.id ? null : prev))}
            >
              {renderItem(item.id, index)}
            </div>
          );
        })}
      </div>
      {loadingMore ? <span className="sr-only">Загрузка карточек…</span> : null}
    </div>
  );
}
