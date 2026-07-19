import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from 'react';
import { useContainerWidth } from '../masonry/useMasonryColumnCount';
import {
  GALLERY_LIST_COLUMN_LABELS,
  GALLERY_LIST_HEADER_GAP_PX,
  GALLERY_LIST_HEADER_HEIGHT_PX,
  GALLERY_LIST_OVERSCAN_ROWS,
  GALLERY_LIST_ROW_GAP_PX,
  GALLERY_LIST_ROW_HEIGHT_PX,
  GALLERY_LIST_ROW_STRIDE_PX,
  GALLERY_LIST_THUMB_SIZE_PX
} from './galleryListConstants';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

export type GalleryListItem = {
  id: string;
};

export type GalleryListProps = {
  items: GalleryListItem[];
  scrollRootRef?: RefObject<HTMLElement | null>;
  loadingMore?: boolean;
  busy?: boolean;
  virtualize?: boolean;
  className?: string;
  renderItem: (id: string, index: number) => ReactNode;
};

export default function GalleryList({
  items,
  scrollRootRef,
  loadingMore = false,
  busy = false,
  virtualize = true,
  className = '',
  renderItem
}: GalleryListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [range, setRange] = useState({ start: 0, end: items.length });
  const [actionsWidthPx, setActionsWidthPx] = useState(0);
  const containerWidth = useContainerWidth(containerRef);

  useLayoutEffect(() => {
    if (headerRef.current) void hydrateArcNavbarIcons(headerRef.current);
  }, []);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    const syncActionsWidth = () => {
      const spacer = root.querySelector<HTMLElement>(
        '.arc-gallery-list__header .arc-gallery-list-row__actions'
      );
      if (!spacer) return;
      root.classList.add('is-measuring-actions');
      const w = Math.ceil(spacer.getBoundingClientRect().width);
      root.classList.remove('is-measuring-actions');
      if (w > 0) {
        setActionsWidthPx((prev) => (prev === w ? prev : w));
      }
    };

    void (async () => {
      if (headerRef.current) await hydrateArcNavbarIcons(headerRef.current);
      syncActionsWidth();
    })();

    const ro = new ResizeObserver(syncActionsWidth);
    ro.observe(root);
    return () => {
      root.classList.remove('is-measuring-actions');
      ro.disconnect();
    };
  }, [items.length, range.start, range.end, containerWidth]);

  useEffect(() => {
    const fromProp = scrollRootRef?.current ?? null;
    if (fromProp) {
      setScrollRoot(fromProp);
      return;
    }
    const el = containerRef.current?.closest('.arc-app-outlet');
    setScrollRoot(el instanceof HTMLElement ? el : null);
  }, [scrollRootRef, containerWidth]);

  useEffect(() => {
    if (!virtualize || !scrollRoot) {
      setRange({ start: 0, end: items.length });
      return;
    }

    const update = () => {
      const body = bodyRef.current;
      const stride = GALLERY_LIST_ROW_STRIDE_PX;
      const headerGap = GALLERY_LIST_HEADER_GAP_PX;
      if (!body) {
        setRange({ start: 0, end: items.length });
        return;
      }
      const rootRect = scrollRoot.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const minY = rootRect.top - bodyRect.top - headerGap;
      const maxY = minY + scrollRoot.clientHeight;
      const start = Math.max(0, Math.floor(minY / stride) - GALLERY_LIST_OVERSCAN_ROWS);
      const end = Math.min(
        items.length,
        Math.ceil(maxY / stride) + GALLERY_LIST_OVERSCAN_ROWS
      );
      setRange({ start, end });
    };

    update();
    scrollRoot.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scrollRoot);
    if (bodyRef.current) ro.observe(bodyRef.current);
    return () => {
      scrollRoot.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [items.length, scrollRoot, virtualize]);

  const totalHeight =
    items.length === 0
      ? 0
      : GALLERY_LIST_HEADER_GAP_PX +
        items.length * GALLERY_LIST_ROW_HEIGHT_PX +
        (items.length - 1) * GALLERY_LIST_ROW_GAP_PX;
  const visibleItems = useMemo(() => {
    if (!virtualize) return items.map((item, index) => ({ item, index }));
    const slice: Array<{ item: GalleryListItem; index: number }> = [];
    for (let index = range.start; index < range.end; index += 1) {
      const item = items[index];
      if (item) slice.push({ item, index });
    }
    return slice;
  }, [items, range.end, range.start, virtualize]);

  const rootClass = ['arc-gallery-list', className, busy ? 'arc-gallery-list--busy' : '']
    .filter(Boolean)
    .join(' ');

  const listCssVars = {
    '--arc-gallery-list-thumb': `${GALLERY_LIST_THUMB_SIZE_PX}px`,
    '--arc-gallery-list-row-h': `${GALLERY_LIST_ROW_HEIGHT_PX}px`,
    '--arc-gallery-list-header-h': `${GALLERY_LIST_HEADER_HEIGHT_PX}px`,
    ...(actionsWidthPx > 0
      ? { '--arc-gallery-list-actions': `${actionsWidthPx}px` }
      : {})
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className={rootClass}
      role="table"
      aria-busy={busy || loadingMore}
      aria-rowcount={items.length}
      style={listCssVars}
    >
      <div
        ref={headerRef}
        className="arc-gallery-list__header"
        role="row"
      >
        <span className="arc-gallery-list-row__thumb" aria-hidden />
        <span className="arc-gallery-list__header-cell text-s" role="columnheader">
          {GALLERY_LIST_COLUMN_LABELS.name}
        </span>
        <span className="arc-gallery-list__header-cell text-s" role="columnheader">
          {GALLERY_LIST_COLUMN_LABELS.resolution}
        </span>
        <span className="arc-gallery-list__header-cell text-s" role="columnheader">
          {GALLERY_LIST_COLUMN_LABELS.size}
        </span>
        <span className="arc-gallery-list__header-cell text-s" role="columnheader">
          {GALLERY_LIST_COLUMN_LABELS.format}
        </span>
        <span className="arc-gallery-list__header-cell text-s" role="columnheader">
          {GALLERY_LIST_COLUMN_LABELS.addedAt}
        </span>
        {/* Невидимый spacer той же ширины, что блок кнопок в строках — выравнивает колонки. */}
        <span
          className="arc-gallery-list-row__actions arc-ui-kit-scope"
          data-btn-size="s"
          aria-hidden
        >
          <button type="button" className="btn btn-outline btn-ds" tabIndex={-1} disabled>
            <span className="btn-ds__icon arc-icon-bookmark" aria-hidden="true" />
            <span className="btn-ds__value">Убрать из мудборда</span>
          </button>
          <button type="button" className="btn btn-outline btn-ds" tabIndex={-1} disabled>
            <span className="btn-ds__icon arc-icon-search" aria-hidden="true" />
            <span className="btn-ds__value">Найти похожее</span>
          </button>
        </span>
      </div>
      <div
        ref={bodyRef}
        className="arc-gallery-list__inner"
        style={{ height: totalHeight, position: 'relative' }}
        role="rowgroup"
      >
        {visibleItems.map(({ item, index }) => (
          <div
            key={item.id}
            className="arc-gallery-list__item"
            role="row"
            style={{
              position: 'absolute',
              top: GALLERY_LIST_HEADER_GAP_PX + index * GALLERY_LIST_ROW_STRIDE_PX,
              left: 0,
              right: 0,
              height: GALLERY_LIST_ROW_HEIGHT_PX
            }}
          >
            {renderItem(item.id, index)}
          </div>
        ))}
      </div>
      {loadingMore ? <span className="sr-only">Загрузка карточек…</span> : null}
    </div>
  );
}
