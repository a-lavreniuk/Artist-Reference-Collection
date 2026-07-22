import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { arcMotionTokens, ensureGsapSetup, getPrefersReducedMotion, motionDuration } from '../../motion';
import './Tooltip.css';

export type TooltipVariant = 'default' | 'rich';

type ArrowEdge = 'top' | 'bottom' | 'left' | 'right';

function arrowEdgeForPosition(position: 'top' | 'bottom' | 'left' | 'right'): ArrowEdge {
  switch (position) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    default:
      return 'bottom';
  }
}

function pointInRect(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

/** Расстояние между якорём и подсказкой (px), по смыслу как --s-2 в arc-ui (8px) */
const ANCHOR_GAP = 8;

/** Отступ подсказки от краёв окна при clamp (px), по смыслу как --s-2 */
const VIEW_MARGIN = 8;

/** Указатель не «входит» в слой с pointer-events: none — зона тултипа учитывается отдельно. */
const HIDE_AFTER_LEAVE_MS = 200;

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  variant?: TooltipVariant;
  showArrow?: boolean;
  /**
   * Обёртка якоря. Для текста внутри `<button>` нужен `span`
   * (div внутри button браузер «чинит» и ломает hover).
   */
  as?: 'div' | 'span';
}

export function Tooltip({
  content,
  children,
  delay = 500,
  position = 'top',
  className = '',
  variant = 'default',
  showArrow = true,
  as: Wrapper = 'div'
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [layout, setLayout] = useState<{
    top: number;
    left: number;
    arrowEdge: ArrowEdge;
  } | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisibleRef = useRef(false);
  const wrapperRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const fadePlayedRef = useRef(false);

  isVisibleRef.current = isVisible;

  const clearShowTimeout = () => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
  };

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearHideTimeout();
    clearShowTimeout();
    if (!isVisibleRef.current) {
      showTimeoutRef.current = setTimeout(() => setIsVisible(true), delay);
    }
  };

  const handleMouseLeave = () => {
    clearShowTimeout();
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      hideTimeoutRef.current = null;
      setIsVisible(false);
      setLayout(null);
    }, HIDE_AFTER_LEAVE_MS);
  };

  const updateTooltipPosition = useCallback(() => {
    const wrap = wrapperRef.current;
    const tip = tooltipRef.current;
    if (!wrap || !tip) return;

    const wrapperRect = wrap.getBoundingClientRect();
    const tooltipRect = tip.getBoundingClientRect();
    if (tooltipRect.width === 0 || tooltipRect.height === 0) return;

    let top = 0;
    let left = 0;
    const actualPosition = position || 'top';
    let arrowEdge = arrowEdgeForPosition(actualPosition);

    switch (actualPosition) {
      case 'top':
        top = wrapperRect.top - tooltipRect.height - ANCHOR_GAP;
        left = wrapperRect.left + wrapperRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'bottom':
        top = wrapperRect.bottom + ANCHOR_GAP;
        left = wrapperRect.left + (wrapperRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = wrapperRect.top + (wrapperRect.height - tooltipRect.height) / 2;
        left = wrapperRect.left - tooltipRect.width - ANCHOR_GAP;
        break;
      case 'right':
        top = wrapperRect.top + (wrapperRect.height - tooltipRect.height) / 2;
        left = wrapperRect.right + ANCHOR_GAP;
        break;
      default:
        top = wrapperRect.top - tooltipRect.height - ANCHOR_GAP;
        left = wrapperRect.left + (wrapperRect.width - tooltipRect.width) / 2;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < VIEW_MARGIN) {
      left = VIEW_MARGIN;
    } else if (left + tooltipRect.width > viewportWidth - VIEW_MARGIN) {
      left = viewportWidth - tooltipRect.width - VIEW_MARGIN;
    }

    if (top < VIEW_MARGIN) {
      if (actualPosition === 'top') {
        top = wrapperRect.bottom + ANCHOR_GAP;
        arrowEdge = 'top';
      } else {
        top = VIEW_MARGIN;
      }
    } else if (top + tooltipRect.height > viewportHeight - VIEW_MARGIN) {
      if (actualPosition === 'bottom') {
        top = wrapperRect.top - tooltipRect.height - ANCHOR_GAP;
        arrowEdge = 'bottom';
      } else {
        top = viewportHeight - tooltipRect.height - VIEW_MARGIN;
      }
    }

    setLayout((prev) => {
      const next = { top, left, arrowEdge };
      if (
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.arrowEdge === next.arrowEdge
      ) {
        return prev;
      }
      return next;
    });
  }, [position]);

  useLayoutEffect(() => {
    if (!isVisible) {
      setLayout(null);
      return;
    }

    setLayout(null);
    let cancelled = false;
    let raf2 = 0;

    const run = () => {
      if (!cancelled) updateTooltipPosition();
    };

    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(run);
    });

    const node = tooltipRef.current;
    const ro =
      node && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!cancelled) updateTooltipPosition();
          })
        : null;
    if (node && ro) ro.observe(node);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      ro?.disconnect();
    };
  }, [isVisible, position, updateTooltipPosition]);

  useLayoutEffect(() => {
    if (!isVisible) {
      fadePlayedRef.current = false;
      return;
    }
    if (!layout || !tooltipRef.current || fadePlayedRef.current) return;

    const el = tooltipRef.current;
    const gsap = ensureGsapSetup();
    const reduced = getPrefersReducedMotion();
    const duration = motionDuration('fast', reduced);

    fadePlayedRef.current = true;
    gsap.killTweensOf(el);
    gsap.set(el, { opacity: 0 });
    if (reduced) {
      gsap.set(el, { opacity: 1 });
      return;
    }

    gsap.to(el, { opacity: 1, duration, ease: arcMotionTokens.ease });
  }, [isVisible, layout]);

  useEffect(() => {
    if (!isVisible || !layout) return;
    const onMove = (e: MouseEvent) => {
      const w = wrapperRef.current?.getBoundingClientRect();
      const t = tooltipRef.current?.getBoundingClientRect();
      if (!w || !t) return;
      const inside =
        pointInRect(e.clientX, e.clientY, w) || pointInRect(e.clientX, e.clientY, t);
      if (inside) clearHideTimeout();
      else if (!hideTimeoutRef.current) {
        hideTimeoutRef.current = setTimeout(() => {
          hideTimeoutRef.current = null;
          setIsVisible(false);
          setLayout(null);
        }, HIDE_AFTER_LEAVE_MS);
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [isVisible, layout]);

  useEffect(() => {
    if (!isVisible || !layout) return;
    window.addEventListener('scroll', updateTooltipPosition, true);
    window.addEventListener('resize', updateTooltipPosition);
    return () => {
      window.removeEventListener('scroll', updateTooltipPosition, true);
      window.removeEventListener('resize', updateTooltipPosition);
    };
  }, [isVisible, layout, updateTooltipPosition]);

  useEffect(() => {
    return () => {
      clearShowTimeout();
      clearHideTimeout();
    };
  }, []);

  const arrowEdge = layout?.arrowEdge ?? arrowEdgeForPosition(position);

  const tip =
    isVisible && content !== null && content !== undefined ? (
      <div
        ref={tooltipRef}
        className={`arc-tooltip arc-tooltip--variant-${variant} arc-tooltip--arrow-edge-${arrowEdge}${showArrow ? '' : ' arc-tooltip--no-arrow'}${layout ? ' arc-tooltip--placed' : ''}`}
        style={{
          position: 'fixed',
          top: layout ? `${layout.top}px` : '-9999px',
          left: layout ? `${layout.left}px` : '-9999px',
          visibility: layout ? 'visible' : 'hidden'
        }}
      >
        <div className="arc-tooltip__inner">{content}</div>
        {showArrow && (
          <svg className="arc-tooltip__arrow" width="12" height="6" viewBox="0 0 12 6" aria-hidden>
            <polygon points="0,0 12,0 6,6" className="arc-tooltip__arrow-fill" />
          </svg>
        )}
      </div>
    ) : null;

  return (
    <Wrapper
      ref={wrapperRef as React.RefObject<HTMLDivElement & HTMLSpanElement>}
      className={`arc-tooltip-wrapper ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {tip ? createPortal(tip, document.body) : null}
    </Wrapper>
  );
}
