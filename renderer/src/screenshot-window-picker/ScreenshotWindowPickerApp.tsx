import { useCallback, useEffect, useRef, useState } from 'react';

type WindowHighlight = {
  title: string;
  nativeId?: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function ScreenshotWindowPickerApp() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState<WindowHighlight | null>(null);
  const pollRef = useRef(0);
  const pickingRef = useRef(false);

  const cancel = useCallback(() => {
    void window.arc?.screenshotWindowPickerCancel?.();
  }, []);

  const confirm = useCallback((picked: WindowHighlight) => {
    void window.arc?.screenshotWindowPickerConfirm?.({
      title: picked.title,
      nativeId: picked.nativeId
    });
  }, []);

  const queryWindowAt = useCallback(async (x: number, y: number): Promise<WindowHighlight | null> => {
    const result = await window.arc?.screenshotWindowPickerAtPoint?.({ x, y });
    if (!result?.ok || !result.window?.title) {
      setHighlight(null);
      return null;
    }
    setHighlight(result.window);
    return result.window;
  }, []);

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

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, []);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pickingRef.current) return;
    if (pollRef.current) window.clearTimeout(pollRef.current);
    const x = event.clientX;
    const y = event.clientY;
    pollRef.current = window.setTimeout(() => {
      void queryWindowAt(x, y);
    }, 40);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || pickingRef.current) return;
    event.preventDefault();
    pickingRef.current = true;
    void (async () => {
      const picked = await queryWindowAt(event.clientX, event.clientY);
      if (picked?.title) {
        confirm(picked);
      }
      pickingRef.current = false;
    })();
  };

  return (
    <div
      ref={rootRef}
      className="arc-screenshot-window-picker"
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      role="application"
      aria-label="Выбор окна для скриншота"
    >
      {highlight ? (
        <div
          className="arc-screenshot-window-picker__highlight"
          style={{
            left: highlight.x,
            top: highlight.y,
            width: highlight.width,
            height: highlight.height
          }}
        />
      ) : null}
      <div className="arc-screenshot-window-picker__hint">
        Наведите на окно и нажмите, чтобы сделать скриншот. Esc — отмена
      </div>
    </div>
  );
}
