import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { SimilarCropRect } from '../../search/searchUrl';
import { normalizeSimilarCrop } from '../../search/similarSearchSession';

type Props = {
  imageSrc: string;
  crop: SimilarCropRect;
  onChange: (crop: SimilarCropRect) => void;
};

type DragKind = 'move' | 'nw' | 'ne' | 'sw' | 'se';

type DragState = {
  kind: DragKind;
  startX: number;
  startY: number;
  startCrop: SimilarCropRect;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Область кропа с ручками по углам (Figma 892-12002). */
export default function SimilarImageCropper({ imageSrc, crop, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ w: 0, h: 0, ox: 0, oy: 0, iw: 0, ih: 0 });
  const dragRef = useRef<DragState | null>(null);

  const safeCrop = normalizeSimilarCrop(crop);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const img = root.querySelector('img');
    if (!img) return;
    const r = root.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    setLayout({
      w: r.width,
      h: r.height,
      ox: ir.left - r.left,
      oy: ir.top - r.top,
      iw: ir.width,
      ih: ir.height
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    const img = root.querySelector('img');
    if (img) img.addEventListener('load', measure);
    return () => {
      ro.disconnect();
      if (img) img.removeEventListener('load', measure);
    };
  }, [imageSrc, measure]);

  const toPx = (c: SimilarCropRect) => ({
    left: layout.ox + c.x * layout.iw,
    top: layout.oy + c.y * layout.ih,
    width: c.w * layout.iw,
    height: c.h * layout.ih
  });

  const px = toPx(safeCrop);

  const applyPointer = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    const root = rootRef.current;
    if (!drag || !root || layout.iw < 1 || layout.ih < 1) return;
    const rect = root.getBoundingClientRect();
    const dx = (clientX - drag.startX) / layout.iw;
    const dy = (clientY - drag.startY) / layout.ih;
    const s = drag.startCrop;
    let next = { ...s };
    if (drag.kind === 'move') {
      next.x = clamp01(s.x + dx);
      next.y = clamp01(s.y + dy);
      next.x = Math.min(next.x, 1 - s.w);
      next.y = Math.min(next.y, 1 - s.h);
    } else {
      if (drag.kind.includes('n')) {
        const y = clamp01(s.y + dy);
        const h = s.h + (s.y - y);
        next.y = y;
        next.h = Math.max(0.05, h);
      }
      if (drag.kind.includes('s')) {
        next.h = Math.max(0.05, s.h + dy);
      }
      if (drag.kind.includes('w')) {
        const x = clamp01(s.x + dx);
        const w = s.w + (s.x - x);
        next.x = x;
        next.w = Math.max(0.05, w);
      }
      if (drag.kind.includes('e')) {
        next.w = Math.max(0.05, s.w + dx);
      }
      next.x = Math.min(next.x, 1 - next.w);
      next.y = Math.min(next.y, 1 - next.h);
    }
    onChange(normalizeSimilarCrop(next));
  };

  const bindDrag = (kind: DragKind) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind, startX: e.clientX, startY: e.clientY, startCrop: safeCrop };
    const move = (ev: PointerEvent) => applyPointer(ev.clientX, ev.clientY);
    const up = () => {
      dragRef.current = null;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  return (
    <div ref={rootRef} className="arc-similar-cropper">
      <img className="arc-similar-cropper__image" src={imageSrc} alt="" draggable={false} />
      <div className="arc-similar-cropper__shade" aria-hidden="true" />
      <div
        className="arc-similar-cropper__frame"
        style={{ left: px.left, top: px.top, width: px.width, height: px.height }}
        onPointerDown={bindDrag('move')}
      >
        <span className="arc-similar-cropper__handle arc-similar-cropper__handle--nw" onPointerDown={bindDrag('nw')} />
        <span className="arc-similar-cropper__handle arc-similar-cropper__handle--ne" onPointerDown={bindDrag('ne')} />
        <span className="arc-similar-cropper__handle arc-similar-cropper__handle--sw" onPointerDown={bindDrag('sw')} />
        <span className="arc-similar-cropper__handle arc-similar-cropper__handle--se" onPointerDown={bindDrag('se')} />
      </div>
    </div>
  );
}
