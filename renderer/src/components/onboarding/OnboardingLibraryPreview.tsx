import GalleryBottomShade from '../gallery/GalleryBottomShade';
import { ONBOARDING_UI_IMAGE_SRC } from '../../content/onboarding';

type Props = {
  rising?: boolean;
};

export default function OnboardingLibraryPreview({ rising }: Props) {
  return (
    <div className={`arc-onboarding-library-preview${rising ? ' arc-onboarding-library-preview--rising' : ''}`} aria-hidden="true">
      <div className="arc-onboarding-library-preview__frame">
        <img
          src={ONBOARDING_UI_IMAGE_SRC}
          alt=""
          className="arc-onboarding-library-preview__img"
          draggable={false}
        />
        <GalleryBottomShade />
      </div>
    </div>
  );
}
