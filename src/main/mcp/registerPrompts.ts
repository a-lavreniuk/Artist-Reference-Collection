import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const PROMPTS: Array<{
  name: string;
  title: string;
  description: string;
  text: string;
}> = [
  {
    name: 'suggest_tags',
    title: 'Предложить метки',
    description: 'Предложить метки для карточки через engine ARC и спросить перед записью',
    text:
      'Предложи метки для указанной карточки в ARC. Используй arc_suggest_card_tags (один engine с приложением). ' +
      'Покажи matched и proposedNew, кратко объясни выбор. Не вызывай arc_set_card_tags и не создавай метки, ' +
      'пока я не подтвержу. После подтверждения: merge matched tagIds с уже назначенными (не replace весь список). ' +
      'Для proposedNew сначала спроси, создавать ли новые метки в каталоге.'
  },
  {
    name: 'organize_imports',
    title: 'Разметить недавний импорт',
    description: 'Предложить метки и коллекции для недавно добавленных карточек',
    text: 'Просмотри последние импортированные карточки в библиотеке ARC, предложи метки и коллекции и спроси подтверждение перед изменениями. Для меток по содержимому изображения предпочитай arc_suggest_card_tags, а не угадывание по памяти.'
  },
  {
    name: 'build_moodboard',
    title: 'Собрать мудборд',
    description: 'Подобрать карточки и добавить на мудборд по брифу',
    text: 'По моему брифу найди подходящие референсы в ARC и предложи добавить их на мудборд. Сначала покажи план подбора.'
  },
  {
    name: 'find_duplicates',
    title: 'Найти дубликаты',
    description: 'Сканировать библиотеку и предложить объединение дубликатов',
    text: 'Просканируй библиотеку ARC на дубликаты, покажи пары и предложи объединение с объяснением, какая карточка primary.'
  },
  {
    name: 'color_palette_review',
    title: 'Подбор по цвету',
    description: 'Найти референсы с похожей палитрой',
    text: 'Помоги подобрать референсы в ARC по цвету: уточни целевой HEX или карточку-эталон, затем используй поиск по цвету и покажи результаты.'
  },
  {
    name: 'library_overview',
    title: 'Обзор библиотеки',
    description: 'Статистика, структура меток и коллекций',
    text: 'Дай обзор библиотеки ARC: статистика, основные категории меток, коллекции и идеи по организации. Ничего не меняй без подтверждения.'
  }
];

export function registerArcMcpPrompts(server: McpServer): void {
  for (const prompt of PROMPTS) {
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description
      },
      async () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: prompt.text
            }
          }
        ]
      })
    );
  }
}
