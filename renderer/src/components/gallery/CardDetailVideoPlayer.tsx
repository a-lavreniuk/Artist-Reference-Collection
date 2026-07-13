import { useLayoutEffect, useMemo, useRef } from 'react';
import { ContextMenu } from '../context-menu';
import type { ContextMenuRow } from '../context-menu';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import ValueSlider from '../range-slider/ValueSlider';
import { Tooltip } from '../tooltip/Tooltip';
import {
  formatPlaybackRate,
  formatVideoClock,
  formatVideoFileSizeMb,
  formatVideoResolution,
  VIDEO_PLAYBACK_RATES
} from './cardDetailVideoTime';
import type { CardDetailVideoPlayerProps } from './cardDetailVideoPlayerTypes';
import { useCardDetailVideoPlayer } from './useCardDetailVideoPlayer';

const PLAYER_MENU_PROPS = {
  anchorPlacement: 'aboveAnchor' as const,
  anchorAlign: 'end' as const
};

export default function CardDetailVideoPlayer({
  cardId,
  src,
  videoNote,
  videoWidth,
  videoHeight,
  fileSizeBytes,
  autoplay,
  onCardUpdated,
  onToast,
  onOpenInfo,
  playerRef
}: CardDetailVideoPlayerProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const player = useCardDetailVideoPlayer({
    cardId,
    src,
    autoplay,
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
    player.volume
  ]);

  const sliderMax = Math.max(player.durationMs, 1);
  const resolutionLabel = formatVideoResolution(videoWidth, videoHeight);
  const fileSizeLabel = formatVideoFileSizeMb(fileSizeBytes);

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
        label: 'Копировать кадр',
        iconClass: 'arc-icon-copy',
        onSelect: () => void player.copyFrame()
      },
      {
        type: 'item',
        key: 'save-frame',
        label: 'Сохранить кадр',
        iconClass: 'arc-icon-save',
        onSelect: () => void player.saveFrame()
      },
      {
        type: 'item',
        key: 'set-preview',
        label: 'Установить превью',
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
    <div className="arc-card-detail-video-player">
      <div className="arc-card-detail-media-fit">
        <video
          ref={player.videoRef}
          className="arc-card-detail-media"
          src={src}
          crossOrigin="anonymous"
          preload="metadata"
          playsInline
          onLoadedMetadata={player.onLoadedMetadata}
          onDurationChange={player.onDurationChange}
          onTimeUpdate={player.onTimeUpdate}
          onSeeked={player.onSeeked}
          onPlay={player.onPlayState}
          onPause={player.onPlayState}
          onEnded={player.onPlayState}
          onVolumeChange={player.onPlayState}
        />
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
        className="arc-card-detail-video-controls arc-ui-kit-scope"
        data-elevation="sunken"
        data-btn-size="m"
      >
        {videoNote ? <p className="text-s arc-card-detail-video-note">{videoNote}</p> : null}

        <div
          ref={timelineRef}
          className="arc-card-detail-video-timeline"
          onPointerDown={onTimelinePointerDown}
          onPointerMove={onTimelinePointerMove}
          onPointerUp={onTimelinePointerUp}
          onPointerCancel={onTimelinePointerUp}
          onPointerLeave={() => player.hideScrubPreview()}
        >
          <ValueSlider
            min={0}
            max={sliderMax}
            step={100}
            size="m"
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

        <div className="arc-card-detail-video-transport">
          <div className="arc-card-detail-video-transport__left">
            <Tooltip content={player.playing ? 'Пауза' : 'Воспроизведение'} position="top">
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
            </Tooltip>

            <div className="arc-card-detail-video-skip-group">
              <Tooltip content="−5 сек" position="top">
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds arc-card-detail-video-skip-btn"
                  aria-label="Назад на 5 секунд"
                  onClick={() => player.seekBySeconds(-5)}
                >
                  <span className="btn-icon-only__glyph arc-icon-skip-back" aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip content="+5 сек" position="top">
                <button
                  type="button"
                  className="btn btn-outline btn-icon-only btn-ds arc-card-detail-video-skip-btn"
                  aria-label="Вперёд на 5 секунд"
                  onClick={() => player.seekBySeconds(5)}
                >
                  <span className="btn-icon-only__glyph arc-icon-skip-forward" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>

            <div className="arc-card-detail-video-time-pill text-code-m" role="status" aria-live="polite">
              {formatVideoClock(player.currentMs / 1000)}
              <span className="arc-card-detail-video-time__sep"> / </span>
              {formatVideoClock(player.durationMs / 1000)}
            </div>

            <div className="arc-card-detail-video-volume">
              <Tooltip content={volumeToggleLabel} position="top">
                <button
                  type="button"
                  className={`btn btn-outline btn-icon-only btn-ds${player.muted ? ' is-active' : ''}`}
                  aria-label={volumeToggleLabel}
                  aria-pressed={player.muted}
                  onClick={player.toggleMute}
                >
                  <span className={`btn-icon-only__glyph ${volumeIconClass}`} aria-hidden="true" />
                </button>
              </Tooltip>
              <div className="arc-card-detail-video-volume__slider">
                <ValueSlider
                  min={0}
                  max={100}
                  step={1}
                  size="m"
                  value={volumePct}
                  formatValue={(v) => `${v}%`}
                  ariaLabel="Громкость"
                  showValue={false}
                  onChange={player.applyVolume}
                />
              </div>
            </div>

            <div className="arc-card-detail-video-meta">
              <div className="arc-card-detail-video-meta__item">
                <span className="btn-ds__icon arc-icon-aspect-ratio-other" aria-hidden="true" />
                <span className="text-m">{resolutionLabel}</span>
              </div>
              <div className="arc-card-detail-video-meta__item">
                <span className="btn-ds__icon arc-icon-save" aria-hidden="true" />
                <span className="text-m">{fileSizeLabel}</span>
              </div>
            </div>
          </div>

          <div className="arc-card-detail-video-transport__right">
            <Tooltip content="Скорость" position="top">
              <button
                ref={player.speedMenuAnchorRef}
                type="button"
                className="btn btn-outline btn-ds btn-m"
                aria-haspopup="menu"
                aria-expanded={player.speedMenuOpen}
                onClick={() => player.setSpeedMenuOpen((open) => !open)}
              >
                <span className="btn-ds__icon arc-icon-fast-forward" aria-hidden="true" />
                <span className="btn-ds__value">{formatPlaybackRate(player.playbackRate)}</span>
              </button>
            </Tooltip>

            <Tooltip content="Кадр" position="top">
              <button
                ref={player.frameMenuAnchorRef}
                type="button"
                className="btn btn-outline btn-icon-only btn-ds"
                aria-label="Действия с кадром"
                aria-haspopup="menu"
                aria-expanded={player.frameMenuOpen}
                onClick={() => player.setFrameMenuOpen((open) => !open)}
              >
                <span className="btn-icon-only__glyph arc-icon-image" aria-hidden="true" />
              </button>
            </Tooltip>

            <Tooltip content="Информация о файле" position="top">
              <button
                type="button"
                className="btn btn-outline btn-icon-only btn-ds"
                aria-label="Информация о файле"
                onClick={() => onOpenInfo?.()}
              >
                <span className="btn-icon-only__glyph arc-icon-info" aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        </div>
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
        ariaLabel="Действия с кадром"
        rows={frameMenuRows}
        {...PLAYER_MENU_PROPS}
      />
    </div>
  );
}
