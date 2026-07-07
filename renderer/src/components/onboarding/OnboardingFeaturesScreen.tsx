import { useLayoutEffect, useRef, useState } from 'react';
import { ONBOARDING_FEATURES, ONBOARDING_KNOWLEDGE_BASE_URL } from '../../content/onboarding';
import { hydrateArcNavbarIcons } from '../layout/navbarIconHydrate';

type Props = {
  revealed?: boolean;
  animateEnter?: boolean;
  animating?: boolean;
  onAnimationEnd?: () => void;
  onContinue: () => void;
};

export default function OnboardingFeaturesScreen({
  revealed = true,
  animateEnter = false,
  animating = false,
  onAnimationEnd,
  onContinue
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!animateEnter && revealed);

  useLayoutEffect(() => {
    if (ref.current) void hydrateArcNavbarIcons(ref.current);
  }, []);

  useLayoutEffect(() => {
    if (!revealed) {
      setVisible(false);
      return;
    }
    if (!animateEnter) {
      setVisible(true);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [revealed, animateEnter]);

  const openKnowledgeBase = () => {
    if (window.arc?.openExternalUrl) {
      void window.arc.openExternalUrl(ONBOARDING_KNOWLEDGE_BASE_URL);
    }
  };

  const leavingClass = animating ? ' arc-onboarding-stage__hero--leaving' : '';

  return (
    <section
      ref={ref}
      className={`arc-onboarding-stage arc-onboarding-stage--features arc-ui-kit-scope${visible ? ' arc-onboarding-stage--revealed' : ''}${!animateEnter ? ' arc-onboarding-stage--instant' : ''}`}
      data-elevation="sunken"
      data-typo-tone="white"
      data-btn-size="l"
    >
      <div className={`arc-onboarding-stage__hero arc-onboarding-stage__hero--center${leavingClass}`}>
        <div className="arc-onboarding-stage__copy arc-onboarding-stage__copy--center">
          <h1 className="h1 arc-onboarding-stage__title">В чем преимущества</h1>
          <p className="text-l arc-onboarding-stage__subtitle">
            ARC — приложение для организации визуальных материалов без интернета. Создано для художников и
            дизайнеров с большими коллекциями референсов
          </p>
        </div>
        <button type="button" className="btn btn-brand btn-ds" onClick={onContinue} disabled={animating}>
          <span className="btn-ds__value">Начать проект</span>
          <span className="btn-ds__icon arc-icon-chevron arc-chevron-point-right" aria-hidden="true" />
        </button>
      </div>

      <div
        className={`arc-onboarding-features-row${animating ? ' arc-onboarding-features-row--rising' : ''}`}
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget || !animating) return;
          if (event.propertyName !== 'transform') return;
          onAnimationEnd?.();
        }}
      >
        {ONBOARDING_FEATURES.map((feature) => (
          <article key={feature.title} className="arc-onboarding-feature-card panel elevation-sunken">
            <span className={`arc-onboarding-feature-card__icon ${feature.iconClass}`} aria-hidden="true" />
            <div className="arc-onboarding-feature-card__content">
              <h2 className="h2 arc-onboarding-feature-card__title">{feature.title}</h2>
              <p className="text-l arc-onboarding-feature-card__description">{feature.description}</p>
            </div>
          </article>
        ))}
      </div>

      <button
        type="button"
        className={`btn btn-outline btn-ds arc-onboarding-knowledge-btn${leavingClass}`}
        onClick={openKnowledgeBase}
        disabled={animating}
      >
        <span className="btn-ds__value">База знаний ARC</span>
        <span className="btn-ds__icon arc-onboarding-knowledge-btn__icon" aria-hidden="true" />
      </button>
    </section>
  );
}
