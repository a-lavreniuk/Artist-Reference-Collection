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



type McpSession = {

  server: McpServer;

  transport: StreamableHTTPServerTransport;

};



let httpServer: http.Server | null = null;

const sessions = new Map<string, McpSession>();



function isLocalAddress(req: IncomingMessage): boolean {

  const addr = req.socket.remoteAddress;

  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';

}



function readSessionId(req: IncomingMessage): string | undefined {

  const raw = req.headers['mcp-session-id'];

  if (typeof raw === 'string' && raw.trim()) return raw.trim();

  if (Array.isArray(raw) && typeof raw[0] === 'string' && raw[0].trim()) return raw[0].trim();

  return undefined;

}



function sendJson(res: ServerResponse, status: number, body: unknown): void {

  const payload = JSON.stringify(body);

  res.writeHead(status, {

    'Content-Type': 'application/json; charset=utf-8',

    'Content-Length': Buffer.byteLength(payload)

  });

  res.end(payload);

}



function sendMcpClientError(res: ServerResponse, status: number, message: string): void {

  sendJson(res, status, {

    jsonrpc: '2.0',

    error: { code: -32000, message },

    id: null

  });

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



async function closeMcpSession(sessionId: string): Promise<void> {

  const entry = sessions.get(sessionId);

  if (!entry) return;

  sessions.delete(sessionId);

  try {

    await entry.server.close();

  } catch {

    /* ignore */

  }

  try {

    await entry.transport.close();

  } catch {

    /* ignore */

  }

}



async function closeAllMcpSessions(): Promise<void> {

  const ids = [...sessions.keys()];

  await Promise.all(ids.map((sessionId) => closeMcpSession(sessionId)));

}



async function createMcpSession(): Promise<McpSession> {

  const server = new McpServer(

    { name: 'arc-mcp', version: app.getVersion() },

    {

      instructions:

        'Инструменты библиотеки ARC (Artist Reference Collection). Перед массовыми изменениями согласуйте действие с пользователем. Инструменты каталога меток управляют разделом «Метки» и не привязывают метки к карточкам автоматически.'

    }

  );

  registerArcMcpTools(server);



  let sessionEntry: McpSession | null = null;

  const transport = new StreamableHTTPServerTransport({

    sessionIdGenerator: () => randomUUID(),

    onsessioninitialized: (sessionId) => {

      if (sessionEntry) sessions.set(sessionId, sessionEntry);

    },

    onsessionclosed: (sessionId) => {

      void closeMcpSession(sessionId);

    }

  });



  sessionEntry = { server, transport };

  server.server.onclose = async () => {

    const sessionId = transport.sessionId;

    if (sessionId) await closeMcpSession(sessionId);

  };



  await server.connect(transport);

  return sessionEntry;

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



  const method = req.method ?? 'GET';

  const sessionId = readSessionId(req);



  try {

    if (method === 'POST') {

      const parsedBody = await readJsonBody(req, MAX_MCP_BODY_BYTES);

      if (sessionId) {

        const existing = sessions.get(sessionId);

        if (!existing) {

          sendMcpClientError(res, 400, 'Bad Request: No valid session ID provided');

          return;

        }

        await existing.transport.handleRequest(req, res, parsedBody);

        return;

      }



      const session = await createMcpSession();

      await session.transport.handleRequest(req, res, parsedBody);

      return;

    }



    if (method === 'GET' || method === 'DELETE') {

      if (!sessionId) {

        sendMcpClientError(res, 400, 'Bad Request: No valid session ID provided');

        return;

      }

      const existing = sessions.get(sessionId);

      if (!existing) {

        sendMcpClientError(res, 400, 'Bad Request: No valid session ID provided');

        return;

      }

      await existing.transport.handleRequest(req, res);

      return;

    }



    sendMcpClientError(res, 405, 'Method not allowed');

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

  await closeAllMcpSessions();



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


