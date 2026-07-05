import { useRef, useState } from 'react';

import type { CardRecord } from '../../services/db';

import { useCardSectionMediaActive } from '../layout/cardSectionMedia';

import { galleryCardAspectRatio } from './gallerySkeleton';



type Props = {

  card: CardRecord;

  src: string;

  /** Если задан — превью грузится только когда секция видима (не блокирует IPC на main). */

  mediaTab?: 'gallery' | 'collections' | 'moodboard';

};



export default function GalleryThumb({ card, src, mediaTab }: Props) {

  const retryRef = useRef(0);

  const [retryTick, setRetryTick] = useState(0);

  const aspectRatio = galleryCardAspectRatio(card);

  const tabActive = useCardSectionMediaActive(mediaTab ?? 'gallery');

  const mediaActive = mediaTab === undefined ? true : tabActive;

  const effectiveSrc = mediaActive ? src : undefined;



  const handleError = () => {

    if (!mediaActive || !effectiveSrc || retryRef.current >= 1) return;

    retryRef.current += 1;

    window.setTimeout(() => setRetryTick((v) => v + 1), 120);

  };



  return (

    <span

      className="arc-gallery-thumb-wrap"

      style={{ aspectRatio, background: 'var(--gray-900)' }}

    >

      {mediaActive && effectiveSrc ? (

        <img

          key={`${effectiveSrc}:${retryTick}`}

          className="arc-gallery-thumb"

          src={effectiveSrc}

          alt=""

          loading="lazy"

          decoding="async"

          onError={handleError}

        />

      ) : null}

    </span>

  );

}

