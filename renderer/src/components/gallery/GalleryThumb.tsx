import { useLayoutEffect, useRef, useState } from 'react';
import type { CardRecord } from '../../services/db';
import { galleryCardAspectRatio, gallerySkeletonStyle } from './gallerySkeleton';

type Props = {
  card: CardRecord;
  src: string;
};

export default function GalleryThumb({ card, src }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const aspectRatio = galleryCardAspectRatio(card);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  return (
    <span className="arc-gallery-thumb-wrap" style={{ aspectRatio }}>
      {!loaded ? (
        <div className="arc-gallery-skeleton arc-gallery-skeleton--under" style={gallerySkeletonStyle(card)} aria-hidden />
      ) : null}
      <img
        ref={imgRef}
        className={`arc-gallery-thumb${loaded ? ' is-loaded' : ''}`}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
    </span>
  );
}
