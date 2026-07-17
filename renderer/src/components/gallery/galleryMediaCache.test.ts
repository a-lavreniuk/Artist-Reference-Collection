import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardRecord } from '../../services/db';
import {
  __resetMediaServerOriginForTests,
  buildLibraryMediaUrl,
  clearGalleryMediaUrlCache,
  peekCardsSrcMap,
  refreshMediaServerOrigin
} from './galleryMediaCache';

function cardStub(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: 'card-1',
    type: 'image',
    addedAt: '2026-01-01T00:00:00.000Z',
    originalRelativePath: 'cards/card-1/original.jpg',
    thumbRelativePath: 'cards/card-1/thumb_s.webp',
    thumbSRelativePath: 'cards/card-1/thumb_s.webp',
    thumbMRelativePath: 'cards/card-1/thumb_m.webp',
    thumbLRelativePath: 'cards/card-1/thumb_l.webp',
    tagIds: [],
    collectionIds: [],
    ...overrides
  };
}

describe('galleryMediaCache origin + sect', () => {
  beforeEach(() => {
    clearGalleryMediaUrlCache();
    __resetMediaServerOriginForTests();
    vi.stubGlobal('window', {
      arc: {
        getMediaServerOrigin: vi.fn(() => null as string | null)
      }
    });
  });

  afterEach(() => {
    clearGalleryMediaUrlCache();
    __resetMediaServerOriginForTests();
    vi.unstubAllGlobals();
  });

  it('не закрепляет null origin: после появления HTTP origin URL пересобирается', () => {
    const getOrigin = window.arc.getMediaServerOrigin as ReturnType<typeof vi.fn>;
    getOrigin.mockReturnValueOnce(null);

    const before = buildLibraryMediaUrl('cards/card-1/thumb_m.webp', 'gallery');
    expect(before).toContain('arc-media://localhost');

    getOrigin.mockReturnValue('http://127.0.0.1:12345');
    const after = buildLibraryMediaUrl('cards/card-1/thumb_m.webp', 'gallery');
    expect(after).toContain('http://127.0.0.1:12345');
    expect(after).not.toContain('arc-media://localhost');
  });

  it('refreshMediaServerOrigin сбрасывает кэш и читает origin заново', () => {
    const getOrigin = window.arc.getMediaServerOrigin as ReturnType<typeof vi.fn>;
    getOrigin.mockReturnValue('http://127.0.0.1:1111');
    expect(buildLibraryMediaUrl('cards/card-1/thumb_s.webp')).toContain('1111');

    getOrigin.mockReturnValue('http://127.0.0.1:2222');
    // Без refresh всё ещё старый origin (валидный кэш).
    expect(buildLibraryMediaUrl('cards/card-1/thumb_s.webp')).toContain('1111');

    refreshMediaServerOrigin();
    expect(buildLibraryMediaUrl('cards/card-1/thumb_s.webp')).toContain('2222');
  });

  it('peekCardsSrcMap для коллекций ставит sect=collections', () => {
    const getOrigin = window.arc.getMediaServerOrigin as ReturnType<typeof vi.fn>;
    getOrigin.mockReturnValue('http://127.0.0.1:9999');

    const map = peekCardsSrcMap([cardStub()], 's', 'collections');
    const href = map['card-1'];
    expect(href).toBeTruthy();
    expect(href).toContain('sect=collections');
    expect(href).toContain('thumb_s.webp');
  });

  it('peekCardsSrcMap для галереи ставит sect=gallery', () => {
    const getOrigin = window.arc.getMediaServerOrigin as ReturnType<typeof vi.fn>;
    getOrigin.mockReturnValue('http://127.0.0.1:9999');

    const map = peekCardsSrcMap([cardStub()], 'm', 'gallery');
    expect(map['card-1']).toContain('sect=gallery');
  });
});
