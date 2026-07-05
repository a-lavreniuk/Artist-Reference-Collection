import { randomUUID } from 'crypto';
import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { app } from 'electron';

import { readAppPreferencesSync } from '../appPreferences';
import {
  ARC_MCP_HOST,
  ARC_MCP_PATH,
  ARC_MCP_PORT,
  MAX_MCP_BODY_BYTES
} from './constants';
import { registerArcMcpTools } from './registerTools';

let httpServer: http.Server | null = null;
let mcpServer: McpServer | null = null;
let transport: StreamableHTTPServerTransport | null = null;
let mcpReady: Promise<void> | null = null;

function isLocalAddress(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress;
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return undefined;
  return JSON.parse(raw) as unknown;
}

async function ensureMcpRuntime(): Promise<StreamableHTTPServerTransport> {
  if (transport && mcpServer) return transport;
  if (!mcpReady) {
    mcpReady = (async () => {
      mcpServer = new McpServer(
        { name: 'arc-mcp', version: app.getVersion() },
        {
          instructions:
            'ARC (Artist Reference Collection) library tools. Confirm bulk changes with the user first. Tag/category tools only manage the catalog — they do not attach tags to cards.'
        }
      );
      registerArcMcpTools(mcpServer);
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
      });
      await mcpServer.connect(transport);
    })();
  }
  await mcpReady;
  if (!transport) {
    throw new Error('MCP transport failed to initialize');
  }
  return transport;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isLocalAddress(req)) {
    sendJson(res, 403, { status: 'error', message: 'Forbidden' });
    return;
  }

  let pathname = '/';
  try {
    pathname = new URL(req.url ?? '/', `http://${ARC_MCP_HOST}`).pathname;
  } catch {
    sendJson(res, 400, { status: 'error', message: 'Bad request' });
    return;
  }

  if (pathname !== ARC_MCP_PATH) {
    sendJson(res, 404, { status: 'error', message: 'Not found' });
    return;
  }

  if (!readAppPreferencesSync().mcpServerEnabled) {
    sendJson(res, 403, { status: 'error', message: 'MCP server disabled' });
    return;
  }

  try {
    const activeTransport = await ensureMcpRuntime();
    let parsedBody: unknown;
    if (req.method === 'POST') {
      parsedBody = await readJsonBody(req, MAX_MCP_BODY_BYTES);
    }
    await activeTransport.handleRequest(req, res, parsedBody);
  } catch (err) {
    if (err instanceof Error && err.message === 'BODY_TOO_LARGE') {
      sendJson(res, 413, { status: 'error', message: 'Request body too large' });
      return;
    }
    if (!res.headersSent) {
      sendJson(res, 500, { status: 'error', message: 'Internal error' });
    }
  }
}

export function isMcpServerRunning(): boolean {
  return httpServer != null;
}

export async function startMcpServer(): Promise<void> {
  if (httpServer) return;

  await new Promise<void>((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      void handleRequest(req, res).catch(() => {
        if (!res.headersSent) {
          sendJson(res, 500, { status: 'error', message: 'Internal error' });
        }
      });
    });

    srv.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[ARC MCP] Port ${ARC_MCP_PORT} is already in use`);
        resolve();
        return;
      }
      reject(err);
    });

    srv.listen(ARC_MCP_PORT, ARC_MCP_HOST, () => {
      httpServer = srv;
      console.info(`[ARC MCP] listening on http://${ARC_MCP_HOST}:${ARC_MCP_PORT}${ARC_MCP_PATH}`);
      resolve();
    });
  });
}

export async function stopMcpServer(): Promise<void> {
  if (mcpServer) {
    await mcpServer.close();
    mcpServer = null;
  }
  transport = null;
  mcpReady = null;

  if (!httpServer) return;
  await new Promise<void>((resolve) => {
    httpServer!.close(() => resolve());
  });
  httpServer = null;
}

export async function restartMcpServer(): Promise<void> {
  await stopMcpServer();
  await startMcpServer();
}
