import { Fragment, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  clampUnit,
  isAnnotationVisibleAtTime,
  isPointAnnotation,
  type CardAnnotationV1
} from '@arc-main-shared/detailCardTemplate';
import { clusterAnnotations, type AnnotationClusterMember } from './annotationCluster';
import CardDetailAnnotationPin from './CardDetailAnnotationPin';

export type AnnotationDraftRect = { x: number; y: number; w: number; h: number };

type Props = {
  annotations: CardAnnotationV1[];
  annotationsVisible?: boolean;
  editMode?: boolean;
  commentMode: boolean;
  currentMs?: number | null;
  selectedId?: string | null;
  focusedId?: string | null;
  hoveredId?: string | null;
  sparkleId?: string | null;
  composerAnchorId?: string | null;
  draftRect?: AnnotationDraftRect | null;
  draftIndex?: number;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onPeek?: (id: string | null) => void;
  onCreate?: (rect: AnnotationDraftRect) => void;
  onUpdate?: (id: string, rect: AnnotationDraftRect) => void;
};

type DragState =
  | {
      kind: 'point-move';
      id: string;
      pointerId: number;
      origin: AnnotationDraftRect;
      startNorm: { x: number; y: number };
    }
  | {
      kind: 'region-move';
      id: string;
      pointerId: number;
      origin: AnnotationDraftRect;
      startNorm: { x: number; y: number };
    }
  | {
      kind: 'region-anchor';
      id: string;
      pointerId: number;
      origin: AnnotationDraftRect;
      startNorm: { x: number; y: number };
    }
  | {
      kind: 'region-opposite';
      id: string;
      pointerId: number;
      origin: AnnotationDraftRect;
    };

const MIN_RECT = 0.015;

function clientToNorm(el: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clampUnit((clientX - rect.left) / rect.width),
    y: clampUnit((clientY - rect.top) / rect.height)
  };
}

function normalizeRect(x: number, y: number, w: number, h: number): AnnotationDraftRect {
  let nextW = Math.max(MIN_RECT, w);
  let nextH = Math.max(MIN_RECT, h);
  let nextX = x;
  let nextY = y;
  if (nextX + nextW > 1) nextX = 1 - nextW;
  if (nextY + nextH > 1) nextY = 1 - nextH;
  return {
    x: clampUnit(nextX),
    y: clampUnit(nextY),
    w: nextW,
    h: nextH
  };
}

function movePoint(origin: AnnotationDraftRect, dx: number, dy: number): AnnotationDraftRect {
  return {
    x: clampUnit(origin.x + dx),
    y: clampUnit(origin.y + dy),
    w: 0,
    h: 0
  };
}

function moveRegionAnchor(origin: AnnotationDraftRect, dx: number, dy: number): AnnotationDraftRect {
  const oppositeX = origin.x + origin.w;
  const oppositeY = origin.y + origin.h;
  return normalizeRect(origin.x + dx, origin.y + dy, oppositeX - (origin.x + dx), oppositeY - (origin.y + dy));
}

function resizeFromAnchor(origin: AnnotationDraftRect, pointerX: number, pointerY: number): AnnotationDraftRect {
  return normalizeRect(origin.x, origin.y, pointerX - origin.x, pointerY - origin.y);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('[data-annot-pin], [data-annot-region], [data-annot-resize-opposite]')
  );
}

function annotRect(annot: CardAnnotationV1): AnnotationDraftRect {
  return { x: annot.x, y: annot.y, w: annot.w, h: annot.h };
}

function memberIsHighlighted(
  member: AnnotationClusterMember,
  selectedId?: string | null,
  focusedId?: string | null,
  hoveredId?: string | null,
  composerAnchorId?: string | null
): boolean {
  const id = member.annot.id;
  return selectedId === id || focusedId === id || hoveredId === id || composerAnchorId === id;
}

export default function CardDetailAnnotationLayer({
  annotations,
  annotationsVisible = true,
  editMode = false,
  commentMode,
  currentMs = null,
  selectedId,
  focusedId = null,
  hoveredId = null,
  sparkleId = null,
  composerAnchorId = null,
  draftRect = null,
  draftIndex,
  onSelect,
  onHover,
  onPeek,
  onCreate,
  onUpdate
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pinTapRef = useRef<{ id: string; moved: boolean } | null>(null);
  const peekTimerRef = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draw, setDraw] = useState<{
    startX: number;
    startY: number;
    clientX: number;
    clientY: number;
    rect: AnnotationDraftRect;
    moved: boolean;
  } | null>(null);

  const canEditGeometry = editMode && commentMode;

  const schedulePeek = (id: string | null) => {
    if (peekTimerRef.current) window.clearTimeout(peekTimerRef.current);
    if (!id || editMode || composerAnchorId) {
      onPeek?.(null);
      return;
    }
    peekTimerRef.current = window.setTimeout(() => onPeek?.(id), 220);
  };

  const clearPeekTimer = () => {
    if (peekTimerRef.current) {
      window.clearTimeout(peekTimerRef.current);
      peekTimerRef.current = null;
    }
  };

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, state: DragState) => {
    if (!rootRef.current || !canEditGeometry) return;
    event.preventDefault();
    event.stopPropagation();
    clearPeekTimer();
    onPeek?.(null);
    rootRef.current.setPointerCapture(event.pointerId);
    dragRef.current = state;
    setDraggingId(state.id);
  };

  const onLayerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canEditGeometry || e.button !== 0 || !rootRef.current) return;
    if (isInteractiveTarget(e.target)) return;
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
    const root = rootRef.current;
    if (!root) return;

    if (draw) {
      const moved = e.clientX !== draw.clientX || e.clientY !== draw.clientY;
      const now = clientToNorm(root, e.clientX, e.clientY);
      const x = Math.min(draw.startX, now.x);
      const y = Math.min(draw.startY, now.y);
      const w = Math.abs(now.x - draw.startX);
      const h = Math.abs(now.y - draw.startY);
      setDraw({ ...draw, rect: { x, y, w, h }, moved: draw.moved || moved });
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const now = clientToNorm(root, e.clientX, e.clientY);

    if (drag.kind === 'region-opposite') {
      onUpdate?.(drag.id, resizeFromAnchor(drag.origin, now.x, now.y));
      return;
    }

    const dx = now.x - drag.startNorm.x;
    const dy = now.y - drag.startNorm.y;

    if (drag.kind === 'point-move') {
      onUpdate?.(drag.id, movePoint(drag.origin, dx, dy));
      if (pinTapRef.current?.id === drag.id) pinTapRef.current.moved = true;
      return;
    }

    if (drag.kind === 'region-move') {
      onUpdate?.(drag.id, normalizeRect(drag.origin.x + dx, drag.origin.y + dy, drag.origin.w, drag.origin.h));
      return;
    }

    onUpdate?.(drag.id, moveRegionAnchor(drag.origin, dx, dy));
    if (pinTapRef.current?.id === drag.id) pinTapRef.current.moved = true;
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

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (
      (drag.kind === 'point-move' || drag.kind === 'region-anchor') &&
      pinTapRef.current?.id === drag.id &&
      !pinTapRef.current.moved
    ) {
      onSelect?.(drag.id);
    }
    pinTapRef.current = null;
    dragRef.current = null;
    setDraggingId(null);
  };

  const onLayerPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (draw) finishDraw(e, true);
    finishDrag(e);
  };

  const onLayerPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (draw) finishDraw(e, false);
    finishDrag(e);
  };

  const onPinPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, annot: CardAnnotationV1) => {
    if (e.button !== 0) return;
    clearPeekTimer();
    onPeek?.(null);
    if (!canEditGeometry) {
      onSelect?.(annot.id);
      return;
    }
    pinTapRef.current = { id: annot.id, moved: false };
    const startNorm = clientToNorm(rootRef.current!, e.clientX, e.clientY);
    if (isPointAnnotation(annot)) {
      beginDrag(e, {
        kind: 'point-move',
        id: annot.id,
        pointerId: e.pointerId,
        origin: annotRect(annot),
        startNorm
      });
      return;
    }
    beginDrag(e, {
      kind: 'region-anchor',
      id: annot.id,
      pointerId: e.pointerId,
      origin: annotRect(annot),
      startNorm
    });
  };

  const onRegionPointerDown = (e: ReactPointerEvent<HTMLDivElement>, annot: CardAnnotationV1) => {
    if (e.button !== 0 || isPointAnnotation(annot) || !canEditGeometry) return;
    beginDrag(e, {
      kind: 'region-move',
      id: annot.id,
      pointerId: e.pointerId,
      origin: annotRect(annot),
      startNorm: clientToNorm(rootRef.current!, e.clientX, e.clientY)
    });
  };

  const onOppositePointerDown = (e: ReactPointerEvent<HTMLButtonElement>, annot: CardAnnotationV1) => {
    if (e.button !== 0 || isPointAnnotation(annot) || !canEditGeometry) return;
    beginDrag(e, {
      kind: 'region-opposite',
      id: annot.id,
      pointerId: e.pointerId,
      origin: annotRect(annot)
    });
  };

  const pendingDraft = draw?.moved ? draw.rect : draw ? null : draftRect;

  if (!annotationsVisible) return null;

  const visibleMembers: AnnotationClusterMember[] = [];
  annotations.forEach((annot, index) => {
    if (!isAnnotationVisibleAtTime(annot, currentMs)) return;
    visibleMembers.push({ annot, index });
  });

  const clusters = clusterAnnotations(visibleMembers);

  const renderMark = (member: AnnotationClusterMember) => {
    const { annot, index } = member;
    const isPoint = isPointAnnotation(annot);
    const isActive =
      memberIsHighlighted(member, selectedId, focusedId, hoveredId, composerAnchorId);
    const isDragging = draggingId === annot.id;

    return (
      <div
        key={annot.id}
        className={[
          'arc-card-detail-annot-mark',
          isPoint ? 'arc-card-detail-annot-mark--point' : 'arc-card-detail-annot-mark--region',
          isActive ? 'is-selected' : '',
          focusedId === annot.id ? 'is-focused' : '',
          hoveredId === annot.id ? 'is-hovered' : '',
          isDragging ? 'is-dragging' : '',
          sparkleId === annot.id ? 'is-sparkle' : '',
          composerAnchorId === annot.id ? 'is-composer' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          left: `${annot.x * 100}%`,
          top: `${annot.y * 100}%`,
          width: isPoint ? undefined : `${annot.w * 100}%`,
          height: isPoint ? undefined : `${annot.h * 100}%`
        }}
        onMouseEnter={() => {
          onHover?.(annot.id);
          schedulePeek(annot.id);
        }}
        onMouseLeave={() => {
          if (dragRef.current?.id !== annot.id) onHover?.(null);
          clearPeekTimer();
          onPeek?.(null);
        }}
      >
        {isPoint ? null : (
          <div
            className="arc-card-detail-annot-region"
            data-annot-region=""
            onPointerDown={(event) => onRegionPointerDown(event, annot)}
          />
        )}
        {!isPoint && canEditGeometry ? (
          <button
            type="button"
            className="arc-card-detail-annot-resize-opposite"
            data-annot-resize-opposite=""
            aria-label="Изменить размер области"
            onPointerDown={(event) => onOppositePointerDown(event, annot)}
          />
        ) : null}
        <CardDetailAnnotationPin
          number={index + 1}
          anchorId={annot.id}
          ariaLabel={`Аннотация ${index + 1}`}
          onPointerDown={(event) => onPinPointerDown(event, annot)}
        />
      </div>
    );
  };

  const renderRegionOnly = (member: AnnotationClusterMember) => {
    const { annot } = member;
    if (isPointAnnotation(annot)) return null;
    const isActive = memberIsHighlighted(member, selectedId, focusedId, hoveredId, composerAnchorId);
    return (
      <div
        key={`region-${annot.id}`}
        className={[
          'arc-card-detail-annot-mark arc-card-detail-annot-mark--region arc-card-detail-annot-mark--region-only',
          isActive ? 'is-selected is-hovered' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          left: `${annot.x * 100}%`,
          top: `${annot.y * 100}%`,
          width: `${annot.w * 100}%`,
          height: `${annot.h * 100}%`
        }}
      >
        <div
          className="arc-card-detail-annot-region is-visible"
          data-annot-region=""
          onPointerDown={(event) => onRegionPointerDown(event, annot)}
        />
      </div>
    );
  };

  const renderCluster = (clusterKey: string, members: AnnotationClusterMember[], x: number, y: number) => {
    const numbers = members.map((member) => member.index + 1);
    const primary = members[0];
    if (!primary) return null;
    const anchorId = `cluster-${clusterKey}`;
    const clusterHovered = members.some((member) => member.annot.id === hoveredId);
    const clusterFocused = members.some((member) => member.annot.id === focusedId);

    return (
      <div
        key={clusterKey}
        className={[
          'arc-card-detail-annot-mark arc-card-detail-annot-mark--point arc-card-detail-annot-mark--cluster',
          clusterHovered ? 'is-hovered' : '',
          clusterFocused ? 'is-focused' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
        onMouseEnter={() => {
          onHover?.(primary.annot.id);
          schedulePeek(anchorId);
        }}
        onMouseLeave={() => {
          onHover?.(null);
          clearPeekTimer();
          onPeek?.(null);
        }}
      >
        <CardDetailAnnotationPin
          number={numbers[0]}
          clusterCount={members.length}
          anchorId={anchorId}
          ariaLabel={`Аннотации ${numbers.join(', ')}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            clearPeekTimer();
            onSelect?.(primary.annot.id);
          }}
        />
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={[
        'arc-card-detail-annot-layer',
        commentMode ? 'is-comment-mode' : '',
        editMode ? 'is-edit-mode' : 'is-view-mode'
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={onLayerPointerDown}
      onPointerMove={onLayerPointerMove}
      onPointerUp={onLayerPointerUp}
      onPointerCancel={onLayerPointerCancel}
    >
      {clusters.map((cluster) => {
        if (cluster.members.length === 1) {
          return renderMark(cluster.members[0]);
        }
        const clusterHovered = cluster.members.some((member) => member.annot.id === hoveredId);
        return (
          <Fragment key={cluster.key}>
            {clusterHovered ? cluster.members.map((member) => renderRegionOnly(member)) : null}
            {renderCluster(cluster.key, cluster.members, cluster.x, cluster.y)}
          </Fragment>
        );
      })}
      {pendingDraft ? (
        <div
          className={[
            'arc-card-detail-annot-mark is-draft',
            isPointAnnotation(pendingDraft)
              ? 'arc-card-detail-annot-mark--point'
              : 'arc-card-detail-annot-mark--region'
          ].join(' ')}
          style={{
            left: `${pendingDraft.x * 100}%`,
            top: `${pendingDraft.y * 100}%`,
            width: isPointAnnotation(pendingDraft) ? undefined : `${pendingDraft.w * 100}%`,
            height: isPointAnnotation(pendingDraft) ? undefined : `${pendingDraft.h * 100}%`
          }}
        >
          {isPointAnnotation(pendingDraft) ? null : (
            <div className="arc-card-detail-annot-region is-visible" />
          )}
          <CardDetailAnnotationPin
            number={draftIndex ?? annotations.length + 1}
            anchorId="draft"
            ariaLabel="Черновик аннотации"
            interactive={false}
          />
        </div>
      ) : null}
    </div>
  );
}
