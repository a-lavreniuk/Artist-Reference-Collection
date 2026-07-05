import { useMemo } from 'react';

import SettingsMcpToolRow from '../../../components/settings/SettingsMcpToolRow';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import { getAppPreferencesSync } from '../../../services/appPreferencesRuntime';
import {
  defaultMcpToolsEnabled,
  MCP_TOOL_GROUPS,
  MCP_TOOLS,
  type McpToolId
} from '@arc-main-shared/mcpToolCatalog';

const LABEL_ENABLE = 'Разрешить подключение MCP-клиентов';
const HINT_INTRO =
  'MCP (Model Context Protocol) позволяет AI-агентам в Cursor и других клиентах читать библиотеку и выполнять разрешённые действия, пока ARC запущен.';
const HINT_TAGS =
  'Инструменты для меток создают и редактируют категории и метки в каталоге раздела «Метки». Они не меняют метки на карточках.';
const HINT_PRIVACY =
  'При использовании облачной модели названия файлов, метки и результаты поиска могут попадать в контекст LLM-провайдера. Для чувствительных материалов используйте локальную модель или сначала только чтение.';
const HINT_TOOLS =
  'Отключённые инструменты не будут доступны MCP-клиентам после переподключения.';

const MCP_PORT = 47897;

/** Настройки локального MCP-сервера ARC */
export default function SettingsMcpServerPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const disabled = !ready;

  const toolsEnabled = prefs?.mcpToolsEnabled ?? defaultMcpToolsEnabled();

  const toolGroups = useMemo(
    () =>
      MCP_TOOL_GROUPS.map((group) => ({
        group,
        tools: MCP_TOOLS.filter((tool) => tool.groupId === group.id)
      })).filter((entry) => entry.tools.length > 0),
    []
  );

  const mcpJson = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            'arc-mcp': {
              transport: 'http',
              type: 'streamable-http',
              streamable: true,
              url: `http://127.0.0.1:${MCP_PORT}/mcp`
            }
          }
        },
        null,
        2
      ),
    []
  );

  const setToolEnabled = (toolId: McpToolId, pressed: boolean) => {
    const current =
      prefs?.mcpToolsEnabled ??
      getAppPreferencesSync().mcpToolsEnabled ??
      defaultMcpToolsEnabled();
    void update({
      mcpToolsEnabled: {
        ...current,
        [toolId]: pressed
      }
    });
  };

  return (
    <div className="arc-settings-main__scroll arc-settings-shortcuts-panel">
      <div className="arc-settings-main__content arc-ui-kit-scope" data-btn-size="m">
        <div className="arc-settings-desc-block">
          <p className="text-m arc-settings-desc-block__text">{HINT_INTRO}</p>
          <p className="text-m arc-settings-desc-block__text">{HINT_TAGS}</p>
          <p className="text-m arc-settings-desc-block__text">{HINT_PRIVACY}</p>
          <SettingsToggleRow
            label={LABEL_ENABLE}
            pressed={prefs?.mcpServerEnabled === true}
            disabled={disabled}
            onPressedChange={(mcpServerEnabled) => void update({ mcpServerEnabled })}
          />
          <p className="text-m arc-settings-desc-block__text">
            Порт: <span className="typo-p-m">{MCP_PORT}</span>
          </p>
          <p className="text-m arc-settings-desc-block__text">Конфигурация для Cursor (mcp.json):</p>
          <pre className="text-m arc-settings-desc-block__text arc-settings-mcp-json">{mcpJson}</pre>
        </div>
      </div>

      <div
        className={`arc-settings-shortcuts-panel__list arc-ui-kit-scope${ready ? ' is-prefs-ready' : ''}`}
        data-btn-size="m"
      >
        <div className="arc-settings-shortcuts-panel__group">
          <SettingsSection title="Инструменты MCP">
            <p className="text-m arc-settings-desc-block__text">{HINT_TOOLS}</p>
          </SettingsSection>
        </div>
        {toolGroups.map((entry, index) => (
          <div key={entry.group.id} className="arc-settings-shortcuts-panel__group">
            <SettingsSeparator />
            <SettingsSection title={`${entry.group.title} (${entry.tools.length})`}>
              {entry.tools.map((tool) => (
                <SettingsMcpToolRow
                  key={tool.id}
                  label={tool.label}
                  toolId={tool.id}
                  pressed={toolsEnabled[tool.id]}
                  disabled={disabled}
                  onPressedChange={(pressed) => setToolEnabled(tool.id, pressed)}
                />
              ))}
            </SettingsSection>
          </div>
        ))}
      </div>
    </div>
  );
}
