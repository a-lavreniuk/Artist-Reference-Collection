import { describe, expect, it } from 'vitest';
import { buildCardInfoSections } from '../components/gallery/cardFileMetaFormat';
import type { CardRecord } from '../services/arcSchema';

describe('buildCardInfoSections', () => {
  it('omits empty rows and empty sections', () => {
    const card: CardRecord = {
      id: '1',
      type: 'image',
      addedAt: '2026-01-01T00:00:00.000Z',
      originalRelativePath: 'cards/1/original.jpg',
      thumbRelativePath: 'cards/1/thumb_s.webp',
      tagIds: [],
      collectionIds: [],
      format: 'jpg',
      width: 1920,
      height: 1080,
      fileSize: 1024,
      mediaMeta: {
        version: 1,
        probedAt: '2026-01-01T00:00:00.000Z',
        camera: 'Sony ILCE-7M4',
        iso: 400
      }
    };
    const sections = buildCardInfoSections(card);
    const flat = sections.flat();
    expect(flat.some((r) => r.label === 'Разрешение' && r.value === '1920×1080')).toBe(true);
    expect(flat.some((r) => r.label === 'Камера' && r.value === 'Sony ILCE-7M4')).toBe(true);
    expect(flat.some((r) => r.label === 'ISO' && r.value === '400')).toBe(true);
    expect(flat.some((r) => r.label === 'Объектив')).toBe(false);
    expect(flat.some((r) => r.value === '—')).toBe(false);
  });
});
