import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MarqueeMode, SelectionRect } from './galleryCardSelectionCore';

export type MarqueeView = { rect: SelectionRect; mode: MarqueeMode } | null;

export type MarqueeSubscribe = (listener: (view: MarqueeView) => void) => () => void;

type Props = {
  subscribe: MarqueeSubscribe;
};

/** Минимальный размер, при котором рамку уже видно, а не точку от клика. */
const MIN_VISIBLE_PX = 4;

/**
 * Рамка хранит своё состояние отдельно от ленты: движение курсора перерисовывает
 * только этот компонент, а не страницу с карточками.
 */
export default function GalleryMarqueeOverlay({ subscribe }: Props) {
  const [view, setView] = useState<MarqueeView>(null);

  useEffect(() => subscribe(setView), [subscribe]);

  if (!view) return null;
  const width = view.rect.right - view.rect.left;
  const height = view.rect.bottom - view.rect.top;
  if (width < MIN_VISIBLE_PX && height < MIN_VISIBLE_PX) return null;

  // Портал в body: рамку видно поверх навбара, вне стекинга страницы.
  return createPortal(
    <div
      className={`arc-gallery-marquee${view.mode === 'subtract' ? ' arc-gallery-marquee--subtract' : ''}`}
      style={{ left: view.rect.left, top: view.rect.top, width, height }}
      aria-hidden
    />,
    document.body
  );
}
