import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  formatInterfaceTourProgress,
  INTERFACE_TOUR_BACK_LABEL,
  INTERFACE_TOUR_CONTINUE_LABEL,
  INTERFACE_TOUR_FINISH_LABEL,
  INTERFACE_TOUR_MODAL_TITLE,
  INTERFACE_TOUR_SKIP_LABEL,
  type InterfaceTourPlacement
} from '../../content/onboardingTour';
import { useAnchoredTourLayout } from '../../hooks/useAnchoredTourLayout';
import { useInterfaceTourTheme } from '../../hooks/useInterfaceTourTheme';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import './interfaceTourTheme.css';

type Props = {
  open: boolean;
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

export default function InterfaceTourModal({
  open,
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

  useLayoutEffect(() => {
    if (hostRef.current) void hydrateArcNavbarIcons(hostRef.current);
  }, [open, stepIndex, body]);

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
  const continueLabel = isLastStep ? INTERFACE_TOUR_FINISH_LABEL : INTERFACE_TOUR_CONTINUE_LABEL;

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
      <button type="button" className="context-menu-backdrop" aria-label="Пропустить обучение" onClick={onSkip} />
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
            <p className="arc-modal__subtitle">{progress}</p>
          </div>
        </header>
        <div className="arc-modal__body">
          <div className="arc-modal__slot">
            <p className="arc-modal__slot-text typo-p-m" id="arcInterfaceTourBody">
              {body}
            </p>
          </div>
        </div>
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
      </section>
    </div>,
    document.body
  );
}
