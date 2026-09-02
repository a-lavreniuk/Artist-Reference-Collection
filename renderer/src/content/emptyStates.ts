export type EmptyStateCopy = {
  title: string;
  subtitle: string;
  primaryActionLabel?: string;
  primaryActionVariant?: 'brand' | 'outline';
  secondaryActionLabel?: string;
  secondaryActionVariant?: 'brand' | 'outline';
};

export const EMPTY_STATE_COPY = {
  libraryEmpty: {
    title: 'Библиотека пока пуста',
    subtitle: 'Добавьте первый файл: перетащите его в окно или нажмите «Добавить файлы»',
    primaryActionLabel: 'Добавить файлы',
    primaryActionVariant: 'brand'
  },
  libraryUnconfigured: {
    title: 'Библиотека ещё не подключена',
    subtitle: 'Укажите папку в «Настройки → Библиотека» — и можно сразу добавлять файлы',
    primaryActionLabel: 'Перейти в настройки',
    primaryActionVariant: 'outline'
  },
  libraryUntagged: {
    title: 'Все карточки уже с метками',
    subtitle: 'Так держать! Не забудьте разобрать карточки без меток, если они появятся',
    primaryActionLabel: 'Открыть библиотеку',
    primaryActionVariant: 'outline'
  },
  libraryTrashEmpty: {
    title: 'Корзина пуста',
    subtitle: 'Удалённые карточки появятся здесь — их можно восстановить или удалить навсегда'
  },
  searchNoResults: {
    title: 'Ничего не найдено',
    subtitle: 'Измените фильтры или вернитесь в обычную библиотеку',
    primaryActionLabel: 'Сбросить фильтры',
    primaryActionVariant: 'outline'
  },
  searchFeedError: {
    title: 'Не удалось выполнить поиск',
    subtitle: 'Попробуйте снова или сбросьте фильтры',
    primaryActionLabel: 'Сбросить фильтры',
    primaryActionVariant: 'outline'
  },
  aiSearchNoResults: {
    title: 'Ничего не найдено',
    subtitle: 'Попробуйте другое описание или настройте точность поиска',
    primaryActionLabel: 'Умный поиск',
    primaryActionVariant: 'outline'
  },
  collectionsNone: {
    title: 'Вы ещё не создали ни одной коллекции',
    subtitle: 'Коллекции помогают организовывать карточки под темы или задачи',
    primaryActionLabel: 'Добавить коллекцию',
    primaryActionVariant: 'brand'
  },
  collectionEmpty: {
    title: 'В коллекции пока нет карточек',
    subtitle: 'Добавьте карточки из библиотеки — они появятся здесь автоматически',
    primaryActionLabel: 'Перейти в библиотеку',
    primaryActionVariant: 'outline'
  },
  sectionEmpty: {
    title: 'В разделе пока нет карточек',
    subtitle: 'Добавьте карточки из библиотеки — они появятся здесь автоматически',
    primaryActionLabel: 'Перейти в библиотеку',
    primaryActionVariant: 'outline'
  },
  moodboardEmpty: {
    title: 'В мудборде пока нет карточек',
    subtitle:
      'Добавьте карточку из библиотеки — нажмите на неё или ПКМ и выберите «Добавить в мудборд»',
    primaryActionLabel: 'Перейти в библиотеку',
    primaryActionVariant: 'outline'
  },
  tagsNone: {
    title: 'Вы ещё не добавили ни одной метки',
    subtitle: 'Используйте категории и метки, чтобы упростить поиск карточек',
    primaryActionLabel: 'Добавить категорию',
    primaryActionVariant: 'brand'
  },
  categoryTagsEmpty: {
    title: 'В этой категории пока нет меток',
    subtitle: 'Создайте метку, чтобы находить нужные карточки быстрее',
    primaryActionLabel: 'Добавить метку',
    primaryActionVariant: 'brand'
  },
  tagsSearchNoResults: {
    title: 'Ничего не найдено',
    subtitle: 'Попробуйте другой запрос или сбросьте поиск'
  },
  inDevelopmentStatistics: {
    title: 'Статистика пока в разработке',
    subtitle: 'Здесь будут сводки по библиотеке: объём, форматы, популярные метки'
  },
  inDevelopmentHistory: {
    title: 'История пока в разработке',
    subtitle: 'Здесь будет журнал действий с библиотекой за выбранный период'
  },
  inDevelopmentDuplicates: {
    title: 'Поиск дублей пока в разработке',
    subtitle: 'Здесь можно будет находить идентичные или очень похожие изображения и удалять ненужные'
  },
  duplicatesNoResults: {
    title: 'Совпадений не найдено',
    subtitle: 'Попробуйте снизить порог схожести или проверьте библиотеку позже'
  },
  duplicatesQueueComplete: {
    title: 'Очередь проверена',
    subtitle: 'Все пары обработаны. Если вы уверены, что ничего не пропустили, можно вернуться в библиотеку',
    primaryActionLabel: 'Перейти в библиотеку',
    primaryActionVariant: 'outline'
  },
  inDevelopmentBoard: {
    title: 'Доска пока в разработке',
    subtitle: 'Здесь будет артборд для работы с изображениями'
  },
  historyEmpty: {
    title: 'История пока пуста',
    subtitle: 'Здесь появятся записи о действиях с библиотекой — импорт, коллекции, метки и другое'
  },
  historyFilterEmpty: {
    title: 'Нет записей за этот период',
    subtitle: 'Выберите другой период или откройте всю историю'
  },
  statsPopularTagsEmpty: {
    title: 'Нет популярных меток',
    subtitle: 'Когда метки начнут чаще встречаться на карточках, они появятся здесь'
  },
  cardDetailAnnotationsEmpty: {
    title: 'Аннотаций пока нет',
    subtitle: 'Включите режим аннотаций и выделите область на превью'
  },
  statsLowTagsEmpty: {
    title: 'Нет малоиспользуемых меток',
    subtitle: 'Метки с небольшим числом карточек появятся в этом списке'
  },
  appCrash: {
    title: 'Что-то пошло не так',
    subtitle:
      'Интерфейс остановился из-за ошибки. Можно перезагрузить окно или отправить сообщение о проблеме.',
    primaryActionLabel: 'Перезагрузить',
    primaryActionVariant: 'brand',
    secondaryActionLabel: 'Сообщить о проблеме',
    secondaryActionVariant: 'outline'
  }
} as const satisfies Record<string, EmptyStateCopy>;
