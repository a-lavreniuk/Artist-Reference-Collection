import { ARC_IMPORT_API_PORT } from './constants';
import type { AppInfoData, ImportApiHandlerDeps, ItemAddRequestBody, JSendResponse } from './types';

export function buildAppInfoData(
  deps: Pick<ImportApiHandlerDeps, 'getAppVersion' | 'getPlatform' | 'isApiEnabled'>
): AppInfoData {
  return {
    name: 'ARC',
    version: deps.getAppVersion(),
    platform: deps.getPlatform(),
    importApiEnabled: deps.isApiEnabled(),
    importApiPort: ARC_IMPORT_API_PORT
  };
}

export function handleAppInfo(deps: ImportApiHandlerDeps): JSendResponse<AppInfoData> {
  return { status: 'success', data: buildAppInfoData(deps) };
}

function parseItemAddBody(raw: unknown): ItemAddRequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const body: ItemAddRequestBody = {};
  if (typeof o.url === 'string') body.url = o.url;
  if (typeof o.base64 === 'string') body.base64 = o.base64;
  if (typeof o.website === 'string') body.website = o.website;
  if (typeof o.pageTitle === 'string') body.pageTitle = o.pageTitle;
  if (typeof o.name === 'string') body.name = o.name;
  return body;
}

export function validateItemUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export type ItemAddHttpStatus = 200 | 400 | 403 | 503 | 500;

export type ItemAddResult = {
  status: ItemAddHttpStatus;
  body: JSendResponse<{ id: string }>;
};

export async function handleItemAdd(deps: ImportApiHandlerDeps, rawBody: unknown): Promise<ItemAddResult> {
  if (!deps.isApiEnabled()) {
    return { status: 403, body: { status: 'error', message: 'Import API disabled' } };
  }

  const libraryRoot = deps.getLibraryRoot();
  if (!libraryRoot) {
    return { status: 503, body: { status: 'error', message: 'Library not selected' } };
  }

  const body = parseItemAddBody(rawBody);
  if (!body) {
    return { status: 400, body: { status: 'error', message: 'Invalid request body' } };
  }

  const url = body.url?.trim();
  if (!url) {
    return { status: 400, body: { status: 'error', message: 'url is required' } };
  }

  if (body.base64?.trim()) {
    return { status: 400, body: { status: 'error', message: 'base64 import is not supported in MVP' } };
  }

  if (!validateItemUrl(url)) {
    return { status: 400, body: { status: 'error', message: 'Invalid url' } };
  }

  const name = deps.resolveCardName(body.pageTitle, body.name);
  const website = body.website?.trim() || undefined;

  const result = await deps.importFromUrl({
    libraryRoot,
    url,
    website,
    name
  });

  if (!result.ok) {
    return { status: 500, body: { status: 'error', message: result.error } };
  }

  return { status: 200, body: { status: 'success', data: { id: result.id } } };
}
