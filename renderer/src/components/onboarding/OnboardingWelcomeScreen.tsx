import { useLayoutEffect, useRef } from 'react';
import { ONBOARDING_LOGO_SRC } from '../../content/onboarding';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';
import OnboardingWelcomeGrid from './OnboardingWelcomeGrid';

type Props = {
  animating: boolean;
  onContinue: () => void;
  onAnimationEnd: () => void;
};

export default function OnboardingWelcomeScreen({ animating, onContinue, onAnimationEnd }: Props) {
  const heroRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (heroRef.current) void hydrateArcNavbarIcons(heroRef.current);
  }, []);

  return (
    <section
      className="arc-onboarding-stage arc-onboarding-stage--welcome arc-ui-kit-scope"
      data-elevation="sunken"
      data-typo-tone="white"
      data-btn-size="l"
    >
      <div
        ref={heroRef}
        className={`arc-onboarding-stage__hero${animating ? ' arc-onboarding-stage__hero--leaving' : ''}`}
      >
        <img src={ONBOARDING_LOGO_SRC} alt="" className="arc-onboarding-logo" width={128} height={128} />
        <div className="arc-onboarding-stage__copy">
          <h1 className="h1 arc-onboarding-stage__title">Добро пожаловать в ARC</h1>
          <p className="text-l arc-onboarding-stage__subtitle">
            Новый способ хранения, быстрого поиска и систематизации референсов в одном месте
          </p>
        </div>
        <p className="text-s arc-onboarding-legal">
          Используя ARC, вы соглашаетесь с{' '}
          <span className="arc-onboarding-legal__link">Лицензионным соглашением</span> и{' '}
          <span className="arc-onboarding-legal__link">Политикой конфиденциальности</span>
        </p>
        <button type="button" className="btn btn-brand btn-ds" onClick={onContinue} disabled={animating}>
          <span className="btn-ds__value">Преимущества ARC</span>
          <span className="btn-ds__icon arc-icon-chevron arc-chevron-point-right" aria-hidden="true" />
        </button>
      </div>
      <OnboardingWelcomeGrid rising={animating} onTransitionEnd={onAnimationEnd} />
    </section>
  );
}
