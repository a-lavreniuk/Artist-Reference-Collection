import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import MoodboardKonvaStage, {
  type DrawTool,
  type MainTool,
  type SelectedTarget,
  SCALE_MAX,
  SCALE_MIN
} from './board/MoodboardKonvaStage';
import { cloneBoard } from './board/cloneBoard';
import { newEntityId } from './board/ids';
import { loadCardOriginalPixelSize } from './board/cardOriginalSize';
import { fitBoardToViewport } from './board/fitViewport';
import BoardColorModal from './BoardColorModal';
import ConfirmRemoveFromMoodboardModal from './ConfirmRemoveFromMoodboardModal';
import { hydrateArc2NavbarIcons } from '../layout/navbarIconHydrate';
import type { MoodboardBoardV1 } from '../../services/arcSchema';
import type { CardRecord } from '../../services/db';
import {
  ARC2_CARDS_CHANGED_EVENT,
  ARC2_MOODBOARD_BOARD_CHANGED_EVENT,
  getCardById,
  getMoodboardBoard,
  getMoodboardCardIds,
  isCardOnBoard,
  removeCardFromMoodboard,
  saveMoodboardBoard
} from '../../services/db';
import { normalizeHex } from '../../utils/colorPicker';

const MIME_CARD = 'application/x-arc2-card-id';

function isTypingTarget(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(t.isContentEditable);
}

export default function MoodboardBoardView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<MoodboardBoardV1 | null>(null);

  const [board, setBoard] = useState<MoodboardBoardV1 | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [undoStack, setUndoStack] = useState<MoodboardBoardV1[]>([]);
  const [redoStack, setRedoStack] = useState<MoodboardBoardV1[]>([]);

  const [mainTool, setMainTool] = useState<MainTool>('select');
  const [drawTool, setDrawTool] = useState<DrawTool>('brush');
  const [strokeWidthPx, setStrokeWidthPx] = useState(3);
  const [strokeColor, setStrokeColor] = useState('#c5c7cc');
  const [textFontSize, setTextFontSize] = useState(20);
  const [textColor, setTextColor] = useState('#f2f3f4');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');

  const [selected, setSelected] = useState<SelectedTarget>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState('');
  const editSnapshotRef = useRef<string | null>(null);

  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panDragActive, setPanDragActive] = useState(false);
  const erroredEraserRef = useRef(false);
  const [eraserDeniedTick, setEraserDeniedTick] = useState(0);

  const [queueCards, setQueueCards] = useState<CardRecord[]>([]);
  const [queueThumbs, setQueueThumbs] = useState<Record<string, string | null>>({});

  const [removeQueueConfirm, setRemoveQueueConfirm] = useState<{ cardId: string; onBoard: boolean } | null>(null);
  const [colorModal, setColorModal] = useState<'stroke' | 'text' | null>(null);

  const ignoreNextBoardEventRef = useRef(false);
  const saveBoardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveViewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapRef = useRef<string>('');
  const lastSavedViewportSnapRef = useRef<string>('');

  boardRef.current = board;

  const reloadQueue = useCallback(async () => {
    const ids = await getMoodboardCardIds();
    const cards = (await Promise.all(ids.map((id) => getCardById(id)))).filter((c): c is CardRecord => Boolean(c));
    setQueueCards(cards);
  }, []);

  const reloadBoardFromDb = useCallback(async () => {
    const b = await getMoodboardBoard();
    setBoard(b);
    setUndoStack([]);
    setRedoStack([]);
    lastSavedSnapRef.current = JSON.stringify(b);
  }, []);

  useEffect(() => {
    void reloadBoardFromDb();
  }, [reloadBoardFromDb]);

  useEffect(() => {
    const onRemote = () => {
      if (ignoreNextBoardEventRef.current) {
        ignoreNextBoardEventRef.current = false;
        return;
      }
      void reloadBoardFromDb();
    };
    window.addEventListener(ARC2_MOODBOARD_BOARD_CHANGED_EVENT, onRemote);
    return () => window.removeEventListener(ARC2_MOODBOARD_BOARD_CHANGED_EVENT, onRemote);
  }, [reloadBoardFromDb]);

  useEffect(() => {
    const onCards = () => void reloadQueue();
    window.addEventListener(ARC2_CARDS_CHANGED_EVENT, onCards);
    return () => window.removeEventListener(ARC2_CARDS_CHANGED_EVENT, onCards);
  }, [reloadQueue]);

  useEffect(() => {
    void reloadQueue();
  }, [reloadQueue]);

  useLayoutEffect(() => {
    if (toolbarRef.current) void hydrateArc2NavbarIcons(toolbarRef.current);
  }, [
    mainTool,
    drawTool,
    strokeWidthPx,
    textFontSize,
    textAlign,
    selected,
    undoStack.length,
    redoStack.length,
    board?.viewport.scale,
    editingTextId,
    colorModal
  ]);

  useEffect(() => {
    if (!board) return;
    const el = canvasWrapRef.current;
    if (!el) return;
    let raf = 0;

    const measure = () => {
      const w = Math.max(320, Math.floor(el.clientWidth));
      const h = Math.max(240, Math.floor(el.clientHeight));
      setSize({ width: w, height: h });
    };

    const scheduleMeasure = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };

    // Важно: первичный замер + только resize окна.
    // ResizeObserver здесь даёт петлю роста, т.к. canvas влияет на размер контейнера.
    scheduleMeasure();
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      window.removeEventListener('resize', scheduleMeasure);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [board]);

  const queueKey = queueCards.map((c) => c.id).join(',');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string | null> = {};
      for (const c of queueCards) {
        if (!window.arc) {
          next[c.id] = null;
          continue;
        }
        const rel = c.thumbRelativePath || c.originalRelativePath;
        if (!rel || rel === 'legacy') {
          next[c.id] = null;
          continue;
        }
        const url = await window.arc.toFileUrl(rel);
        if (cancelled) return;
        next[c.id] = url;
      }
      if (!cancelled) setQueueThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [queueKey, queueCards]);

  const scheduleSave = useCallback(() => {
    if (!board) return;
    if (saveBoardTimerRef.current) clearTimeout(saveBoardTimerRef.current);
    saveBoardTimerRef.current = setTimeout(() => {
      const b = boardRef.current;
      if (!b) return;
      const snap = JSON.stringify({
        imageInstances: b.imageInstances,
        strokes: b.strokes,
        shapes: b.shapes,
        texts: b.texts
      });
      if (snap === lastSavedSnapRef.current) return;
      ignoreNextBoardEventRef.current = true;
      void saveMoodboardBoard(b).then(() => {
        lastSavedSnapRef.current = snap;
      });
    }, 600);
  }, [board]);

  const scheduleViewportSave = useCallback(() => {
    if (!board) return;
    if (saveViewportTimerRef.current) clearTimeout(saveViewportTimerRef.current);
    saveViewportTimerRef.current = setTimeout(() => {
      const b = boardRef.current;
      if (!b) return;
      const snap = JSON.stringify(b.viewport);
      if (snap === lastSavedViewportSnapRef.current) return;
      ignoreNextBoardEventRef.current = true;
      void saveMoodboardBoard(b).then(() => {
        lastSavedViewportSnapRef.current = snap;
      });
    }, 1500);
  }, [board]);

  useEffect(() => {
    if (!board) return;
    scheduleSave();
    return () => {
      if (saveBoardTimerRef.current) clearTimeout(saveBoardTimerRef.current);
    };
  }, [board, scheduleSave]);

  useEffect(() => {
    if (!board) return;
    scheduleViewportSave();
    return () => {
      if (saveViewportTimerRef.current) clearTimeout(saveViewportTimerRef.current);
    };
  }, [board?.viewport.x, board?.viewport.y, board?.viewport.scale, board, scheduleViewportSave]);

  useEffect(() => {
    return () => {
      if (saveBoardTimerRef.current) clearTimeout(saveBoardTimerRef.current);
      if (saveViewportTimerRef.current) clearTimeout(saveViewportTimerRef.current);
      const b = boardRef.current;
      if (b) {
        ignoreNextBoardEventRef.current = true;
        void saveMoodboardBoard(b);
      }
    };
  }, []);

  const onBeforeMutate = useCallback(() => {
    const b = boardRef.current;
    if (!b) return;
    setUndoStack((s) => [...s, cloneBoard(b)]);
    setRedoStack([]);
  }, []);

  const onBoardChange = useCallback((next: MoodboardBoardV1) => {
    setBoard(next);
  }, []);

  const onPanPixelDelta = useCallback((dx: number, dy: number) => {
    setBoard((b) => {
      if (!b) return b;
      return {
        ...b,
        viewport: { ...b.viewport, x: b.viewport.x + dx, y: b.viewport.y + dy }
      };
    });
  }, []);

  const undo = useCallback(() => {
    setUndoStack((past) => {
      if (!past.length || !boardRef.current) return past;
      const prev = past[past.length - 1];
      setRedoStack((f) => [cloneBoard(boardRef.current!), ...f]);
      setBoard(prev);
      setSelected(null);
      setEditingTextId(null);
      return past.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack((future) => {
      if (!future.length || !boardRef.current) return future;
      const next = future[0];
      setUndoStack((u) => [...u, cloneBoard(boardRef.current!)]);
      setBoard(next);
      setSelected(null);
      setEditingTextId(null);
      return future.slice(1);
    });
  }, []);

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    setBoard((b) => {
      if (!b) return b;
      const vp = b.viewport;
      const wx = (sx - vp.x) / vp.scale;
      const wy = (sy - vp.y) / vp.scale;
      let newScale = vp.scale * factor;
      newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, newScale));
      return {
        ...b,
        viewport: {
          x: sx - wx * newScale,
          y: sy - wy * newScale,
          scale: newScale
        }
      };
    });
  }, []);

  const zoomCenterFactor = useCallback(
    (factor: number) => {
      const cx = size.width / 2;
      const cy = size.height / 2;
      zoomAt(cx, cy, factor);
    },
    [size.height, size.width, zoomAt]
  );

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvasWrapRef.current?.getBoundingClientRect();
      if (!rect || !boardRef.current) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.08 : 1 / 1.08;
      zoomAt(sx, sy, factor);
    },
    [zoomAt]
  );

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const handler = (ev: WheelEvent) => onWheel(ev);
    el.addEventListener('wheel', handler, { passive: false });
    return () => {
      el.removeEventListener('wheel', handler);
    };
  }, [onWheel]);

  const fitView = useCallback(() => {
    setBoard((b) => {
      if (!b) return b;
      const vp = fitBoardToViewport(b, size.width, size.height);
      return { ...b, viewport: vp };
    });
  }, [size.height, size.width]);

  const resetZoom100 = useCallback(() => {
    setBoard((b) => {
      if (!b) return b;
      const cx = size.width / 2;
      const cy = size.height / 2;
      const vp = b.viewport;
      const wx = (cx - vp.x) / vp.scale;
      const wy = (cy - vp.y) / vp.scale;
      const newScale = 1;
      return {
        ...b,
        viewport: {
          x: cx - wx * newScale,
          y: cy - wy * newScale,
          scale: newScale
        }
      };
    });
  }, [size.height, size.width]);

  const deleteSelected = useCallback(() => {
    if (!selected || !boardRef.current) return;
    const b = boardRef.current;
    onBeforeMutate();
    if (selected.kind === 'image') {
      setBoard({
        ...b,
        imageInstances: b.imageInstances.filter((i) => i.id !== selected.id)
      });
    } else if (selected.kind === 'stroke') {
      setBoard({ ...b, strokes: b.strokes.filter((s) => s.id !== selected.id) });
    } else if (selected.kind === 'shape') {
      setBoard({ ...b, shapes: b.shapes.filter((s) => s.id !== selected.id) });
    } else if (selected.kind === 'text') {
      setBoard({ ...b, texts: b.texts.filter((t) => t.id !== selected.id) });
    }
    setSelected(null);
    setEditingTextId(null);
  }, [onBeforeMutate, selected]);

  const clearBoardContent = useCallback(() => {
    if (!boardRef.current) return;
    if (!window.confirm('Очистить рабочую область? Карточки в очереди мудборда останутся.')) return;
    onBeforeMutate();
    const next = {
      ...boardRef.current,
      imageInstances: [],
      strokes: [],
      shapes: [],
      texts: []
    };
    setBoard(next);
    setSelected(null);
    setEditingTextId(null);
  }, [onBeforeMutate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === 'Escape') {
        if (editingTextId) return;
        setSelected(null);
        setMainTool('select');
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [deleteSelected, editingTextId, redo, undo]);

  const editingText = useMemo(() => {
    if (!editingTextId || !board) return null;
    return board.texts.find((t) => t.id === editingTextId) ?? null;
  }, [board, editingTextId]);

  useEffect(() => {
    if (editingText) {
      editSnapshotRef.current = editingText.content;
      setEditBuffer(editingText.content);
    }
  }, [editingText?.id]);

  useEffect(() => {
    if (selected?.kind === 'text' && board) {
      const t = board.texts.find((x) => x.id === selected.id);
      if (t) {
        setTextFontSize(t.fontSize);
        setTextAlign(t.align);
        setTextColor(t.color);
      }
    }
    if (selected?.kind === 'stroke' && board) {
      const s = board.strokes.find((x) => x.id === selected.id);
      if (s) setStrokeColor(s.color);
    }
    if (selected?.kind === 'shape' && board) {
      const sh = board.shapes.find((x) => x.id === selected.id);
      if (sh) setStrokeColor(sh.color);
    }
  }, [board, selected]);

  useEffect(() => {
    if (!eraserDeniedTick) return;
    const id = window.setTimeout(() => setEraserDeniedTick(0), 220);
    return () => window.clearTimeout(id);
  }, [eraserDeniedTick]);

  const commitEditBuffer = useCallback(() => {
    if (!editingTextId || !boardRef.current) return;
    const id = editingTextId;
    const content = editBuffer;
    onBeforeMutate();
    setBoard((b) => {
      if (!b) return b;
      return {
        ...b,
        texts: b.texts.map((t) => (t.id === id ? { ...t, content } : t))
      };
    });
    setEditingTextId(null);
  }, [editBuffer, editingTextId, onBeforeMutate]);

  const cancelEditBuffer = useCallback(() => {
    const snap = editSnapshotRef.current ?? '';
    if (editingTextId && boardRef.current) {
      setBoard((b) => {
        if (!b) return b;
        return {
          ...b,
          texts: b.texts.map((t) => (t.id === editingTextId ? { ...t, content: snap } : t))
        };
      });
    }
    setEditingTextId(null);
  }, [editingTextId]);

  const textOverlay = useMemo(() => {
    if (!editingText || !board || !canvasWrapRef.current) return null;
    const vp = board.viewport;
    const t = editingText;
    const rect = canvasWrapRef.current.getBoundingClientRect();
    const left = rect.left + t.x * vp.scale + vp.x;
    const top = rect.top + t.y * vp.scale + vp.y;
    const width = Math.max(80, t.width * vp.scale);
    const fs = Math.max(10, t.fontSize * vp.scale);
    return createPortal(
      <textarea
        className="arc2-moodboard-text-edit input input-live"
        style={{
          position: 'fixed',
          left,
          top,
          width,
          minHeight: fs * 2,
          fontSize: fs,
          zIndex: 50
        }}
        value={editBuffer}
        onChange={(e) => setEditBuffer(e.target.value)}
        onBlur={() => commitEditBuffer()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditBuffer();
          }
        }}
        autoFocus
        aria-label="Редактирование текста на доске"
      />,
      document.body
    );
  }, [board, cancelEditBuffer, commitEditBuffer, editBuffer, editingText]);

  const patchStrokeColor = useCallback(
    (hex: string) => {
      if (!selected || (selected.kind !== 'stroke' && selected.kind !== 'shape')) return;
      onBeforeMutate();
      const id = selected.id;
      setBoard((b) => {
        if (!b) return b;
        if (selected.kind === 'stroke') {
          return { ...b, strokes: b.strokes.map((s) => (s.id === id ? { ...s, color: hex } : s)) };
        }
        return { ...b, shapes: b.shapes.map((s) => (s.id === id ? { ...s, color: hex } : s)) };
      });
    },
    [onBeforeMutate, selected]
  );

  const patchTextProps = useCallback(
    (patch: Partial<{ color: string; fontSize: number; align: 'left' | 'center' | 'right' }>) => {
      if (!selected || selected.kind !== 'text') return;
      onBeforeMutate();
      const id = selected.id;
      setBoard((b) => {
        if (!b) return b;
        return { ...b, texts: b.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
      });
    },
    [onBeforeMutate, selected]
  );

  const onDropOnCanvas = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const cardId = e.dataTransfer.getData(MIME_CARD);
      if (!cardId || !boardRef.current || !canvasWrapRef.current) return;
      const rect = canvasWrapRef.current.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const b0 = boardRef.current;
      const vp = b0.viewport;
      const wx = (sx - vp.x) / vp.scale;
      const wy = (sy - vp.y) / vp.scale;
      const card = await getCardById(cardId);
      if (!card) return;

      const originalSize = await loadCardOriginalPixelSize(card);
      const width = originalSize?.width ?? Math.max(1, card.width || 320);
      const height = originalSize?.height ?? Math.max(1, card.height || 320);
      let maxZ = 0;
      for (const x of b0.imageInstances) maxZ = Math.max(maxZ, x.zIndex);
      for (const x of b0.strokes) maxZ = Math.max(maxZ, x.zIndex);
      for (const x of b0.shapes) maxZ = Math.max(maxZ, x.zIndex);
      for (const x of b0.texts) maxZ = Math.max(maxZ, x.zIndex);
      onBeforeMutate();
      const id = newEntityId();
      setBoard({
        ...b0,
        imageInstances: [
          ...b0.imageInstances,
          {
            id,
            cardId,
            x: wx - width / 2,
            y: wy - height / 2,
            width,
            height,
            rotation: 0,
            zIndex: maxZ + 1
          }
        ]
      });
      setSelected({ kind: 'image', id });
    },
    [onBeforeMutate]
  );

  const goCardsMode = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.set('mf', 'cards');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const zoomPct = board ? Math.round(board.viewport.scale * 100) : 100;
  const onBoardCardIds = useMemo(() => new Set((board?.imageInstances ?? []).map((x) => x.cardId)), [board]);

  const initialStrokeHex = normalizeHex(strokeColor) ?? '#c5c7cc';
  const initialTextHex = normalizeHex(textColor) ?? '#f2f3f4';

  if (!board) {
    return (
      <div className="arc2-moodboard arc2-moodboard--loading">
        <p className="arc2-moodboard-loading-msg">Загрузка доски…</p>
      </div>
    );
  }

  return (
    <div className="arc2-moodboard">
      <header className="arc2-moodboard-top">
        <button type="button" className="btn btn-outline btn-ds btn-s" data-btn-size="s" onClick={() => goCardsMode()}>
          <span className="btn-ds__value">Карточки</span>
        </button>
      </header>

      <section className="arc2-moodboard-queue" aria-label="Очередь карточек мудборда">
        <div className="arc2-moodboard-queue-scroll">
          {queueCards.map((c) => (
            <div key={c.id} className="arc2-moodboard-queue-tile-wrap">
              {(() => {
                const alreadyOnBoard = onBoardCardIds.has(c.id);
                return (
              <div
                className={`arc2-moodboard-queue-tile${alreadyOnBoard ? ' is-on-board' : ''}`}
                draggable={!alreadyOnBoard}
                onDragStart={(e) => {
                  if (alreadyOnBoard) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData(MIME_CARD, c.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                {/* eslint-disable-next-line jsx-a11y/alt-text -- превью из библиотеки */}
                <img className="arc2-moodboard-queue-thumb" src={queueThumbs[c.id] ?? undefined} />
              </div>
                );
              })()}
              <button
                type="button"
                className="arc2-moodboard-queue-remove btn-icon-only btn-icon-only--ghost"
                data-btn-size="s"
                aria-label="Снять с мудборда"
                onClick={async () => {
                  const onBoard = await isCardOnBoard(c.id);
                  setRemoveQueueConfirm({ cardId: c.id, onBoard });
                }}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-close" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </section>

      <div ref={toolbarRef} className="arc2-moodboard-body">
        <div
          className="arc2-moodboard-toolbar-host"
          data-arc2-icon-size="s"
          data-btn-size="s"
          aria-label="Инструменты доски"
        >
          <div className="arc2-moodboard-toolbar arc2-moodboard-toolbar--history">
            <button
              type="button"
              className="btn-icon-only btn-icon-only--ghost"
              aria-label="Отменить"
              disabled={undoStack.length === 0}
              onClick={() => undo()}
            >
              <span className="btn-icon-only__glyph tab-icon arc2-icon-undo" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-icon-only btn-icon-only--ghost arc2-moodboard-history-redo"
              aria-label="Вернуть"
              disabled={redoStack.length === 0}
              onClick={() => redo()}
            >
              <span className="btn-icon-only__glyph tab-icon arc2-icon-undo" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-icon-only btn-icon-only--ghost"
              aria-label="Очистить доску"
              title="Очистить доску"
              onClick={() => clearBoardContent()}
            >
              <span className="btn-icon-only__glyph tab-icon arc2-icon-trash" aria-hidden />
            </button>
          </div>

          <div className="arc2-moodboard-toolbar arc2-moodboard-toolbar--main">
            <button
              type="button"
              className={`btn-icon-only${mainTool === 'select' ? ' is-active' : ''} btn-icon-only--ghost`}
              aria-label="Выделение"
              aria-pressed={mainTool === 'select'}
              onClick={() => setMainTool('select')}
            >
              <span className="btn-icon-only__glyph tab-icon arc2-icon-cursor" aria-hidden />
            </button>
            <button
              type="button"
              className={`btn-icon-only${mainTool === 'pan' ? ' is-active' : ''} btn-icon-only--ghost`}
              aria-label="Панорама"
              aria-pressed={mainTool === 'pan'}
              onClick={() => setMainTool('pan')}
            >
              <span className="btn-icon-only__glyph tab-icon arc2-icon-pan" aria-hidden />
            </button>
            <button
              type="button"
              className={`btn-icon-only${mainTool === 'draw' ? ' is-active' : ''} btn-icon-only--ghost`}
              aria-label="Рисование"
              aria-pressed={mainTool === 'draw'}
              onClick={() => setMainTool('draw')}
            >
              <span className="btn-icon-only__glyph tab-icon arc2-icon-pencil" aria-hidden />
            </button>
            <button
              type="button"
              className={`btn-icon-only${mainTool === 'text' ? ' is-active' : ''} btn-icon-only--ghost`}
              aria-label="Текст"
              aria-pressed={mainTool === 'text'}
              onClick={() => setMainTool('text')}
            >
              <span className="btn-icon-only__glyph tab-icon arc2-icon-type" aria-hidden />
            </button>
          </div>

          {mainTool === 'draw' ? (
            <div className="arc2-moodboard-toolbar arc2-moodboard-toolbar--draw">
              <button
                type="button"
                className={`btn-icon-only${drawTool === 'brush' ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="Кисть"
                aria-pressed={drawTool === 'brush'}
                onClick={() => setDrawTool('brush')}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-pencil" aria-hidden />
              </button>
              <button
                type="button"
                className={`btn-icon-only${strokeWidthPx <= 4 ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="Тонкая линия"
                onClick={() => setStrokeWidthPx(3)}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-line-thin" aria-hidden />
              </button>
              <button
                type="button"
                className={`btn-icon-only${strokeWidthPx > 4 ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="Толстая линия"
                onClick={() => setStrokeWidthPx(10)}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-line-thik" aria-hidden />
              </button>
              <button
                type="button"
                className={`btn-icon-only${drawTool === 'rect' ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="Прямоугольник"
                aria-pressed={drawTool === 'rect'}
                onClick={() => setDrawTool('rect')}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-predictable" aria-hidden />
              </button>
              <button
                type="button"
                className={`btn-icon-only${drawTool === 'ellipse' ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="Эллипс"
                aria-pressed={drawTool === 'ellipse'}
                onClick={() => setDrawTool('ellipse')}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-circle" aria-hidden />
              </button>
              <button
                type="button"
                className={`btn-icon-only${drawTool === 'line' ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="Линия"
                aria-pressed={drawTool === 'line'}
                onClick={() => setDrawTool('line')}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-line" aria-hidden />
              </button>
              <button
                type="button"
                className={`btn-icon-only${drawTool === 'eraser' ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="Ластик"
                aria-pressed={drawTool === 'eraser'}
                onClick={() => setDrawTool('eraser')}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-eraser" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-icon-only btn-icon-only--ghost"
                aria-label="Цвет линии"
                onClick={() => setColorModal('stroke')}
              >
                <span className="arc2-moodboard-color-swatch" style={{ backgroundColor: initialStrokeHex }} />
              </button>
            </div>
          ) : null}

          {mainTool === 'text' ? (
            <div className="arc2-moodboard-toolbar arc2-moodboard-toolbar--text">
              <button
                type="button"
                className={`btn btn-outline btn-ds btn-s${textFontSize <= 15 ? ' is-active' : ''}`}
                onClick={() => {
                  setTextFontSize(14);
                  patchTextProps({ fontSize: 14 });
                }}
              >
                <span className="btn-ds__value">S</span>
              </button>
              <button
                type="button"
                className={`btn btn-outline btn-ds btn-s${textFontSize > 15 && textFontSize < 24 ? ' is-active' : ''}`}
                onClick={() => {
                  setTextFontSize(20);
                  patchTextProps({ fontSize: 20 });
                }}
              >
                <span className="btn-ds__value">M</span>
              </button>
              <button
                type="button"
                className={`btn btn-outline btn-ds btn-s${textFontSize >= 24 ? ' is-active' : ''}`}
                onClick={() => {
                  setTextFontSize(28);
                  patchTextProps({ fontSize: 28 });
                }}
              >
                <span className="btn-ds__value">L</span>
              </button>
              <button
                type="button"
                className={`btn-icon-only${textAlign === 'left' ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="По левому краю"
                aria-pressed={textAlign === 'left'}
                onClick={() => {
                  setTextAlign('left');
                  patchTextProps({ align: 'left' });
                }}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-align-left" aria-hidden />
              </button>
              <button
                type="button"
                className={`btn-icon-only${textAlign === 'center' ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="По центру"
                aria-pressed={textAlign === 'center'}
                onClick={() => {
                  setTextAlign('center');
                  patchTextProps({ align: 'center' });
                }}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-align-center" aria-hidden />
              </button>
              <button
                type="button"
                className={`btn-icon-only${textAlign === 'right' ? ' is-active' : ''} btn-icon-only--ghost`}
                aria-label="По правому краю"
                aria-pressed={textAlign === 'right'}
                onClick={() => {
                  setTextAlign('right');
                  patchTextProps({ align: 'right' });
                }}
              >
                <span className="btn-icon-only__glyph tab-icon arc2-icon-align-right" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-icon-only btn-icon-only--ghost"
                aria-label="Цвет текста"
                onClick={() => setColorModal('text')}
              >
                <span className="arc2-moodboard-color-swatch" style={{ backgroundColor: initialTextHex }} />
              </button>
            </div>
          ) : null}
        </div>

        <div
          ref={canvasWrapRef}
          className={`arc2-moodboard-canvas-wrap${spaceHeld || panDragActive ? ' arc2-moodboard-canvas-wrap--pan' : ''}${eraserDeniedTick > 0 ? ' arc2-moodboard-canvas-wrap--eraser-deny' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(e) => void onDropOnCanvas(e)}
        >
          <MoodboardKonvaStage
            width={size.width}
            height={size.height}
            board={board}
            onBoardChange={onBoardChange}
            mainTool={mainTool}
            drawTool={drawTool}
            strokeWidthPx={strokeWidthPx}
            strokeColor={initialStrokeHex}
            textFontSize={textFontSize}
            textColor={initialTextHex}
            textAlign={textAlign}
            selected={selected}
            onSelect={setSelected}
            onBeforeMutate={onBeforeMutate}
            onPanPixelDelta={onPanPixelDelta}
            spaceHeld={spaceHeld}
            panDragActive={panDragActive}
            setPanDragActive={setPanDragActive}
            editingTextId={editingTextId}
            setEditingTextId={setEditingTextId}
            erroredEraserRef={erroredEraserRef}
            onEraserBlocked={() => setEraserDeniedTick((n) => n + 1)}
          />
        </div>

        <div className="arc2-moodboard-zoom" aria-label="Масштаб">
          <button type="button" className="btn-icon-only btn-icon-only--ghost" aria-label="Уменьшить" onClick={() => zoomCenterFactor(1 / 1.08)}>
            <span className="btn-icon-only__glyph tab-icon arc2-icon-minus" aria-hidden />
          </button>
          <button type="button" className="btn-icon-only btn-icon-only--ghost" aria-label="Увеличить" onClick={() => zoomCenterFactor(1.08)}>
            <span className="btn-icon-only__glyph tab-icon arc2-icon-plus" aria-hidden />
          </button>
          <button type="button" className="btn btn-outline btn-ds btn-s" onClick={() => resetZoom100()}>
            <span className="btn-ds__value">100%</span>
          </button>
          <button type="button" className="btn btn-outline btn-ds btn-s" onClick={() => fitView()}>
            <span className="btn-ds__value">Вписать</span>
          </button>
          <span className="arc2-moodboard-zoom-pct" aria-live="polite">
            {zoomPct}%
          </span>
        </div>
      </div>

      {textOverlay}

      {removeQueueConfirm ? (
        <ConfirmRemoveFromMoodboardModal
          cardOnBoard={removeQueueConfirm.onBoard}
          onClose={() => setRemoveQueueConfirm(null)}
          onConfirm={async () => {
            await removeCardFromMoodboard(removeQueueConfirm.cardId);
            await reloadQueue();
          }}
        />
      ) : null}

      {colorModal === 'stroke' ? (
        <BoardColorModal
          title="Цвет линии"
          initialHex={selected?.kind === 'stroke' || selected?.kind === 'shape' ? (normalizeHex(strokeColor) ?? '#c5c7cc') : initialStrokeHex}
          onClose={() => setColorModal(null)}
          onApply={(hex) => {
            setStrokeColor(hex);
            if (selected?.kind === 'stroke' || selected?.kind === 'shape') patchStrokeColor(hex);
            setColorModal(null);
          }}
        />
      ) : null}

      {colorModal === 'text' ? (
        <BoardColorModal
          title="Цвет текста"
          initialHex={selected?.kind === 'text' ? (normalizeHex(textColor) ?? '#f2f3f4') : initialTextHex}
          onClose={() => setColorModal(null)}
          onApply={(hex) => {
            setTextColor(hex);
            patchTextProps({ color: hex });
            setColorModal(null);
          }}
        />
      ) : null}
    </div>
  );
}
