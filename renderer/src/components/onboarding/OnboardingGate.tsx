import { useEffect, useState, type ReactNode } from 'react';
import { dispatchInterfaceTourSetupCompleted } from './interfaceTourEvents';
import { useOnboardingGate } from '../../hooks/useOnboardingSetup';
import OnboardingSetupPage from './OnboardingSetupPage';

function RouteFallback() {
  return (
    <div className="arc-onboarding-boot panel elevation-default" role="status" aria-live="polite">
      <span className="loader" aria-hidden="true" />
    </div>
  );
}

type Props = {
  children: ReactNode;
};

export default function OnboardingGate({ children }: Props) {
  const { ready, needsSetup } = useOnboardingGate();
  const [setupDone, setSetupDone] = useState(false);
  const [pendingTourStart, setPendingTourStart] = useState(false);

  useEffect(() => {
    if (ready && !needsSetup) setSetupDone(true);
  }, [ready, needsSetup]);

  useEffect(() => {
    if (!ready || !needsSetup || setupDone) return;
    void window.arc?.setMainWindowOnboardingMode?.(true);
  }, [ready, needsSetup, setupDone]);

  useEffect(() => {
    if (!pendingTourStart || !setupDone) return;
    setPendingTourStart(false);
    dispatchInterfaceTourSetupCompleted();
  }, [pendingTourStart, setupDone]);

  if (!ready) return <RouteFallback />;
  if (needsSetup && !setupDone) {
    return (
      <OnboardingSetupPage
        onComplete={() => {
          void window.arc?.setMainWindowOnboardingMode?.(false);
          setSetupDone(true);
          setPendingTourStart(true);
        }}
      />
    );
  }
  return children;
}
