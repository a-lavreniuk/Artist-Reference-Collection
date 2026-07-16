import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { setVideoPreviewFrame } from '../../services/db';
import { ArcAnimatedModalHost } from '../../motion';
import ValueSlider from '../range-slider/ValueSlider';
import FloatingModalPanel from '../layout/FloatingModalPanel';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import { resolveMediaUrl, cardOriginalRel } from './galleryMediaCache';
import {
  formatPreviewFrameMs,
  videoPreviewDurationMs
} from './videoPreviewFrame';

type Props = {
  card: CardRecord;
  onClose: () => void;
  onSaved?: (card: CardRecord) => void;
};

export default function VideoPreviewFrameModal({ card, onClose, onSaved }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubbingRef = useRef(false);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(() => videoPreviewDurationMs(card));
  const [frameMs, setFrameMs] = useState(() => card.previewFrameMs ?? 0);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const rel = cardOriginalRel(card);
    if (!rel) {
      setLoadError('Видео недоступно');
      return;
    }
    void resolveMediaUrl(rel).then((href) => {
      if (cancelled) return;
      if (!href) setLoadError('Видео недоступно');
      else setVideoSrc(href);
    });
    return () => {
      cancelled = true;
    };
  }, [card]);

  const seekVideo = useCallback((ms: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    el.currentTime = Math.min(ms / 1000, Math.max(0, el.duration - 0.05));
  }, []);

  const handleSliderChange = useCallback(
    (ms: number) => {
      scrubbingRef.current = true;
      setFrameMs(ms);
      seekVideo(ms);
    },
    [seekVideo]
  );

  const handleSave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = await setVideoPreviewFrame(card.id, frameMs);
      onSaved?.(updated);
      onClose();
    } catch {
      setLoadError('Не удалось сохранить кадр');
    } finally {
      setBusy(false);
    }
  };

  const sliderMax = Math.max(durationMs, 1000);

  return (
    <ArcAnimatedModalHost onClose={onClose}>
      {({ requestClose }) => (
        <FloatingModalPanel
          ref={hostRef}
          panelId="video-preview-frame-modal"
          className="arc-modal arc-modal--video-preview-frame"
          data-elevation="raised"
          data-input-size="m"
          data-btn-size="s"
          role="dialog"
          aria-modal="true"
          aria-labelledby="arcVideoPreviewFrameTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="arc-modal__header arc-modal__header--title">
            <h3 className="arc-modal__title" id="arcVideoPreviewFrameTitle">
              Выбрать кадр превью
            </h3>
            <button type="button" className="arc-modal__close" aria-label="Закрыть" onClick={requestClose}>
              <span className="tab-icon arc-icon-close" aria-hidden="true" />
            </button>
          </header>
          <div className="arc-modal__body arc-video-preview-frame-modal__body">
            {loadError ? <p className="text-m arc-video-preview-frame-modal__hint">{loadError}</p> : null}
            {videoSrc ? (
              <div className="arc-video-preview-frame-modal__video-wrap panel elevation-sunken">
                <video
                  ref={videoRef}
                  className="arc-video-preview-frame-modal__video"
                  src={videoSrc}
                  preload="metadata"
                  playsInline
                  muted
                  onLoadedMetadata={(event) => {
                    const el = event.currentTarget;
                    const metaMs = Math.round(el.duration * 1000);
                    if (Number.isFinite(metaMs) && metaMs > 0) {
                      setDurationMs((prev) => (prev > 0 ? prev : metaMs));
                    }
                    const initial = card.previewFrameMs ?? 0;
                    if (initial > 0) seekVideo(initial);
                  }}
                  onTimeUpdate={(event) => {
                    if (scrubbingRef.current) return;
                    const el = event.currentTarget;
                    setFrameMs(Math.round(el.currentTime * 1000));
                  }}
                  onSeeked={() => {
                    scrubbingRef.current = false;
                  }}
                />
              </div>
            ) : !loadError ? (
              <p className="text-m arc-video-preview-frame-modal__hint">Загрузка…</p>
            ) : null}
            <div className="arc-video-preview-frame-modal__slider">
              <ValueSlider
                min={0}
                max={sliderMax}
                step={100}
                size="s"
                value={frameMs}
                formatValue={formatPreviewFrameMs}
                ariaLabel="Позиция кадра"
                onChange={handleSliderChange}
              />
            </div>
          </div>
          <footer className="arc-modal__footer arc-modal__footer--actions-2">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={requestClose} disabled={busy}>
              <span className="btn-ds__value">Отмена</span>
            </button>
            <button
              type="button"
              className="btn btn-brand btn-ds btn-s"
              onClick={() => void handleSave()}
              disabled={busy || !videoSrc || Boolean(loadError)}
            >
              <span className="btn-ds__value">{busy ? 'Сохранение…' : 'Сохранить'}</span>
            </button>
          </footer>
        </FloatingModalPanel>
      )}
    </ArcAnimatedModalHost>
  );
}
