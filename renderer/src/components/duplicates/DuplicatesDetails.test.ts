import { describe, expect, it } from 'vitest';
import { defaultDetailCardTemplate } from '@arc-main-shared/detailCardTemplate';
import type { CardRecord } from '../../services/arcSchema';
import {
  clampDuplicatesLabelWidth,
  collectDuplicatesLabelTexts,
  sectionsOpenForPair,
  visibleDetailSections,
  visibleDetailSectionsForPair
} from './DuplicatesDetails';

function card(partial: Partial<CardRecord>): CardRecord {
  return {
    id: 'card',
    type: 'image',
    addedAt: '2026-01-01T00:00:00.000Z',
    originalRelativePath: 'a.jpg',
    thumbRelativePath: 'thumbs/a.jpg',
    tagIds: [],
    collectionIds: [],
    ...partial
  };
}

describe('sectionsOpenForPair', () => {
  it('keeps details open and collapses matching sections', () => {
    const a = card({ id: 'a', name: 'Same' });
    const b = card({ id: 'b', name: 'Same' });
    expect(sectionsOpenForPair(a, b)).toEqual({
      details: true,
      properties: false,
      tags: false,
      annotations: false,
      collections: false
    });
  });

  it('opens properties when names differ', () => {
    const a = card({ id: 'a', name: 'One' });
    const b = card({ id: 'b', name: 'Two' });
    expect(sectionsOpenForPair(a, b).properties).toBe(true);
  });

  it('opens annotations when pin texts differ', () => {
    const a = card({
      id: 'a',
      annotations: [
        { id: '1', x: 0, y: 0, w: 1, h: 1, text: 'CTA', createdAt: '2026-01-01T00:00:00.000Z' }
      ]
    });
    const b = card({ id: 'b' });
    expect(sectionsOpenForPair(a, b).annotations).toBe(true);
  });
});

describe('visibleDetailSections', () => {
  it('always includes details when the card exists', () => {
    expect(visibleDetailSections(card({ id: 'a' }))).toEqual(['details']);
  });

  it('hides empty properties, tags, annotations and collections on a single card', () => {
    const empty = card({ id: 'a' });
    expect(visibleDetailSections(empty, defaultDetailCardTemplate())).toEqual(['details']);
  });

  it('shows filled optional sections', () => {
    const filled = card({
      id: 'a',
      name: 'Shot',
      tagIds: ['tag-1'],
      collectionIds: ['col-1'],
      annotations: [
        { id: '1', x: 0, y: 0, w: 1, h: 1, text: 'Note', createdAt: '2026-01-01T00:00:00.000Z' }
      ]
    });
    expect(visibleDetailSections(filled, defaultDetailCardTemplate())).toEqual([
      'details',
      'properties',
      'tags',
      'annotations',
      'collections'
    ]);
  });
});

describe('visibleDetailSectionsForPair', () => {
  const template = defaultDetailCardTemplate();

  it('keeps a section on both sides when only one card has content', () => {
    const a = card({
      id: 'a',
      tagIds: ['tag-1'],
      annotations: [
        { id: '1', x: 0, y: 0, w: 1, h: 1, text: 'Note', createdAt: '2026-01-01T00:00:00.000Z' }
      ]
    });
    const b = card({ id: 'b' });
    expect(visibleDetailSectionsForPair(a, template, b, template)).toEqual([
      'details',
      'tags',
      'annotations'
    ]);
  });

  it('omits a section when both cards are empty', () => {
    expect(
      visibleDetailSectionsForPair(card({ id: 'a' }), template, card({ id: 'b' }), template)
    ).toEqual(['details']);
  });
});

describe('clampDuplicatesLabelWidth', () => {
  it('caps the shared label column at 400px', () => {
    expect(clampDuplicatesLabelWidth(80)).toBe(80);
    expect(clampDuplicatesLabelWidth(400)).toBe(400);
    expect(clampDuplicatesLabelWidth(512)).toBe(400);
  });
});

describe('collectDuplicatesLabelTexts', () => {
  it('includes detail labels and custom property names', () => {
    const template = {
      ...defaultDetailCardTemplate(),
      fields: [
        ...defaultDetailCardTemplate().fields,
        {
          id: 'custom-1',
          type: 'shortText' as const,
          label: 'Очень длинное название поля',
          visibility: 'always' as const,
          showInFilters: false
        }
      ]
    };
    const a = card({ id: 'a', name: 'Shot', customFields: { 'custom-1': 'value' } });
    const b = card({ id: 'b' });
    const labels = collectDuplicatesLabelTexts(a, template, 'Основная', b, template, 'Основная');
    expect(labels).toContain('Дата добавления');
    expect(labels).toContain('Библиотека');
    expect(labels).toContain('Очень длинное название поля');
  });
});
