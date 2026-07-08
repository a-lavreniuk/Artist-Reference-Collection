export const ARC_API_HOSTS = ['127.0.0.1', 'localhost'];
/** Must match ARC_IMPORT_API_HOST in src/main/importApi/constants.ts */
export const ARC_API_PRIMARY_HOST = '127.0.0.1';
export const ARC_API_PORT = 47896;
const REQUEST_TIMEOUT_MS = 2500;
/** Server downloads remote image before responding — keep well above info ping timeout. */
const IMPORT_REQUEST_TIMEOUT_MS = 60_000;

function apiBase(host) {
  return `http://${host}:${ARC_API_PORT}/api/v1`;
}

function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isAbortError(err) {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * @returns {Promise<{ ok: true, data: object } | { ok: false, reason: 'offline' | 'disabled' }>}
 */
export async function checkArc() {
  let sawHttp = false;

  for (const host of ARC_API_HOSTS) {
    try {
      const res = await fetchWithTimeout(`${apiBase(host)}/app/info`, {
        method: 'GET',
        cache: 'no-store'
      });
      sawHttp = true;
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.status !== 'success') continue;
      if (!json.data?.importApiEnabled) {
        return { ok: false, reason: 'disabled' };
      }
      return { ok: true, data: json.data };
    } catch {
      // try next host
    }
  }

  if (sawHttp) {
    return { ok: false, reason: 'disabled' };
  }
  return { ok: false, reason: 'offline' };
}

/**
 * @param {{ url: string, fallbackUrl?: string, website?: string, pageTitle?: string, name?: string, collectionId?: string, quiet?: boolean }} payload
 */
export async function importItem(payload) {
  const body = {
    url: payload.url,
    website: payload.website,
    pageTitle: payload.pageTitle
  };

  if (payload.fallbackUrl?.trim()) {
    body.fallbackUrl = payload.fallbackUrl.trim();
  }
  if (payload.name?.trim()) {
    body.name = payload.name.trim();
  }
  if (payload.collectionId?.trim()) {
    body.collectionId = payload.collectionId.trim();
  }
  if (payload.quiet === true) {
    body.quiet = true;
  }

  // Single host only: 127.0.0.1 and localhost hit the same server; retrying after
  // client timeout duplicates cards because the first request may already be processed.
  try {
    const res = await fetchWithTimeout(
      `${apiBase(ARC_API_PRIMARY_HOST)}/item/add`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      },
      IMPORT_REQUEST_TIMEOUT_MS
    );
    const json = await res.json();
    if (res.status === 503) {
      return { ok: false, code: 'no_library', message: json?.message ?? 'Library not selected' };
    }
    if (res.status === 403) {
      return { ok: false, code: 'disabled', message: json?.message ?? 'Import API disabled' };
    }
    if (!res.ok || json?.status !== 'success') {
      return { ok: false, code: 'error', message: json?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, id: json.data?.id };
  } catch (err) {
    if (isAbortError(err)) {
      return { ok: false, code: 'error', message: 'Import timed out' };
    }
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, code: 'error', message };
  }
}

/**
 * @param {string} name
 * @returns {Promise<{ ok: true, id: string, name: string, created: boolean } | { ok: false, code: string, message?: string }>}
 */
export async function ensureCollection(name) {
  const trimmed = name?.trim();
  if (!trimmed) {
    return { ok: false, code: 'error', message: 'Collection name is required' };
  }

  try {
    const res = await fetchWithTimeout(
      `${apiBase(ARC_API_PRIMARY_HOST)}/collection/ensure`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      },
      IMPORT_REQUEST_TIMEOUT_MS
    );
    const json = await res.json();
    if (res.status === 503) {
      return { ok: false, code: 'no_library', message: json?.message ?? 'Library not selected' };
    }
    if (res.status === 403) {
      return { ok: false, code: 'disabled', message: json?.message ?? 'Import API disabled' };
    }
    if (!res.ok || json?.status !== 'success') {
      return { ok: false, code: 'error', message: json?.message ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      id: json.data?.id,
      name: json.data?.name ?? trimmed,
      created: json.data?.created === true
    };
  } catch (err) {
    if (isAbortError(err)) {
      return { ok: false, code: 'error', message: 'Request timed out' };
    }
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, code: 'error', message };
  }
}
