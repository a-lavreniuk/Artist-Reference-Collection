import { MCP_TOOL_COPY, MCP_TOOL_IDS, type McpToolId } from './mcpToolCopy';

export { MCP_TOOL_COPY, MCP_TOOL_IDS, type McpToolId } from './mcpToolCopy';
export {
  MCP_CONFIRM_HINT,
  MCP_CATALOG_HINT,
  mcpToolDescription,
  mcpToolLabel
} from './mcpToolCopy';

export type McpToolGroupId =
  | 'app'
  | 'cards-read'
  | 'cards-write'
  | 'collections'
  | 'moodboard'
  | 'catalog-read'
  | 'catalog-write'
  | 'visual-search'
  | 'filters'
  | 'duplicates'
  | 'ai'
  | 'import';

export type McpToolDefinition = {
  id: McpToolId;
  groupId: McpToolGroupId;
  label: string;
};

export const MCP_TOOL_GROUPS: ReadonlyArray<{ id: McpToolGroupId; title: string }> = [
  { id: 'app', title: 'Приложение' },
  { id: 'cards-read', title: 'Карточки — чтение' },
  { id: 'cards-write', title: 'Карточки — запись' },
  { id: 'import', title: 'Импорт' },
  { id: 'collections', title: 'Коллекции' },
  { id: 'moodboard', title: 'Мудборд' },
  { id: 'catalog-read', title: 'Каталог меток — чтение' },
  { id: 'catalog-write', title: 'Каталог меток — запись' },
  { id: 'visual-search', title: 'Визуальный поиск' },
  { id: 'filters', title: 'Фильтры галереи' },
  { id: 'duplicates', title: 'Дубликаты' },
  { id: 'ai', title: 'AI-поиск' }
];

export const MCP_TOOLS: ReadonlyArray<McpToolDefinition> = MCP_TOOL_IDS.map((id) => ({
  id,
  groupId: MCP_TOOL_COPY[id].groupId,
  label: MCP_TOOL_COPY[id].label
}));

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
