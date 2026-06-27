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

export type InterfaceTourPlacement = 'top' | 'bottom' | 'left' | 'right';

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
    id: 'bug_report',
    catalogIds: ['A6'],
    route: '/gallery',
    anchorId: 'bug-report-widget',
    fallbackAnchorId: 'navbar-menu',
    placement: 'left',
    body:
      'Если у\u00A0вас возникла проблема, вы\u00A0можете сообщить о\u00A0ней через плавающую кнопку или меню. Это поможет вам отправить баг или пожелание, связанное с\u00A0ARC',
    enabled: true
  },
  {
    id: 'main_tabs',
    catalogIds: ['B1', 'B2', 'B3'],
    route: '/gallery',
    anchorId: 'main-tabs',
    placement: 'bottom',
    body:
      'Вкладки вверху переключают основные разделы: «Библиотека» — архив карточек, «Коллекции» — тематические подборки, «Мудборд» — визуальные подборки для проектов',
    enabled: true
  },
  {
    id: 'search',
    catalogIds: ['C1', 'C2', 'C3', 'C4', 'C5'],
    route: '/gallery',
    anchorId: 'navbar-search',
    placement: 'bottom',
    body:
      'В центре панели — поиск с\u00A0режимами: метки, AI-семантика, доминирующий цвет и похожие изображения; переключайте иконками слева от поля',
    enabled: true
  },
  {
    id: 'sort_filters',
    catalogIds: ['D1', 'D6'],
    route: '/gallery',
    anchorId: 'navbar-sort-filters',
    placement: 'bottom',
    body:
      '«Сортировка» и «Фильтры» задают порядок карточек в сетке и сужают выборку по формату, дате, описанию и другим параметрам',
    enabled: true
  },
  {
    id: 'add',
    catalogIds: ['E3'],
    route: '/gallery',
    anchorId: 'navbar-add',
    placement: 'bottom',
    body:
      '«Добавить» открывает импорт файлов и папок. Материалы можно также просто перетащить прямо в\u00A0окно ARC',
    enabled: true
  },
  {
    id: 'menu',
    catalogIds: ['E4'],
    route: '/gallery',
    anchorId: 'navbar-menu',
    placement: 'bottom',
    body:
      'В «Меню» можно найти другие разделы, а\u00A0также выбрать тему оформления и сменить размер сетки',
    enabled: true
  },
  {
    id: 'gallery_grid',
    catalogIds: ['G1'],
    route: '/gallery',
    anchorId: 'gallery-grid',
    placement: 'top',
    body:
      'Сетка показывает превью материалов библиотеки; щелчок по карточке открывает просмотр в полном размере',
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
      'В «Коллекциях» материалы группируют по задачам: список слева, «Добавить коллекцию» создаёт новую подборку',
    enabled: true
  },
  {
    id: 'moodboard',
    catalogIds: ['J1'],
    route: '/moodboard',
    anchorId: 'moodboard-page',
    fallbackAnchorId: 'main-tab-moodboard',
    placement: 'bottom',
    body:
      '«Мудборд» собирает карточки из библиотеки в одну визуальную подборку под проект или сцену',
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
      '«Категории и метки» — основа системы организации: слева список категорий и возможность добавлять новые',
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
    enabled: true
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
      'Карточку открывают из сетки; в оверлее — превью в полном размере и все действия с файлом',
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
      'Поля «Имя», «Ссылка» и «Описание» хранят подпись и контекст; «Открыть ссылку» ведёт к источнику в браузере',
    bodyEmptyLibrary:
      'После первого импорта здесь можно задать имя, ссылку и описание материала',
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
    enabled: true
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
      'В шапке оверлея — мудборд, копирование настроек, папка с файлом, информация, ID и удаление в корзину или навсегда',
    bodyEmptyLibrary:
      'Эти действия доступны для каждой карточки после импорта',
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
    enabled: true
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
    enabled: true
  }
] as const;

export const ENABLED_INTERFACE_TOUR_STEPS = INTERFACE_TOUR_STEPS.filter((step) => step.enabled);

export function formatInterfaceTourProgress(stepIndex: number, total = ENABLED_INTERFACE_TOUR_STEPS.length): string {
  return `${stepIndex + 1} из ${total}`;
}
