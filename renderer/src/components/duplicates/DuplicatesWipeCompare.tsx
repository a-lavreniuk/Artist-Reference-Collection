import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import type { CardRecord } from '../../services/arcSchema';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import DuplicatesMetaOverlay from './DuplicatesMetaOverlay';

type Props = {
  cardA: CardRecord | null;
  cardB: CardRecord | null;
  urlA: string | null;
  urlB: string | null;
  libraryRootAbs: string | null;
};

export default function DuplicatesWipeCompare({ cardA, cardB, urlA, urlB, libraryRootAbs }: Props) {
  const [pos, setPos] = useState(50);
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useLayoutEffect(() => {
    if (wrapRef.current) void hydrateArcNavbarIcons(wrapRef.current);
  }, [urlA, urlB]);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, next)));
  }, []);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const stop = () => {
    draggingRef.current = false;
  };

  return (
    <div
      ref={wrapRef}
      className="arc-duplicates-wipe-wrap arc-ui-kit-scope"
      data-btn-size="l"
      data-elevation="default"
    >
      <div
        ref={viewportRef}
        className="arc-duplicates-wipe"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        {urlB ? <img className="arc-duplicates-wipe__img" src={urlB} alt="" draggable={false} /> : null}
        {urlA ? (
          <img
            className="arc-duplicates-wipe__img arc-duplicates-wipe__img--top"
            src={urlA}
            alt=""
            draggable={false}
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          />
        ) : null}

        <DuplicatesMetaOverlay card={cardA} libraryRootAbs={libraryRootAbs} align="left" />
        <DuplicatesMetaOverlay card={cardB} libraryRootAbs={libraryRootAbs} align="right" />
      </div>

      <div className="arc-duplicates-wipe__split" style={{ left: `${pos}%` }}>
        <div className="arc-duplicates-wipe__divider" aria-hidden="true" />
        <button
          type="button"
          className="btn btn-brand btn-icon-only btn-ds arc-duplicates-wipe__handle"
          tabIndex={-1}
          aria-label="Сравнить изображения"
        >
          <span className="btn-icon-only__glyph arc-icon-arrow-left-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
