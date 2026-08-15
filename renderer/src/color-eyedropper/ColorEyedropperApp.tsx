import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { eyedropperHudPosition, type EyedropperHudCorner } from './hudLayout';
import { clientToImagePixel, hexFromImageData } from './sampleColor';

const LOUPE_RADIUS = 3;
const CURSOR_ICON = './ui/icons/eyedropper/eyedropper-corsor.svg';

type PointerState = {
  x: number;
  y: number;
  hex: string;
};

function loadFrameImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось загрузить снимок экрана'));
    image.src = dataUrl;
  });
}

export default function ColorEyedropperApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<ImageData | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pointer, setPointer] = useState<PointerState | null>(null);
  const [cardMotion, setCardMotion] = useState(false);
  const hudCornerRef = useRef<EyedropperHudCorner | null>(null);

  const cancel = useCallback(() => {
    void window.arc?.colorEyedropperCancel?.();
  }, []);

  const confirm = useCallback((hex: string) => {
    void window.arc?.colorEyedropperConfirm?.(hex);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    void (async () => {
      try {
        const frame = await window.arc?.colorEyedropperGetFrame?.();
        if (!frame?.ok || cancelled) {
          if (!cancelled) cancel();
          return;
        }
        const image = await loadFrameImage(frame.dataUrl);
        if (cancelled) return;
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          if (!cancelled) cancel();
          return;
        }
        ctx.drawImage(image, 0, 0);
        pixelsRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setFrameUrl(frame.dataUrl);
        setReady(true);
      } catch {
        if (!cancelled) cancel();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cancel]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancel]);

  const sampleAt = (clientX: number, clientY: number): PointerState | null => {
    const canvas = canvasRef.current;
    const pixels = pixelsRef.current;
    if (!canvas || !pixels) return null;
    const { x, y } = clientToImagePixel(
      clientX,
      clientY,
      window.innerWidth,
      window.innerHeight,
      canvas.width,
      canvas.height
    );
    const hex = hexFromImageData(pixels.data, y * canvas.width + x);
    if (!hex) return null;
    return { x: clientX, y: clientY, hex };
  };

  const paintLoupe = useCallback((clientX: number, clientY: number) => {
    const source = canvasRef.current;
    const loupe = loupeRef.current;
    if (!source || !loupe) return;
    const ctx = loupe.getContext('2d');
    if (!ctx) return;
    const { x, y } = clientToImagePixel(
      clientX,
      clientY,
      window.innerWidth,
      window.innerHeight,
      source.width,
      source.height
    );
    const size = LOUPE_RADIUS * 2 + 1;
    if (loupe.width !== size || loupe.height !== size) {
      loupe.width = size;
      loupe.height = size;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(source, x - LOUPE_RADIUS, y - LOUPE_RADIUS, size, size, 0, 0, size, size);
  }, []);

  const hasPointer = pointer !== null;

  useLayoutEffect(() => {
    if (!pointer) return;
    paintLoupe(pointer.x, pointer.y);
  }, [paintLoupe, pointer]);

  useLayoutEffect(() => {
    if (!hasPointer) {
      setCardMotion(false);
      hudCornerRef.current = null;
      return;
    }
    const frame = requestAnimationFrame(() => setCardMotion(true));
    return () => cancelAnimationFrame(frame);
  }, [hasPointer]);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!ready) return;
    const next = sampleAt(event.clientX, event.clientY);
    if (!next) return;
    setPointer(next);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.button === 2 || event.button === 1) {
      cancel();
      return;
    }
    if (event.button !== 0) return;
    const next = sampleAt(event.clientX, event.clientY);
    if (next) confirm(next.hex);
  };

  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    cancel();
  };

  const hud = pointer
    ? eyedropperHudPosition(
        pointer.x,
        pointer.y,
        window.innerWidth,
        window.innerHeight,
        hudCornerRef.current
      )
    : null;
  if (hud) hudCornerRef.current = hud.corner;

  return (
    <div
      className="arc-color-eyedropper arc-ui-kit-scope"
      data-elevation="sunken"
      role="application"
      aria-label="Пипетка цвета"
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      {frameUrl ? (
        <img className="arc-color-eyedropper__frame" src={frameUrl} alt="" draggable={false} />
      ) : null}
      <canvas ref={canvasRef} className="arc-color-eyedropper__buffer" aria-hidden="true" />
      {hud && pointer ? (
        <div
          className={`arc-color-eyedropper__hud${cardMotion ? ' is-ready' : ''}`}
          data-corner={hud.corner}
          style={{ left: hud.left, top: hud.top }}
        >
          <img
            className="arc-color-eyedropper__cursor"
            src={CURSOR_ICON}
            alt=""
            width={24}
            height={24}
            draggable={false}
          />
          <div
            className="arc-color-eyedropper__card"
            data-typo-tone="dark"
            style={{ left: hud.cardLeft, top: hud.cardTop }}
          >
            <div className="arc-color-eyedropper__zoom-wrap">
              <canvas ref={loupeRef} className="arc-color-eyedropper__zoom" aria-hidden="true" />
            </div>
            <div className="arc-color-eyedropper__meta">
              <div className="arc-color-eyedropper__color">
                <span
                  className="arc-color-eyedropper__sample"
                  style={{ background: pointer.hex }}
                  aria-hidden="true"
                />
                <span className="text-m arc-color-eyedropper__hex">{pointer.hex}</span>
              </div>
              <p className="text-s arc-color-eyedropper__hint">Нажмите для выбора</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
