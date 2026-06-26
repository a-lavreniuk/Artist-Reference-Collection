import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

type CropperLayout = {
  w: number;
  h: number;
  ox: number;
  oy: number;
  iw: number;
  ih: number;
};

const EMPTY_LAYOUT: CropperLayout = { w: 0, h: 0, ox: 0, oy: 0, iw: 0, ih: 0 };

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Видимая область изображения при object-fit: contain внутри элемента <img>. */
function measureContainedImageLayout(img: HTMLImageElement, root: HTMLElement): CropperLayout {
  const rootRect = root.getBoundingClientRect();
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;
  if (!naturalW || !naturalH) {
    return { ...EMPTY_LAYOUT, w: rootRect.width, h: rootRect.height };
  }

  const boxW = img.clientWidth;
  const boxH = img.clientHeight;
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  const iw = naturalW * scale;
  const ih = naturalH * scale;
  const imgRect = img.getBoundingClientRect();

  return {
    w: rootRect.width,
    h: rootRect.height,
    ox: imgRect.left - rootRect.left + (boxW - iw) / 2,
    oy: imgRect.top - rootRect.top + (boxH - ih) / 2,
    iw,
    ih
  };
}

/** Область кропа с ручками по углам (Figma 892-12002). */
export default function SimilarImageCropper({ imageSrc, crop, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<CropperLayout>(EMPTY_LAYOUT);
  const dragRef = useRef<DragState | null>(null);

  const safeCrop = normalizeSimilarCrop(crop);
  const layoutReady = layout.iw >= 1 && layout.ih >= 1;

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const img = root.querySelector('img');
    if (!img) return;
    setLayout(measureContainedImageLayout(img, root));
  }, []);

  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    const img = root.querySelector('img');
    if (img) {
      ro.observe(img);
      img.addEventListener('load', measure);
      if (img.complete) measure();
    }
    return () => {
      ro.disconnect();
      if (img) img.removeEventListener('load', measure);
    };
  }, [imageSrc, measure]);

  const framePx = useMemo(() => {
    if (!layoutReady) return null;
    return {
      left: layout.ox + safeCrop.x * layout.iw,
      top: layout.oy + safeCrop.y * layout.ih,
      width: safeCrop.w * layout.iw,
      height: safeCrop.h * layout.ih
    };
  }, [layout, layoutReady, safeCrop]);

  const applyPointer = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag || !layoutReady) return;
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
      <img
        className="arc-similar-cropper__image"
        src={imageSrc}
        alt=""
        draggable={false}
        onLoad={measure}
      />
      {layoutReady && framePx ? (
        <div
          className="arc-similar-cropper__frame"
          style={{
            left: framePx.left,
            top: framePx.top,
            width: framePx.width,
            height: framePx.height
          }}
          onPointerDown={bindDrag('move')}
        >
          <span className="arc-similar-cropper__handle arc-similar-cropper__handle--nw" onPointerDown={bindDrag('nw')} />
          <span className="arc-similar-cropper__handle arc-similar-cropper__handle--ne" onPointerDown={bindDrag('ne')} />
          <span className="arc-similar-cropper__handle arc-similar-cropper__handle--sw" onPointerDown={bindDrag('sw')} />
          <span className="arc-similar-cropper__handle arc-similar-cropper__handle--se" onPointerDown={bindDrag('se')} />
        </div>
      ) : null}
    </div>
  );
}
