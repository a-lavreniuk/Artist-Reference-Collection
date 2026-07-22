import { ARC_IMPORT_API_PORT } from './constants';
import type {
  AppInfoData,
  CollectionEnsureRequestBody,
  ImportApiHandlerDeps,
  ImportMediaKind,
  ItemAddRequestBody,
  JSendResponse
} from './types';

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
  if (typeof o.fallbackUrl === 'string') body.fallbackUrl = o.fallbackUrl;
  if (o.mediaKind === 'image' || o.mediaKind === 'video') body.mediaKind = o.mediaKind;
  if (typeof o.base64 === 'string') body.base64 = o.base64;
  if (typeof o.website === 'string') body.website = o.website;
  if (typeof o.pageTitle === 'string') body.pageTitle = o.pageTitle;
  if (typeof o.name === 'string') body.name = o.name;
  if (typeof o.collectionId === 'string') body.collectionId = o.collectionId;
  if (o.quiet === true) body.quiet = true;
  if (o.force === true) body.force = true;
  return body;
}

function parseCollectionEnsureBody(raw: unknown): CollectionEnsureRequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const body: CollectionEnsureRequestBody = {};
  if (typeof o.name === 'string') body.name = o.name;
  if (typeof o.description === 'string') body.description = o.description;
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

export type ItemAddHttpStatus = 200 | 400 | 403 | 409 | 503 | 500;

export type ItemAddResult = {
  status: ItemAddHttpStatus;
  body: JSendResponse<{ id: string }>;
};

export type CollectionEnsureHttpStatus = 200 | 400 | 403 | 503 | 500;

export type CollectionEnsureResult = {
  status: CollectionEnsureHttpStatus;
  body: JSendResponse<{ id: string; name: string; created: boolean }>;
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
  const collectionId = body.collectionId?.trim() || undefined;
  const fallbackCandidate = body.fallbackUrl?.trim();
  const fallbackUrl =
    fallbackCandidate && validateItemUrl(fallbackCandidate) ? fallbackCandidate : undefined;
  const mediaKind: ImportMediaKind | undefined =
    body.mediaKind === 'video' || body.mediaKind === 'image' ? body.mediaKind : undefined;

  const result = await deps.importFromUrl({
    libraryRoot,
    url,
    fallbackUrl,
    mediaKind,
    website,
    name,
    collectionId,
    quiet: body.quiet === true,
    force: body.force === true
  });

  if (!result.ok) {
    const maintenance = /maintenance/i.test(result.error);
    const status =
      result.statusHint ??
      (maintenance ? 503 : /duplicate/i.test(result.error) ? 409 : 500);
    return {
      status,
      body: { status: 'error', message: result.error }
    };
  }

  return { status: 200, body: { status: 'success', data: { id: result.id } } };
}

export async function handleCollectionEnsure(
  deps: ImportApiHandlerDeps,
  rawBody: unknown
): Promise<CollectionEnsureResult> {
  if (!deps.isApiEnabled()) {
    return { status: 403, body: { status: 'error', message: 'Import API disabled' } };
  }

  const libraryRoot = deps.getLibraryRoot();
  if (!libraryRoot) {
    return { status: 503, body: { status: 'error', message: 'Library not selected' } };
  }

  const body = parseCollectionEnsureBody(rawBody);
  if (!body) {
    return { status: 400, body: { status: 'error', message: 'Invalid request body' } };
  }

  const name = body.name?.trim();
  if (!name) {
    return { status: 400, body: { status: 'error', message: 'name is required' } };
  }

  const result = await deps.ensureCollection({
    libraryRoot,
    name,
    description: body.description?.trim() || undefined
  });

  if (!result.ok) {
    const maintenance = /maintenance/i.test(result.error);
    return {
      status: maintenance ? 503 : 500,
      body: { status: 'error', message: result.error }
    };
  }

  return {
    status: 200,
    body: {
      status: 'success',
      data: { id: result.id, name: result.name, created: result.created }
    }
  };
}
