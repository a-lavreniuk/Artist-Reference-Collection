import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  INTERFACE_TOUR_REST_OFFER_BODY,
  isCardTourStep,
  needsCardOverlayTourStep,
  resolveAutoStartSegment,
  shouldIncludeThanksStep,
  stepsForSegment,
  type InterfaceTourSegment,
  type InterfaceTourStep
} from '../content/onboardingTour';
import {
  restPrefsAfterChromePause,
  restPrefsAfterContinueOffer,
  restPrefsAfterFullFinish,
  restPrefsAfterLater,
  shouldAutoStartChromeOrFull,
  shouldResumeRestTour,
  shouldShowRestTourOffer
} from '../content/interfaceTourSession';
import { useOpenCardUrl } from '../search/openCardUrl';
import { getNavbarMetrics, listCardsPage } from '../services/db';
import { ARC_CARDS_CHANGED_EVENT } from '../services/db/events';
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
import { getManualSectionNavigationEpoch } from '../search/sectionNavigation';

function resolveStepBody(step: InterfaceTourStep, libraryHasCards: boolean): string {
  if (!libraryHasCards && step.bodyEmptyLibrary) return step.bodyEmptyLibrary;
  return step.body;
}

function pageRouteMarkerIds(step: InterfaceTourStep): string[] {
  return resolvePageRouteMarkerIds(step.anchorId, step.fallbackAnchorId, step.fallbackAnchorIds);
}

function pathnameMatchesRoute(pathname: string, route: string): boolean {
  return pathname.startsWith(route);
}

const OFFER_STEP: InterfaceTourStep = {
  id: 'rest_offer',
  catalogIds: [],
  route: '/gallery',
  anchorId: 'gallery-first-card',
  fallbackAnchorId: 'gallery-grid',
  fallbackAnchorIds: ['gallery-page'],
  placement: 'top',
  body: INTERFACE_TOUR_REST_OFFER_BODY,
  enabled: true
};

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
  /** Пользователь ушёл с маршрута шага тура вручную — не откатывать на step.route. */
  const userOverrodeTourRouteRef = useRef(false);
  const manualSectionNavEpochRef = useRef(getManualSectionNavigationEpoch());

  navigateRef.current = navigate;
  locationRef.current = location;
  openCardRef.current = openCard;
  closeCardRef.current = closeCard;
  openCardIdRef.current = openCardId;

  const getPathname = useCallback<PathnameReader>(() => locationRef.current.pathname, []);

  const [active, setActive] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [segment, setSegment] = useState<InterfaceTourSegment>('chrome');
  const [stepIndex, setStepIndex] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [libraryHasCards, setLibraryHasCards] = useState(false);
  const [includeThanks, setIncludeThanks] = useState(false);
  const autoStartInFlightRef = useRef(false);

  const steps = stepsForSegment(segment, { includeThanks });
  const step = offerOpen ? OFFER_STEP : steps[stepIndex];

  const navigateToTourRoute = useCallback((route: string) => {
    tourCardIdRef.current = null;
    openingTourCardRef.current = false;
    navigateRef.current({ pathname: route, search: '' }, { replace: true });
  }, []);

  const closeTourUi = useCallback(() => {
    tourCardIdRef.current = null;
    openingTourCardRef.current = false;
    routeSyncRequestedRef.current = false;
    if (openCardIdRef.current) {
      closeCardRef.current();
    }
    setActive(false);
    setOfferOpen(false);
    setAnchorEl(null);
    setPreparing(false);
  }, []);

  const finishTour = useCallback(async () => {
    closeTourUi();
    await patchAppPreferences({
      onboardingTourStep: 0,
      ...restPrefsAfterFullFinish()
    });
  }, [closeTourUi]);

  const pauseAfterChrome = useCallback(async () => {
    closeTourUi();
    await patchAppPreferences({
      onboardingTourStep: 0,
      ...restPrefsAfterChromePause()
    });
  }, [closeTourUi]);

  const skipTour = useCallback(() => {
    if (segment === 'chrome') {
      void pauseAfterChrome();
      return;
    }
    void finishTour();
  }, [finishTour, pauseAfterChrome, segment]);

  const startTour = useCallback(
    (nextSegment: InterfaceTourSegment, nextStepIndex: number, replay = false) => {
      const nextIncludeThanks = shouldIncludeThanksStep({ replay, segment: nextSegment });
      const maxIndex = Math.max(0, stepsForSegment(nextSegment, { includeThanks: nextIncludeThanks }).length - 1);
      const safeIndex = Math.min(Math.max(0, nextStepIndex), maxIndex);
      autoStartedRef.current = true;
      userOverrodeTourRouteRef.current = false;
      routeSyncRequestedRef.current = true;
      manualSectionNavEpochRef.current = getManualSectionNavigationEpoch();
      setOfferOpen(false);
      setIncludeThanks(nextIncludeThanks);
      setSegment(nextSegment);
      setStepIndex(safeIndex);
      setActive(true);
    },
    []
  );

  const tryAutoStartTour = useCallback(async () => {
    const currentPrefs = getAppPreferencesSync();
    if (!currentPrefs.onboardingSetupCompleted) return false;
    if (autoStartedRef.current || autoStartInFlightRef.current) return false;

    autoStartInFlightRef.current = true;
    try {
      const metrics = await getNavbarMetrics();
      const hasCards = (metrics?.totalCards ?? 0) > 0;
      setLibraryHasCards(hasCards);

      if (shouldResumeRestTour(currentPrefs, hasCards)) {
        startTour('rest', currentPrefs.onboardingTourStep);
        return true;
      }

      if (!shouldAutoStartChromeOrFull(currentPrefs)) return false;
      startTour(resolveAutoStartSegment(hasCards), currentPrefs.onboardingTourStep);
      return true;
    } finally {
      autoStartInFlightRef.current = false;
    }
  }, [startTour]);

  const dismissRestOffer = useCallback(() => {
    setOfferOpen(false);
    setAnchorEl(null);
    setPreparing(false);
    void patchAppPreferences(restPrefsAfterLater());
  }, []);

  const continueRestOffer = useCallback(() => {
    void patchAppPreferences({
      onboardingTourStep: 0,
      ...restPrefsAfterContinueOffer()
    });
    startTour('rest', 0);
  }, [startTour]);

  useEffect(() => {
    if (!ready || !prefs || autoStartedRef.current) return;
    void tryAutoStartTour();
  }, [prefs, ready, tryAutoStartTour]);

  useEffect(() => {
    const onSetupCompleted = () => {
      if (autoStartedRef.current) return;
      void tryAutoStartTour();
    };
    window.addEventListener(ARC_INTERFACE_TOUR_SETUP_COMPLETED_EVENT, onSetupCompleted);
    return () => window.removeEventListener(ARC_INTERFACE_TOUR_SETUP_COMPLETED_EVENT, onSetupCompleted);
  }, [tryAutoStartTour]);

  useEffect(() => {
    const onReplay = () => {
      tourCardIdRef.current = null;
      openingTourCardRef.current = false;
      userOverrodeTourRouteRef.current = false;
      routeSyncRequestedRef.current = true;
      manualSectionNavEpochRef.current = getManualSectionNavigationEpoch();
      if (openCardIdRef.current) {
        closeCardRef.current();
      }
      void (async () => {
        const metrics = await getNavbarMetrics();
        const hasCards = (metrics?.totalCards ?? 0) > 0;
        setLibraryHasCards(hasCards);
        await patchAppPreferences({
          onboardingTourCompleted: false,
          onboardingTourStep: 0,
          onboardingRestTourPending: false,
          onboardingRestTourOfferDismissed: false,
          onboardingRestTourStarted: false
        });
        startTour(resolveAutoStartSegment(hasCards), 0, true);
      })();
    };
    window.addEventListener(ARC_INTERFACE_TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(ARC_INTERFACE_TOUR_REPLAY_EVENT, onReplay);
  }, [startTour]);

  useEffect(() => {
    const refreshCards = () => {
      void getNavbarMetrics().then((metrics) => {
        setLibraryHasCards((metrics?.totalCards ?? 0) > 0);
      });
    };
    refreshCards();
    window.addEventListener(ARC_CARDS_CHANGED_EVENT, refreshCards);
    return () => window.removeEventListener(ARC_CARDS_CHANGED_EVENT, refreshCards);
  }, []);

  useEffect(() => {
    if (!ready || !prefs || active) return;
    if (!shouldShowRestTourOffer(prefs, libraryHasCards, active)) {
      if (!prefs.onboardingRestTourPending || prefs.onboardingRestTourOfferDismissed) {
        setOfferOpen(false);
      }
      return;
    }
    setOfferOpen(true);
    routeSyncRequestedRef.current = true;
    userOverrodeTourRouteRef.current = false;
    manualSectionNavEpochRef.current = getManualSectionNavigationEpoch();
  }, [active, libraryHasCards, prefs, ready]);

  useEffect(() => {
    const preparingOfferOrStep = active || offerOpen;
    if (!preparingOfferOrStep) {
      setPreparing(false);
      setAnchorEl(null);
      openingTourCardRef.current = false;
      return;
    }

    const currentStep = offerOpen ? OFFER_STEP : stepsForSegment(segment, { includeThanks })[stepIndex];
    if (!currentStep) return;

    const pathname = resolveActivePathname(getPathname);
    const isCardStep = isCardTourStep(currentStep);
    const needsOverlay = needsCardOverlayTourStep(currentStep);
    const manualSectionNavEpoch = getManualSectionNavigationEpoch();
    if (manualSectionNavEpoch !== manualSectionNavEpochRef.current) {
      manualSectionNavEpochRef.current = manualSectionNavEpoch;
      routeSyncRequestedRef.current = false;
      userOverrodeTourRouteRef.current = true;
      prepareGenerationRef.current += 1;
      openingTourCardRef.current = false;
      setPreparing(false);
      setAnchorEl(null);
      return;
    }

    if (
      (currentStep.id === 'card_open' || currentStep.id === 'bug_report' || currentStep.id === 'thanks') &&
      openCardId
    ) {
      setPreparing(true);
      setAnchorEl(null);
      tourCardIdRef.current = null;
      openingTourCardRef.current = false;
      closeCardRef.current();
      return;
    }

    if (!pathnameMatchesRoute(pathname, currentStep.route)) {
      if (!routeSyncRequestedRef.current || userOverrodeTourRouteRef.current) {
        prepareGenerationRef.current += 1;
        openingTourCardRef.current = false;
        routeSyncRequestedRef.current = false;
        setPreparing(false);
        setAnchorEl(null);
        return;
      }
      setPreparing(true);
      setAnchorEl(null);
      navigateToTourRoute(currentStep.route);
      return;
    }

    userOverrodeTourRouteRef.current = false;
    routeSyncRequestedRef.current = false;

    const generation = ++prepareGenerationRef.current;

    void (async () => {
      setPreparing(true);
      setAnchorEl(null);

      try {
        if (generation !== prepareGenerationRef.current) return;

        await waitForRouteCommit(currentStep.route, pageRouteMarkerIds(currentStep), 12000, getPathname);
        if (generation !== prepareGenerationRef.current) return;

        let hasCards = libraryHasCards;
        if (isCardStep || offerOpen) {
          const metrics = await getNavbarMetrics();
          hasCards = (metrics?.totalCards ?? 0) > 0;
          if (generation === prepareGenerationRef.current) {
            setLibraryHasCards(hasCards);
          }
        }

        if (generation !== prepareGenerationRef.current) return;

        if (needsOverlay && hasCards) {
          if (!pathnameMatchesRoute(resolveActivePathname(getPathname), currentStep.route)) {
            if (!routeSyncRequestedRef.current || userOverrodeTourRouteRef.current) return;
            navigateToTourRoute(currentStep.route);
            return;
          }

          await waitForRouteCommit(currentStep.route, ['gallery-grid', 'gallery-page'], 12000, getPathname);
          if (generation !== prepareGenerationRef.current) return;

          if (!openCardIdRef.current && !tourCardIdRef.current && !openingTourCardRef.current) {
            if (!routeSyncRequestedRef.current || userOverrodeTourRouteRef.current) return;
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
          currentStep.anchorId,
          currentStep.fallbackAnchorId,
          12000,
          currentStep.fallbackAnchorIds,
          { routePrefix: currentStep.route, getPathname }
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
    includeThanks,
    libraryHasCards,
    location.pathname,
    location.search,
    navigateToTourRoute,
    offerOpen,
    openCardId,
    segment,
    stepIndex
  ]);

  const goBack = useCallback(() => {
    openingTourCardRef.current = false;
    userOverrodeTourRouteRef.current = false;
    routeSyncRequestedRef.current = true;
    setStepIndex((current) => {
      const next = Math.max(0, current - 1);
      void patchAppPreferences({ onboardingTourStep: next });
      return next;
    });
  }, []);

  const goForward = useCallback(() => {
    const currentSteps = stepsForSegment(segment, { includeThanks });
    if (stepIndex >= currentSteps.length - 1) {
      if (segment === 'chrome') {
        void pauseAfterChrome();
        return;
      }
      void finishTour();
      return;
    }
    openingTourCardRef.current = false;
    userOverrodeTourRouteRef.current = false;
    routeSyncRequestedRef.current = true;
    const next = stepIndex + 1;
    setStepIndex(next);
    void patchAppPreferences({ onboardingTourStep: next });
  }, [finishTour, includeThanks, pauseAfterChrome, segment, stepIndex]);

  const body = offerOpen
    ? INTERFACE_TOUR_REST_OFFER_BODY
    : step
      ? resolveStepBody(step, libraryHasCards)
      : '';
  const visible = (active || offerOpen) && !preparing && Boolean(anchorEl) && Boolean(step);

  useEffect(() => {
    if ((active || offerOpen) && visible) return;
    if (!active && !offerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (offerOpen) dismissRestOffer();
        else skipTour();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, dismissRestOffer, offerOpen, skipTour, visible]);

  return {
    visible,
    variant: offerOpen ? ('offer' as const) : ('step' as const),
    spotlight: step?.id !== 'thanks',
    stepIndex,
    totalSteps: steps.length,
    body,
    placement: step?.placement ?? 'bottom',
    anchorEl,
    canGoBack: !offerOpen && stepIndex > 0,
    isLastStep: !offerOpen && stepIndex >= steps.length - 1,
    skipTour: offerOpen ? dismissRestOffer : skipTour,
    goBack,
    goForward: offerOpen ? continueRestOffer : goForward
  };
}
