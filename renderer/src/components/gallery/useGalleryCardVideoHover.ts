import { useCallback, useEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/db';
import { cardOriginalRel, resolveMediaUrl } from './galleryMediaCache';
import {
  claimGalleryCardVideoPlayback,
  releaseGalleryCardVideoPlayback,
  subscribeGalleryCardVideoPlayback
} from './galleryCardVideoPlayback';

type Options = {
  card: CardRecord;
  active: boolean;
  suppressed: boolean;
};

export function useGalleryCardVideoHover({ card, active, suppressed }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [playbackAllowed, setPlaybackAllowed] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const isVideo = card.type === 'video';
  const shouldEngage = isVideo && active && !suppressed;

  useEffect(() => {
    return subscribeGalleryCardVideoPlayback((activeId) => {
      setPlaybackAllowed(activeId === card.id);
    });
  }, [card.id]);

  useEffect(() => {
    if (!shouldEngage) {
      releaseGalleryCardVideoPlayback(card.id);
      return;
    }
    claimGalleryCardVideoPlayback(card.id);
    return () => {
      releaseGalleryCardVideoPlayback(card.id);
    };
  }, [card.id, shouldEngage]);

  useEffect(() => {
    if (!shouldEngage) {
      setVideoSrc(null);
      return;
    }
    const rel = cardOriginalRel(card);
    if (!rel) return;
    let cancelled = false;
    void resolveMediaUrl(rel).then((url) => {
      if (!cancelled && url) setVideoSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [card, shouldEngage]);

  const resetVideo = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setCurrentMs(0);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoSrc) return;

    if (shouldEngage && playbackAllowed) {
      el.muted = true;
      void el.play().catch(() => undefined);
      return;
    }
    resetVideo();
  }, [shouldEngage, playbackAllowed, videoSrc, resetVideo]);

  useEffect(() => {
    if (!shouldEngage) {
      resetVideo();
    }
  }, [shouldEngage, resetVideo]);

  const onTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const sec = el.currentTime;
    if (!Number.isFinite(sec) || sec < 0) return;
    setCurrentMs(Math.round(sec * 1000));
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const sec = el.duration;
    if (!Number.isFinite(sec) || sec <= 0) return;
    setDurationMs(Math.round(sec * 1000));
  }, []);

  const seekToMs = useCallback((ms: number) => {
    const el = videoRef.current;
    if (!el) return;
    const duration = durationMs > 0 ? durationMs : Math.round((el.duration || 0) * 1000);
    const clamped =
      duration > 0 ? Math.max(0, Math.min(ms, duration)) : Math.max(0, ms);
    el.currentTime = clamped / 1000;
    setCurrentMs(clamped);
  }, [durationMs]);

  const showVideo = shouldEngage && playbackAllowed && Boolean(videoSrc);

  return {
    videoRef,
    videoSrc,
    showVideo,
    currentMs,
    durationMs,
    seekToMs,
    onTimeUpdate,
    onLoadedMetadata
  };
}
