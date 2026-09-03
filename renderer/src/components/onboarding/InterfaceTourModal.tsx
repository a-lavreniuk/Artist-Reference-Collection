import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatInterfaceTourProgress,
  INTERFACE_TOUR_BACK_LABEL,
  INTERFACE_TOUR_CONTINUE_LABEL,
  INTERFACE_TOUR_FINISH_LABEL,
  INTERFACE_TOUR_LATER_LABEL,
  INTERFACE_TOUR_MODAL_TITLE,
  INTERFACE_TOUR_SKIP_LABEL,
  type InterfaceTourPlacement
} from '../../content/onboardingTour';
import { useAnchoredTourLayout } from '../../hooks/useAnchoredTourLayout';
import { useInterfaceTourTheme } from '../../hooks/useInterfaceTourTheme';
import {
  computeTourSpotlightHole,
  paintTourSpotlight,
  readCssLengthPx,
  readElementRadiusPx,
  readTourSpotlightBlurPx,
  readTourSpotlightPaddingPx,
  TOUR_SPOTLIGHT_RADIUS_FALLBACK_PX,
  type TourSpotlightHole
} from '../../hooks/tourSpotlightHole';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import './interfaceTourTheme.css';

type Props = {
  open: boolean;
  variant?: 'step' | 'offer';
  spotlight?: boolean;
  stepIndex: number;
  totalSteps: number;
  body: string;
  placement: InterfaceTourPlacement;
  anchorEl: HTMLElement | null;
  canGoBack: boolean;
  isLastStep: boolean;
  onSkip: () => void;
  onBack: () => void;
  onContinue: () => void;
};

function useTourSpotlightHole(open: boolean, anchorEl: HTMLElement | null): TourSpotlightHole | null {
  const [hole, setHole] = useState<TourSpotlightHole | null>(null);

  const updateHole = useCallback(() => {
    if (!open || !anchorEl) {
      setHole(null);
      return;
    }
    const padding = readTourSpotlightPaddingPx();
    const fallbackRadius = readCssLengthPx('--radius-s', TOUR_SPOTLIGHT_RADIUS_FALLBACK_PX);
    const radius = readElementRadiusPx(anchorEl, fallbackRadius);
    const next = computeTourSpotlightHole(anchorEl.getBoundingClientRect(), padding, radius);
    setHole((prev) => {
      if (
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height &&
        prev.radius === next.radius
      ) {
        return prev;
      }
      return next;
    });
  }, [anchorEl, open]);

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setHole(null);
      return;
    }

    updateHole();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateHole();
          })
        : null;
    ro?.observe(anchorEl);
    window.addEventListener('scroll', updateHole, true);
    window.addEventListener('resize', updateHole);
    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', updateHole, true);
      window.removeEventListener('resize', updateHole);
    };
  }, [anchorEl, open, updateHole]);

  return hole;
}

function TourSpotlightShade({ hole }: { hole: TourSpotlightHole }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paint = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintTourSpotlight(
        ctx,
        { width, height },
        hole,
        readTourSpotlightBlurPx(),
        getComputedStyle(canvas).color
      );
    };

    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
  }, [hole]);

  return <canvas ref={canvasRef} className="arc-interface-tour-spotlight__shade" aria-hidden="true" />;
}

export default function InterfaceTourModal({
  open,
  variant = 'step',
  spotlight = true,
  stepIndex,
  totalSteps,
  body,
  placement,
  anchorEl,
  canGoBack,
  isLastStep,
  onSkip,
  onBack,
  onContinue
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const tourTheme = useInterfaceTourTheme();
  const layout = useAnchoredTourLayout(open, anchorEl, modalRef, placement);
  const hole = useTourSpotlightHole(open && spotlight, anchorEl);
  const isOffer = variant === 'offer';

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [open, stepIndex, body, variant]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onSkip]);

  if (!open || !anchorEl) return null;

  const progress = formatInterfaceTourProgress(stepIndex, totalSteps);
  const continueLabel = isOffer
    ? INTERFACE_TOUR_CONTINUE_LABEL
    : isLastStep
      ? INTERFACE_TOUR_FINISH_LABEL
      : INTERFACE_TOUR_CONTINUE_LABEL;
  const skipLabel = isOffer ? INTERFACE_TOUR_LATER_LABEL : INTERFACE_TOUR_SKIP_LABEL;
  const skipAria = isOffer ? INTERFACE_TOUR_LATER_LABEL : 'Пропустить обучение';

  return createPortal(
    <div
      ref={hostRef}
      className="arc-interface-tour-host arc-ui-kit-scope"
      data-tour-theme={tourTheme}
      data-elevation="raised"
      data-typo-tone="white"
      data-btn-size="s"
      aria-hidden="false"
    >
      <button
        type="button"
        className={`arc-interface-tour-spotlight${spotlight ? '' : ' arc-interface-tour-spotlight--dim'}`}
        aria-label={skipAria}
        onClick={onSkip}
      />
      {spotlight && hole ? (
        <>
          <TourSpotlightShade hole={hole} />
          <div
            className="arc-interface-tour-spotlight__hole"
            aria-hidden="true"
            style={{
              top: `${hole.top}px`,
              left: `${hole.left}px`,
              width: `${hole.width}px`,
              height: `${hole.height}px`,
              borderRadius: `${hole.radius}px`
            }}
          />
        </>
      ) : null}
      <section
        ref={modalRef}
        className="arc-modal arc-interface-tour-modal"
        data-elevation="raised"
        data-typo-tone="white"
        data-input-size="s"
        data-btn-size="s"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcInterfaceTourTitle"
        aria-describedby="arcInterfaceTourBody"
        style={
          layout
            ? {
                top: `${layout.top}px`,
                left: `${layout.left}px`
              }
            : { visibility: 'hidden' as const }
        }
        onClick={(event) => event.stopPropagation()}
      >
        <header className="arc-modal__header arc-modal__header--title">
          <div className="arc-modal__title-block">
            <h3 className="arc-modal__title" id="arcInterfaceTourTitle">
              {INTERFACE_TOUR_MODAL_TITLE}
            </h3>
            {isOffer ? null : <p className="arc-modal__subtitle">{progress}</p>}
          </div>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text text-m" id="arcInterfaceTourBody">
              {body}
            </p>
          </div>
        </div>
        {isOffer ? (
          <footer className="arc-modal__footer arc-modal__footer--actions-2">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onSkip}>
              <span className="btn-ds__value">{skipLabel}</span>
            </button>
            <button type="button" className="btn btn-brand btn-ds btn-s" onClick={onContinue}>
              <span className="btn-ds__value">{continueLabel}</span>
            </button>
          </footer>
        ) : (
          <footer className="arc-modal__footer arc-modal__footer--actions-3">
            <button type="button" className="btn btn-outline btn-ds btn-s" onClick={onSkip}>
              <span className="btn-ds__value">{INTERFACE_TOUR_SKIP_LABEL}</span>
            </button>
            <div className="arc-modal__footer-right">
              <button
                type="button"
                className="btn btn-outline btn-ds btn-s"
                disabled={!canGoBack}
                onClick={onBack}
              >
                <span className="btn-ds__value">{INTERFACE_TOUR_BACK_LABEL}</span>
              </button>
              <button type="button" className="btn btn-brand btn-ds btn-s" onClick={onContinue}>
                <span className="btn-ds__value">{continueLabel}</span>
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>,
    document.body
  );
}
