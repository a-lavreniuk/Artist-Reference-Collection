export const ONBOARDING_KNOWLEDGE_BASE_URL =
  'https://arc-knowledge.tilda.ws/tdocs/arc-knowledge-base-9dc2pv4zdf18e47';

export const ONBOARDING_LOGO_SRC = '/onboarding/logo.svg';
export const ONBOARDING_WELCOME_GRID_SRC = '/onboarding/grid.png';
export const ONBOARDING_UI_IMAGE_SRC = '/onboarding/ui-Image.png';

export const ONBOARDING_WINDOW_WIDTH = 1280;
export const ONBOARDING_WINDOW_HEIGHT = 800;

/** Синхрон с `--arc-onboarding-welcome-exit` в index.css */
export const ONBOARDING_EXIT_MS = 3000;
/** Старт fade-in следующего шага — на половине exit transform */
export const ONBOARDING_ENTER_START_MS = ONBOARDING_EXIT_MS / 2;

export const ONBOARDING_DEFAULT_LIBRARY_NAME = 'Библиотека ARC';

export type OnboardingFeature = {
  iconClass: string;
  title: string;
  description: string;
};

export const ONBOARDING_FEATURES: OnboardingFeature[] = [
  {
    iconClass: 'arc-onboarding-feature-card__icon--search',
    title: 'Порядок в\u00A0хаосе',
    description:
      'Метки, категории, цвета и фильтры помогают быстро находить нужные материалы среди\u00A0тысяч файлов'
  },
  {
    iconClass: 'arc-onboarding-feature-card__icon--server',
    title: 'Без\u00A0интернета',
    description:
      'Файлы хранятся локально, прямо на\u00A0компьютере. Коллекция всегда под\u00A0рукой — даже без\u00A0сети и облаков'
  },
  {
    iconClass: 'arc-onboarding-feature-card__icon--whiteboard',
    title: 'Референсы на\u00A0холсте',
    description: 'Не просто храните изображения — стройте полноценные сцены, подборки и визуальные концепты'
  }
];
