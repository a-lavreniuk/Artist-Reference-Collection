import { useEffect, useRef, useState } from 'react';

import type { CardRecord } from '../../services/db';
import { useCardSectionMediaActive } from '../layout/cardSectionMedia';
import {
  buildLibraryMediaUrl,
  cardOriginalRel,
  cardThumbRel,
  refreshMediaServerOrigin
} from './galleryMediaCache';
import { galleryCardAspectRatio } from './gallerySkeleton';

const MAX_THUMB_RETRIES = 3;
const RETRY_DELAYS_MS = [120, 250, 500] as const;

type Props = {
  card: CardRecord;
  src: string;
  /** Если задан — превью грузится только когда секция видима (не блокирует IPC на main). */
  mediaTab?: 'gallery' | 'collections' | 'moodboard';
};

function rebuildThumbSrc(
  card: CardRecord,
  mediaTab: Props['mediaTab'],
  withoutSect = false
): string | null {
  if (withoutSect) {
    const originalRel = cardOriginalRel(card);
    if (!originalRel) return null;
    return buildLibraryMediaUrl(originalRel, undefined, card.dateModified);
  }
  const thumbRel = cardThumbRel(card);
  if (!thumbRel) return null;
  return buildLibraryMediaUrl(thumbRel, mediaTab, card.dateModified);
}

export default function GalleryThumb({ card, src, mediaTab }: Props) {
  const retryRef = useRef(0);
  const usedOriginalFallbackRef = useRef(false);
  const retryTimerRef = useRef(0);
  const [retryTick, setRetryTick] = useState(0);
  const [overrideSrc, setOverrideSrc] = useState<string | null>(null);
  const aspectRatio = galleryCardAspectRatio(card);
  const tabActive = useCardSectionMediaActive(mediaTab ?? 'gallery');
  const mediaActive = mediaTab === undefined ? true : tabActive;
  const displaySrc = overrideSrc ?? src;
  const effectiveSrc = mediaActive ? displaySrc : undefined;

  useEffect(() => {
    window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = 0;
    retryRef.current = 0;
    usedOriginalFallbackRef.current = false;
    setOverrideSrc(null);
    setRetryTick(0);
    return () => {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = 0;
    };
  }, [src, card.id]);

  const handleError = () => {
    if (!mediaActive || !effectiveSrc) return;

    if (retryRef.current < MAX_THUMB_RETRIES) {
      const attempt = retryRef.current;
      retryRef.current += 1;
      refreshMediaServerOrigin();
      const rebuilt = rebuildThumbSrc(card, mediaTab);
      const delay = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      const expectedSrc = effectiveSrc;
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = 0;
        if (rebuilt && rebuilt !== expectedSrc) {
          setOverrideSrc(rebuilt);
        } else {
          setRetryTick((v) => v + 1);
        }
      }, delay);
      return;
    }

    if (usedOriginalFallbackRef.current) return;
    usedOriginalFallbackRef.current = true;
    refreshMediaServerOrigin();
    // Как в деталке: original без ?sect=, чтобы обойти gating / отсутствующий thumb.
    const fallbackHref = rebuildThumbSrc(card, mediaTab, true);
    if (!fallbackHref || fallbackHref === effectiveSrc) return;
    setOverrideSrc(fallbackHref);
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
