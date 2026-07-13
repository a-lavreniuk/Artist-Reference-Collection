import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';
import ValueSlider from '../components/range-slider/ValueSlider';
import { Tooltip } from '../components/tooltip/Tooltip';
import { formatVideoClock } from '../components/gallery/cardDetailVideoTime';

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  resetKey: string;
};

export default function CardViewerVideoControls({ videoRef, resetKey }: Props) {
  const controlsRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const readDurationMs = useCallback((el: HTMLVideoElement) => {
    const sec = el.duration;
    if (!Number.isFinite(sec) || sec <= 0) return 0;
    return Math.round(sec * 1000);
  }, []);

  const readCurrentMs = useCallback((el: HTMLVideoElement) => {
    const sec = el.currentTime;
    if (!Number.isFinite(sec) || sec < 0) return 0;
    return Math.round(sec * 1000);
  }, []);

  const syncFromVideo = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setPlaying(!el.paused && !el.ended);
    setCurrentMs(readCurrentMs(el));
    setDurationMs(readDurationMs(el));
  }, [readCurrentMs, readDurationMs, videoRef]);

  useEffect(() => {
    setPlaying(false);
    setCurrentMs(0);
    setDurationMs(0);
  }, [resetKey]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onPlay = () => syncFromVideo();
    const onPause = () => syncFromVideo();
    const onTimeUpdate = () => setCurrentMs(readCurrentMs(el));
    const onLoadedMetadata = () => syncFromVideo();
    const onDurationChange = () => setDurationMs(readDurationMs(el));
    const onEnded = () => syncFromVideo();

    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('ended', onEnded);

    syncFromVideo();

    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('ended', onEnded);
    };
  }, [readCurrentMs, readDurationMs, resetKey, syncFromVideo, videoRef]);

  useLayoutEffect(() => {
    if (controlsRef.current) void hydrateArcNavbarIcons(controlsRef.current);
  }, [playing, durationMs, currentMs]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      void el.play();
    } else {
      el.pause();
    }
  }, [videoRef]);

  const seekToMs = useCallback(
    (ms: number) => {
      const el = videoRef.current;
      if (!el) return;
      const duration = readDurationMs(el) || durationMs;
      const clamped = duration > 0 ? Math.max(0, Math.min(ms, duration)) : Math.max(0, ms);
      el.currentTime = clamped / 1000;
      setCurrentMs(clamped);
    },
    [durationMs, readDurationMs, videoRef]
  );

  const sliderMax = Math.max(durationMs, 1);
  const timerLabel = `${formatVideoClock(currentMs / 1000)} / ${formatVideoClock(durationMs / 1000)}`;

  return (
    <footer ref={controlsRef} className="arc-card-viewer__video-bar">
      <Tooltip content={playing ? 'Пауза' : 'Воспроизвести'} position="top">
        <button
          type="button"
          className="btn btn-outline btn-icon-only btn-ds"
          aria-label={playing ? 'Пауза' : 'Воспроизвести'}
          onClick={togglePlay}
        >
          <span
            className={`btn-icon-only__glyph${playing ? ' arc-icon-pause' : ' arc-icon-play'}`}
            aria-hidden="true"
          />
        </button>
      </Tooltip>

      <span className="arc-card-viewer__video-timer text-s">{timerLabel}</span>

      <div className="arc-card-viewer__video-timeline">
        <ValueSlider
          min={0}
          max={sliderMax}
          step={100}
          size="s"
          value={currentMs}
          formatValue={() => ''}
          ariaLabel="Позиция воспроизведения"
          showValue={false}
          disabled={durationMs <= 0}
          onChange={seekToMs}
        />
      </div>
    </footer>
  );
}
