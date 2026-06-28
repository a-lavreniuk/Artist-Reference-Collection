import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ENABLED_INTERFACE_TOUR_STEPS,
  type InterfaceTourStep
} from '../content/onboardingTour';
import { useOpenCardUrl } from '../search/openCardUrl';
import { getNavbarMetrics, listCardsPage } from '../services/db';
import { patchAppPreferences, getAppPreferencesSync } from '../services/appPreferencesRuntime';
import { useAppPreferences } from './useAppPreferences';
import {
  resolveActivePathname,
  resolvePageRouteMarkerIds,
  waitForInterfaceTourAnchor,
  waitForRouteCommit,
  type PathnameReader
} from '../components/onboarding/interfaceTourAnchors';
import {
  ARC_INTERFACE_TOUR_REPLAY_EVENT,
  ARC_INTERFACE_TOUR_SETUP_COMPLETED_EVENT
} from '../components/onboarding/interfaceTourEvents';

const CARD_STEP_FIRST_INDEX = 11;
const CARD_STEP_LAST_INDEX = 14;
const STATS_STEP_INDEX = 15;

function resolveStepBody(step: InterfaceTourStep, stepIndex: number, libraryHasCards: boolean): string {
  const isCardStep = stepIndex >= CARD_STEP_FIRST_INDEX && stepIndex <= CARD_STEP_LAST_INDEX;
  if (isCardStep && !libraryHasCards && step.bodyEmptyLibrary) {
    return step.bodyEmptyLibrary;
  }
  return step.body;
}

function pageRouteMarkerIds(step: InterfaceTourStep): string[] {
  return resolvePageRouteMarkerIds(step.anchorId, step.fallbackAnchorId, step.fallbackAnchorIds);
}

function pathnameMatchesRoute(pathname: string, route: string): boolean {
  return pathname.startsWith(route);
}

export function useInterfaceTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const { prefs, ready } = useAppPreferences();
  const { openCardId, openCard, closeCard } = useOpenCardUrl();

  const navigateRef = useRef(navigate);
  const locationRef = useRef(location);
  const openCardRef = useRef(openCard);
  const closeCardRef = useRef(closeCard);
  const openCardIdRef = useRef(openCardId);
  const prepareGenerationRef = useRef(0);
  const tourCardIdRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);
  const openingTourCardRef = useRef(false);
  /** Автонавигация только после смены шага тура, не при ручном переключении вкладок. */
  const routeSyncRequestedRef = useRef(false);

  navigateRef.current = navigate;
  locationRef.current = location;
  openCardRef.current = openCard;
  closeCardRef.current = closeCard;
  openCardIdRef.current = openCardId;

  const getPathname = useCallback<PathnameReader>(() => locationRef.current.pathname, []);

  const tryAutoStartTour = useCallback(() => {
    const currentPrefs = getAppPreferencesSync();
    if (!currentPrefs.onboardingSetupCompleted || currentPrefs.onboardingTourCompleted) return false;
    autoStartedRef.current = true;
    routeSyncRequestedRef.current = true;
    setStepIndex(currentPrefs.onboardingTourStep);
    setActive(true);
    return true;
  }, []);

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [libraryHasCards, setLibraryHasCards] = useState(true);

  const navigateToTourRoute = useCallback((route: string) => {
    tourCardIdRef.current = null;
    openingTourCardRef.current = false;
    navigateRef.current({ pathname: route, search: '' }, { replace: true });
  }, []);

  const finishTour = useCallback(async () => {
    tourCardIdRef.current = null;
    openingTourCardRef.current = false;
    routeSyncRequestedRef.current = false;
    if (openCardIdRef.current) {
      closeCardRef.current();
    }
    setActive(false);
    setAnchorEl(null);
    setPreparing(false);
    await patchAppPreferences({ onboardingTourCompleted: true, onboardingTourStep: 0 });
  }, []);

  const skipTour = useCallback(() => {
    void finishTour();
  }, [finishTour]);

  useEffect(() => {
    if (!ready || !prefs || autoStartedRef.current) return;
    tryAutoStartTour();
  }, [prefs, ready, tryAutoStartTour]);

  useEffect(() => {
    const onSetupCompleted = () => {
      if (autoStartedRef.current) return;
      tryAutoStartTour();
    };
    window.addEventListener(ARC_INTERFACE_TOUR_SETUP_COMPLETED_EVENT, onSetupCompleted);
    return () => window.removeEventListener(ARC_INTERFACE_TOUR_SETUP_COMPLETED_EVENT, onSetupCompleted);
  }, [tryAutoStartTour]);

  useEffect(() => {
    const onReplay = () => {
      tourCardIdRef.current = null;
      openingTourCardRef.current = false;
      routeSyncRequestedRef.current = true;
      if (openCardIdRef.current) {
        closeCardRef.current();
      }
      void patchAppPreferences({ onboardingTourCompleted: false, onboardingTourStep: 0 });
      setStepIndex(0);
      setActive(true);
    };
    window.addEventListener(ARC_INTERFACE_TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(ARC_INTERFACE_TOUR_REPLAY_EVENT, onReplay);
  }, []);

  useEffect(() => {
    if (active) {
      routeSyncRequestedRef.current = true;
    }
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) {
      setPreparing(false);
      setAnchorEl(null);
      openingTourCardRef.current = false;
      return;
    }

    const step = ENABLED_INTERFACE_TOUR_STEPS[stepIndex];
    if (!step) return;

    const pathname = resolveActivePathname(getPathname);
    const isCardStep = stepIndex >= CARD_STEP_FIRST_INDEX && stepIndex <= CARD_STEP_LAST_INDEX;

    if (stepIndex >= STATS_STEP_INDEX && openCardId) {
      setPreparing(true);
      setAnchorEl(null);
      tourCardIdRef.current = null;
      openingTourCardRef.current = false;
      closeCardRef.current();
      return;
    }

    if (!pathnameMatchesRoute(pathname, step.route)) {
      if (!routeSyncRequestedRef.current) {
        setPreparing(false);
        setAnchorEl(null);
        return;
      }
      setPreparing(true);
      setAnchorEl(null);
      navigateToTourRoute(step.route);
      return;
    }

    routeSyncRequestedRef.current = false;

    const generation = ++prepareGenerationRef.current;

    void (async () => {
      setPreparing(true);
      setAnchorEl(null);

      try {
        if (generation !== prepareGenerationRef.current) return;

        await waitForRouteCommit(step.route, pageRouteMarkerIds(step), 12000, getPathname);
        if (generation !== prepareGenerationRef.current) return;

        let hasCards = true;
        if (isCardStep) {
          const metrics = await getNavbarMetrics();
          hasCards = (metrics?.totalCards ?? 0) > 0;
          if (generation === prepareGenerationRef.current) {
            setLibraryHasCards(hasCards);
          }
        }

        if (generation !== prepareGenerationRef.current) return;

        if (isCardStep && hasCards) {
          if (!pathnameMatchesRoute(resolveActivePathname(getPathname), '/gallery')) {
            navigateToTourRoute('/gallery');
            return;
          }

          await waitForRouteCommit('/gallery', ['gallery-grid', 'gallery-page'], 12000, getPathname);
          if (generation !== prepareGenerationRef.current) return;

          if (!openCardIdRef.current && !tourCardIdRef.current && !openingTourCardRef.current) {
            openingTourCardRef.current = true;
            const page = await listCardsPage({ offset: 0, limit: 1 });
            const firstId = page[0]?.id;
            if (generation !== prepareGenerationRef.current) return;
            if (firstId) {
              openCardRef.current(firstId);
              tourCardIdRef.current = firstId;
            } else {
              openingTourCardRef.current = false;
            }
            return;
          }

          if (openCardIdRef.current || tourCardIdRef.current) {
            if (openCardIdRef.current) {
              tourCardIdRef.current = openCardIdRef.current;
            }
            openingTourCardRef.current = false;
            await waitForRouteCommit(
              '/gallery',
              ['card-detail-fields', 'gallery-grid', 'gallery-page'],
              12000,
              getPathname
            );
          }
        }

        if (generation !== prepareGenerationRef.current) return;

        const resolved = await waitForInterfaceTourAnchor(
          step.anchorId,
          step.fallbackAnchorId,
          12000,
          step.fallbackAnchorIds,
          { routePrefix: step.route, getPathname }
        );
        if (generation !== prepareGenerationRef.current) return;

        setAnchorEl(resolved?.element ?? null);
        if (!resolved?.element) {
          const navbarHost = document.querySelector('.arc-navbar-host');
          if (navbarHost instanceof HTMLElement) {
            setAnchorEl(navbarHost);
          }
        }
      } finally {
        if (generation === prepareGenerationRef.current) {
          setPreparing(false);
          routeSyncRequestedRef.current = false;
        }
      }
    })();
  }, [
    active,
    closeCard,
    getPathname,
    location.pathname,
    location.search,
    navigateToTourRoute,
    openCardId,
    stepIndex
  ]);

  const goBack = useCallback(() => {
    openingTourCardRef.current = false;
    routeSyncRequestedRef.current = true;
    setStepIndex((current) => {
      const next = Math.max(0, current - 1);
      void patchAppPreferences({ onboardingTourStep: next });
      return next;
    });
  }, []);

  const goForward = useCallback(() => {
    if (stepIndex >= ENABLED_INTERFACE_TOUR_STEPS.length - 1) {
      void finishTour();
      return;
    }
    openingTourCardRef.current = false;
    routeSyncRequestedRef.current = true;
    const next = stepIndex + 1;
    setStepIndex(next);
    void patchAppPreferences({ onboardingTourStep: next });
  }, [finishTour, stepIndex]);

  const step = ENABLED_INTERFACE_TOUR_STEPS[stepIndex];
  const body = step ? resolveStepBody(step, stepIndex, libraryHasCards) : '';
  const visible = active && !preparing && Boolean(anchorEl) && Boolean(step);

  useEffect(() => {
    if (!active || visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') skipTour();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, skipTour, visible]);

  return {
    visible,
    stepIndex,
    totalSteps: ENABLED_INTERFACE_TOUR_STEPS.length,
    body,
    placement: step?.placement ?? 'bottom',
    anchorEl,
    canGoBack: stepIndex > 0,
    isLastStep: stepIndex >= ENABLED_INTERFACE_TOUR_STEPS.length - 1,
    skipTour,
    goBack,
    goForward
  };
}
