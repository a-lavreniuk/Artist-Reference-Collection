import InterfaceTourModal from './InterfaceTourModal';
import { useInterfaceTour } from '../../hooks/useInterfaceTour';

export default function InterfaceTourHost() {
  const tour = useInterfaceTour();

  return (
    <InterfaceTourModal
      open={tour.visible}
      stepIndex={tour.stepIndex}
      totalSteps={tour.totalSteps}
      body={tour.body}
      placement={tour.placement}
      anchorEl={tour.anchorEl}
      canGoBack={tour.canGoBack}
      isLastStep={tour.isLastStep}
      onSkip={tour.skipTour}
      onBack={tour.goBack}
      onContinue={tour.goForward}
    />
  );
}
