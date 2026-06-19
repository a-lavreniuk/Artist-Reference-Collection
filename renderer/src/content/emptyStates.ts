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
    title: 'Вы ещё не добавили ни одной карточки',
    subtitle: 'Пока здесь пусто. Перетащите файлы в это окно или нажмите на кнопку',
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
    subtitle: 'Так держать! У всех ваших карточек проставлены метки'
  },
  libraryTrashEmpty: {
    title: 'Корзина пуста',
    subtitle:
      'Удалённые карточки появятся здесь — их можно восстановить или удалить навсегда. Есть настройка удаления карточек минуя корзину'
  },
  searchNoResults: {
    title: 'Ничего не найдено',
    subtitle: 'Измените фильтры или сбросьте метки',
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
    primaryActionLabel: 'Настройки AI Поиска',
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
    subtitle: 'Добавьте карточки из библиотеки — они появятся здесь',
    primaryActionLabel: 'Перейти в библиотеку',
    primaryActionVariant: 'outline'
  },
  moodboardEmpty: {
    title: 'В мудборде пока нет карточек',
    subtitle: 'Добавляйте карточки из библиотеки — и собирайте референсы в одном месте',
    primaryActionLabel: 'Перейти в библиотеку',
    primaryActionVariant: 'outline'
  },
  tagsNone: {
    title: 'Вы ещё не добавили ни одной метки',
    subtitle: 'Используйте категории и метки, чтобы значительно упростить процесс поиска карточек',
    primaryActionLabel: 'Добавить категорию',
    primaryActionVariant: 'brand'
  },
  categoryTagsEmpty: {
    title: 'В этой категории пока нет меток',
    subtitle: 'Добавьте метку — так проще находить нужные карточки',
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
  inDevelopmentBoard: {
    title: 'Доска пока в разработке',
    subtitle: 'Здесь будет артборд для работы с изображениями'
  }
} as const satisfies Record<string, EmptyStateCopy>;
