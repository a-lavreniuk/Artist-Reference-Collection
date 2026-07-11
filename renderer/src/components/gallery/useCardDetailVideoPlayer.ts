import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { setVideoPreviewFrame } from '../../services/db';
import { copyVideoFrameToClipboard, saveVideoFrameToCardFolder } from '../../services/storageClient';
import { clampPlaybackRate, DEFAULT_VIDEO_FPS, stepPlaybackRate } from './cardDetailVideoTime';
import { logVideoPlayer } from './cardDetailVideoDebug';
import type { CardDetailVideoPlayerHandle } from './cardDetailVideoPlayerTypes';

type Options = {
  cardId: string;
  src: string;
  autoplay: boolean;
  playerRef?: React.RefObject<CardDetailVideoPlayerHandle | null>;
  onCardUpdated?: (card: import('../../services/arcSchema').CardRecord) => void;
  onToast?: (message: string) => void;
};

export function useCardDetailVideoPlayer({
  cardId,
  src,
  autoplay,
  playerRef,
  onCardUpdated,
  onToast
}: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubVideoRef = useRef<HTMLVideoElement>(null);
  const preMuteVolumeRef = useRef(1);

  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fps] = useState(DEFAULT_VIDEO_FPS);
  const [scrubPreviewSrc, setScrubPreviewSrc] = useState<string | null>(null);
  const [scrubPreviewVisible, setScrubPreviewVisible] = useState(false);
  const [scrubPreviewLeftPct, setScrubPreviewLeftPct] = useState(0);
  const [frameMenuOpen, setFrameMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);

  const frameMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const speedMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const scrubCanvasRef = useRef<HTMLCanvasElement>(null);
  const scrubDebounceRef = useRef<number | null>(null);
  const durationMsRef = useRef(0);
  const seekingRef = useRef(false);
  const scrubPreviewEnabledRef = useRef(true);

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

  const syncDurationMs = useCallback(
    (el: HTMLVideoElement) => {
      const next = readDurationMs(el);
      durationMsRef.current = next;
      setDurationMs((prev) => (prev === next ? prev : next));
    },
    [readDurationMs]
  );

  useEffect(() => {
    setPlaying(false);
    setCurrentMs(0);
    setDurationMs(0);
    durationMsRef.current = 0;
    seekingRef.current = false;
    scrubPreviewEnabledRef.current = true;
    setPlaybackRate(1);
    setMuted(false);
    setVolume(1);
    preMuteVolumeRef.current = 1;
  }, [cardId, src]);

  const syncVideoState = useCallback((el: HTMLVideoElement) => {
    setPlaying(!el.paused && !el.ended);
    setCurrentMs(readCurrentMs(el));
    syncDurationMs(el);
    setVolume(el.volume);
    setMuted(el.muted);
    setPlaybackRate(clampPlaybackRate(el.playbackRate || 1));
  }, [readCurrentMs, syncDurationMs]);

  const seekToMs = useCallback(
    (ms: number) => {
      const el = videoRef.current;
      if (!el) {
        logVideoPlayer('seek:skip-no-video', { ms });
        return;
      }
      const duration = readDurationMs(el) || durationMsRef.current;
      const clamped =
        duration > 0 ? Math.max(0, Math.min(ms, duration)) : Math.max(0, ms);
      const beforeMs = readCurrentMs(el);
      seekingRef.current = true;
      el.currentTime = clamped / 1000;
      setCurrentMs(clamped);
      logVideoPlayer('seek', {
        requestedMs: ms,
        clampedMs: clamped,
        durationMs: duration,
        beforeMs,
        readyState: el.readyState,
        paused: el.paused
      });
      window.setTimeout(() => {
        if (!seekingRef.current) return;
        seekingRef.current = false;
        logVideoPlayer('seek:fallback-clear-seeking', { currentMs: readCurrentMs(el) });
      }, 750);
    },
    [readCurrentMs, readDurationMs]
  );

  const captureFrameMs = useCallback((): number => {
    const el = videoRef.current;
    if (!el) return 0;
    el.pause();
    const ms = Math.round(el.currentTime * 1000);
    setCurrentMs(ms);
    setPlaying(false);
    return ms;
  }, []);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused || el.ended) {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, []);

  const seekBySeconds = useCallback(
    (deltaSec: number) => {
      const el = videoRef.current;
      if (!el) return;
      seekToMs(readCurrentMs(el) + deltaSec * 1000);
    },
    [readCurrentMs, seekToMs]
  );

  const stepFrames = useCallback(
    (frameCount: number) => {
      const el = videoRef.current;
      if (!el) return;
      const wasPaused = el.paused;
      el.pause();
      const stepSec = frameCount / fps;
      seekToMs(readCurrentMs(el) + Math.round(stepSec * 1000));
      if (!wasPaused) {
        void el.play().catch(() => undefined);
      }
    },
    [fps, readCurrentMs, seekToMs]
  );

  const adjustSpeed = useCallback(
    (direction: 1 | -1) => {
      const el = videoRef.current;
      const next = stepPlaybackRate(playbackRate, direction);
      setPlaybackRate(next);
      if (el) el.playbackRate = next;
    },
    [playbackRate]
  );

  const copyFrame = useCallback(async () => {
    const frameMs = captureFrameMs();
    try {
      await copyVideoFrameToClipboard(cardId, frameMs);
      onToast?.('Кадр скопирован');
    } catch {
      onToast?.('Не удалось скопировать кадр');
    }
  }, [captureFrameMs, cardId, onToast]);

  const saveFrame = useCallback(async () => {
    const frameMs = captureFrameMs();
    try {
      await saveVideoFrameToCardFolder(cardId, frameMs);
      onToast?.('Кадр сохранён в папку карточки');
    } catch {
      onToast?.('Не удалось сохранить кадр');
    }
  }, [captureFrameMs, cardId, onToast]);

  const setPreviewFrame = useCallback(async () => {
    const frameMs = captureFrameMs();
    try {
      const updated = await setVideoPreviewFrame(cardId, frameMs);
      onCardUpdated?.(updated);
      onToast?.('Превью карточки обновлено');
    } catch {
      onToast?.('Не удалось установить превью');
    }
  }, [captureFrameMs, cardId, onCardUpdated, onToast]);

  useImperativeHandle(
    playerRef,
    () => ({
      togglePlay,
      seekBySeconds,
      stepFrames,
      adjustSpeed,
      copyFrame,
      saveFrame,
      setPreviewFrame
    }),
    [adjustSpeed, copyFrame, saveFrame, seekBySeconds, setPreviewFrame, stepFrames, togglePlay]
  );

  const onLoadedMetadata = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const el = event.currentTarget;
      syncVideoState(el);
      logVideoPlayer('metadata', {
        durationMs: readDurationMs(el),
        currentMs: readCurrentMs(el),
        src: el.currentSrc
      });
      if (autoplay) {
        void el.play().catch(() => {
          el.muted = true;
          setMuted(true);
          void el.play().catch(() => undefined);
        });
      }
    },
    [autoplay, readCurrentMs, readDurationMs, syncVideoState]
  );

  const onDurationChange = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      syncDurationMs(event.currentTarget);
    },
    [syncDurationMs]
  );

  const onTimeUpdate = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (seekingRef.current) return;
      const el = event.currentTarget;
      setCurrentMs(readCurrentMs(el));
      if (durationMsRef.current <= 0) syncDurationMs(el);
    },
    [readCurrentMs, syncDurationMs]
  );

  const onSeeked = useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const el = event.currentTarget;
      seekingRef.current = false;
      const nextMs = readCurrentMs(el);
      setCurrentMs(nextMs);
      const seekable =
        el.seekable.length > 0
          ? Array.from({ length: el.seekable.length }, (_, i) => ({
              startMs: Math.round(el.seekable.start(i) * 1000),
              endMs: Math.round(el.seekable.end(i) * 1000)
            }))
          : [];
      logVideoPlayer('seeked', {
        currentMs: nextMs,
        durationMs: readDurationMs(el),
        readyState: el.readyState,
        seekable
      });
    },
    [readCurrentMs, readDurationMs]
  );

  const onPlayState = useCallback(() => {
    const el = videoRef.current;
    if (el) syncVideoState(el);
  }, [syncVideoState]);

  const applyVolume = useCallback((nextPct: number) => {
    const el = videoRef.current;
    const clamped = Math.max(0, Math.min(1, nextPct / 100));
    if (clamped <= 0) {
      if (el && !el.muted) {
        preMuteVolumeRef.current = el.volume > 0 ? el.volume : preMuteVolumeRef.current;
        el.muted = true;
      }
      setMuted(true);
      setVolume(0);
      return;
    }
    setVolume(clamped);
    preMuteVolumeRef.current = clamped;
    if (el) {
      el.volume = clamped;
      el.muted = false;
      setMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.muted) {
      const restore = preMuteVolumeRef.current > 0 ? preMuteVolumeRef.current : 1;
      el.muted = false;
      el.volume = restore;
      setMuted(false);
      setVolume(restore);
      return;
    }
    preMuteVolumeRef.current = el.volume > 0 ? el.volume : 1;
    el.muted = true;
    setMuted(true);
  }, []);

  const onSelectSpeed = useCallback((rate: number) => {
    const el = videoRef.current;
    const next = clampPlaybackRate(rate);
    setPlaybackRate(next);
    if (el) el.playbackRate = next;
    setSpeedMenuOpen(false);
  }, []);

  const drawScrubPreview = useCallback(() => {
    if (!scrubPreviewEnabledRef.current) return;
    const scrubEl = scrubVideoRef.current;
    const canvas = scrubCanvasRef.current;
    if (!scrubEl || !canvas || scrubEl.readyState < 2) return;
    const w = scrubEl.videoWidth;
    const h = scrubEl.videoHeight;
    if (!w || !h) return;
    const maxW = 128;
    const scale = maxW / w;
    canvas.width = maxW;
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(scrubEl, 0, 0, canvas.width, canvas.height);
      setScrubPreviewSrc(canvas.toDataURL('image/jpeg', 0.82));
    } catch (err) {
      scrubPreviewEnabledRef.current = false;
      setScrubPreviewSrc(null);
      setScrubPreviewVisible(false);
      logVideoPlayer('scrub-preview:disabled', {
        reason: err instanceof Error ? err.message : String(err)
      });
    }
  }, []);

  const scheduleScrubPreview = useCallback(
    (ratio: number) => {
      if (!scrubPreviewEnabledRef.current) return;
      const el = scrubVideoRef.current;
      const duration = durationMsRef.current;
      if (!el || duration <= 0) return;
      const ms = Math.max(0, Math.min(duration, Math.round(ratio * duration)));
      setScrubPreviewLeftPct(ratio * 100);
      setScrubPreviewVisible(true);
      if (scrubDebounceRef.current) window.clearTimeout(scrubDebounceRef.current);
      scrubDebounceRef.current = window.setTimeout(() => {
        scrubDebounceRef.current = null;
        const onSeeked = () => {
          el.removeEventListener('seeked', onSeeked);
          try {
            drawScrubPreview();
          } catch (err) {
            scrubPreviewEnabledRef.current = false;
            setScrubPreviewSrc(null);
            setScrubPreviewVisible(false);
            logVideoPlayer('scrub-preview:seeked-error', {
              reason: err instanceof Error ? err.message : String(err)
            });
          }
        };
        el.addEventListener('seeked', onSeeked);
        el.currentTime = ms / 1000;
      }, 100);
    },
    [drawScrubPreview]
  );

  const hideScrubPreview = useCallback(() => {
    setScrubPreviewVisible(false);
    setScrubPreviewSrc(null);
    if (scrubDebounceRef.current) {
      window.clearTimeout(scrubDebounceRef.current);
      scrubDebounceRef.current = null;
    }
  }, []);

  const onTimelinePointer = useCallback(
    (clientX: number, rect: DOMRect, seek: boolean) => {
      const duration = durationMsRef.current;
      if (duration <= 0 || rect.width <= 0) {
        logVideoPlayer('timeline:skip', { duration, rectWidth: rect.width, seek });
        return;
      }
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetMs = Math.round(ratio * duration);
      if (seek) {
        logVideoPlayer('timeline:seek', {
          clientX,
          ratio,
          targetMs,
          rectLeft: rect.left,
          rectWidth: rect.width
        });
        seekToMs(targetMs);
        hideScrubPreview();
      } else {
        scheduleScrubPreview(ratio);
      }
    },
    [hideScrubPreview, scheduleScrubPreview, seekToMs]
  );

  useEffect(() => {
    return () => {
      if (scrubDebounceRef.current) window.clearTimeout(scrubDebounceRef.current);
    };
  }, []);

  return {
    videoRef,
    scrubVideoRef,
    scrubCanvasRef,
    frameMenuAnchorRef,
    speedMenuAnchorRef,
    playing,
    currentMs,
    durationMs,
    volume,
    muted,
    playbackRate,
    scrubPreviewSrc,
    scrubPreviewVisible,
    scrubPreviewLeftPct,
    frameMenuOpen,
    setFrameMenuOpen,
    speedMenuOpen,
    setSpeedMenuOpen,
    togglePlay,
    seekBySeconds,
    copyFrame,
    saveFrame,
    setPreviewFrame,
    onLoadedMetadata,
    onDurationChange,
    onTimeUpdate,
    onSeeked,
    onPlayState,
    applyVolume,
    toggleMute,
    onSelectSpeed,
    seekToMs,
    onTimelinePointer,
    hideScrubPreview
  };
}
