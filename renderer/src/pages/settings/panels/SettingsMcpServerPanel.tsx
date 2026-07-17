import { useCallback, useMemo, useState } from 'react';

import DemoAlert from '../../../components/layout/DemoAlert';
import SettingsMcpToolRow from '../../../components/settings/SettingsMcpToolRow';
import SettingsSection from '../../../components/settings/SettingsSection';
import SettingsSeparator from '../../../components/settings/SettingsSeparator';
import SettingsToggleRow from '../../../components/settings/SettingsToggleRow';
import { useAppPreferences } from '../../../hooks/useAppPreferences';
import type { AppPreferencesV1 } from '../../../services/appPreferences';
import {
  defaultMcpToolsEnabled,
  MCP_TOOL_GROUPS,
  MCP_TOOLS,
  type McpToolId
} from '@arc-main-shared/mcpToolCatalog';

const LABEL_ENABLE = 'Разрешить подключение MCP-клиентов';
const HINT_INTRO =
  'MCP (Model Context Protocol) даёт AI-агентам возможность читать библиотеку и выполнять разрешённые операции, пока работает ARC.';
const HINT_TAGS =
  'Инструменты для управления метками позволяют создавать и редактировать категории и метки. С их помощью можно изменять описание карточек, менять метки и перемещать файлы в корзину.';
const HINT_RESOURCES =
  'Медиа-ресурсы карточек, такие как превью и оригиналы, доступны MCP-клиентам по адресам arc://card/{id}/thumb и /original. Это возможно, если переключатель в группе «Карточки — чтение» активирован.';
const HINT_PRIVACY =
  'При использовании облачной модели информация о файлах, метках и результатах поиска может попадать в контекст LLM-провайдера. Чтобы защитить чувствительные данные, рекомендуется использовать локальную модель или режим только чтения.';
const HINT_TOOLS =
  'Отключённые инструменты недоступны MCP-клиентам до переподключения.';
const HINT_CONNECT_TITLE = 'Как подключить ARC-MCP для вашего агента:';
const HINT_CONNECT_1 = 'Включите агента.';
const HINT_CONNECT_2 = 'Нажмите «Копировать».';
const HINT_CONNECT_3 =
  'В чате агента попросите его установить сервер и вставьте содержимое буфера.';
const COPY_SUCCESS_MESSAGE = 'Конфигурация MCP сервера скопирована в буфер';

const MCP_PORT = 47897;

/** Настройки локального MCP-сервера ARC */
export default function SettingsMcpServerPanel() {
  const { prefs, ready, update } = useAppPreferences();
  const [copyAlertKey, setCopyAlertKey] = useState(0);
  const disabled = !ready;
  const mcpEnabled = prefs?.mcpServerEnabled === true;

  const toolsEnabled = prefs?.mcpToolsEnabled ?? defaultMcpToolsEnabled();

  const toolGroups = useMemo(
    () =>
      MCP_TOOL_GROUPS.map((group) => ({
        group,
        tools: MCP_TOOLS.filter((tool) => tool.groupId === group.id)
      })).filter((entry) => entry.tools.length > 0),
    []
  );

  const copyMcpPackage = useCallback(() => {
    const getPackage = window.arc?.getMcpSetupPackage;
    if (!getPackage) return;
    void getPackage()
      .then(async (result) => {
        if (!result?.ok || !result.text) return false;
        await navigator.clipboard.writeText(result.text);
        return true;
      })
      .then((ok) => {
        if (ok) setCopyAlertKey((key) => key + 1);
      })
      .catch(() => {
        /* clipboard / IPC unavailable */
      });
  }, []);

  const setToolEnabled = (toolId: McpToolId, pressed: boolean) => {
    void update({
      mcpToolsEnabled: {
        [toolId]: pressed
      } as AppPreferencesV1['mcpToolsEnabled']
    });
  };

  return (
    <>
      <div className="arc-settings-main__scroll arc-settings-shortcuts-panel">
        <div className="arc-settings-main__content arc-ui-kit-scope" data-btn-size="m">
          <div className="arc-settings-desc-block">
            <p className="text-m arc-settings-desc-block__text">{HINT_INTRO}</p>
            <p className="text-m arc-settings-desc-block__text">{HINT_TAGS}</p>
            <p className="text-m arc-settings-desc-block__text">{HINT_RESOURCES}</p>
            <p className="text-m arc-settings-desc-block__text">{HINT_PRIVACY}</p>
            <SettingsToggleRow
              label={LABEL_ENABLE}
              pressed={mcpEnabled}
              disabled={disabled}
              onPressedChange={(mcpServerEnabled) => void update({ mcpServerEnabled })}
            />
            {mcpEnabled ? (
              <>
                <SettingsSeparator />
                <p className="text-m arc-settings-desc-block__text">
                  Порт: <span className="text-code-m">{MCP_PORT}</span>
                </p>
                <p className="text-m arc-settings-desc-block__text">{HINT_CONNECT_TITLE}</p>
                <p className="text-m arc-settings-desc-block__text">1. {HINT_CONNECT_1}</p>
                <p className="text-m arc-settings-desc-block__text">2. {HINT_CONNECT_2}</p>
                <p className="text-m arc-settings-desc-block__text">3. {HINT_CONNECT_3}</p>
                <div className="arc-ui-kit-scope arc-settings-mcp-actions" data-btn-size="s">
                  <button
                    type="button"
                    className="btn btn-outline btn-ds btn-s"
                    disabled={disabled}
                    onClick={copyMcpPackage}
                  >
                    <span className="btn-ds__value">Копировать</span>
                  </button>
                </div>
                <SettingsSeparator className="arc-settings-separator--flush-bottom" />
              </>
            ) : null}
          </div>
        </div>

        {mcpEnabled ? (
          <div
            className={`arc-settings-shortcuts-panel__list arc-settings-shortcuts-panel__list--compact-top arc-ui-kit-scope${ready ? ' is-prefs-ready' : ''}`}
            data-btn-size="m"
          >
            <div className="arc-settings-shortcuts-panel__group">
              <SettingsSection title="Инструменты MCP">
                <p className="text-m arc-settings-desc-block__text">{HINT_TOOLS}</p>
              </SettingsSection>
            </div>
            {toolGroups.map((entry) => (
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
        ) : null}
      </div>

      {copyAlertKey > 0 ? (
        <DemoAlert
          key={`copy-${copyAlertKey}`}
          message={COPY_SUCCESS_MESSAGE}
          variant="success"
          onClose={() => setCopyAlertKey(0)}
        />
      ) : null}
    </>
  );
}
