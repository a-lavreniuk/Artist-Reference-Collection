import path from 'path';

import { ipcMain } from 'electron';

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

export function buildHttpMcpServerConfig(): Record<string, unknown> {
  return {
    transport: 'http',
    type: 'streamable-http',
    streamable: true,
    url: ARC_MCP_URL
  };
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
}): string {
  const launch = options?.launch ?? getMcpStdioLaunch();
  const port = options?.port ?? ARC_MCP_PORT;
  const httpJson = JSON.stringify(
    {
      mcpServers: {
        'arc-mcp': buildHttpMcpServerConfig()
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
