import { useLayoutEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/db';
import { useCardSectionMediaActive } from '../layout/cardSectionMedia';
import { galleryCardAspectRatio, gallerySkeletonStyle } from './gallerySkeleton';

type Props = {
  card: CardRecord;
  src: string;
  /** Если задан — превью грузится только когда секция видима (не блокирует IPC на main). */
  mediaTab?: 'gallery' | 'collections' | 'moodboard';
};

export default function GalleryThumb({ card, src, mediaTab }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const retryRef = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const aspectRatio = galleryCardAspectRatio(card);
  const tabActive = useCardSectionMediaActive(mediaTab ?? 'gallery');
  const mediaActive = mediaTab === undefined ? true : tabActive;
  const effectiveSrc = mediaActive ? src : undefined;

  useLayoutEffect(() => {
    retryRef.current = 0;
    const img = imgRef.current;
    if (!effectiveSrc) {
      setLoaded(false);
      return;
    }
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [effectiveSrc]);

  const handleError = () => {
    setLoaded(false);
    if (!mediaActive || !effectiveSrc || retryRef.current >= 1) return;
    retryRef.current += 1;
    window.setTimeout(() => setRetryTick((v) => v + 1), 120);
  };

  return (
    <span className="arc-gallery-thumb-wrap" style={{ aspectRatio }}>
      {!loaded || !mediaActive ? (
        <div className="arc-gallery-skeleton arc-gallery-skeleton--under" style={gallerySkeletonStyle(card)} aria-hidden />
      ) : null}
      {mediaActive && effectiveSrc ? (
        <img
          key={`${effectiveSrc}:${retryTick}`}
          ref={imgRef}
          className={`arc-gallery-thumb${loaded ? ' is-loaded' : ''}`}
          src={effectiveSrc}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={handleError}
        />
      ) : null}
    </span>
  );
}
