import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  clampUnit,
  isAnnotationVisibleAtTime,
  isPointAnnotation,
  type CardAnnotationV1
} from '@arc-main-shared/detailCardTemplate';

export type AnnotationDraftRect = { x: number; y: number; w: number; h: number };

type Props = {
  annotations: CardAnnotationV1[];
  commentMode: boolean;
  currentMs?: number | null;
  selectedId?: string | null;
  composerAnchorId?: string | null;
  draftRect?: AnnotationDraftRect | null;
  draftIndex?: number;
  onSelect?: (id: string) => void;
  onCreate?: (rect: AnnotationDraftRect) => void;
  onMove?: (id: string, x: number, y: number) => void;
};

function clientToNorm(el: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clampUnit((clientX - rect.left) / rect.width),
    y: clampUnit((clientY - rect.top) / rect.height)
  };
}

function clampTopLeft(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: clampUnit(Math.min(x, 1 - Math.max(w, 0))),
    y: clampUnit(Math.min(y, 1 - Math.max(h, 0)))
  };
}

export default function CardDetailAnnotationLayer({
  annotations,
  commentMode,
  currentMs = null,
  selectedId,
  composerAnchorId = null,
  draftRect = null,
  draftIndex,
  onSelect,
  onCreate,
  onMove
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [draw, setDraw] = useState<{
    startX: number;
    startY: number;
    clientX: number;
    clientY: number;
    rect: AnnotationDraftRect;
    moved: boolean;
  } | null>(null);
  const moveRef = useRef<{
    id: string;
    originX: number;
    originY: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
    pointerId: number;
  } | null>(null);

  const onLayerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!commentMode || e.button !== 0 || !rootRef.current) return;
    const from = e.target instanceof Element ? e.target : (e.target as Node).parentElement;
    if (from?.closest('[data-annot-pin]')) return;
    if (composerAnchorId) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = clientToNorm(rootRef.current, e.clientX, e.clientY);
    setDraw({
      startX: start.x,
      startY: start.y,
      clientX: e.clientX,
      clientY: e.clientY,
      rect: { x: start.x, y: start.y, w: 0, h: 0 },
      moved: false
    });
  };

  const onLayerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draw || !rootRef.current) return;
    const moved = e.clientX !== draw.clientX || e.clientY !== draw.clientY;
    const now = clientToNorm(rootRef.current, e.clientX, e.clientY);
    const x = Math.min(draw.startX, now.x);
    const y = Math.min(draw.startY, now.y);
    const w = Math.abs(now.x - draw.startX);
    const h = Math.abs(now.y - draw.startY);
    setDraw({ ...draw, rect: { x, y, w, h }, moved: draw.moved || moved });
  };

  const finishDraw = (e: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    if (!draw) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const rect = draw.moved ? draw.rect : { x: draw.startX, y: draw.startY, w: 0, h: 0 };
    setDraw(null);
    if (commit) onCreate?.(rect);
  };

  const onPinPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, annot: CardAnnotationV1) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    moveRef.current = {
      id: annot.id,
      originX: annot.x,
      originY: annot.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
      pointerId: e.pointerId
    };
  };

  const onPinPointerMove = (e: ReactPointerEvent<HTMLButtonElement>, annot: CardAnnotationV1) => {
    const move = moveRef.current;
    if (!move || move.id !== annot.id || !rootRef.current) return;
    if (e.clientX === move.startClientX && e.clientY === move.startClientY && !move.moved) return;
    move.moved = true;
    const start = clientToNorm(rootRef.current, move.startClientX, move.startClientY);
    const now = clientToNorm(rootRef.current, e.clientX, e.clientY);
    const next = clampTopLeft(
      move.originX + (now.x - start.x),
      move.originY + (now.y - start.y),
      annot.w,
      annot.h
    );
    onMove?.(annot.id, next.x, next.y);
  };

  const onPinPointerUp = (e: ReactPointerEvent<HTMLButtonElement>, annot: CardAnnotationV1) => {
    const move = moveRef.current;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    moveRef.current = null;
    if (!move || move.id !== annot.id) return;
    if (!move.moved && e.type !== 'pointercancel') onSelect?.(annot.id);
  };

  const pendingDraft = draw?.moved ? draw.rect : draw ? null : draftRect;

  return (
    <div
      ref={rootRef}
      className={`arc-card-detail-annot-layer${commentMode ? ' is-comment-mode' : ''}`}
      onPointerDown={onLayerPointerDown}
      onPointerMove={onLayerPointerMove}
      onPointerUp={(event) => finishDraw(event, true)}
      onPointerCancel={(event) => finishDraw(event, false)}
    >
      {annotations.map((annot, index) =>
        isAnnotationVisibleAtTime(annot, currentMs) ? (
          <div
            key={annot.id}
            className={[
              'arc-card-detail-annot-mark',
              isPointAnnotation(annot) ? 'arc-card-detail-annot-mark--point' : 'arc-card-detail-annot-mark--region',
              selectedId === annot.id ? 'is-selected' : '',
              composerAnchorId === annot.id ? 'is-composer' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              left: `${annot.x * 100}%`,
              top: `${annot.y * 100}%`,
              width: isPointAnnotation(annot) ? undefined : `${annot.w * 100}%`,
              height: isPointAnnotation(annot) ? undefined : `${annot.h * 100}%`
            }}
          >
            {isPointAnnotation(annot) ? null : <div className="arc-card-detail-annot-region" />}
            <button
              type="button"
              className="arc-card-detail-annot-pin text-s"
              data-annot-pin=""
              data-annot-anchor={annot.id}
              aria-label={`Аннотация ${index + 1}`}
              onPointerDown={(ev) => onPinPointerDown(ev, annot)}
              onPointerMove={(ev) => onPinPointerMove(ev, annot)}
              onPointerUp={(ev) => onPinPointerUp(ev, annot)}
              onPointerCancel={(ev) => onPinPointerUp(ev, annot)}
            >
              {index + 1}
            </button>
          </div>
        ) : null
      )}
      {pendingDraft ? (
        <div
          className={[
            'arc-card-detail-annot-mark is-draft',
            isPointAnnotation(pendingDraft) ? 'arc-card-detail-annot-mark--point' : 'arc-card-detail-annot-mark--region'
          ].join(' ')}
          style={{
            left: `${pendingDraft.x * 100}%`,
            top: `${pendingDraft.y * 100}%`,
            width: isPointAnnotation(pendingDraft) ? undefined : `${pendingDraft.w * 100}%`,
            height: isPointAnnotation(pendingDraft) ? undefined : `${pendingDraft.h * 100}%`
          }}
        >
          {isPointAnnotation(pendingDraft) ? null : <div className="arc-card-detail-annot-region is-visible" />}
          <span className="arc-card-detail-annot-pin text-s" data-annot-anchor="draft">
            {draftIndex ?? annotations.length + 1}
          </span>
        </div>
      ) : null}
    </div>
  );
}
