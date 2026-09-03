import {
  resolveAutoStartSegment,
  type InterfaceTourSegment
} from './onboardingTour';

export type InterfaceTourRestPrefs = {
  onboardingTourCompleted: boolean;
  onboardingRestTourPending: boolean;
  onboardingRestTourOfferDismissed: boolean;
  onboardingRestTourStarted: boolean;
};

export function shouldAutoStartChromeOrFull(prefs: Pick<InterfaceTourRestPrefs, 'onboardingTourCompleted'>): boolean {
  return !prefs.onboardingTourCompleted;
}

export function shouldResumeRestTour(
  prefs: InterfaceTourRestPrefs,
  hasCards: boolean
): boolean {
  return (
    hasCards &&
    prefs.onboardingRestTourPending &&
    prefs.onboardingRestTourStarted &&
    !prefs.onboardingRestTourOfferDismissed
  );
}

export function shouldShowRestTourOffer(
  prefs: InterfaceTourRestPrefs,
  hasCards: boolean,
  tourActive: boolean
): boolean {
  return (
    !tourActive &&
    hasCards &&
    prefs.onboardingRestTourPending &&
    !prefs.onboardingRestTourOfferDismissed &&
    !prefs.onboardingRestTourStarted
  );
}

export function segmentAfterReplay(hasCards: boolean): InterfaceTourSegment {
  return resolveAutoStartSegment(hasCards);
}

export function restPrefsAfterChromePause(): Pick<
  InterfaceTourRestPrefs,
  | 'onboardingTourCompleted'
  | 'onboardingRestTourPending'
  | 'onboardingRestTourStarted'
> {
  return {
    onboardingTourCompleted: true,
    onboardingRestTourPending: true,
    onboardingRestTourStarted: false
  };
}

export function restPrefsAfterFullFinish(): InterfaceTourRestPrefs {
  return {
    onboardingTourCompleted: true,
    onboardingRestTourPending: false,
    onboardingRestTourOfferDismissed: false,
    onboardingRestTourStarted: false
  };
}

export function restPrefsAfterLater(): Pick<
  InterfaceTourRestPrefs,
  'onboardingRestTourOfferDismissed' | 'onboardingRestTourStarted'
> {
  return {
    onboardingRestTourOfferDismissed: true,
    onboardingRestTourStarted: false
  };
}

export function restPrefsAfterContinueOffer(): Pick<
  InterfaceTourRestPrefs,
  'onboardingRestTourStarted' | 'onboardingRestTourPending'
> {
  return {
    onboardingRestTourPending: true,
    onboardingRestTourStarted: true
  };
}

export function restPrefsAfterReplay(): InterfaceTourRestPrefs {
  return {
    onboardingTourCompleted: false,
    onboardingRestTourPending: false,
    onboardingRestTourOfferDismissed: false,
    onboardingRestTourStarted: false
  };
}
