import type { IncomingMessage } from 'http';
import { timingSafeEqual } from 'crypto';

/** Header for Import API and HTTP MCP (shared local secret). */
export const ARC_LOCAL_TOKEN_HEADER = 'x-arc-local-token';

function readHeaderToken(req: IncomingMessage): string {
  const raw = req.headers[ARC_LOCAL_TOKEN_HEADER] ?? req.headers['authorization'];
  if (typeof raw === 'string') {
    const v = raw.trim();
    if (/^bearer\s+/i.test(v)) return v.replace(/^bearer\s+/i, '').trim();
    return v;
  }
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    const v = raw[0].trim();
    if (/^bearer\s+/i.test(v)) return v.replace(/^bearer\s+/i, '').trim();
    return v;
  }
  return '';
}

function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  if (ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

/** True when request presents the expected local API secret. */
export function requestHasValidLocalApiToken(req: IncomingMessage, expectedSecret: string): boolean {
  const expected = expectedSecret.trim();
  if (!expected) return false;
  const provided = readHeaderToken(req);
  if (!provided) return false;
  return safeEqualString(provided, expected);
}
