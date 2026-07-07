import { describe, expect, it } from 'vitest';
import {
  analyzeIntegrity,
  applyMetadataWarningFixes,
  buildIntegrityReport,
  collectIntegrityOrphanScanInput,
  groupIntegrityIssues,
  isWarningFixable
} from '../libraryIntegrity';
import type { ArcMetadataV1 } from '../arcSchema';

function baseMeta(overrides: Partial<ArcMetadataV1> = {}): ArcMetadataV1 {
  return {
    version: 1,
    categories: [{ id: 'cat1', name: 'C', sortIndex: 0 }],
    tags: [{ id: 'tag1', categoryId: 'cat1', name: 'T', usageCount: 1 }],
    collections: [{ id: 'col1', name: 'Col', createdAt: '2020-01-01', sortIndex: 0 }],
    cards: [
      {
        id: 'card1',
        type: 'image',
        addedAt: '2020-01-01',
        originalRelativePath: 'cards/card1/original.jpg',
        thumbRelativePath: 'cards/card1/thumb.jpg',
        tagIds: ['tag1'],
        collectionIds: ['col1']
      }
    ],
    moodboardCardIds: [],
    ...overrides
  };
}

describe('libraryIntegrity', () => {
  it('reports clean library', () => {
    const meta = baseMeta();
    const issues = analyzeIntegrity(meta, new Set(), []);
    const report = buildIntegrityReport(issues, []);
    expect(report.isClean).toBe(true);
  });

  it('groups metadata warnings', () => {
    const meta = baseMeta({
      cards: [
        {
          id: 'card1',
          type: 'image',
          addedAt: '2020-01-01',
          originalRelativePath: 'cards/card1/original.jpg',
          thumbRelativePath: 'cards/card1/thumb.jpg',
          tagIds: ['missing-tag'],
          collectionIds: []
        }
      ]
    });
    const issues = analyzeIntegrity(meta, new Set(), []);
    const grouped = groupIntegrityIssues(issues);
    expect(grouped.metadata.length).toBeGreaterThan(0);
    expect(isWarningFixable(grouped.metadata[0]!)).toBe(true);
  });

  it('fixes metadata warnings', () => {
    const meta = baseMeta({
      cards: [
        {
          id: 'card1',
          type: 'image',
          addedAt: '2020-01-01',
          originalRelativePath: 'cards/card1/original.jpg',
          thumbRelativePath: 'cards/card1/thumb.jpg',
          tagIds: ['ghost'],
          collectionIds: ['ghost-col']
        }
      ],
      moodboardCardIds: ['ghost-card']
    });
    const fixed = applyMetadataWarningFixes(meta);
    expect(fixed.cards[0]?.tagIds).toEqual([]);
    expect(fixed.cards[0]?.collectionIds).toEqual([]);
    expect(fixed.moodboardCardIds).toEqual([]);
  });

  it('detects missing files and duplicate paths', () => {
    const meta = baseMeta({
      cards: [
        {
          id: 'card1',
          type: 'image',
          addedAt: '2020-01-01',
          originalRelativePath: 'shared/original.jpg',
          thumbRelativePath: 'shared/thumb.jpg',
          tagIds: [],
          collectionIds: []
        },
        {
          id: 'card2',
          type: 'image',
          addedAt: '2020-01-01',
          originalRelativePath: 'shared/original.jpg',
          thumbRelativePath: 'shared/thumb.jpg',
          tagIds: [],
          collectionIds: []
        }
      ]
    });
    const missing = new Set(['shared/original.jpg']);
    const issues = analyzeIntegrity(meta, missing, ['orphan/extra.jpg']);
    const report = buildIntegrityReport(issues, ['orphan/extra.jpg']);
    expect(report.grouped.missingFiles.length).toBeGreaterThan(0);
    expect(report.grouped.duplicatePaths.length).toBe(2);
    expect(report.grouped.orphanPaths).toEqual(['orphan/extra.jpg']);
    expect(report.grouped.duplicatePaths[0]?.cardIds).toContain('card1');
  });

  it('collects orphan scan input with card ids and canonical paths', () => {
    const meta = baseMeta();
    const input = collectIntegrityOrphanScanInput(meta);
    expect(input.cardIds).toEqual(['card1']);
    expect(input.paths).toContain('cards/card1/original.jpg');
    expect(input.paths).toContain('cards/card1/thumb_s.webp');
    expect(input.paths).toContain('cards/card1/card.json');
  });

  it('flags critical duplicate ids', () => {
    const meta = baseMeta({
      tags: [
        { id: 'dup', categoryId: 'cat1', name: 'A', usageCount: 0 },
        { id: 'dup', categoryId: 'cat1', name: 'B', usageCount: 0 }
      ]
    });
    const issues = analyzeIntegrity(meta, new Set(), []);
    const grouped = groupIntegrityIssues(issues);
    expect(grouped.critical.some((i) => i.code === 'duplicate_tag_id')).toBe(true);
  });
});
