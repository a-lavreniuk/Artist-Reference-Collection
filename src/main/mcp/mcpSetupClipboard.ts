import path from 'path';

import { ipcMain } from 'electron';

import { readAppPreferencesSync } from '../appPreferences';
import { ARC_LOCAL_TOKEN_HEADER } from '../localApiAuth';
import { ARC_MCP_PORT, ARC_MCP_URL } from './constants';

let mcpSetupIpcRegistered = false;

export function registerMcpSetupIpc(): void {
  if (mcpSetupIpcRegistered) return;
  mcpSetupIpcRegistered = true;

  ipcMain.handle('arc:get-mcp-setup-package', async () => ({
    ok: true as const,
    text: buildMcpSetupPackageText()
  }));
}

export type McpStdioLaunch = {
  command: string;
  args: string[];
};

/** Absolute command + args for stdio MCP clients. */
export function getMcpStdioLaunch(): McpStdioLaunch {
  if (process.defaultApp) {
    const appEntry = path.resolve(process.argv[1] ?? path.join(__dirname, '..', '..'));
    return { command: process.execPath, args: [appEntry, '--mcp'] };
  }
  return { command: process.execPath, args: ['--mcp'] };
}

export function buildHttpMcpServerConfig(secret?: string): Record<string, unknown> {
  const token = (secret ?? readAppPreferencesSync().localApiSecret ?? '').trim();
  const config: Record<string, unknown> = {
    transport: 'http',
    type: 'streamable-http',
    streamable: true,
    url: ARC_MCP_URL
  };
  if (token) {
    config.headers = { [ARC_LOCAL_TOKEN_HEADER]: token };
  }
  return config;
}

export function buildStdioMcpServerConfig(launch: McpStdioLaunch = getMcpStdioLaunch()): Record<string, unknown> {
  return {
    command: launch.command,
    args: launch.args
  };
}

/**
 * Neutral structured package for the clipboard (no product/agent brand names).
 * Contains both HTTP and stdio options so the MCP client can pick one.
 */
export function buildMcpSetupPackageText(options?: {
  launch?: McpStdioLaunch;
  port?: number;
  secret?: string;
}): string {
  const launch = options?.launch ?? getMcpStdioLaunch();
  const port = options?.port ?? ARC_MCP_PORT;
  const secret = options?.secret ?? readAppPreferencesSync().localApiSecret ?? '';
  const httpJson = JSON.stringify(
    {
      mcpServers: {
        'arc-mcp': buildHttpMcpServerConfig(secret)
      }
    },
    null,
    2
  );
  const stdioJson = JSON.stringify(
    {
      mcpServers: {
        'arc-mcp': buildStdioMcpServerConfig(launch)
      }
    },
    null,
    2
  );

  return [
    '# Подключение ARC по MCP',
    '',
    'ARC должен быть запущен, переключатель MCP в настройках — включён.',
    '',
    'Ниже два варианта конфигурации. Если клиент умеет подключаться по URL — используйте HTTP.',
    'Иначе используйте stdio (локальный процесс).',
    '',
    'HTTP-запросы должны передавать заголовок X-ARC-Local-Token (секрет из настроек ARC).',
    '',
    `## HTTP (порт ${port})`,
    '',
    '```json',
    httpJson,
    '```',
    '',
    '## stdio (локальный процесс)',
    '',
    '```json',
    stdioJson,
    '```',
    ''
  ].join('\n');
}
