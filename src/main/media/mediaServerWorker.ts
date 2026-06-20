import http from 'http';
import fs from 'fs';
import path from 'path';
import {
  isAllowedMediaExt,
  mimeForMediaExt,
  resolveMediaAbsFromParams
} from './arcMediaPath';

type MediaSectionTab = 'gallery' | 'collections' | 'moodboard';

let libraryRoot: string | null = null;
let activeTab: MediaSectionTab | null = 'gallery';
let mediaGeneration = 0;

function isSectionAllowed(sect: string | null): boolean {
  if (!sect) return true;
  if (sect !== 'gallery' && sect !== 'collections' && sect !== 'moodboard') return true;
  return activeTab === sect;
}

function reject(res: http.ServerResponse, code: number): void {
  res.writeHead(code);
  res.end();
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
    parsed.searchParams.get('abs')
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

    const headers: http.OutgoingHttpHeaders = {
      'Content-Type': mimeForMediaExt(ext),
      'Content-Length': st.size,
      'Cache-Control': 'private, max-age=86400'
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    res.writeHead(200, headers);
    const stream = fs.createReadStream(abs);
    stream.on('error', () => {
      if (!res.headersSent) reject(res, 500);
      else res.destroy();
    });
    stream.pipe(res);
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
    | { type: 'active-tab'; tab: MediaSectionTab | null; generation: number };

  if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

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
