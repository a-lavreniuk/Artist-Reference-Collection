import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from 'react';
import { useContainerWidth, useMasonryColumnCount } from '../masonry/useMasonryColumnCount';
import { useMasonryVirtualRange } from '../masonry/useMasonryVirtualRange';
import {
  MASONRY_LOADING_SKELETON_COUNT,
  MASONRY_OVERSCAN_FACTOR,
  type MasonryItemLayout,
  type MasonryVariant
} from '../masonry/masonryTypes';
import { computeMasonryColumnWidth } from '../masonry/masonryColumnRules';
import { uniformGridCellHeight } from './uniformGridLayout';

export type UniformGridItem = {
  id: string;
};

export type UniformGridProps = {
  items: UniformGridItem[];
  variant?: MasonryVariant;
  scrollRootRef?: RefObject<HTMLElement | null>;
  gap?: number;
  layoutEpoch?: number;
  loadingMore?: boolean;
  loadingSkeletonCount?: number;
  busy?: boolean;
  virtualize?: boolean;
  className?: string;
  skeletonClassName?: string;
  renderItem: (id: string, index: number) => ReactNode;
  renderSkeleton?: (index: number, layout: MasonryItemLayout) => ReactNode;
};

const SKELETON_PREFIX = '__uniform_skeleton__';

function buildUniformLayouts(
  ids: string[],
  columnCount: number,
  containerWidth: number,
  gap: number
): { layouts: Map<string, MasonryItemLayout>; totalHeight: number; cellWidth: number; cellHeight: number } {
  const layouts = new Map<string, MasonryItemLayout>();
  if (columnCount <= 0 || containerWidth <= 0) {
    return { layouts, totalHeight: 0, cellWidth: 0, cellHeight: 0 };
  }
  const cellWidth = computeMasonryColumnWidth(containerWidth, columnCount, gap);
  const cellHeight = uniformGridCellHeight(cellWidth);
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index]!;
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    layouts.set(id, {
      id,
      x: column * (cellWidth + gap),
      y: row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
      column
    });
  }
  const rowCount = Math.ceil(ids.length / columnCount);
  const totalHeight = rowCount > 0 ? rowCount * cellHeight + (rowCount - 1) * gap : 0;
  return { layouts, totalHeight, cellWidth, cellHeight };
}

export default function UniformGrid({
  items,
  variant = 'gallery',
  scrollRootRef,
  gap = 32,
  layoutEpoch = 0,
  loadingMore = false,
  loadingSkeletonCount = MASONRY_LOADING_SKELETON_COUNT,
  busy = false,
  virtualize = true,
  className = '',
  skeletonClassName = 'arc-gallery-skeleton',
  renderItem,
  renderSkeleton
}: UniformGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const containerWidth = useContainerWidth(containerRef);
  const { columnCount, layoutEpoch: gridEpoch } = useMasonryColumnCount(containerWidth, variant);
  const effectiveEpoch = layoutEpoch + gridEpoch;

  useEffect(() => {
    const fromProp = scrollRootRef?.current ?? null;
    if (fromProp) {
      setScrollRoot(fromProp);
      return;
    }
    const el = containerRef.current?.closest('.arc-app-outlet');
    setScrollRoot(el instanceof HTMLElement ? el : null);
  }, [scrollRootRef, containerWidth]);

  const skeletonIds = useMemo(() => {
    if (!loadingMore) return [] as string[];
    return Array.from({ length: loadingSkeletonCount }, (_, i) => `${SKELETON_PREFIX}${i}`);
  }, [loadingMore, loadingSkeletonCount]);

  const allIds = useMemo(
    () => [...items.map((item) => item.id), ...skeletonIds],
    [items, skeletonIds]
  );

  const { layouts, totalHeight, cellHeight } = useMemo(
    () => buildUniformLayouts(allIds, columnCount, containerWidth, gap),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- effectiveEpoch bumps on grid resize
    [allIds, columnCount, containerWidth, gap, effectiveEpoch]
  );

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

  const rootClass = ['arc-uniform-grid', className, busy ? 'arc-uniform-grid--busy' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={rootClass}
      role="grid"
      aria-busy={busy || loadingMore}
      aria-rowcount={items.length}
    >
      <div className="arc-uniform-grid__inner" style={{ height: totalHeight, position: 'relative' }}>
        {allIds.map((id, index) => {
          const layout = layouts.get(id);
          if (!layout) return null;
          const isSkeleton = id.startsWith(SKELETON_PREFIX);
          if (virtualize && !isSkeleton && !visibleIds.has(id)) return null;

          const style: CSSProperties = {
            position: 'absolute',
            left: layout.x,
            top: layout.y,
            width: layout.width,
            height: layout.height
          };

          if (isSkeleton) {
            return (
              <div
                key={id}
                className="arc-uniform-item arc-uniform-item--skeleton"
                style={style}
                aria-hidden
              >
                {renderSkeleton ? (
                  renderSkeleton(index, layout)
                ) : (
                  <div
                    className={skeletonClassName}
                    style={{
                      width: '100%',
                      height: cellHeight || layout.height,
                      aspectRatio: '4 / 3'
                    }}
                  />
                )}
              </div>
            );
          }

          return (
            <div
              key={id}
              className="arc-uniform-item"
              style={style}
              role="gridcell"
              onFocus={() => setFocusedId(id)}
              onBlur={() => setFocusedId((prev) => (prev === id ? null : prev))}
            >
              {renderItem(id, index)}
            </div>
          );
        })}
      </div>
      {loadingMore ? <span className="sr-only">Загрузка карточек…</span> : null}
    </div>
  );
}
