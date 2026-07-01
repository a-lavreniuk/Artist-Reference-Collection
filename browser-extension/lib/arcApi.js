export const ARC_API_BASE = 'http://127.0.0.1:47896/api/v1';

/**
 * @returns {Promise<{ ok: true, data: object } | { ok: false, reason: 'offline' | 'disabled' }>}
 */
export async function checkArc() {
  try {
    const res = await fetch(`${ARC_API_BASE}/app/info`, { method: 'GET' });
    if (!res.ok) return { ok: false, reason: 'offline' };
    const json = await res.json();
    if (json?.status !== 'success' || !json.data?.importApiEnabled) {
      return { ok: false, reason: 'disabled' };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, reason: 'offline' };
  }
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
  const res = await fetch(`${ARC_API_BASE}/item/add`, {
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
    return { ok: false, code: 'error', message: json?.message ?? `HTTP ${res.status}` };
  }
  return { ok: true, id: json.data?.id };
}
