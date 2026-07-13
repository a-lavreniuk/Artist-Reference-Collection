import { useRef, type PointerEvent } from 'react';

type Props = {
  valueMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

export default function GalleryCardVideoTimeline({
  valueMs,
  durationMs,
  onSeek,
  className = '',
  ariaLabel = 'Позиция видео',
  disabled = false
}: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const isDisabled = disabled || durationMs <= 0;
  const progress = durationMs > 0 ? Math.min(1, Math.max(0, valueMs / durationMs)) : 0;

  const seekAtClientX = (clientX: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || isDisabled) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(Math.round(ratio * durationMs));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    seekAtClientX(e.clientX);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.stopPropagation();
    seekAtClientX(e.clientX);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.stopPropagation();
    seekAtClientX(e.clientX);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const rootClass = ['arc-gallery-card-video-timeline', className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={durationMs}
      aria-valuenow={valueMs}
      aria-disabled={isDisabled}
      tabIndex={-1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      <div ref={railRef} className="arc-gallery-card-video-timeline__rail">
        <div
          className="arc-gallery-card-video-timeline__fill"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
