import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ellipse, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardBoardV1 } from '../../../services/arcSchema';
import { getCardOriginalRelativePath } from './cardOriginalSize';
import { getCardById } from '../../../services/db';
import { SCALE_MAX, SCALE_MIN } from './constants';
import { newEntityId } from './ids';

export { SCALE_MIN, SCALE_MAX } from './constants';

export type MainTool = 'select' | 'pan' | 'draw' | 'text';
export type DrawTool = 'brush' | 'circle' | 'line' | 'rect' | 'eraser';

type ShapeDraft =
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'ellipse'; x: number; y: number; w: number; h: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number };

export type SelectedTarget =
  | { kind: 'image'; id: string }
  | { kind: 'stroke'; id: string }
  | { kind: 'shape'; id: string }
  | { kind: 'text'; id: string }
  | null;

type Props = {
  width: number;
  height: number;
  board: MoodboardBoardV1;
  onBoardChange: (next: MoodboardBoardV1) => void;
  mainTool: MainTool;
  drawTool: DrawTool;
  strokeWidthPx: number;
  strokeColor: string;
  textFontSize: number;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  selected: SelectedTarget;
  onSelect: (target: SelectedTarget) => void;
  /** Вызывается перед мутацией доски для записи в undo */
  onBeforeMutate: () => void;
  /** Сдвиг вьюпорта в пикселях экрана (без истории undo) */
  onPanPixelDelta: (dx: number, dy: number) => void;
  spaceHeld: boolean;
  panDragActive: boolean;
  setPanDragActive: (v: boolean) => void;
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  erroredEraserRef: React.MutableRefObject<boolean>;
  /** Ластик по изображению — только обратная связь, без удаления */
  onEraserBlocked?: () => void;
};

function sortByZIndex<T extends { zIndex: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.zIndex - b.zIndex);
}

export default function MoodboardKonvaStage({
  width,
  height,
  board,
  onBoardChange,
  mainTool,
  drawTool,
  strokeWidthPx,
  strokeColor,
  textFontSize,
  textColor,
  textAlign,
  selected,
  onSelect,
  onBeforeMutate,
  onPanPixelDelta,
  spaceHeld,
  panDragActive,
  setPanDragActive,
  editingTextId,
  setEditingTextId,
  erroredEraserRef,
  onEraserBlocked
}: Props) {
  const layerRef = useRef<Konva.Layer>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedImageNodeRef = useRef<Konva.Image>(null);

  const [imagesMap, setImagesMap] = useState<Record<string, HTMLImageElement | null>>({});
  const [brushLine, setBrushLine] = useState<number[] | null>(null);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraft | null>(null);
  const dragStartWorld = useRef<{ x: number; y: number } | null>(null);

  const vp = board.viewport;

  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - vp.x) / vp.scale,
      y: (sy - vp.y) / vp.scale
    }),
    [vp.x, vp.y, vp.scale]
  );

  /* загрузка превью карточек */
  const instanceKey = board.imageInstances.map((i) => `${i.id}:${i.cardId}`).join('|');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, HTMLImageElement | null> = {};
      for (const inst of board.imageInstances) {
        const card = await getCardById(inst.cardId);
        if (!card || !window.arc) {
          next[inst.id] = null;
          continue;
        }
        const rel = getCardOriginalRelativePath(card);
        if (!rel) {
          next[inst.id] = null;
          continue;
        }
        const url = await window.arc.toFileUrl(rel);
        if (!url) {
          next[inst.id] = null;
          continue;
        }
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        });
        if (cancelled) return;
        next[inst.id] = img.complete && img.naturalWidth ? img : null;
      }
      if (!cancelled) setImagesMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceKey]);

  const maxZ = useMemo(() => {
    let z = 0;
    for (const x of board.imageInstances) z = Math.max(z, x.zIndex);
    for (const x of board.strokes) z = Math.max(z, x.zIndex);
    for (const x of board.shapes) z = Math.max(z, x.zIndex);
    for (const x of board.texts) z = Math.max(z, x.zIndex);
    return z;
  }, [board]);

  const commit = useCallback(
    (next: MoodboardBoardV1) => {
      onBoardChange(next);
    },
    [onBoardChange]
  );

  const effectivePan = mainTool === 'pan' || spaceHeld;

  /* Transformer для выделенного изображения */
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    if (selected?.kind === 'image' && selectedImageNodeRef.current) {
      tr.nodes([selectedImageNodeRef.current]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selected, board.imageInstances]);

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const w = screenToWorld(pos.x, pos.y);

    if (e.evt.button === 1) {
      e.evt.preventDefault();
      setPanDragActive(true);
      return;
    }

    if (effectivePan) {
      setPanDragActive(true);
      return;
    }

    if (mainTool === 'draw' && drawTool === 'eraser') {
      const clickedOn = e.target;
      const nm = clickedOn.name();
      const parts = nm.split(':');
      const kindAttr = parts[0];
      const idAttr = parts.slice(1).join(':');
      if (!idAttr || kindAttr === 'image') {
        erroredEraserRef.current = true;
        onEraserBlocked?.();
        window.setTimeout(() => {
          erroredEraserRef.current = false;
        }, 200);
        return;
      }
      onBeforeMutate();
      const next = { ...board, strokes: [...board.strokes], shapes: [...board.shapes], texts: [...board.texts] };
      if (kindAttr === 'stroke') next.strokes = next.strokes.filter((s) => s.id !== idAttr);
      else if (kindAttr === 'shape') next.shapes = next.shapes.filter((s) => s.id !== idAttr);
      else if (kindAttr === 'text') next.texts = next.texts.filter((t) => t.id !== idAttr);
      commit(next);
      onSelect(null);
      return;
    }

    if (mainTool === 'draw' && drawTool === 'brush') {
      setBrushLine([w.x, w.y]);
      return;
    }

    if (mainTool === 'draw' && (drawTool === 'rect' || drawTool === 'ellipse' || drawTool === 'line')) {
      dragStartWorld.current = { x: w.x, y: w.y };
      if (drawTool === 'line') {
        setShapeDraft({ kind: 'line', x1: w.x, y1: w.y, x2: w.x, y2: w.y });
      } else {
        setShapeDraft({ kind: drawTool === 'rect' ? 'rect' : 'ellipse', x: w.x, y: w.y, w: 0, h: 0 });
      }
      return;
    }

    if (mainTool === 'text') {
      onBeforeMutate();
      const id = newEntityId();
      const text =
        textAlign === 'center'
          ? {
              id,
              x: w.x - 100,
              y: w.y,
              width: 200,
              content: 'Текст',
              color: textColor,
              fontSize: textFontSize,
              align: textAlign,
              rotation: 0,
              zIndex: maxZ + 1
            }
          : textAlign === 'right'
            ? {
                id,
                x: w.x - 200,
                y: w.y,
                width: 200,
                content: 'Текст',
                color: textColor,
                fontSize: textFontSize,
                align: textAlign,
                rotation: 0,
                zIndex: maxZ + 1
              }
            : {
                id,
                x: w.x,
                y: w.y,
                width: 200,
                content: 'Текст',
                color: textColor,
                fontSize: textFontSize,
                align: textAlign,
                rotation: 0,
                zIndex: maxZ + 1
              };
      commit({ ...board, texts: [...board.texts, text] });
      onSelect({ kind: 'text', id });
      setEditingTextId(id);
      return;
    }

    if (mainTool === 'select' && (e.target === stage || e.target === layerRef.current)) {
      onSelect(null);
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const w = screenToWorld(pos.x, pos.y);

    if (brushLine && brushLine.length >= 2) {
      const lastX = brushLine[brushLine.length - 2];
      const lastY = brushLine[brushLine.length - 1];
      const dx = w.x - lastX;
      const dy = w.y - lastY;
      if (dx * dx + dy * dy > 8) {
        setBrushLine((prev) => (prev ? [...prev, w.x, w.y] : prev));
      }
      return;
    }

    if (shapeDraft && dragStartWorld.current) {
      const s = dragStartWorld.current;
      if (shapeDraft.kind === 'line') {
        setShapeDraft({ ...shapeDraft, x2: w.x, y2: w.y });
      } else {
        const x = Math.min(s.x, w.x);
        const y = Math.min(s.y, w.y);
        const rw = Math.abs(w.x - s.x);
        const rh = Math.abs(w.y - s.y);
        setShapeDraft({ kind: shapeDraft.kind, x, y, w: rw, h: rh });
      }
    }
  };

  const finishBrush = () => {
    if (!brushLine || brushLine.length < 4) {
      setBrushLine(null);
      return;
    }
    onBeforeMutate();
    const id = newEntityId();
    commit({
      ...board,
      strokes: [...board.strokes, { id, points: brushLine, color: strokeColor, width: strokeWidthPx, zIndex: maxZ + 1 }]
    });
    setBrushLine(null);
  };

  const finishShapeDraft = () => {
    if (!shapeDraft || !dragStartWorld.current) {
      setShapeDraft(null);
      dragStartWorld.current = null;
      return;
    }
    const d = shapeDraft;
    dragStartWorld.current = null;
    setShapeDraft(null);
    if (d.kind === 'rect' && (d.w < 2 || d.h < 2)) return;
    if (d.kind === 'ellipse' && (d.w < 2 || d.h < 2)) return;
    if (d.kind === 'line') {
      const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
      if (len < 2) return;
    }
    onBeforeMutate();
    const id = newEntityId();
    const z = maxZ + 1;
    if (d.kind === 'rect') {
      commit({
        ...board,
        shapes: [...board.shapes, { id, type: 'rect', x: d.x, y: d.y, width: d.w, height: d.h, rotation: 0, color: strokeColor, strokeWidth: strokeWidthPx, zIndex: z }]
      });
    } else if (d.kind === 'ellipse') {
      commit({
        ...board,
        shapes: [...board.shapes, { id, type: 'ellipse', x: d.x + d.w / 2, y: d.y + d.h / 2, width: d.w, height: d.h, rotation: 0, color: strokeColor, strokeWidth: strokeWidthPx, zIndex: z }]
      });
    } else {
      commit({
        ...board,
        shapes: [...board.shapes, { id, type: 'line', x: d.x1, y: d.y1, x2: d.x2, y2: d.y2, rotation: 0, color: strokeColor, strokeWidth: strokeWidthPx, zIndex: z }]
      });
    }
  };

  const handleStageMouseUp = () => {
    if (brushLine) finishBrush();
    if (shapeDraft) finishShapeDraft();
    setPanDragActive(false);
  };

  const sortedImages = sortByZIndex(board.imageInstances);
  const sortedStrokes = sortByZIndex(board.strokes);
  const sortedShapes = sortByZIndex(board.shapes);
  const sortedTexts = sortByZIndex(board.texts);

  const bgFill = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--sunken-bg').trim() || '#1a1a1d'
    : '#1a1a1d';
  const dotPattern = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 20;
    c.height = 20;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(242, 243, 244, 0.18)';
    ctx.beginPath();
    ctx.arc(10, 10, 1.2, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }, []);

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={handleStageMouseDown}
      onMouseMove={(e) => {
        if (panDragActive && effectivePan) {
          onPanPixelDelta(e.evt.movementX, e.evt.movementY);
          return;
        }
        handleStageMouseMove(e);
      }}
      onMouseUp={handleStageMouseUp}
      onMouseLeave={handleStageMouseUp}
    >
      <Layer ref={layerRef} x={vp.x} y={vp.y} scaleX={vp.scale} scaleY={vp.scale}>
        <Rect
          name="board-bg"
          x={-1000000}
          y={-1000000}
          width={2000000}
          height={2000000}
          fill={bgFill}
          listening={false}
        />
        {dotPattern ? (
          <Rect
            x={-1000000}
            y={-1000000}
            width={2000000}
            height={2000000}
            fillPatternImage={dotPattern}
            fillPatternRepeat="repeat"
            listening={false}
          />
        ) : null}
        {sortedImages.map((inst) => {
          const img = imagesMap[inst.id];
          const isSel = selected?.kind === 'image' && selected.id === inst.id;
          return (
            <KonvaImage
              key={inst.id}
              ref={isSel ? selectedImageNodeRef : undefined}
              image={img ?? undefined}
              x={inst.x}
              y={inst.y}
              width={inst.width}
              height={inst.height}
              rotation={inst.rotation}
              name={`image:${inst.id}`}
              draggable={mainTool === 'select' && !effectivePan}
              onClick={(ev) => {
                ev.cancelBubble = true;
                if (mainTool === 'select') onSelect({ kind: 'image', id: inst.id });
              }}
              onDragEnd={(ev) => {
                onBeforeMutate();
                const node = ev.target;
                commit({
                  ...board,
                  imageInstances: board.imageInstances.map((i) =>
                    i.id === inst.id
                      ? {
                          ...i,
                          x: node.x(),
                          y: node.y(),
                          width: node.width() * node.scaleX(),
                          height: node.height() * node.scaleY(),
                          rotation: node.rotation()
                        }
                      : i
                  )
                });
                node.scaleX(1);
                node.scaleY(1);
              }}
              onTransformEnd={(ev) => {
                onBeforeMutate();
                const node = ev.target;
                commit({
                  ...board,
                  imageInstances: board.imageInstances.map((i) =>
                    i.id === inst.id
                      ? {
                          ...i,
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(8, node.width() * node.scaleX()),
                          height: Math.max(8, node.height() * node.scaleY()),
                          rotation: node.rotation()
                        }
                      : i
                  )
                });
                node.scaleX(1);
                node.scaleY(1);
              }}
            />
          );
        })}

        {sortedStrokes.map((s) => (
          <Line
            key={s.id}
            points={s.points}
            stroke={s.color}
            strokeWidth={s.width}
            tension={0.35}
            lineCap="round"
            lineJoin="round"
            listening={mainTool === 'select' || (mainTool === 'draw' && drawTool === 'eraser')}
            name={`stroke:${s.id}`}
            perfectDrawEnabled={false}
            hitStrokeWidth={Math.max(16, s.width * 2)}
            onClick={(ev) => {
              ev.cancelBubble = true;
              if (mainTool === 'select') onSelect({ kind: 'stroke', id: s.id });
            }}
          />
        ))}

        {sortedShapes.map((sh) => {
          if (sh.type === 'rect' && sh.width != null && sh.height != null) {
            return (
              <Rect
                key={sh.id}
                x={sh.x}
                y={sh.y}
                width={sh.width}
                height={sh.height}
                rotation={sh.rotation}
                stroke={sh.color}
                strokeWidth={sh.strokeWidth}
                listening={mainTool === 'select' || (mainTool === 'draw' && drawTool === 'eraser')}
                name={`shape:${sh.id}`}
                onClick={(ev) => {
                  ev.cancelBubble = true;
                  if (mainTool === 'select') onSelect({ kind: 'shape', id: sh.id });
                }}
              />
            );
          }
          if (sh.type === 'ellipse' && sh.width != null && sh.height != null) {
            return (
              <Ellipse
                key={sh.id}
                x={sh.x}
                y={sh.y}
                radiusX={sh.width / 2}
                radiusY={sh.height / 2}
                rotation={sh.rotation}
                stroke={sh.color}
                strokeWidth={sh.strokeWidth}
                listening={mainTool === 'select' || (mainTool === 'draw' && drawTool === 'eraser')}
                name={`shape:${sh.id}`}
                onClick={(ev) => {
                  ev.cancelBubble = true;
                  if (mainTool === 'select') onSelect({ kind: 'shape', id: sh.id });
                }}
              />
            );
          }
          if (sh.type === 'line' && sh.x2 != null && sh.y2 != null) {
            return (
              <Line
                key={sh.id}
                points={[sh.x, sh.y, sh.x2, sh.y2]}
                stroke={sh.color}
                strokeWidth={sh.strokeWidth}
                lineCap="round"
                listening={mainTool === 'select' || (mainTool === 'draw' && drawTool === 'eraser')}
                name={`shape:${sh.id}`}
                hitStrokeWidth={Math.max(16, sh.strokeWidth * 3)}
                onClick={(ev) => {
                  ev.cancelBubble = true;
                  if (mainTool === 'select') onSelect({ kind: 'shape', id: sh.id });
                }}
              />
            );
          }
          return null;
        })}

        {sortedTexts.map((t) => (
          <Text
            key={t.id}
            x={t.x}
            y={t.y}
            width={t.width}
            text={t.content}
            fontSize={t.fontSize}
            fill={t.color}
            align={t.align}
            rotation={t.rotation}
            listening={mainTool === 'select' || (mainTool === 'draw' && drawTool === 'eraser')}
            name={`text:${t.id}`}
            draggable={mainTool === 'select' && !effectivePan}
            onClick={(ev) => {
              ev.cancelBubble = true;
              if (mainTool === 'select') {
                onSelect({ kind: 'text', id: t.id });
                if (ev.evt.detail >= 2) setEditingTextId(t.id);
                return;
              }
              if (mainTool === 'text') {
                onSelect({ kind: 'text', id: t.id });
                setEditingTextId(t.id);
              }
            }}
            onDragEnd={(ev) => {
              onBeforeMutate();
              const node = ev.target;
              commit({
                ...board,
                texts: board.texts.map((x) =>
                  x.id === t.id ? { ...x, x: node.x(), y: node.y(), rotation: node.rotation() } : x
                )
              });
            }}
          />
        ))}

        {brushLine && brushLine.length >= 2 ? (
          <Line points={brushLine} stroke={strokeColor} strokeWidth={strokeWidthPx} tension={0.35} lineCap="round" listening={false} />
        ) : null}

        {shapeDraft
          ? shapeDraft.kind === 'rect'
            ? (
                <Rect
                  x={shapeDraft.x}
                  y={shapeDraft.y}
                  width={shapeDraft.w}
                  height={shapeDraft.h}
                  stroke={strokeColor}
                  strokeWidth={strokeWidthPx}
                  dash={[6, 6]}
                  listening={false}
                />
              )
            : shapeDraft.kind === 'ellipse'
              ? (
                  <Ellipse
                    x={shapeDraft.x + shapeDraft.w / 2}
                    y={shapeDraft.y + shapeDraft.h / 2}
                    radiusX={Math.max(1, shapeDraft.w / 2)}
                    radiusY={Math.max(1, shapeDraft.h / 2)}
                    stroke={strokeColor}
                    strokeWidth={strokeWidthPx}
                    dash={[6, 6]}
                    listening={false}
                  />
                )
              : (
                  <Line
                    points={[shapeDraft.x1, shapeDraft.y1, shapeDraft.x2, shapeDraft.y2]}
                    stroke={strokeColor}
                    strokeWidth={strokeWidthPx}
                    dash={[6, 6]}
                    listening={false}
                  />
                )
          : null}

        <Transformer
          ref={transformerRef}
          rotateEnabled
          borderStroke="#0889c7"
          anchorStroke="#0889c7"
          anchorFill="#f2f3f4"
          padding={2}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 16 || newBox.height < 16) return oldBox;
            return newBox;
          }}
        />
      </Layer>
    </Stage>
  );
}
