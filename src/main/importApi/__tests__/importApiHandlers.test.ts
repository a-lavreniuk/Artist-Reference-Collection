import { describe, expect, it, vi } from 'vitest';

import { ARC_IMPORT_API_PORT } from '../constants';
import { buildAppInfoData, handleAppInfo, handleCollectionEnsure, handleItemAdd, validateItemUrl } from '../importApiHandlers';
import type { ImportApiHandlerDeps } from '../types';

function makeDeps(overrides: Partial<ImportApiHandlerDeps> = {}): ImportApiHandlerDeps {
  return {
    getAppVersion: () => '0.1.2',
    getPlatform: () => 'win32',
    getLibraryRoot: () => '/library',
    isApiEnabled: () => true,
    resolveCardName: (pageTitle) => pageTitle?.trim(),
    importFromUrl: vi.fn(async () => ({ ok: true, id: 'card-1' })),
    ensureCollection: vi.fn(async () => ({
      ok: true,
      id: 'col-1',
      name: 'Board',
      created: true
    })),
    ...overrides
  };
}

describe('validateItemUrl', () => {
  it('accepts http and https', () => {
    expect(validateItemUrl('https://example.com/a.jpg')).toBe(true);
    expect(validateItemUrl('http://example.com/a.jpg')).toBe(true);
  });

  it('rejects invalid urls', () => {
    expect(validateItemUrl('ftp://example.com/a.jpg')).toBe(false);
    expect(validateItemUrl('not-a-url')).toBe(false);
  });
});

describe('handleAppInfo', () => {
  it('returns app metadata', () => {
    const res = handleAppInfo(makeDeps());
    expect(res.status).toBe('success');
    if (res.status === 'success') {
      expect(res.data.name).toBe('ARC');
      expect(res.data.importApiPort).toBe(ARC_IMPORT_API_PORT);
      expect(res.data.importApiEnabled).toBe(true);
    }
  });
});

describe('buildAppInfoData', () => {
  it('reflects disabled API', () => {
    const data = buildAppInfoData({
      getAppVersion: () => '1.0.0',
      getPlatform: () => 'darwin',
      isApiEnabled: () => false
    });
    expect(data.importApiEnabled).toBe(false);
    expect(data.platform).toBe('darwin');
  });
});

describe('handleItemAdd', () => {
  it('returns 403 when API disabled', async () => {
    const res = await handleItemAdd(makeDeps({ isApiEnabled: () => false }), {
      url: 'https://example.com/a.png'
    });
    expect(res.status).toBe(403);
  });

  it('returns 503 when library missing', async () => {
    const res = await handleItemAdd(makeDeps({ getLibraryRoot: () => null }), {
      url: 'https://example.com/a.png'
    });
    expect(res.status).toBe(503);
  });

  it('returns 400 when url missing', async () => {
    const res = await handleItemAdd(makeDeps(), {});
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid url scheme', async () => {
    const res = await handleItemAdd(makeDeps(), { url: 'file:///tmp/a.png' });
    expect(res.status).toBe(400);
  });

  it('imports with metadata', async () => {
    const importFromUrl = vi.fn(async () => ({ ok: true as const, id: 'uuid-1' }));
    const deps = makeDeps({
      resolveCardName: () => 'prefix Title',
      importFromUrl
    });
    const res = await handleItemAdd(deps, {
      url: 'https://cdn.example/photo.jpg',
      website: 'https://example.com/page',
      pageTitle: 'Title'
    });
    expect(res.status).toBe(200);
    expect(importFromUrl).toHaveBeenCalledWith({
      libraryRoot: '/library',
      url: 'https://cdn.example/photo.jpg',
      fallbackUrl: undefined,
      mediaKind: undefined,
      website: 'https://example.com/page',
      name: 'prefix Title',
      collectionId: undefined,
      quiet: false,
      force: false
    });
  });

  it('forwards a valid fallbackUrl and drops an invalid one', async () => {
    const importFromUrl = vi.fn(async () => ({ ok: true as const, id: 'uuid-2' }));
    const deps = makeDeps({ resolveCardName: () => undefined, importFromUrl });

    await handleItemAdd(deps, {
      url: 'https://cdn.example/originals/a.jpg',
      fallbackUrl: 'https://cdn.example/236x/a.jpg'
    });
    expect(importFromUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({ fallbackUrl: 'https://cdn.example/236x/a.jpg' })
    );

    await handleItemAdd(deps, {
      url: 'https://cdn.example/originals/b.jpg',
      fallbackUrl: 'not-a-url'
    });
    expect(importFromUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({ fallbackUrl: undefined })
    );
  });

  it('forwards mediaKind to importFromUrl', async () => {
    const importFromUrl = vi.fn(async () => ({ ok: true as const, id: 'uuid-3' }));
    const deps = makeDeps({ importFromUrl });

    await handleItemAdd(deps, {
      url: 'https://v.pinimg.com/videos/mc/720p/aa/bb/cc/clip.mp4',
      mediaKind: 'video'
    });

    expect(importFromUrl).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: 'https://v.pinimg.com/videos/mc/720p/aa/bb/cc/clip.mp4',
        mediaKind: 'video'
      })
    );
  });

  it('returns 500 when import fails', async () => {
    const res = await handleItemAdd(
      makeDeps({
        importFromUrl: vi.fn(async () => ({ ok: false, error: 'Download failed' }))
      }),
      { url: 'https://example.com/a.png' }
    );
    expect(res.status).toBe(500);
    if (res.body.status === 'error') {
      expect(res.body.message).toBe('Download failed');
    }
  });

  it('returns 503 when library is under maintenance', async () => {
    const res = await handleItemAdd(
      makeDeps({
        importFromUrl: vi.fn(async () => ({
          ok: false,
          error: 'Library is under maintenance'
        }))
      }),
      { url: 'https://example.com/a.png' }
    );
    expect(res.status).toBe(503);
  });

  it('returns 409 when import reports a duplicate', async () => {
    const res = await handleItemAdd(
      makeDeps({
        importFromUrl: vi.fn(async () => ({
          ok: false,
          error: 'Duplicate of existing card (card-9)',
          statusHint: 409 as const
        }))
      }),
      { url: 'https://example.com/a.png' }
    );
    expect(res.status).toBe(409);
  });
});

describe('handleCollectionEnsure', () => {
  it('returns 403 when API disabled', async () => {
    const res = await handleCollectionEnsure(makeDeps({ isApiEnabled: () => false }), { name: 'Board' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when name missing', async () => {
    const res = await handleCollectionEnsure(makeDeps(), {});
    expect(res.status).toBe(400);
  });

  it('ensures collection', async () => {
    const ensureCollection = vi.fn(async () => ({
      ok: true as const,
      id: 'col-uuid',
      name: 'Преимущества',
      created: true
    }));
    const res = await handleCollectionEnsure(makeDeps({ ensureCollection }), { name: 'Преимущества' });
    expect(res.status).toBe(200);
    expect(ensureCollection).toHaveBeenCalledWith({
      libraryRoot: '/library',
      name: 'Преимущества',
      description: undefined
    });
  });
});
