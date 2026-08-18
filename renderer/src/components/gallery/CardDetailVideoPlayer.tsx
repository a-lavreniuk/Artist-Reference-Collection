import { useLayoutEffect, useMemo, useRef, useEffect } from 'react';
import { ContextMenu } from '../context-menu';
import type { ContextMenuRow } from '../context-menu';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import ValueSlider from '../range-slider/ValueSlider';
import { Tooltip } from '../tooltip/Tooltip';
import { formatPlaybackRate, formatVideoClock, VIDEO_PLAYBACK_RATES } from './cardDetailVideoTime';
import type { CardDetailVideoPlayerProps } from './cardDetailVideoPlayerTypes';
import { useCardDetailVideoPlayer } from './useCardDetailVideoPlayer';
import CardDetailAnnotationLayer from './CardDetailAnnotationLayer';

const PLAYER_MENU_PROPS = {
  anchorPlacement: 'aboveAnchor' as const,
  anchorAlign: 'end' as const
};

export default function CardDetailVideoPlayer({
  cardId,
  src,
  autoplay,
  loop = false,
  onLoopChange,
  onCardUpdated,
  onToast,
  playerRef,
  flushToQueue = false,
  commentMode = false,
  editMode = false,
  annotationsVisible = true,
  annotations = [],
  selectedAnnotationId = null,
  focusedAnnotationId = null,
  sparkleAnnotationId = null,
  composerAnchorId = null,
  draftRect = null,
  draftIndex,
  onSelectAnnotation,
  onCreateAnnotation,
  onUpdateAnnotation,
  onCurrentMsChange,
  hoveredAnnotationId = null,
  onHoverAnnotation,
  onPeekAnnotation,
  onAnnotationMarkerSelect
}: CardDetailVideoPlayerProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const player = useCardDetailVideoPlayer({
    cardId,
    src,
    autoplay,
    loop,
    onLoopChange,
    playerRef,
    onCardUpdated,
    onToast
  });

  useLayoutEffect(() => {
    if (controlsRef.current) void hydrateArcNavbarIcons(controlsRef.current);
  }, [
    player.playing,
    player.playbackRate,
    player.frameMenuOpen,
    player.speedMenuOpen,
    player.muted,
    player.volume,
    player.loop
  ]);

  useEffect(() => {
    onCurrentMsChange?.(player.currentMs);
  }, [onCurrentMsChange, player.currentMs]);

  const sliderMax = Math.max(player.durationMs, 1);

  const annotationMarkers = useMemo(
    () =>
      annotations
        .filter((item) => item.timeMs != null)
        .map((item) => ({ id: item.id, timeMs: item.timeMs as number })),
    [annotations]
  );

  const getTimelineTrackRect = () =>
    timelineRef.current?.querySelector('.arc-range-slider__track')?.getBoundingClientRect() ?? null;

  const onTimelineSeek = (ms: number) => {
    player.seekToMs(ms);
    player.hideScrubPreview();
  };

  const seekTimelineAtClientX = (clientX: number) => {
    const rect = getTimelineTrackRect();
    if (!rect || rect.width <= 0) return;
    player.onTimelinePointer(clientX, rect, true);
  };

  const onTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (player.durationMs <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekTimelineAtClientX(e.clientX);
  };

  const onTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      seekTimelineAtClientX(e.clientX);
      return;
    }
    const rect = getTimelineTrackRect();
    if (!rect || rect.width <= 0) return;
    player.onTimelinePointer(e.clientX, rect, false);
  };

  const onTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      seekTimelineAtClientX(e.clientX);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const speedMenuRows = useMemo<ContextMenuRow[]>(
    () =>
      VIDEO_PLAYBACK_RATES.map((rate) => ({
        type: 'item' as const,
        key: `rate-${rate}`,
        label: formatPlaybackRate(rate),
        selected: player.playbackRate === rate,
        onSelect: () => player.onSelectSpeed(rate)
      })),
    [player.onSelectSpeed, player.playbackRate]
  );

  const frameMenuRows = useMemo<ContextMenuRow[]>(
    () => [
      {
        type: 'item',
        key: 'copy-frame',
        label: 'Копировать превью',
        iconClass: 'arc-icon-copy',
        onSelect: () => void player.copyFrame()
      },
      {
        type: 'item',
        key: 'save-frame',
        label: 'Скачать превью',
        iconClass: 'arc-icon-download',
        onSelect: () => void player.saveFrame()
      },
      {
        type: 'item',
        key: 'set-preview',
        label: 'Установить кадр как превью',
        iconClass: 'arc-icon-image',
        onSelect: () => void player.setPreviewFrame()
      }
    ],
    [player.copyFrame, player.saveFrame, player.setPreviewFrame]
  );

  const volumePct = Math.round(player.muted ? 0 : player.volume * 100);
  const volumeToggleLabel = player.muted ? 'Включить звук' : 'Выключить звук';
  const volumeIconClass = player.muted || volumePct <= 0 ? 'arc-icon-volume-x' : 'arc-icon-volume';

  return (
    <div className={`arc-card-detail-video-player${flushToQueue ? ' arc-card-detail-video-player--flush' : ''}`}>
      <div className="arc-card-detail-media-fit">
        <div className="arc-card-detail-video-frame">
          <video
            ref={player.videoRef}
            className="arc-card-detail-media"
            src={src}
            crossOrigin="anonymous"
            preload="metadata"
            playsInline
            loop={player.loop}
            onLoadedMetadata={player.onLoadedMetadata}
            onDurationChange={player.onDurationChange}
            onTimeUpdate={player.onTimeUpdate}
            onSeeked={player.onSeeked}
            onPlay={player.onPlayState}
            onPause={player.onPlayState}
            onEnded={player.onPlayState}
            onVolumeChange={player.onPlayState}
          />
          <CardDetailAnnotationLayer
            annotations={annotations}
            annotationsVisible={annotationsVisible}
            editMode={editMode}
            commentMode={commentMode}
            currentMs={player.currentMs}
            selectedId={selectedAnnotationId}
            focusedId={focusedAnnotationId}
            hoveredId={hoveredAnnotationId}
            sparkleId={sparkleAnnotationId}
            composerAnchorId={composerAnchorId}
            draftRect={draftRect}
            draftIndex={draftIndex}
            onSelect={onSelectAnnotation}
            onHover={onHoverAnnotation}
            onPeek={onPeekAnnotation}
            onCreate={onCreateAnnotation}
            onUpdate={onUpdateAnnotation}
          />
        </div>
        <video
          ref={player.scrubVideoRef}
          className="arc-card-detail-video-scrub-src"
          src={src}
          crossOrigin="anonymous"
          preload="auto"
          muted
          playsInline
          aria-hidden
        />
        <canvas ref={player.scrubCanvasRef} className="arc-card-detail-video-scrub-canvas" aria-hidden />
      </div>

      <div
        ref={controlsRef}
        className="arc-card-detail-video-controls panel elevation-default arc-ui-kit-scope"
        data-elevation="default"
        data-btn-size="s"
      >
        <button
          type="button"
          className="btn btn-outline btn-icon-only btn-ds"
          aria-label={player.playing ? 'Пауза' : 'Воспроизведение'}
          onClick={player.togglePlay}
        >
          <span
            className={`btn-icon-only__glyph ${player.playing ? 'arc-icon-pause' : 'arc-icon-play'}`}
            aria-hidden="true"
          />
        </button>

        <div className="arc-card-detail-video-skip-group">
          <Tooltip content="−10 сек" position="top">
            <button
              type="button"
              className="btn btn-outline btn-icon-only btn-ds arc-card-detail-video-skip-btn"
              aria-label="Назад на 10 секунд"
              onClick={() => player.seekBySeconds(-10)}
            >
              <span className="btn-icon-only__glyph arc-icon-go-backward" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="+30 сек" position="top">
            <button
              type="button"
              className="btn btn-outline btn-icon-only btn-ds arc-card-detail-video-skip-btn"
              aria-label="Вперёд на 30 секунд"
              onClick={() => player.seekBySeconds(30)}
            >
              <span className="btn-icon-only__glyph arc-icon-go-forward" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

        <div className="arc-card-detail-video-volume">
          <button
            type="button"
            className={`btn btn-outline btn-icon-only btn-ds${player.muted ? ' is-active' : ''}`}
            aria-label={volumeToggleLabel}
            aria-pressed={player.muted}
            onClick={player.toggleMute}
          >
            <span className={`btn-icon-only__glyph ${volumeIconClass}`} aria-hidden="true" />
          </button>
          <div className="arc-card-detail-video-volume__flyout">
            <div className="arc-card-detail-video-volume__slider panel elevation-default">
              <ValueSlider
                min={0}
                max={100}
                step={1}
                size="s"
                value={volumePct}
                formatValue={(v) => `${v}%`}
                ariaLabel="Громкость"
                showValue={false}
                onChange={player.applyVolume}
              />
            </div>
          </div>
        </div>

        <span className="text-code-s arc-card-detail-video-time" role="status" aria-live="polite">
          {formatVideoClock(player.currentMs / 1000)}
        </span>

        <div
          ref={timelineRef}
          className="arc-card-detail-video-timeline"
          onPointerDown={onTimelinePointerDown}
          onPointerMove={onTimelinePointerMove}
          onPointerUp={onTimelinePointerUp}
          onPointerCancel={onTimelinePointerUp}
          onPointerLeave={() => player.hideScrubPreview()}
        >
          {annotationMarkers.length > 0 ? (
            <div className="arc-card-detail-video-timeline-markers" aria-hidden="true">
              {annotationMarkers.map((marker) => (
                <button
                  key={marker.id}
                  type="button"
                  className={[
                    'arc-card-detail-video-timeline-marker',
                    marker.timeMs <= player.currentMs ? 'is-passed' : '',
                    selectedAnnotationId === marker.id ? 'is-selected' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ left: `${(marker.timeMs / sliderMax) * 100}%` }}
                  aria-label="Аннотация на таймлайне"
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerEnter={() => player.scheduleScrubPreview(marker.timeMs / sliderMax)}
                  onClick={() => onAnnotationMarkerSelect?.(marker.id)}
                />
              ))}
            </div>
          ) : null}
          <ValueSlider
            min={0}
            max={sliderMax}
            step={100}
            size="s"
            value={Math.min(player.currentMs, sliderMax)}
            showValue={false}
            disabled={sliderMax <= 1}
            seekOnTrackPointerDown={false}
            ariaLabel="Позиция воспроизведения"
            onChange={onTimelineSeek}
            onTrackPointerLeave={player.hideScrubPreview}
          />

          {player.scrubPreviewVisible && player.scrubPreviewSrc ? (
            <div
              className="arc-card-detail-video-scrub-preview panel elevation-default"
              style={{ left: `${player.scrubPreviewLeftPct}%` }}
            >
              <img src={player.scrubPreviewSrc} alt="" draggable={false} />
            </div>
          ) : null}
        </div>

        <span className="text-code-s arc-card-detail-video-time">{formatVideoClock(player.durationMs / 1000)}</span>

        <Tooltip content={player.loop ? 'Выключить повтор' : 'Включить повтор'} position="top">
          <button
            type="button"
            className={`btn btn-outline btn-icon-only btn-ds${player.loop ? ' is-active' : ''}`}
            aria-label={player.loop ? 'Выключить повтор' : 'Включить повтор'}
            aria-pressed={player.loop}
            onClick={player.toggleLoop}
          >
            <span
              className={`btn-icon-only__glyph ${player.loop ? 'arc-icon-repeat' : 'arc-icon-repeat-off'}`}
              aria-hidden="true"
            />
          </button>
        </Tooltip>

        <Tooltip content="Скорость" position="top">
          <button
            ref={player.speedMenuAnchorRef}
            type="button"
            className="btn btn-outline btn-ds btn-s"
            aria-haspopup="menu"
            aria-expanded={player.speedMenuOpen}
            onClick={() => player.setSpeedMenuOpen((open) => !open)}
          >
            <span className="btn-ds__icon arc-icon-forward" aria-hidden="true" />
            <span className="btn-ds__value">{formatPlaybackRate(player.playbackRate)}</span>
          </button>
        </Tooltip>

        <Tooltip content="Действия с превью" position="top">
          <button
            ref={player.frameMenuAnchorRef}
            type="button"
            className="btn btn-outline btn-icon-only btn-ds"
            aria-label="Действия с превью"
            aria-haspopup="menu"
            aria-expanded={player.frameMenuOpen}
            onClick={() => player.setFrameMenuOpen((open) => !open)}
          >
            <span className="btn-icon-only__glyph arc-icon-options" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      <ContextMenu
        open={player.speedMenuOpen}
        anchorRef={player.speedMenuAnchorRef}
        onClose={() => player.setSpeedMenuOpen(false)}
        ariaLabel="Скорость воспроизведения"
        rows={speedMenuRows}
        {...PLAYER_MENU_PROPS}
      />

      <ContextMenu
        open={player.frameMenuOpen}
        anchorRef={player.frameMenuAnchorRef}
        onClose={() => player.setFrameMenuOpen(false)}
        ariaLabel="Действия с превью"
        rows={frameMenuRows}
        {...PLAYER_MENU_PROPS}
      />
    </div>
  );
}
