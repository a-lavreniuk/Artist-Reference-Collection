import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { ContextMenu } from '../components/context-menu';
import type { ContextMenuRow } from '../components/context-menu';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import ValueSlider from '../components/range-slider/ValueSlider';
import { Tooltip } from '../components/tooltip/Tooltip';
import {
  DEFAULT_VIEWER_TRANSFORM,
  rotateViewerTransform,
  toggleViewerFlipH,
  toggleViewerFlipV,
  toggleViewerGrayscale,
  viewerTransformStyle,
  type ViewerTransform
} from './cardViewerTransforms';
import {
  VIEWER_ZOOM_PRESETS,
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

export default function CardViewerApp() {
  const launch = useMemo(() => parseCardViewerLaunch(window.location.search), []);
  const session = useCardViewerSession(launch.cardIds, launch.startIndex);

  const rootRef = useRef<HTMLDivElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [zoomMode, setZoomMode] = useState<ViewerZoomMode>({ kind: 'fit' });
  const [transform, setTransform] = useState<ViewerTransform>(DEFAULT_VIEWER_TRANSFORM);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [opacityPct, setOpacityPct] = useState(OPACITY_MAX);
  const [opacityInput, setOpacityInput] = useState(`${OPACITY_MAX}%`);
  const [menuOpen, setMenuOpen] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const panEnabled = zoomMode.kind !== 'fit';
  const { offset: panOffset, panHandlers } = useCardViewerPan(
    panEnabled,
    `${session.card?.id ?? ''}:${zoomMode.kind}${zoomMode.kind === 'scale' ? zoomMode.factor : ''}`
  );

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

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [alwaysOnTop, zoomMode, session.card?.id, menuOpen, showNavigation, opacityPct]);

  useEffect(() => {
    setTransform(DEFAULT_VIEWER_TRANSFORM);
    setNaturalSize({ width: 0, height: 0 });
  }, [session.card?.id]);

  useEffect(() => {
    setOpacityInput(`${opacityPct}%`);
  }, [opacityPct]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeViewer();
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
  }, [closeViewer, session]);

  const menuRows = useMemo<ContextMenuRow[]>(() => {
    const rows: ContextMenuRow[] = [
      {
        type: 'item',
        key: 'fit',
        label: 'Вписать в окно',
        iconClass: 'arc-icon-minimize-2',
        selected: zoomMode.kind === 'fit',
        onSelect: () => setZoomMode({ kind: 'fit' })
      },
      {
        type: 'item',
        key: 'actual',
        label: 'Реальный размер',
        iconClass: 'arc-icon-maximize-2',
        selected: zoomMode.kind === 'actual',
        onSelect: () => setZoomMode({ kind: 'actual' })
      },
      { type: 'separator', key: 'sep-presets' },
      { type: 'header', key: 'hdr-scale', label: 'Масштаб' }
    ];
    for (const factor of VIEWER_ZOOM_PRESETS) {
      rows.push({
        type: 'item',
        key: `scale-${factor}`,
        label: `${Math.round(factor * 100)} %`,
        selected: zoomMode.kind === 'scale' && zoomMode.factor === factor,
        onSelect: () => setZoomMode({ kind: 'scale', factor })
      });
    }
    rows.push(
      { type: 'separator', key: 'sep-transforms' },
      {
        type: 'item',
        key: 'rotate',
        label: 'Повернуть на 90°',
        iconClass: 'arc-icon-reuse',
        onSelect: () => setTransform((prev) => rotateViewerTransform(prev))
      },
      {
        type: 'item',
        key: 'flip-h',
        label: 'Отразить по горизонтали',
        iconClass: 'arc-icon-flip-horizontal',
        onSelect: () => setTransform((prev) => toggleViewerFlipH(prev))
      },
      {
        type: 'item',
        key: 'flip-v',
        label: 'Отразить по вертикали',
        iconClass: 'arc-icon-flip-vertical',
        onSelect: () => setTransform((prev) => toggleViewerFlipV(prev))
      },
      {
        type: 'item',
        key: 'grayscale',
        label: transform.grayscale ? 'Цветное изображение' : 'Чёрно-белое',
        iconClass: 'arc-icon-image',
        onSelect: () => setTransform((prev) => toggleViewerGrayscale(prev))
      }
    );
    return rows;
  }, [transform.grayscale, zoomMode]);

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
        className={`arc-card-viewer__stage${panEnabled ? ' arc-card-viewer__stage--pannable' : ''}`}
        style={{ opacity: stageOpacity }}
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
