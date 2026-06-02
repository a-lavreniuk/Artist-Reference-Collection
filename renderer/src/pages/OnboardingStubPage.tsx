import { useEffect, useLayoutEffect, useRef } from 'react';
import { hydrateArcNavbarIcons } from '../components/layout/navbarIconHydrate';

type FeatureItem = {
  iconClass: string;
  title: string;
  description: string;
};

const FEATURES: FeatureItem[] = [
  {
    iconClass: 'arc-icon-folder-open',
    title: 'Коллекции',
    description: 'Можно организовывать тематические коллекции.'
  },
  {
    iconClass: 'arc-icon-tag',
    title: 'Метки',
    description: 'Продвинутая система категоризации метками.'
  },
  {
    iconClass: 'arc-icon-server',
    title: 'Всё локально',
    description: 'Файлы хранятся локально, прямо на компьютере.'
  },
  {
    iconClass: 'arc-icon-bookmark',
    title: 'Мудборд',
    description: 'Можно собирать мудборд-доску для актуальных проектов.'
  }
];

export default function OnboardingStubPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = document.body;
    const prev = body.getAttribute('data-elevation');
    body.setAttribute('data-elevation', 'sunken');
    return () => {
      if (prev) body.setAttribute('data-elevation', prev);
      else body.removeAttribute('data-elevation');
    };
  }, []);

  useLayoutEffect(() => {
    if (rootRef.current) {
      void hydrateArcNavbarIcons(rootRef.current);
    }
  }, []);

  const noop = () => {};

  return (
    <div
      ref={rootRef}
      className="arc-onboarding"
      data-btn-size="m"
      data-arc-icon-size="xl"
    >
      <div className="arc-onboarding-welcome">
        <div className="arc-onboarding-header">
          <div className="arc-onboarding-title">
            <h1 className="h1">Добро пожаловать в ARC</h1>
            <p className="text-l arc-onboarding-description">
              ARC — приложение для организации визуальных материалов без интернета. Создано для художников и
              дизайнеров с большими коллекциями референсов.
            </p>
          </div>
          <button type="button" className="btn btn-brand btn-ds" onClick={noop}>
            <span className="btn-ds__value">Начать проект</span>
            <span className="btn-ds__icon arc-icon-folder-open" aria-hidden="true"></span>
          </button>
        </div>

        <div className="arc-onboarding-features">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="arc-onboarding-feature panel elevation-sunken">
              <span
                className={`arc-onboarding-feature__icon ${feature.iconClass}`}
                aria-hidden="true"
              ></span>
              <div className="arc-onboarding-feature__content">
                <h2 className="h2">{feature.title}</h2>
                <p className="text-l arc-onboarding-feature__description">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-ghost btn-ds" onClick={noop}>
          <span className="btn-ds__value">Восстановить резервную копию</span>
        </button>
      </div>
    </div>
  );
}
