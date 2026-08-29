const WINDOW_MS = 1000;
const MAX_HITS = 40;

const hits: number[] = [];

/** Simple localhost rate limit for Import API / MCP. */
export function isLocalHttpRateLimited(): boolean {
  const now = Date.now();
  while (hits.length > 0 && now - hits[0]! >= WINDOW_MS) hits.shift();
  if (hits.length >= MAX_HITS) return true;
  hits.push(now);
  return false;
}
