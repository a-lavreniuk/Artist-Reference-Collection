import http from 'http';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { app } from 'electron';

import { ARC_MCP_HOST, ARC_MCP_PATH, ARC_MCP_PORT, ARC_MCP_URL } from './constants';
import { isMcpStdioArgv } from './mcpStdioArgv';

export { isMcpStdioArgv } from './mcpStdioArgv';

const WATCHDOG_MS = 5000;
const WATCHDOG_FAILS_BEFORE_EXIT = 2;

/** Keep MCP stdio clean: never write non-protocol bytes to stdout. */
export function silenceStdoutLogging(): void {
  const toStderr = (...args: unknown[]) => {
    console.error(...args);
  };
  console.log = toStderr;
  console.info = toStderr;
  console.debug = toStderr;
  console.warn = toStderr;
}

async function probeArcMcpHttp(timeoutMs = 2500): Promise<{ ok: true } | { ok: false; reason: string }> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: ARC_MCP_HOST,
        port: ARC_MCP_PORT,
        path: ARC_MCP_PATH,
        method: 'GET',
        timeout: timeoutMs
      },
      (res) => {
        res.resume();
        // 401/403/405/406 still mean the listener is up
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve({ ok: true });
          return;
        }
        resolve({ ok: false, reason: `HTTP ${res.statusCode ?? '?'}` });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({
        ok: false,
        reason: 'Сервер MCP не отвечает. Запустите ARC и включите MCP в настройках.'
      });
    });
    req.on('error', () => {
      resolve({
        ok: false,
        reason: 'Сервер MCP недоступен. Запустите ARC и включите MCP в настройках.'
      });
    });
    req.end();
  });
}

async function connectHttpClient(): Promise<Client> {
  const httpTransport = new StreamableHTTPClientTransport(new URL(ARC_MCP_URL));
  const client = new Client({ name: 'arc-mcp-stdio-bridge', version: app.getVersion() });
  await client.connect(httpTransport);
  return client;
}

/**
 * Stdio MCP entry: bridges local client ↔ HTTP MCP in the running ARC GUI process.
 * Does not open a window and must not write to stdout except JSON-RPC.
 */
export async function runMcpStdioHost(): Promise<void> {
  silenceStdoutLogging();

  const probe = await probeArcMcpHttp();
  if (!probe.ok) {
    console.error(`[ARC MCP] ${probe.reason}`);
    app.exit(1);
    return;
  }

  let client: Client;
  try {
    client = await connectHttpClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[ARC MCP] Не удалось подключиться к HTTP MCP (${ARC_MCP_URL}): ${msg}. Включите MCP в настройках ARC.`
    );
    app.exit(1);
    return;
  }

  async function withClientRetry<T>(fn: (c: Client) => Promise<T>): Promise<T> {
    try {
      return await fn(client);
    } catch (firstErr) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
      try {
        client = await connectHttpClient();
        return await fn(client);
      } catch {
        throw firstErr;
      }
    }
  }

  const server = new Server(
    { name: 'arc-mcp', version: app.getVersion() },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      instructions:
        'Инструменты библиотеки ARC (Artist Reference Collection). Перед массовыми изменениями согласуйте действие с пользователем.'
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => withClientRetry((c) => c.listTools()));
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    withClientRetry((c) =>
      c.callTool({
        name: request.params.name,
        arguments: request.params.arguments
      })
    )
  );
  server.setRequestHandler(ListResourcesRequestSchema, async () =>
    withClientRetry((c) => c.listResources())
  );
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () =>
    withClientRetry((c) => c.listResourceTemplates())
  );
  server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
    withClientRetry((c) => c.readResource({ uri: request.params.uri }))
  );
  server.setRequestHandler(ListPromptsRequestSchema, async () => withClientRetry((c) => c.listPrompts()));
  server.setRequestHandler(GetPromptRequestSchema, async (request) =>
    withClientRetry((c) =>
      c.getPrompt({
        name: request.params.name,
        arguments: request.params.arguments
      })
    )
  );

  const stdio = new StdioServerTransport();
  await server.connect(stdio);

  let consecutiveProbeFails = 0;
  const watchdog = setInterval(() => {
    void probeArcMcpHttp(1500).then((result) => {
      if (result.ok) {
        consecutiveProbeFails = 0;
        return;
      }
      consecutiveProbeFails += 1;
      if (consecutiveProbeFails >= WATCHDOG_FAILS_BEFORE_EXIT) {
        clearInterval(watchdog);
        console.error(`[ARC MCP] ${result.reason}`);
        app.exit(1);
      }
    });
  }, WATCHDOG_MS);

  await new Promise<void>((resolve) => {
    stdio.onclose = () => resolve();
    process.stdin.on('end', () => resolve());
    process.stdin.on('close', () => resolve());
  });

  clearInterval(watchdog);
  try {
    await client.close();
  } catch {
    /* ignore */
  }
  app.exit(0);
}
