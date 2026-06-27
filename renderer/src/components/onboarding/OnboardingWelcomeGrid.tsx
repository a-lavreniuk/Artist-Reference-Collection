import GalleryBottomShade from '../gallery/GalleryBottomShade';
import { ONBOARDING_WELCOME_GRID_SRC } from '../../content/onboarding';

type Props = {
  rising?: boolean;
  onTransitionEnd?: () => void;
};

export default function OnboardingWelcomeGrid({ rising, onTransitionEnd }: Props) {
  return (
    <div className={`arc-onboarding-welcome-grid${rising ? ' arc-onboarding-welcome-grid--rising' : ''}`} aria-hidden="true">
      <div className="arc-onboarding-welcome-grid__frame">
        <img
          src={ONBOARDING_WELCOME_GRID_SRC}
          alt=""
          className="arc-onboarding-welcome-grid__img"
          draggable={false}
          onTransitionEnd={(event) => {
            if (event.target !== event.currentTarget || !rising) return;
            if (event.propertyName !== 'transform') return;
            onTransitionEnd?.();
          }}
        />
        <GalleryBottomShade />
      </div>
    </div>
  );
}
