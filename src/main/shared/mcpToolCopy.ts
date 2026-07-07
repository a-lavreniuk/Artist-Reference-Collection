import type { McpToolGroupId } from './mcpToolCatalog';

export type McpToolCopyEntry = {
  groupId: McpToolGroupId;
  label: string;
  description: string;
};

export const MCP_CONFIRM_HINT =
  'Перед массовыми изменениями согласуйте действие с пользователем.';

export const MCP_CATALOG_HINT =
  'Инструменты каталога меток не привязывают метки к карточкам автоматически.';

export const MCP_TOOL_COPY = {
  arc_get_app_info: {
    groupId: 'app',
    label: 'Информация о приложении и библиотеке',
    description: 'Версия ARC, платформа, статус MCP и открыта ли библиотека.'
  },
  arc_get_library_stats: {
    groupId: 'app',
    label: 'Статистика библиотеки и диска',
    description: 'Количество карточек, корзина, занятое место на диске и статус AI-индекса.'
  },
  arc_get_recent_history: {
    groupId: 'app',
    label: 'Журнал действий библиотеки',
    description: 'Последние записи истории изменений в библиотеке.'
  },
  arc_get_ai_status: {
    groupId: 'app',
    label: 'Статус AI-поиска',
    description: 'Установленные модели, индексация, ошибки и готовность семантического поиска.'
  },
  arc_list_cards: {
    groupId: 'cards-read',
    label: 'Список карточек',
    description:
      'Список карточек с пагинацией, метками, коллекцией, расширенными фильтрами и сортировкой. Для корзины используйте libraryScope: trash.'
  },
  arc_get_card: {
    groupId: 'cards-read',
    label: 'Одна карточка по ID',
    description: 'Полные метаданные одной карточки по идентификатору.'
  },
  arc_search_cards: {
    groupId: 'cards-read',
    label: 'Текстовый поиск карточек',
    description: 'Полнотекстовый поиск по описанию, ссылке и AI-подписи карточки.'
  },
  arc_get_card_palette: {
    groupId: 'cards-read',
    label: 'Палитра цветов карточки',
    description: 'Доминантный цвет и палитра изображения карточки для анализа референса.'
  },
  arc_get_card_media_url: {
    groupId: 'cards-read',
    label: 'URL медиа карточки',
    description: 'Локальный URL превью или оригинала через media-server ARC (только localhost).'
  },
  arc_card_media_resources: {
    groupId: 'cards-read',
    label: 'MCP-ресурсы медиа карточек',
    description: 'Шаблоны URI arc://card/{id}/thumb и arc://card/{id}/original для vision-клиентов.'
  },
  arc_import_item: {
    groupId: 'import',
    label: 'Импорт по URL',
    description: `Импорт изображения или видео по прямой HTTP(S)-ссылке. ${MCP_CONFIRM_HINT}`
  },
  arc_import_item_base64: {
    groupId: 'import',
    label: 'Импорт из base64',
    description: `Импорт медиафайла из base64-строки. ${MCP_CONFIRM_HINT}`
  },
  arc_import_files: {
    groupId: 'import',
    label: 'Импорт локальных файлов',
    description: `Импорт файлов с диска по абсолютным путям. ${MCP_CONFIRM_HINT}`
  },
  arc_check_import_duplicate: {
    groupId: 'import',
    label: 'Проверка дубликата перед импортом',
    description: 'Проверяет, есть ли уже такой файл в библиотеке, до импорта.'
  },
  arc_update_card: {
    groupId: 'cards-write',
    label: 'Обновление карточки (без меток)',
    description: `Изменяет имя, описание и коллекции карточки. Метки на карточке не меняет. ${MCP_CONFIRM_HINT}`
  },
  arc_set_card_tags: {
    groupId: 'cards-write',
    label: 'Метки на карточке',
    description: `Назначает или снимает метки на карточке (полный список tagIds). ${MCP_CONFIRM_HINT}`
  },
  arc_move_card_to_trash: {
    groupId: 'cards-write',
    label: 'Переместить в корзину',
    description: `Мягкое удаление карточки в корзину. ${MCP_CONFIRM_HINT}`
  },
  arc_restore_card: {
    groupId: 'cards-write',
    label: 'Восстановить из корзины',
    description: `Восстанавливает карточку из корзины. ${MCP_CONFIRM_HINT}`
  },
  arc_permanent_delete_card: {
    groupId: 'cards-write',
    label: 'Удалить навсегда',
    description: `Безвозвратно удаляет карточку из библиотеки. ${MCP_CONFIRM_HINT}`
  },
  arc_empty_trash: {
    groupId: 'cards-write',
    label: 'Очистить корзину',
    description: `Безвозвратно удаляет все карточки из корзины. ${MCP_CONFIRM_HINT}`
  },
  arc_list_collections: {
    groupId: 'collections',
    label: 'Список коллекций',
    description: 'Все коллекции библиотеки с базовыми полями.'
  },
  arc_get_collection: {
    groupId: 'collections',
    label: 'Детали коллекции',
    description: 'Статистика коллекции и превью последних карточек.'
  },
  arc_create_collection: {
    groupId: 'collections',
    label: 'Создать коллекцию',
    description: `Создаёт новую коллекцию. ${MCP_CONFIRM_HINT}`
  },
  arc_update_collection: {
    groupId: 'collections',
    label: 'Редактировать коллекцию',
    description: `Изменяет имя и описание коллекции. ${MCP_CONFIRM_HINT}`
  },
  arc_delete_collection: {
    groupId: 'collections',
    label: 'Удалить коллекцию',
    description: `Удаляет коллекцию и отвязывает карточки. ${MCP_CONFIRM_HINT}`
  },
  arc_add_cards_to_collection: {
    groupId: 'collections',
    label: 'Добавить карточки в коллекцию',
    description: `Добавляет карточки в коллекцию без дублирования. ${MCP_CONFIRM_HINT}`
  },
  arc_remove_cards_from_collection: {
    groupId: 'collections',
    label: 'Убрать карточки из коллекции',
    description: `Убирает карточки из указанной коллекции. ${MCP_CONFIRM_HINT}`
  },
  arc_get_moodboard: {
    groupId: 'moodboard',
    label: 'Состояние мудборда',
    description: 'Список карточек мудборда и раскладка доски.'
  },
  arc_add_to_moodboard: {
    groupId: 'moodboard',
    label: 'Добавить на мудборд',
    description: `Добавляет карточки в мудборд. ${MCP_CONFIRM_HINT}`
  },
  arc_remove_from_moodboard: {
    groupId: 'moodboard',
    label: 'Убрать с мудборда',
    description: `Убирает карточки с мудборда и с доски. ${MCP_CONFIRM_HINT}`
  },
  arc_update_moodboard_board: {
    groupId: 'moodboard',
    label: 'Обновить раскладку мудборда',
    description: `Сохраняет состояние доски мудборда (viewport, элементы). ${MCP_CONFIRM_HINT}`
  },
  arc_list_categories: {
    groupId: 'catalog-read',
    label: 'Список категорий меток',
    description: 'Все категории меток в разделе «Метки».'
  },
  arc_list_tags: {
    groupId: 'catalog-read',
    label: 'Список меток',
    description: 'Все метки каталога библиотеки.'
  },
  arc_list_tags_by_category: {
    groupId: 'catalog-read',
    label: 'Метки категории',
    description: 'Метки одной категории по categoryId.'
  },
  arc_create_category: {
    groupId: 'catalog-write',
    label: 'Создать категорию меток',
    description: `Создаёт категорию в каталоге меток. ${MCP_CATALOG_HINT} ${MCP_CONFIRM_HINT}`
  },
  arc_update_category: {
    groupId: 'catalog-write',
    label: 'Редактировать категорию',
    description: `Изменяет категорию меток. ${MCP_CATALOG_HINT} ${MCP_CONFIRM_HINT}`
  },
  arc_delete_category: {
    groupId: 'catalog-write',
    label: 'Удалить категорию',
    description: `Удаляет категорию меток по правилам ARC. ${MCP_CONFIRM_HINT}`
  },
  arc_create_tag: {
    groupId: 'catalog-write',
    label: 'Создать метку',
    description: `Создаёт метку в каталоге (без привязки к карточкам). ${MCP_CATALOG_HINT} ${MCP_CONFIRM_HINT}`
  },
  arc_update_tag: {
    groupId: 'catalog-write',
    label: 'Редактировать метку',
    description: `Изменяет метку в каталоге. ${MCP_CATALOG_HINT} ${MCP_CONFIRM_HINT}`
  },
  arc_delete_tag: {
    groupId: 'catalog-write',
    label: 'Удалить метку',
    description: `Удаляет метку из каталога по правилам ARC. ${MCP_CONFIRM_HINT}`
  },
  arc_color_search: {
    groupId: 'visual-search',
    label: 'Поиск по цвету',
    description: 'Находит карточки, близкие к заданному цвету (hex).'
  },
  arc_similar_search: {
    groupId: 'visual-search',
    label: 'Похожие изображения',
    description: 'Визуальный поиск похожих карточек по cardId (нужен AI-индекс).'
  },
  arc_get_filter_stats: {
    groupId: 'filters',
    label: 'Счётчики фильтров галереи',
    description: 'Статистика для фильтров navbar (даты, вес, разрешение и т.д.).'
  },
  arc_list_filter_presets: {
    groupId: 'filters',
    label: 'Список пресетов фильтров',
    description: 'Сохранённые пользователем наборы фильтров галереи.'
  },
  arc_save_filter_preset: {
    groupId: 'filters',
    label: 'Сохранить пресет фильтров',
    description: `Создаёт или обновляет пресет фильтров. ${MCP_CONFIRM_HINT}`
  },
  arc_delete_filter_preset: {
    groupId: 'filters',
    label: 'Удалить пресет фильтров',
    description: `Удаляет сохранённый пресет. ${MCP_CONFIRM_HINT}`
  },
  arc_rename_filter_preset: {
    groupId: 'filters',
    label: 'Переименовать пресет фильтров',
    description: `Меняет имя сохранённого пресета. ${MCP_CONFIRM_HINT}`
  },
  arc_scan_duplicates: {
    groupId: 'duplicates',
    label: 'Сканировать дубликаты',
    description: 'Запускает поиск пар похожих/дублирующихся карточек.'
  },
  arc_list_duplicate_pairs: {
    groupId: 'duplicates',
    label: 'Список пар дубликатов',
    description: 'Возвращает найденные пары дубликатов (из кэша или после скана).'
  },
  arc_merge_duplicates: {
    groupId: 'duplicates',
    label: 'Объединить дубликаты',
    description: `Сливает две карточки: primary остаётся, secondary удаляется. ${MCP_CONFIRM_HINT}`
  },
  arc_skip_duplicate_pair: {
    groupId: 'duplicates',
    label: 'Пропустить пару дубликатов',
    description: 'Помечает пару как пропущенную в сессии и постоянном списке.'
  },
  arc_ai_search: {
    groupId: 'ai',
    label: 'Семантический AI-поиск',
    description: 'Поиск карточек по смыслу запроса (нужны модель и индексация).'
  },
  arc_trigger_reindex: {
    groupId: 'ai',
    label: 'Переиндексировать библиотеку',
    description: `Запускает полную переиндексацию для AI-поиска. ${MCP_CONFIRM_HINT}`
  }
} as const satisfies Record<string, McpToolCopyEntry>;

export type McpToolId = keyof typeof MCP_TOOL_COPY;

export const MCP_TOOL_IDS = Object.keys(MCP_TOOL_COPY) as McpToolId[];

export function mcpToolDescription(id: McpToolId): string {
  return MCP_TOOL_COPY[id].description;
}

export function mcpToolLabel(id: McpToolId): string {
  return MCP_TOOL_COPY[id].label;
}
