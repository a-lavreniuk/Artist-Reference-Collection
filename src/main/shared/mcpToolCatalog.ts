export const MCP_TOOL_IDS = [
  'arc_get_app_info',
  'arc_list_cards',
  'arc_get_card',
  'arc_search_cards',
  'arc_list_categories',
  'arc_list_tags',
  'arc_list_collections',
  'arc_ai_search',
  'arc_get_library_stats',
  'arc_import_item',
  'arc_update_card',
  'arc_create_category',
  'arc_update_category',
  'arc_create_tag',
  'arc_update_tag'
] as const;

export type McpToolId = (typeof MCP_TOOL_IDS)[number];

export type McpToolGroupId = 'app' | 'cards-read' | 'cards-write' | 'catalog-read' | 'catalog-write' | 'ai';

export type McpToolDefinition = {
  id: McpToolId;
  groupId: McpToolGroupId;
  label: string;
};

export const MCP_TOOL_GROUPS: ReadonlyArray<{ id: McpToolGroupId; title: string }> = [
  { id: 'app', title: 'Приложение' },
  { id: 'cards-read', title: 'Карточки — чтение' },
  { id: 'cards-write', title: 'Карточки — запись' },
  { id: 'catalog-read', title: 'Каталог меток — чтение' },
  { id: 'catalog-write', title: 'Каталог меток — запись' },
  { id: 'ai', title: 'AI-поиск' }
];

export const MCP_TOOLS: ReadonlyArray<McpToolDefinition> = [
  { id: 'arc_get_app_info', groupId: 'app', label: 'Информация о приложении и библиотеке' },
  { id: 'arc_get_library_stats', groupId: 'app', label: 'Статистика библиотеки и диска' },
  { id: 'arc_list_cards', groupId: 'cards-read', label: 'Список карточек' },
  { id: 'arc_get_card', groupId: 'cards-read', label: 'Одна карточка по ID' },
  { id: 'arc_search_cards', groupId: 'cards-read', label: 'Текстовый поиск карточек' },
  { id: 'arc_list_collections', groupId: 'cards-read', label: 'Список коллекций' },
  { id: 'arc_import_item', groupId: 'cards-write', label: 'Импорт по URL' },
  { id: 'arc_update_card', groupId: 'cards-write', label: 'Обновление карточки (без меток)' },
  { id: 'arc_list_categories', groupId: 'catalog-read', label: 'Список категорий меток' },
  { id: 'arc_list_tags', groupId: 'catalog-read', label: 'Список меток' },
  { id: 'arc_create_category', groupId: 'catalog-write', label: 'Создание категории' },
  { id: 'arc_update_category', groupId: 'catalog-write', label: 'Редактирование категории' },
  { id: 'arc_create_tag', groupId: 'catalog-write', label: 'Создание метки' },
  { id: 'arc_update_tag', groupId: 'catalog-write', label: 'Редактирование метки' },
  { id: 'arc_ai_search', groupId: 'ai', label: 'Семантический AI-поиск' }
];

export type McpToolsEnabledMap = Record<McpToolId, boolean>;

export function defaultMcpToolsEnabled(): McpToolsEnabledMap {
  return Object.fromEntries(MCP_TOOL_IDS.map((id) => [id, true])) as McpToolsEnabledMap;
}

export function sanitizeMcpToolsEnabled(raw: unknown): McpToolsEnabledMap {
  const defaults = defaultMcpToolsEnabled();
  if (!raw || typeof raw !== 'object') return defaults;
  const record = raw as Record<string, unknown>;
  const next = { ...defaults };
  for (const id of MCP_TOOL_IDS) {
    if (typeof record[id] === 'boolean') {
      next[id] = record[id];
    }
  }
  return next;
}

export function mergeMcpToolsEnabled(
  current: McpToolsEnabledMap,
  patch: Partial<McpToolsEnabledMap>
): McpToolsEnabledMap {
  return sanitizeMcpToolsEnabled({ ...current, ...patch });
}

export function listEnabledMcpToolIds(enabled: McpToolsEnabledMap): McpToolId[] {
  return MCP_TOOL_IDS.filter((id) => enabled[id]);
}
