import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';

import { app } from 'electron';

import { readAppPreferencesSync } from '../appPreferences';
import { readLibraryRootSync } from '../libraryRootConfig';
import { importMediaFile } from '../storage/libraryStorage';
import { refreshLibrarySessionSnapshotFromDisk } from '../librarySessionSnapshot';
import { notifyRendererExtensionImport } from './notifyRenderer';
import { ARC_IMPORT_API_HOST, ARC_IMPORT_API_PORT, MAX_IMPORT_BODY_BYTES } from './constants';
import { handleAppInfo, handleItemAdd } from './importApiHandlers';
import { downloadUrlToTempFile } from './importFromRemote';
import type { ImportApiHandlerDeps } from './types';

let server: http.Server | null = null;

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
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function resolveCardNameFromPrefs(pageTitle?: string, explicitName?: string): string | undefined {
  const prefs = readAppPreferencesSync();
  const explicit = explicitName?.trim();
  if (explicit) {
    if (prefs.importApiPrefixEnabled && prefs.importApiPrefixText.trim()) {
      return `${prefs.importApiPrefixText.trim()} ${explicit}`;
    }
    return explicit;
  }
  const title = pageTitle?.trim();
  if (!title) return undefined;
  if (prefs.importApiPrefixEnabled && prefs.importApiPrefixText.trim()) {
    return `${prefs.importApiPrefixText.trim()} ${title}`;
  }
  return title;
}

function buildDeps(): ImportApiHandlerDeps {
  return {
    getAppVersion: () => app.getVersion(),
    getPlatform: () => process.platform,
    getLibraryRoot: () => readLibraryRootSync(),
    isApiEnabled: () => readAppPreferencesSync().importApiEnabled,
    resolveCardName: resolveCardNameFromPrefs,
    importFromUrl: async ({ libraryRoot, url, website, name }) => {
      let cleanup: (() => Promise<void>) | null = null;
      try {
        const { tempPath, cleanup: rm } = await downloadUrlToTempFile(url, MAX_IMPORT_BODY_BYTES);
        cleanup = rm;
        const result = await importMediaFile(libraryRoot, tempPath, {
          linkUrl: website,
          name
        });
        if (!result.ok) {
          return { ok: false, error: result.error };
        }
        const { queueCardsForIndexing } = await import('../ipcAi');
        void queueCardsForIndexing([result.row.id]);
        void refreshLibrarySessionSnapshotFromDisk();
        notifyRendererExtensionImport([result.row.id]);
        return { ok: true, id: result.row.id };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Import failed';
        return { ok: false, error: message };
      } finally {
        if (cleanup) await cleanup();
      }
    }
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!isLocalAddress(req)) {
    sendJson(res, 403, { status: 'error', message: 'Forbidden' });
    return;
  }

  let pathname = '/';
  try {
    pathname = new URL(req.url ?? '/', `http://${ARC_IMPORT_API_HOST}`).pathname;
  } catch {
    sendJson(res, 400, { status: 'error', message: 'Bad request' });
    return;
  }

  const deps = buildDeps();

  if (req.method === 'GET' && pathname === '/api/v1/app/info') {
    sendJson(res, 200, handleAppInfo(deps));
    return;
  }

  if (req.method === 'POST' && pathname === '/api/v1/item/add') {
    try {
      const body = await readJsonBody(req, MAX_IMPORT_BODY_BYTES);
      const result = await handleItemAdd(deps, body);
      sendJson(res, result.status, result.body);
    } catch (err) {
      if (err instanceof Error && err.message === 'BODY_TOO_LARGE') {
        sendJson(res, 413, { status: 'error', message: 'Request body too large' });
        return;
      }
      sendJson(res, 400, { status: 'error', message: 'Invalid JSON' });
    }
    return;
  }

  sendJson(res, 404, { status: 'error', message: 'Not found' });
}

export function isImportApiServerRunning(): boolean {
  return server != null;
}

export async function startImportApiServer(): Promise<void> {
  if (server) return;

  const prefs = readAppPreferencesSync();
  if (!prefs.importApiEnabled) return;

  await new Promise<void>((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      void handleRequest(req, res).catch(() => {
        sendJson(res, 500, { status: 'error', message: 'Internal error' });
      });
    });

    srv.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[ARC Import API] Port ${ARC_IMPORT_API_PORT} is already in use`);
        resolve();
        return;
      }
      reject(err);
    });

    srv.listen(ARC_IMPORT_API_PORT, ARC_IMPORT_API_HOST, () => {
      server = srv;
      resolve();
    });
  });
}

export function stopImportApiServer(): void {
  if (!server) return;
  server.close();
  server = null;
}

export async function restartImportApiServer(): Promise<void> {
  stopImportApiServer();
  await startImportApiServer();
}
