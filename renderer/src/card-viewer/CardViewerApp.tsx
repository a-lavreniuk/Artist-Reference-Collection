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
import { getVideoPlaybackTierFromPath, videoPlaybackDescription } from '../media/canPlayInBrowser';
import {
  DEFAULT_VIEWER_TRANSFORM,
  rotateViewerTransform,
  toggleViewerFlipH,
  toggleViewerGrayscale,
  viewerTransformStyle,
  type ViewerTransform
} from './cardViewerTransforms';
import {
  VIEWER_ZOOM_PRESETS,
  viewerZoomLabel,
  viewerZoomMediaStyle,
  type ViewerZoomMode
} from './cardViewerZoom';
import { parseCardViewerLaunch } from './parseCardViewerLaunch';
import { useCardViewerSession } from './useCardViewerSession';
import { useCardViewerPan } from './useCardViewerPan';

const OPACITY_MIN = 20;
const OPACITY_MAX = 100;

export default function CardViewerApp() {
  const launch = useMemo(() => parseCardViewerLaunch(window.location.search), []);
  const session = useCardViewerSession(launch.cardIds, launch.startIndex);

  const rootRef = useRef<HTMLDivElement>(null);
  const sizeMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const [zoomMode, setZoomMode] = useState<ViewerZoomMode>({ kind: 'fit' });
  const [transform, setTransform] = useState<ViewerTransform>(DEFAULT_VIEWER_TRANSFORM);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [opacityPct, setOpacityPct] = useState(100);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const panEnabled = zoomMode.kind !== 'fit';
  const { offset: panOffset, panHandlers } = useCardViewerPan(
    panEnabled,
    `${session.card?.id ?? ''}:${zoomMode.kind}${zoomMode.kind === 'scale' ? zoomMode.factor : ''}`
  );

  const videoTier = useMemo(() => {
    if (session.card?.type !== 'video' || !session.mediaRel) return null;
    return getVideoPlaybackTierFromPath(session.mediaRel);
  }, [session.card?.type, session.mediaRel]);

  useLayoutEffect(() => {
    if (rootRef.current) void hydrateArcNavbarIcons(rootRef.current);
  }, [alwaysOnTop, zoomMode, session.card?.id, sizeMenuOpen]);

  useEffect(() => {
    setTransform(DEFAULT_VIEWER_TRANSFORM);
    setNaturalSize({ width: 0, height: 0 });
  }, [session.card?.id]);

  useEffect(() => {
    if (!window.arc?.cardViewerSetOpacity) return;
    void window.arc.cardViewerSetOpacity(opacityPct / 100);
  }, [opacityPct]);

  const closeViewer = useCallback(() => {
    void window.arc?.cardViewerClose?.();
  }, []);

  const togglePin = useCallback(() => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    void window.arc?.cardViewerSetAlwaysOnTop?.(next);
  }, [alwaysOnTop]);

  const onMediaContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

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

  const sizeMenuRows = useMemo<ContextMenuRow[]>(() => {
    const rows: ContextMenuRow[] = [
      {
        type: 'item',
        key: 'fit',
        label: 'Вписать в окно',
        iconClass: 'arc-icon-maximize',
        onSelect: () => setZoomMode({ kind: 'fit' })
      },
      {
        type: 'item',
        key: 'actual',
        label: 'Реальный размер',
        iconClass: 'arc-icon-resolution',
        onSelect: () => setZoomMode({ kind: 'actual' })
      },
      { type: 'separator', key: 'sep-presets' }
    ];
    for (const factor of VIEWER_ZOOM_PRESETS) {
      rows.push({
        type: 'item',
        key: `scale-${factor}`,
        label: `${Math.round(factor * 100)}%`,
        selected: zoomMode.kind === 'scale' && zoomMode.factor === factor,
        onSelect: () => setZoomMode({ kind: 'scale', factor })
      });
    }
    return rows;
  }, [zoomMode]);

  const mediaContextRows = useMemo<ContextMenuRow[]>(
    () => [
      {
        type: 'item',
        key: 'rotate',
        label: 'Повернуть на 90°',
        iconClass: 'arc-icon-redo',
        onSelect: () => setTransform((prev) => rotateViewerTransform(prev))
      },
      {
        type: 'item',
        key: 'flip',
        label: 'Отразить по горизонтали',
        iconClass: 'arc-icon-arrows-horizontal',
        onSelect: () => setTransform((prev) => toggleViewerFlipH(prev))
      },
      {
        type: 'item',
        key: 'grayscale',
        label: transform.grayscale ? 'Цветное изображение' : 'Чёрно-белое',
        iconClass: 'arc-icon-image',
        onSelect: () => setTransform((prev) => toggleViewerGrayscale(prev))
      },
      { type: 'separator', key: 'sep-zoom' },
      {
        type: 'item',
        key: 'fit',
        label: 'Вписать в окно',
        iconClass: 'arc-icon-maximize',
        onSelect: () => setZoomMode({ kind: 'fit' })
      },
      {
        type: 'item',
        key: 'actual',
        label: 'Реальный размер',
        iconClass: 'arc-icon-resolution',
        onSelect: () => setZoomMode({ kind: 'actual' })
      }
    ],
    [transform.grayscale]
  );

  const mediaStyle = {
    ...viewerZoomMediaStyle(zoomMode, naturalSize.width, naturalSize.height),
    ...viewerTransformStyle(transform)
  };

  const title = session.card?.name?.trim() || session.card?.id || 'Просмотр';

  return (
    <div ref={rootRef} className="arc-card-viewer arc-ui-kit-scope" data-btn-size="s" data-elevation="sunken">
      <header className="arc-card-viewer__toolbar">
        <div className="arc-card-viewer__toolbar-group">
          <Tooltip content="Вписать в окно" position="bottom">
            <button
              type="button"
              className={`btn btn-ghost btn-icon-only btn-ds${zoomMode.kind === 'fit' ? ' is-active' : ''}`}
              aria-label="Вписать в окно"
              aria-pressed={zoomMode.kind === 'fit'}
              onClick={() => setZoomMode({ kind: 'fit' })}
            >
              <span className="btn-icon-only__glyph arc-icon-maximize" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Реальный размер" position="bottom">
            <button
              type="button"
              className={`btn btn-ghost btn-icon-only btn-ds${zoomMode.kind === 'actual' ? ' is-active' : ''}`}
              aria-label="Реальный размер"
              aria-pressed={zoomMode.kind === 'actual'}
              onClick={() => setZoomMode({ kind: 'actual' })}
            >
              <span className="btn-icon-only__glyph arc-icon-resolution" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Масштаб" position="bottom">
            <button
              ref={sizeMenuAnchorRef}
              type="button"
              className={`btn btn-ghost btn-icon-only btn-ds${zoomMode.kind === 'scale' ? ' is-active' : ''}`}
              aria-label={`Масштаб: ${viewerZoomLabel(zoomMode)}`}
              aria-haspopup="menu"
              aria-expanded={sizeMenuOpen}
              onClick={() => setSizeMenuOpen((open) => !open)}
            >
              <span className="btn-icon-only__glyph arc-icon-grid-m" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content={alwaysOnTop ? 'Открепить окно' : 'Поверх всех окон'} position="bottom">
            <button
              type="button"
              className={`btn btn-ghost btn-icon-only btn-ds${alwaysOnTop ? ' is-active' : ''}`}
              aria-label={alwaysOnTop ? 'Открепить окно' : 'Поверх всех окон'}
              aria-pressed={alwaysOnTop}
              onClick={togglePin}
            >
              <span className="btn-icon-only__glyph arc-icon-arrow-up-right" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

        <p className="arc-card-viewer__title" title={title}>
          {title}
        </p>

        <div className="arc-card-viewer__toolbar-spacer" aria-hidden="true" />

        {session.counterLabel ? (
          <span className="arc-card-viewer__counter">{session.counterLabel}</span>
        ) : null}

        <div className="arc-card-viewer__toolbar-group arc-card-viewer__opacity">
          <ValueSlider
            min={OPACITY_MIN}
            max={OPACITY_MAX}
            step={5}
            size="s"
            value={opacityPct}
            formatValue={(v) => `${v}%`}
            ariaLabel="Прозрачность окна"
            showValue={false}
            onChange={setOpacityPct}
          />
        </div>

        <div className="arc-card-viewer__toolbar-group">
          <Tooltip content="Закрыть" position="bottom">
            <button
              type="button"
              className="btn btn-ghost btn-icon-only btn-ds"
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
            <div
              className="arc-card-viewer__media-wrap"
              onContextMenu={onMediaContextMenu}
              onPointerDown={startFileDrag}
            >
            {session.card?.type === 'video' && videoTier && videoTier !== 'html5' ? (
              <p className="text-s arc-card-viewer__video-note">{videoPlaybackDescription(videoTier)}</p>
            ) : null}
            {session.card?.type === 'video' ? (
              <video
                key={session.mediaSrc}
                className={`arc-card-viewer__media${session.mediaRel ? ' arc-card-viewer__media--draggable' : ''}`}
                src={session.mediaSrc}
                style={mediaStyle}
                controls
                preload="metadata"
                playsInline
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

      <ContextMenu
        open={sizeMenuOpen}
        anchorRef={sizeMenuAnchorRef}
        onClose={() => setSizeMenuOpen(false)}
        ariaLabel="Масштаб"
        rows={sizeMenuRows}
      />

      <ContextMenu
        open={contextMenu !== null}
        position={contextMenu}
        onClose={() => setContextMenu(null)}
        ariaLabel="Действия с изображением"
        rows={mediaContextRows}
      />
    </div>
  );
}
