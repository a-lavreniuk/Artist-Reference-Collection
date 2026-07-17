import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react';
import { ContextMenu } from '../components/context-menu';
import type { ContextMenuRow } from '../components/context-menu';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import ValueSlider from '../components/range-slider/ValueSlider';
import { Tooltip } from '../components/tooltip/Tooltip';
import { matchesShortcut } from '../shortcuts/matchShortcutEvent';
import { isEditableTarget } from '../shortcuts/shortcutGuards';
import { shortcutMenuLabel } from '../shortcuts/shortcutLabels';
import {
  canRedoCardViewerHistory,
  canUndoCardViewerHistory,
  createCardViewerHistory,
  pushCardViewerHistory,
  redoCardViewerHistory,
  undoCardViewerHistory,
  type CardViewerHistoryState,
  type CardViewerViewState
} from './cardViewerHistory';
import {
  DEFAULT_VIEWER_TRANSFORM,
  rotateViewerTransform,
  rotateViewerTransformCcw,
  toggleViewerFlipH,
  toggleViewerFlipV,
  toggleViewerGrayscale,
  viewerTransformStyle,
  type ViewerTransform
} from './cardViewerTransforms';
import { applyViewerWheelZoom } from './cardViewerWheelZoom';
import {
  viewerZoomMediaStyle,
  type ViewerZoomMode
} from './cardViewerZoom';
import { parseCardViewerLaunch } from './parseCardViewerLaunch';
import { useCardViewerSession } from './useCardViewerSession';
import { useCardViewerPan } from './useCardViewerPan';
import CardViewerVideoControls from './CardViewerVideoControls';
import type { CardViewerOpenContext } from './openCardsInNewWindow';

const OPACITY_MIN = 20;
const OPACITY_MAX = 100;
const WHEEL_HISTORY_BATCH_MS = 350;
const MENU_SLOT_ORDER = ['label', 'shortcut'] as const;

function clampOpacityPct(value: number): number {
  if (!Number.isFinite(value)) return OPACITY_MAX;
  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, Math.round(value)));
}

function parseOpacityInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return null;
  return clampOpacityPct(parsed);
}

function cardViewerContextAllowsNavigation(context: CardViewerOpenContext): boolean {
  return context.kind === 'collection' || context.kind === 'moodboard';
}

function defaultViewState(): CardViewerViewState {
  return {
    transform: DEFAULT_VIEWER_TRANSFORM,
    zoomMode: { kind: 'fit' },
    pan: { x: 0, y: 0 }
  };
}

export default function CardViewerApp() {
  const launch = useMemo(() => parseCardViewerLaunch(window.location.search), []);
  const session = useCardViewerSession(launch.cardIds, launch.startIndex);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const historyRef = useRef<CardViewerHistoryState>(createCardViewerHistory(defaultViewState()));
  const viewRef = useRef<CardViewerViewState>(defaultViewState());
  const wheelBatchActiveRef = useRef(false);
  const wheelBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [zoomMode, setZoomMode] = useState<ViewerZoomMode>({ kind: 'fit' });
  const [transform, setTransform] = useState<ViewerTransform>(DEFAULT_VIEWER_TRANSFORM);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [opacityPct, setOpacityPct] = useState(OPACITY_MAX);
  const [opacityInput, setOpacityInput] = useState(`${OPACITY_MAX}%`);
  const [menuOpen, setMenuOpen] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [historyTick, setHistoryTick] = useState(0);

  const panEnabled = zoomMode.kind !== 'fit';
  const { offset: panOffset, setOffset: setPanOffset, panHandlers } = useCardViewerPan(
    panEnabled,
    session.card?.id ?? ''
  );

  viewRef.current = { transform, zoomMode, pan: panOffset };

  const showNavigation =
    cardViewerContextAllowsNavigation(launch.context) && session.cardIds.length > 1;

  const cardTitle = session.card?.name?.trim() || session.card?.id || 'Просмотр';

  const breadcrumb = useMemo(() => {
    if (launch.context.kind === 'moodboard') {
      return { prefix: 'Мудборд', cardName: cardTitle };
    }
    if (launch.context.kind === 'collection') {
      return { prefix: launch.context.name, cardName: cardTitle };
    }
    return { prefix: null, cardName: cardTitle };
  }, [cardTitle, launch.context]);

  const fullTitle = breadcrumb.prefix
    ? `${breadcrumb.prefix} / ${breadcrumb.cardName}`
    : breadcrumb.cardName;

  const canUndo = canUndoCardViewerHistory(historyRef.current);
  const canRedo = canRedoCardViewerHistory(historyRef.current);
  void historyTick;

  const applyViewState = useCallback(
    (next: CardViewerViewState) => {
      setTransform(next.transform);
      setZoomMode(next.zoomMode);
      setPanOffset(next.pan);
      viewRef.current = next;
    },
    [setPanOffset]
  );

  const bumpHistory = useCallback(() => {
    setHistoryTick((tick) => tick + 1);
  }, []);

  const endWheelBatch = useCallback(() => {
    wheelBatchActiveRef.current = false;
    if (wheelBatchTimerRef.current) {
      clearTimeout(wheelBatchTimerRef.current);
      wheelBatchTimerRef.current = null;
    }
  }, []);

  const commitViewState = useCallback(
    (next: CardViewerViewState) => {
      endWheelBatch();
      // Keep present in sync with live pan/zoom before recording (drag pan is not pushed alone).
      historyRef.current = { ...historyRef.current, present: viewRef.current };
      historyRef.current = pushCardViewerHistory(historyRef.current, next);
      applyViewState(next);
      bumpHistory();
    },
    [applyViewState, bumpHistory, endWheelBatch]
  );

  const mutateView = useCallback(
    (mutator: (prev: CardViewerViewState) => CardViewerViewState) => {
      const next = mutator(viewRef.current);
      commitViewState(next);
    },
    [commitViewState]
  );

  const undoView = useCallback(() => {
    endWheelBatch();
    const nextHistory = undoCardViewerHistory(historyRef.current);
    if (nextHistory === historyRef.current) return;
    historyRef.current = nextHistory;
    applyViewState(nextHistory.present);
    bumpHistory();
  }, [applyViewState, bumpHistory, endWheelBatch]);

  const redoView = useCallback(() => {
    endWheelBatch();
    const nextHistory = redoCardViewerHistory(historyRef.current);
    if (nextHistory === historyRef.current) return;
    historyRef.current = nextHistory;
    applyViewState(nextHistory.present);
    bumpHistory();
  }, [applyViewState, bumpHistory, endWheelBatch]);

  const resetView = useCallback(() => {
    commitViewState(defaultViewState());
  }, [commitViewState]);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [alwaysOnTop, zoomMode, transform, session.card?.id, menuOpen, showNavigation, opacityPct, canUndo, canRedo]);

  useEffect(() => {
    const initial = defaultViewState();
    historyRef.current = createCardViewerHistory(initial);
    applyViewState(initial);
    setNaturalSize({ width: 0, height: 0 });
    wheelBatchActiveRef.current = false;
    if (wheelBatchTimerRef.current) {
      clearTimeout(wheelBatchTimerRef.current);
      wheelBatchTimerRef.current = null;
    }
    bumpHistory();
  }, [session.card?.id, applyViewState, bumpHistory]);

  useEffect(() => {
    setOpacityInput(`${opacityPct}%`);
  }, [opacityPct]);

  useEffect(() => {
    return () => {
      if (wheelBatchTimerRef.current) clearTimeout(wheelBatchTimerRef.current);
    };
  }, []);

  const closeViewer = useCallback(() => {
    void window.arc?.cardViewerClose?.();
  }, []);

  const togglePin = useCallback(() => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    void window.arc?.cardViewerSetAlwaysOnTop?.(next);
  }, [alwaysOnTop]);

  const startFileDrag = useCallback(
    (event: ReactPointerEvent) => {
      if (!session.mediaRel || (!event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      void window.arc?.cardViewerStartFileDrag?.({
        relativePath: session.mediaRel,
        cardId: session.card?.id
      });
    },
    [session.card?.id, session.mediaRel]
  );

  const onStageWheel = useCallback(
    (event: ReactWheelEvent<HTMLElement>) => {
      if (!session.mediaSrc || naturalSize.width <= 0 || naturalSize.height <= 0) return;
      event.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const stageSize = { width: rect.width, height: rect.height };
      const focalX = event.clientX - rect.left;
      const focalY = event.clientY - rect.top;
      const prev = viewRef.current;
      const result = applyViewerWheelZoom({
        zoomMode: prev.zoomMode,
        pan: prev.pan,
        stage: stageSize,
        natural: naturalSize,
        focalX,
        focalY,
        deltaY: event.deltaY
      });
      const next: CardViewerViewState = {
        transform: prev.transform,
        zoomMode: result.zoomMode,
        pan: result.pan
      };

      if (!wheelBatchActiveRef.current) {
        historyRef.current = { ...historyRef.current, present: prev };
        historyRef.current = pushCardViewerHistory(historyRef.current, next);
        wheelBatchActiveRef.current = true;
      } else {
        historyRef.current = { ...historyRef.current, present: next };
      }
      applyViewState(next);
      bumpHistory();

      if (wheelBatchTimerRef.current) clearTimeout(wheelBatchTimerRef.current);
      wheelBatchTimerRef.current = setTimeout(() => {
        wheelBatchActiveRef.current = false;
        wheelBatchTimerRef.current = null;
      }, WHEEL_HISTORY_BATCH_MS);
    },
    [applyViewState, bumpHistory, naturalSize, session.mediaSrc]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        closeViewer();
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (matchesShortcut(event, 'viewer.redo')) {
        event.preventDefault();
        redoView();
        return;
      }
      if (matchesShortcut(event, 'viewer.undo')) {
        event.preventDefault();
        undoView();
        return;
      }
      if (matchesShortcut(event, 'viewer.reset')) {
        event.preventDefault();
        resetView();
        return;
      }
      if (matchesShortcut(event, 'viewer.rotateCcw')) {
        event.preventDefault();
        mutateView((prev) => ({
          ...prev,
          transform: rotateViewerTransformCcw(prev.transform)
        }));
        return;
      }
      if (matchesShortcut(event, 'viewer.rotateCw')) {
        event.preventDefault();
        mutateView((prev) => ({
          ...prev,
          transform: rotateViewerTransform(prev.transform)
        }));
        return;
      }

      if (event.key === 'ArrowLeft') {
        if (!session.canGoPrev) return;
        event.preventDefault();
        session.goPrev();
        return;
      }
      if (event.key === 'ArrowRight') {
        if (!session.canGoNext) return;
        event.preventDefault();
        session.goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeViewer, menuOpen, mutateView, redoView, resetView, session, undoView]);

  const menuRows = useMemo<ContextMenuRow[]>(() => {
    const withKeepOpen = (
      row: Extract<ContextMenuRow, { type: 'item' }>
    ): Extract<ContextMenuRow, { type: 'item' }> => ({
      ...row,
      closeOnSelect: false,
      slotOrder: [...MENU_SLOT_ORDER]
    });

    return [
      withKeepOpen({
        type: 'item',
        key: 'undo',
        label: 'Отменить',
        shortcut: shortcutMenuLabel('viewer.undo'),
        disabled: !canUndo,
        onSelect: undoView
      }),
      withKeepOpen({
        type: 'item',
        key: 'redo',
        label: 'Вернуть',
        shortcut: shortcutMenuLabel('viewer.redo'),
        disabled: !canRedo,
        onSelect: redoView
      }),
      withKeepOpen({
        type: 'item',
        key: 'reset',
        label: 'Сбросить вид',
        shortcut: shortcutMenuLabel('viewer.reset'),
        onSelect: resetView
      }),
      { type: 'separator', key: 'sep-transforms' },
      withKeepOpen({
        type: 'item',
        key: 'rotate-cw',
        label: 'Повернуть вправо',
        shortcut: shortcutMenuLabel('viewer.rotateCw'),
        onSelect: () =>
          mutateView((prev) => ({
            ...prev,
            transform: rotateViewerTransform(prev.transform)
          }))
      }),
      withKeepOpen({
        type: 'item',
        key: 'rotate-ccw',
        label: 'Повернуть влево',
        shortcut: shortcutMenuLabel('viewer.rotateCcw'),
        onSelect: () =>
          mutateView((prev) => ({
            ...prev,
            transform: rotateViewerTransformCcw(prev.transform)
          }))
      }),
      withKeepOpen({
        type: 'item',
        key: 'flip-h',
        label: 'Отразить по горизонтали',
        onSelect: () =>
          mutateView((prev) => ({
            ...prev,
            transform: toggleViewerFlipH(prev.transform)
          }))
      }),
      withKeepOpen({
        type: 'item',
        key: 'flip-v',
        label: 'Отразить по вертикали',
        onSelect: () =>
          mutateView((prev) => ({
            ...prev,
            transform: toggleViewerFlipV(prev.transform)
          }))
      }),
      withKeepOpen({
        type: 'item',
        key: 'grayscale',
        label: transform.grayscale ? 'Цветное изображение' : 'Чёрно-белое',
        onSelect: () =>
          mutateView((prev) => ({
            ...prev,
            transform: toggleViewerGrayscale(prev.transform)
          }))
      })
    ];
  }, [canRedo, canUndo, mutateView, redoView, resetView, transform.grayscale, undoView]);

  const mediaStyle = {
    ...viewerZoomMediaStyle(zoomMode, naturalSize.width, naturalSize.height),
    ...viewerTransformStyle(transform)
  };

  const stageOpacity = opacityPct / 100;

  const commitOpacityInput = useCallback(() => {
    const parsed = parseOpacityInput(opacityInput);
    if (parsed === null) {
      setOpacityInput(`${opacityPct}%`);
      return;
    }
    setOpacityPct(parsed);
    setOpacityInput(`${parsed}%`);
  }, [opacityInput, opacityPct]);

  const isVideo = session.card?.type === 'video';

  return (
    <div
      ref={rootRef}
      className="arc-card-viewer arc-ui-kit-scope"
      data-btn-size="s"
      data-input-size="s"
      data-elevation="default"
      data-typo-tone="white"
    >
      <header className="arc-card-viewer__toolbar">
        <div className="arc-card-viewer__toolbar-left">
          <Tooltip content="Меню" position="bottom">
            <button
              ref={menuAnchorRef}
              type="button"
              className={`btn btn-outline btn-icon-only btn-ds${menuOpen ? ' is-active' : ''}`}
              aria-label="Меню"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="btn-icon-only__glyph arc-icon-menu" aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip content={alwaysOnTop ? 'Открепить окно' : 'Поверх всех окон'} position="bottom">
            <button
              type="button"
              className={`btn btn-outline btn-icon-only btn-ds${alwaysOnTop ? ' is-active' : ''}`}
              aria-label={alwaysOnTop ? 'Открепить окно' : 'Поверх всех окон'}
              aria-pressed={alwaysOnTop}
              onClick={togglePin}
            >
              <span
                className={`btn-icon-only__glyph${alwaysOnTop ? ' arc-icon-pin-off' : ' arc-icon-pin'}`}
                aria-hidden="true"
              />
            </button>
          </Tooltip>

          <p className="arc-card-viewer__title text-m" data-typo-role="secondary" title={fullTitle}>
            {fullTitle}
          </p>
        </div>
        <div className="arc-card-viewer__toolbar-right">
          {showNavigation ? (
            <div className="arc-card-viewer__slides">
              {session.counterLabel ? (
                <span className="arc-card-viewer__counter text-m" data-typo-role="secondary">
                  {session.counterLabel}
                </span>
              ) : null}
              <div
                className="btn-group btn-group-ds arc-card-viewer__nav-group"
                role="group"
                aria-label="Перелистывание карточек"
              >
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds"
                  aria-label="Предыдущая карточка"
                  disabled={!session.canGoPrev}
                  onClick={() => session.goPrev()}
                >
                  <span className="btn-icon-only__glyph arc-icon-skip-back" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds"
                  aria-label="Следующая карточка"
                  disabled={!session.canGoNext}
                  onClick={() => session.goNext()}
                >
                  <span className="btn-icon-only__glyph arc-icon-skip-forward" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="arc-card-viewer__opacity-slider">
            <ValueSlider
              min={OPACITY_MIN}
              max={OPACITY_MAX}
              step={5}
              size="s"
              value={opacityPct}
              formatValue={(v) => `${v}%`}
              ariaLabel="Прозрачность изображения"
              showValue={false}
              onChange={setOpacityPct}
            />
          </div>

          <label
            className={`field input-live arc-card-viewer__opacity-input${opacityPct !== OPACITY_MAX ? ' has-value' : ''}`}
          >
            <input
              className="input"
              type="text"
              inputMode="numeric"
              aria-label="Прозрачность в процентах"
              value={opacityInput}
              onChange={(event) => setOpacityInput(event.target.value)}
              onBlur={commitOpacityInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitOpacityInput();
                  event.currentTarget.blur();
                }
              }}
            />
          </label>

          <Tooltip content="Закрыть" position="bottom">
            <button
              type="button"
              className="btn btn-danger btn-icon-only btn-ds"
              aria-label="Закрыть"
              onClick={closeViewer}
            >
              <span className="btn-icon-only__glyph arc-icon-close" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </header>

      <main
        ref={stageRef}
        className={`arc-card-viewer__stage${panEnabled ? ' arc-card-viewer__stage--pannable' : ''}`}
        style={{ opacity: stageOpacity }}
        onWheel={onStageWheel}
        {...(panEnabled ? panHandlers : undefined)}
      >
        {session.loading ? <p className="arc-card-viewer__empty">Загрузка…</p> : null}
        {!session.loading && session.error ? <p className="arc-card-viewer__empty">{session.error}</p> : null}
        {!session.loading && !session.error && session.mediaSrc ? (
          <div
            className="arc-card-viewer__media-pan"
            style={{
              transform:
                panOffset.x !== 0 || panOffset.y !== 0
                  ? `translate(${panOffset.x}px, ${panOffset.y}px)`
                  : undefined
            }}
          >
            <div className="arc-card-viewer__media-wrap" onPointerDown={startFileDrag}>
              {isVideo ? (
                <video
                  ref={videoRef}
                  key={session.mediaSrc}
                  className={`arc-card-viewer__media${session.mediaRel ? ' arc-card-viewer__media--draggable' : ''}`}
                  src={session.mediaSrc}
                  style={mediaStyle}
                  preload="metadata"
                  playsInline
                  muted
                  onLoadedMetadata={(event) => {
                    const el = event.currentTarget;
                    setNaturalSize({ width: el.videoWidth, height: el.videoHeight });
                  }}
                />
              ) : (
                <img
                  key={session.mediaSrc}
                  className={`arc-card-viewer__media${session.mediaRel ? ' arc-card-viewer__media--draggable' : ''}`}
                  src={session.mediaSrc}
                  alt=""
                  draggable={false}
                  style={mediaStyle}
                  onLoad={(event) => {
                    const el = event.currentTarget;
                    setNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
                  }}
                />
              )}
            </div>
          </div>
        ) : null}
      </main>

      {isVideo && session.mediaSrc ? (
        <CardViewerVideoControls videoRef={videoRef} resetKey={session.mediaSrc} />
      ) : null}

      <ContextMenu
        open={menuOpen}
        anchorRef={menuAnchorRef}
        onClose={() => setMenuOpen(false)}
        ariaLabel="Меню просмотра"
        rows={menuRows}
      />
    </div>
  );
}
