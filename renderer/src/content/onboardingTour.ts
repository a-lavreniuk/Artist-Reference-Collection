/**
 * Тур «Знакомство с интерфейсом» (блок 2 онбординга).
 *
 * Требования к формулировкам (задача AnyType «Онбординг», Figma 1654:31237):
 * — кратко о назначении раздела, без перечисления каждой кнопки;
 * — названия элементов интерфейса в «ёлочках», как в UI;
 * — один абзац на шаг (Paragraph/M), нейтральный дружелюбный тон;
 * — неразрывные пробелы после коротких предлогов и союзов (\u00A0).
 */

import { ONBOARDING_KNOWLEDGE_BASE_URL } from './onboarding';

export type InterfaceTourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type InterfaceTourStep = {
  id: string;
  catalogIds: readonly string[];
  route: string;
  anchorId: string;
  fallbackAnchorId?: string;
  /** Дополнительные fallback-якоря по приоритету (после fallbackAnchorId). */
  fallbackAnchorIds?: readonly string[];
  placement: InterfaceTourPlacement;
  /** Основной текст шага в теле модалки */
  body: string;
  /** Если библиотека пуста (шаги карточки) */
  bodyEmptyLibrary?: string;
  enabled: boolean;
};

export const INTERFACE_TOUR_MODAL_TITLE = 'Знакомство';

export const INTERFACE_TOUR_SKIP_LABEL = 'Пропустить';
export const INTERFACE_TOUR_BACK_LABEL = 'Вернуться';
export const INTERFACE_TOUR_CONTINUE_LABEL = 'Продолжить';
export const INTERFACE_TOUR_FINISH_LABEL = 'Готово';
export const INTERFACE_TOUR_LATER_LABEL = 'Позже';

export const INTERFACE_TOUR_REST_OFFER_BODY =
  'В\u00A0библиотеке уже есть карточки. Дальше — как открыть материал и\u00A0какие поля и\u00A0действия есть в\u00A0просмотре';

export type InterfaceTourSegment = 'chrome' | 'rest' | 'full';

export const INTERFACE_TOUR_CARD_STEP_IDS = [
  'card_open',
  'card_fields',
  'card_actions'
] as const;

export const INTERFACE_TOUR_OVERLAY_STEP_IDS = ['card_fields', 'card_actions'] as const;

export const INTERFACE_TOUR_TRAILING_STEP_IDS = ['bug_report'] as const;

const CARD_STEP_ID_SET = new Set<string>(INTERFACE_TOUR_CARD_STEP_IDS);
const OVERLAY_STEP_ID_SET = new Set<string>(INTERFACE_TOUR_OVERLAY_STEP_IDS);
const REST_STEP_ID_SET = new Set<string>([
  ...INTERFACE_TOUR_CARD_STEP_IDS,
  ...INTERFACE_TOUR_TRAILING_STEP_IDS
]);

export const INTERFACE_TOUR_SETTINGS = {
  sectionTitle: 'Знакомство с интерфейсом',
  hint:
    'Короткий тур по основным разделам и инструментам ARC. Запускается после первой настройки; пройти снова или открыть базу знаний можно в\u00A0любой момент',
  replayLabel: 'Пройти обучение ещё раз',
  knowledgeBaseLabel: 'База знаний ARC',
  knowledgeBaseUrl: ONBOARDING_KNOWLEDGE_BASE_URL
} as const;

export const INTERFACE_TOUR_STEPS: readonly InterfaceTourStep[] = [
  {
    id: 'main_tabs',
    catalogIds: ['B1', 'B2', 'B3'],
    route: '/gallery',
    anchorId: 'navbar-nav',
    fallbackAnchorId: 'navbar-library-split',
    fallbackAnchorIds: ['main-tabs'],
    placement: 'bottom',
    body:
      'Здесь находятся основные разделы ARC: «Библиотеки», «Коллекции», «Мудборд» и\u00A0«Доска». Можно создать несколько библиотек — для\u00A0этого нажмите на\u00A0правую часть кнопки со\u00A0стрелкой',
    enabled: true
  },
  {
    id: 'search',
    catalogIds: ['C1', 'C2', 'C3', 'C4', 'C5'],
    route: '/gallery',
    anchorId: 'navbar-search',
    placement: 'bottom',
    body:
      'Поиск работает в\u00A0четырёх режимах: по\u00A0меткам, семантический, по\u00A0доминирующему цвету и\u00A0по\u00A0похожему изображению. По\u00A0умолчанию доступны поиск по\u00A0меткам и\u00A0цвету. Для\u00A0остальных режимов потребуется настроить умный поиск',
    enabled: true
  },
  {
    id: 'sort_filters',
    catalogIds: ['D1', 'D6'],
    route: '/gallery',
    anchorId: 'navbar-sort-filters',
    placement: 'bottom',
    body:
      '«Сортировка» меняет порядок карточек в\u00A0сетке, а\u00A0«Фильтры» сужают выборку по\u00A0формату, дате, описанию и\u00A0другим параметрам',
    enabled: true
  },
  {
    id: 'add',
    catalogIds: ['E3'],
    route: '/gallery',
    anchorId: 'navbar-add',
    placement: 'bottom',
    body:
      'Кнопка «Добавить» открывает импорт файлов и\u00A0папок. Материалы также можно просто перетащить в\u00A0окно ARC',
    enabled: true
  },
  {
    id: 'menu',
    catalogIds: ['E4'],
    route: '/gallery',
    anchorId: 'navbar-menu',
    placement: 'bottom',
    body:
      'В\u00A0«Меню» находятся дополнительные разделы, например «Настройки» и\u00A0«Поиск дублей». Здесь же можно выбрать тему оформления',
    enabled: true
  },
  {
    id: 'gallery_grid',
    catalogIds: ['G1'],
    route: '/gallery',
    anchorId: 'gallery-grid',
    placement: 'center',
    body:
      'Сетка показывает превью материалов библиотеки. Нажмите на\u00A0карточку, чтобы открыть её в\u00A0полном размере',
    bodyEmptyLibrary:
      'Пока библиотека пуста — здесь появятся превью после импорта. Добавить файлы можно кнопкой «Добавить» или просто перетащить их в\u00A0окно ARC',
    enabled: true
  },
  {
    id: 'collections',
    catalogIds: ['I1', 'I2', 'I3'],
    route: '/collections',
    anchorId: 'collections-sidebar',
    fallbackAnchorId: 'collections-page',
    placement: 'right',
    body:
      'Здесь отображаются карточки, сгруппированные в\u00A0коллекции. Слева находится список коллекций, а\u00A0внизу — кнопка создания новой. Внутри коллекции можно создавать разделы для\u00A0более глубокой каталогизации контента',
    enabled: true
  },
  {
    id: 'moodboard',
    catalogIds: ['J1'],
    route: '/moodboard',
    anchorId: 'moodboard-page',
    fallbackAnchorId: 'main-tab-moodboard',
    placement: 'center',
    body:
      '«Мудборд» собирает карточки из\u00A0библиотеки в\u00A0одну визуальную подборку для\u00A0проекта, задачи или конкретной сцены',
    enabled: true
  },
  {
    id: 'tags_overview',
    catalogIds: ['K1', 'K2', 'K3', 'K4'],
    route: '/tags',
    anchorId: 'tags-sidebar',
    fallbackAnchorId: 'tags-page',
    placement: 'right',
    body:
      '«Категории и\u00A0метки» — основа системы организации материалов. Слева находится список категорий, где можно создавать новые. Метки существуют только внутри категорий. Для\u00A0каждой метки можно задать цвет и\u00A0вес — это влияет на\u00A0её приоритет в\u00A0поисковой выдаче',
    enabled: true
  },
  {
    id: 'category_settings',
    catalogIds: ['K5'],
    route: '/tags',
    anchorId: 'tags-add-category',
    fallbackAnchorId: 'tags-sidebar',
    fallbackAnchorIds: ['tags-page'],
    placement: 'right',
    body:
      'У категории настраиваются название, вес, цвет и описание — это определяет порядок и акцент меток в интерфейсе',
    enabled: false
  },
  {
    id: 'card_open',
    catalogIds: ['L1'],
    route: '/gallery',
    anchorId: 'gallery-first-card',
    fallbackAnchorId: 'gallery-grid',
    fallbackAnchorIds: ['gallery-page'],
    placement: 'right',
    body:
      'Нажмите на\u00A0карточку в\u00A0сетке, чтобы открыть детальный просмотр. Здесь доступны полноразмерное превью и\u00A0настройки данных карточки',
    bodyEmptyLibrary:
      'Пока в библиотеке нет карточек, добавьте файлы — затем откройте любую карточку в этой сетке двойным щелчком',
    enabled: true
  },
  {
    id: 'card_fields',
    catalogIds: ['L3', 'L4'],
    route: '/gallery',
    anchorId: 'card-detail-fields',
    fallbackAnchorId: 'gallery-grid',
    fallbackAnchorIds: ['gallery-page'],
    placement: 'left',
    body:
      'В\u00A0панели «Детали» можно изменить имя, ссылку и\u00A0описание, добавить оценку и\u00A0цвета. Ниже находятся аннотации, метки и\u00A0коллекции',
    bodyEmptyLibrary:
      'После первого импорта в\u00A0панели «Детали» появятся имя, ссылка, описание, оценка и\u00A0цвета',
    enabled: true
  },
  {
    id: 'card_similar',
    catalogIds: ['L10'],
    route: '/gallery',
    anchorId: 'card-detail-similar',
    fallbackAnchorId: 'gallery-grid',
    fallbackAnchorIds: ['gallery-page'],
    placement: 'top',
    body:
      '«Похожие изображения» находят карточки с близкой палитрой и композицией — удобно для поиска референсов в том же ключе',
    bodyEmptyLibrary:
      'Когда в библиотеке появятся карточки, блок покажет визуально близкие материалы',
    enabled: false
  },
  {
    id: 'card_actions',
    catalogIds: ['L11', 'L12', 'L13', 'L14', 'L15', 'L16'],
    route: '/gallery',
    anchorId: 'card-detail-toolbar',
    fallbackAnchorId: 'gallery-grid',
    fallbackAnchorIds: ['gallery-page'],
    placement: 'bottom',
    body:
      'В\u00A0шапке доступны дополнительные действия: добавить карточку в\u00A0мудборд, скопировать настройки, открыть папку с\u00A0исходником, посмотреть информацию и\u00A0скопировать ID карточки для\u00A0быстрого поиска',
    bodyEmptyLibrary:
      'Эти действия доступны для каждой карточки после импорта',
    enabled: true
  },
  {
    id: 'bug_report',
    catalogIds: ['A6'],
    route: '/gallery',
    anchorId: 'bug-report-widget',
    fallbackAnchorId: 'navbar-menu',
    placement: 'left',
    body:
      'Если возникла проблема, сообщите о\u00A0ней через плавающую кнопку или меню. Так вы сможете отправить сообщение об\u00A0ошибке или поделиться предложением по\u00A0улучшению ARC',
    enabled: true
  },
  {
    id: 'statistics',
    catalogIds: ['N1'],
    route: '/statistics',
    anchorId: 'statistics-main',
    fallbackAnchorId: 'statistics-page',
    placement: 'top',
    body:
      '«Статистика» показывает, сколько карточек, меток и коллекций в библиотеке и сколько места они занимают на диске',
    enabled: false
  },
  {
    id: 'history',
    catalogIds: ['O1'],
    route: '/history',
    anchorId: 'history-main',
    fallbackAnchorId: 'history-page',
    placement: 'top',
    body:
      '«История» сохраняет действия — импорт, правки меток и удаления; период можно сменить в верхней панели',
    enabled: false
  }
] as const;

export const INTERFACE_TOUR_THANKS_STEP: InterfaceTourStep = {
  id: 'thanks',
  catalogIds: [],
  route: '/gallery',
  anchorId: 'gallery-page',
  fallbackAnchorId: 'gallery-grid',
  fallbackAnchorIds: ['navbar-menu'],
  placement: 'center',
  body:
    'Спасибо, что пользуетесь ARC. Если захотите пройти знакомство ещё раз, его всегда можно запустить в\u00A0разделе «Настройки»',
  enabled: true
};

export const ENABLED_INTERFACE_TOUR_STEPS = INTERFACE_TOUR_STEPS.filter((step) => step.enabled);

export function isCardTourStep(step: Pick<InterfaceTourStep, 'id'>): boolean {
  return CARD_STEP_ID_SET.has(step.id);
}

export function needsCardOverlayTourStep(step: Pick<InterfaceTourStep, 'id'>): boolean {
  return OVERLAY_STEP_ID_SET.has(step.id);
}

export function isRestTourStep(step: Pick<InterfaceTourStep, 'id'>): boolean {
  return REST_STEP_ID_SET.has(step.id);
}

export function stepsForSegment(
  segment: InterfaceTourSegment,
  options?: { includeThanks?: boolean }
): InterfaceTourStep[] {
  let steps: InterfaceTourStep[];
  if (segment === 'full') steps = [...ENABLED_INTERFACE_TOUR_STEPS];
  else if (segment === 'chrome') steps = ENABLED_INTERFACE_TOUR_STEPS.filter((step) => !isRestTourStep(step));
  else steps = ENABLED_INTERFACE_TOUR_STEPS.filter((step) => isRestTourStep(step));
  if (options?.includeThanks && segment !== 'chrome') {
    steps = [...steps, INTERFACE_TOUR_THANKS_STEP];
  }
  return steps;
}

export function shouldIncludeThanksStep(args: {
  replay: boolean;
  segment: InterfaceTourSegment;
}): boolean {
  if (args.replay) return false;
  return args.segment === 'full' || args.segment === 'rest';
}

export function resolveAutoStartSegment(hasCards: boolean): InterfaceTourSegment {
  return hasCards ? 'full' : 'chrome';
}

export function formatInterfaceTourProgress(stepIndex: number, total: number): string {
  return `${stepIndex + 1} из ${total}`;
}
