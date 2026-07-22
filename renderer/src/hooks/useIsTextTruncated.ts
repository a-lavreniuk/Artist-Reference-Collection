import { useLayoutEffect, useState, type RefObject } from 'react';

function measureTruncated(el: HTMLElement): boolean {
  if (el.scrollWidth > el.clientWidth + 1) return true;
  // Fallback: scrollWidth иногда равен clientWidth при ellipsis — меряем текст через Range
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const textWidth = range.getBoundingClientRect().width;
    const boxWidth = el.getBoundingClientRect().width;
    return textWidth > boxWidth + 1;
  } catch {
    return false;
  }
}

/** true, если у элемента текст обрезан ellipsis. */
export function useIsTextTruncated(
  ref: RefObject<HTMLElement | null>,
  /** Пересчёт при смене текста */
  text: string
): boolean {
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      setTruncated(false);
      return;
    }

    const check = () => {
      setTruncated(measureTruncated(el));
    };

    check();
    // После шрифтов / flex-раскладки
    const raf = requestAnimationFrame(check);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    if (el.parentElement) ro?.observe(el.parentElement);

    window.addEventListener('resize', check);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [ref, text]);

  return truncated;
}
