import { useCallback, useEffect, useRef, useState } from 'react';
import { ONBOARDING_ENTER_START_MS } from '../content/onboarding';
import type { OnboardingSetupStep } from '../services/appPreferences';
import { initAppPreferencesRuntime, patchAppPreferences } from '../services/appPreferencesRuntime';
import { getNavbarMetrics, invalidateLibraryCache, isLibraryConfigured } from '../services/db';

export function useOnboardingGate() {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const prefs = await initAppPreferencesRuntime();
      const libraryReady = await isLibraryConfigured();

      if (libraryReady && !prefs.onboardingSetupCompleted) {
        await patchAppPreferences({ onboardingSetupCompleted: true, onboardingSetupStep: 2 });
        if (!mounted) return;
        setNeedsSetup(false);
        setReady(true);
        return;
      }

      const showSetup = !libraryReady && !prefs.onboardingSetupCompleted;
      if (!mounted) return;
      setNeedsSetup(showSetup);
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { ready, needsSetup };
}

export function useOnboardingSetup(onComplete: () => void) {
  const [step, setStep] = useState<OnboardingSetupStep>(0);
  const [prefsReady, setPrefsReady] = useState(false);
  const [welcomeAnimating, setWelcomeAnimating] = useState(false);
  const [featuresEnterFromWelcome, setFeaturesEnterFromWelcome] = useState(false);
  const [featuresEnterStarted, setFeaturesEnterStarted] = useState(false);
  const [featuresAnimating, setFeaturesAnimating] = useState(false);
  const [libraryEnterFromFeatures, setLibraryEnterFromFeatures] = useState(false);
  const [libraryEnterStarted, setLibraryEnterStarted] = useState(false);
  const enterStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEnterStartTimer = useCallback(() => {
    if (enterStartTimerRef.current !== null) {
      clearTimeout(enterStartTimerRef.current);
      enterStartTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    void initAppPreferencesRuntime().then((prefs) => {
      setStep(prefs.onboardingSetupStep);
      setPrefsReady(true);
    });
  }, []);

  useEffect(() => () => clearEnterStartTimer(), [clearEnterStartTimer]);

  const scheduleEnterStart = useCallback((onStart: () => void) => {
    clearEnterStartTimer();
    enterStartTimerRef.current = setTimeout(() => {
      enterStartTimerRef.current = null;
      onStart();
    }, ONBOARDING_ENTER_START_MS);
  }, [clearEnterStartTimer]);

  const goToFeatures = useCallback(() => {
    setFeaturesEnterStarted(false);
    setFeaturesEnterFromWelcome(true);
    setWelcomeAnimating(true);
    scheduleEnterStart(() => setFeaturesEnterStarted(true));
  }, [scheduleEnterStart]);

  const finishWelcomeAnimation = useCallback(() => {
    clearEnterStartTimer();
    setStep(1);
    setWelcomeAnimating(false);
    setFeaturesEnterStarted(false);
    void patchAppPreferences({ onboardingSetupStep: 1 });
  }, [clearEnterStartTimer]);

  const goToLibrary = useCallback(() => {
    setLibraryEnterStarted(false);
    setLibraryEnterFromFeatures(true);
    setFeaturesAnimating(true);
    scheduleEnterStart(() => setLibraryEnterStarted(true));
  }, [scheduleEnterStart]);

  const finishFeaturesAnimation = useCallback(() => {
    clearEnterStartTimer();
    setStep(2);
    setFeaturesAnimating(false);
    setLibraryEnterStarted(false);
    void patchAppPreferences({ onboardingSetupStep: 2 });
  }, [clearEnterStartTimer]);

  const completeSetup = useCallback(async () => {
    await patchAppPreferences({ onboardingSetupCompleted: true, onboardingSetupStep: 2 });
    invalidateLibraryCache();
    await getNavbarMetrics();
    window.dispatchEvent(new CustomEvent('arc:library-changed'));
    onComplete();
  }, [onComplete]);

  return {
    step,
    prefsReady,
    welcomeAnimating,
    featuresEnterFromWelcome,
    featuresEnterStarted,
    featuresAnimating,
    libraryEnterFromFeatures,
    libraryEnterStarted,
    goToFeatures,
    finishWelcomeAnimation,
    finishFeaturesAnimation,
    goToLibrary,
    completeSetup
  };
}
