import http from 'http';
import fs from 'fs';
import path from 'path';
import {
  isAllowedMediaExt,
  mimeForMediaExt,
  resolveMediaAbsFromParams
} from './arcMediaPath';
import { parseSingleByteRange } from './mediaServerRange';

type MediaSectionTab = 'gallery' | 'collections' | 'moodboard';

type StagingEntry = {
  absPath: string;
  expiresAt: number;
};

let libraryRoot: string | null = null;
let activeTab: MediaSectionTab | null = 'gallery';
let mediaGeneration = 0;
const stagingByToken = new Map<string, StagingEntry>();

function isSectionAllowed(sect: string | null): boolean {
  if (!sect) return true;
  if (sect !== 'gallery' && sect !== 'collections' && sect !== 'moodboard') return true;
  return activeTab === sect;
}

function reject(res: http.ServerResponse, code: number, headers?: http.OutgoingHttpHeaders): void {
  res.writeHead(code, headers);
  res.end();
}

function mediaResponseHeaders(
  ext: string,
  extra: http.OutgoingHttpHeaders = {}
): http.OutgoingHttpHeaders {
  return {
    'Content-Type': mimeForMediaExt(ext),
    'Cache-Control': 'private, max-age=86400',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    ...extra
  };
}

function pipeReadStream(
  res: http.ServerResponse,
  abs: string,
  start: number,
  end: number
): void {
  const stream = fs.createReadStream(abs, { start, end });
  stream.on('error', () => {
    if (!res.headersSent) reject(res, 500);
    else res.destroy();
  });
  stream.pipe(res);
}

function sendFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  abs: string,
  ext: string,
  fileSize: number
): void {
  const baseHeaders = mediaResponseHeaders(ext);
  const range = parseSingleByteRange(req.headers.range, fileSize);

  if (range === 'unsatisfiable') {
    reject(res, 416, {
      ...baseHeaders,
      'Content-Range': `bytes */${fileSize}`
    });
    return;
  }

  if (range) {
    const chunkSize = range.end - range.start + 1;
    const headers = mediaResponseHeaders(ext, {
      'Content-Length': chunkSize,
      'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`
    });
    res.writeHead(206, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    pipeReadStream(res, abs, range.start, range.end);
    return;
  }

  const headers = mediaResponseHeaders(ext, {
    'Content-Length': fileSize
  });
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  pipeReadStream(res, abs, 0, fileSize - 1);
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    reject(res, 405);
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(req.url ?? '/', 'http://127.0.0.1');
  } catch {
    reject(res, 400);
    return;
  }

  const sect = parsed.searchParams.get('sect');
  const genAtStart = mediaGeneration;
  if (!isSectionAllowed(sect)) {
    reject(res, 204);
    return;
  }

  const abs = resolveMediaAbsFromParams(
    libraryRoot,
    parsed.searchParams.get('rel'),
    parsed.searchParams.get('stg'),
    stagingByToken
  );
  if (!abs) {
    reject(res, 404);
    return;
  }

  const ext = path.extname(abs);
  if (!isAllowedMediaExt(ext)) {
    reject(res, 403);
    return;
  }

  if (genAtStart !== mediaGeneration || !isSectionAllowed(sect)) {
    reject(res, 204);
    return;
  }

  fs.stat(abs, (err, st) => {
    if (err || !st.isFile() || genAtStart !== mediaGeneration || !isSectionAllowed(sect)) {
      reject(res, err ? 404 : 204);
      return;
    }

    sendFile(req, res, abs, ext, st.size);
  });
}

const server = http.createServer(handleRequest);

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const origin = `http://127.0.0.1:${port}`;
  process.parentPort.postMessage({ type: 'ready', origin });
});

process.parentPort.on('message', (event: { data: unknown }) => {
  const msg = event.data as
    | { type: 'init'; libraryRoot: string | null }
    | { type: 'library-root'; libraryRoot: string | null }
    | { type: 'active-tab'; tab: MediaSectionTab | null; generation: number }
    | { type: 'staging-register'; token: string; absPath: string; expiresAt: number };

  if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

  if (msg.type === 'staging-register') {
    if (typeof msg.token === 'string' && typeof msg.absPath === 'string' && typeof msg.expiresAt === 'number') {
      stagingByToken.set(msg.token, { absPath: msg.absPath, expiresAt: msg.expiresAt });
    }
    return;
  }

  if (msg.type === 'init' || msg.type === 'library-root') {
    libraryRoot = msg.libraryRoot;
    return;
  }

  if (msg.type === 'active-tab') {
    if (activeTab !== msg.tab) {
      mediaGeneration += 1;
    }
    activeTab = msg.tab;
    if (typeof msg.generation === 'number') {
      mediaGeneration = Math.max(mediaGeneration, msg.generation);
    }
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
