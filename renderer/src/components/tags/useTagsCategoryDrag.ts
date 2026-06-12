import { useCallback, useEffect, useRef, useState } from 'react';

export type TagsCategoryDragState = {
  dragId: string;
  insertIndex: number;
  ghostX: number;
  ghostY: number;
  ghostWidth: number;
  label: string;
  count: number;
};

type RowMetrics = {
  id: string;
  top: number;
  height: number;
};

function resolveInsertIndex(clientY: number, rows: RowMetrics[]): number {
  for (let i = 0; i < rows.length; i++) {
    const mid = rows[i].top + rows[i].height / 2;
    if (clientY < mid) return i;
  }
  return rows.length;
}

function collectRowMetrics(listEl: HTMLElement): RowMetrics[] {
  const nodes = listEl.querySelectorAll<HTMLElement>('[data-tags-category-row]');
  return Array.from(nodes).map((node) => ({
    id: node.dataset.tagsCategoryRow as string,
    top: node.getBoundingClientRect().top,
    height: node.getBoundingClientRect().height
  }));
}

type StartDragArgs = {
  id: string;
  label: string;
  count: number;
  handleEl: HTMLElement;
  rowEl: HTMLElement;
  listEl: HTMLElement;
};

export function useTagsCategoryDrag(onReorder: (id: string, insertIndex: number) => void) {
  const [dragState, setDragState] = useState<TagsCategoryDragState | null>(null);
  const dragRef = useRef<{
    id: string;
    label: string;
    count: number;
    listEl: HTMLElement;
    offsetX: number;
    offsetY: number;
    ghostWidth: number;
  } | null>(null);

  const finishDrag = useCallback(
    (clientY: number) => {
      const active = dragRef.current;
      if (!active) return;
      const rows = collectRowMetrics(active.listEl);
      const insertIndex = resolveInsertIndex(clientY, rows);
      onReorder(active.id, insertIndex);
      dragRef.current = null;
      setDragState(null);
    },
    [onReorder]
  );

  useEffect(() => {
    if (!dragState) return;
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'grabbing';

    const onMove = (e: PointerEvent) => {
      const active = dragRef.current;
      if (!active) return;
      const rows = collectRowMetrics(active.listEl);
      const insertIndex = resolveInsertIndex(e.clientY, rows);
      setDragState({
        dragId: active.id,
        insertIndex,
        ghostX: e.clientX - active.offsetX,
        ghostY: e.clientY - active.offsetY,
        ghostWidth: active.ghostWidth,
        label: active.label,
        count: active.count
      });
    };

    const onUp = (e: PointerEvent) => {
      finishDrag(e.clientY);
    };

    const onCancel = (e: PointerEvent) => {
      finishDrag(e.clientY);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      document.body.style.cursor = prevCursor;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [dragState, finishDrag]);

  const startDrag = useCallback((args: StartDragArgs) => {
    const rowRect = args.rowEl.getBoundingClientRect();
    const handleRect = args.handleEl.getBoundingClientRect();
    dragRef.current = {
      id: args.id,
      label: args.label,
      count: args.count,
      listEl: args.listEl,
      offsetX: handleRect.left - rowRect.left + handleRect.width / 2,
      offsetY: handleRect.top - rowRect.top + handleRect.height / 2,
      ghostWidth: rowRect.width
    };
    setDragState({
      dragId: args.id,
      insertIndex: collectRowMetrics(args.listEl).findIndex((r) => r.id === args.id),
      ghostX: rowRect.left,
      ghostY: rowRect.top,
      ghostWidth: rowRect.width,
      label: args.label,
      count: args.count
    });
  }, []);

  return { dragState, startDrag };
}
