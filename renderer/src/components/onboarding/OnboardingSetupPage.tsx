import OnboardingFeaturesScreen from './OnboardingFeaturesScreen';
import OnboardingLayout from './OnboardingLayout';
import OnboardingLibraryScreen from './OnboardingLibraryScreen';
import OnboardingWelcomeScreen from './OnboardingWelcomeScreen';
import { useOnboardingSetup } from '../../hooks/useOnboardingSetup';

type Props = {
  onComplete: () => void;
};

export default function OnboardingSetupPage({ onComplete }: Props) {
  const {
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
  } = useOnboardingSetup(onComplete);

  if (!prefsReady) {
    return (
      <div className="arc-onboarding-boot panel elevation-default" role="status" aria-live="polite">
        <span className="loader" aria-hidden="true" />
      </div>
    );
  }

  return (
    <OnboardingLayout standalone>
      {(step === 2 || featuresAnimating) ? (
        <OnboardingLibraryScreen
          revealed={(step >= 2 && !featuresAnimating) || libraryEnterStarted}
          animateEnter={libraryEnterFromFeatures}
          onComplete={() => void completeSetup()}
        />
      ) : null}
      {(step === 1 || welcomeAnimating) ? (
        <OnboardingFeaturesScreen
          revealed={(step >= 1 && !welcomeAnimating) || featuresEnterStarted}
          animateEnter={featuresEnterFromWelcome}
          animating={featuresAnimating}
          onAnimationEnd={finishFeaturesAnimation}
          onContinue={goToLibrary}
        />
      ) : null}
      {step === 0 ? (
        <OnboardingWelcomeScreen
          animating={welcomeAnimating}
          onContinue={goToFeatures}
          onAnimationEnd={finishWelcomeAnimation}
        />
      ) : null}
    </OnboardingLayout>
  );
}
