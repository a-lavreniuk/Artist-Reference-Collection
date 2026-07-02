export const ARC_API_HOSTS = ['127.0.0.1', 'localhost'];
export const ARC_API_PORT = 47896;
const REQUEST_TIMEOUT_MS = 2500;

function apiBase(host) {
  return `http://${host}:${ARC_API_PORT}/api/v1`;
}

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
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
 * @param {{ url: string, website?: string, pageTitle?: string }} payload
 */
export async function importItem(payload) {
  const body = {
    url: payload.url,
    website: payload.website,
    pageTitle: payload.pageTitle
  };

  let lastError = null;

  for (const host of ARC_API_HOSTS) {
    try {
      const res = await fetchWithTimeout(`${apiBase(host)}/item/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (res.status === 503) {
        return { ok: false, code: 'no_library', message: json?.message ?? 'Library not selected' };
      }
      if (res.status === 403) {
        return { ok: false, code: 'disabled', message: json?.message ?? 'Import API disabled' };
      }
      if (!res.ok || json?.status !== 'success') {
        lastError = json?.message ?? `HTTP ${res.status}`;
        continue;
      }
      return { ok: true, id: json.data?.id };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }
  }

  return { ok: false, code: 'error', message: lastError ?? 'ARC unreachable' };
}
