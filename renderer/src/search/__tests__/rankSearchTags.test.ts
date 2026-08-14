import { describe, expect, it } from 'vitest';
import type { CategoryRecord, TagRecord } from '../../services/db';
import { rankTagsForQuery, mergeSemanticTagHits } from '../rankSearchTags';
import { synonymSearchKeys, tagFieldsMatchQuery } from '../tagSynonymMap';

const category: CategoryRecord = {
  id: 'c1',
  name: 'Cat',
  colorHex: '#64748B',
  weight: 'medium',
  sortIndex: 0,
  createdAt: '2026-01-01T00:00:00.000Z'
};

function tag(id: string, name: string, description?: string): TagRecord {
  return { id, categoryId: 'c1', name, usageCount: 0, description };
}

describe('tag synonyms', () => {
  it('expands light to свет', () => {
    const keys = synonymSearchKeys('light');
    expect(keys).toContain('light');
    expect(keys).toContain('свет');
  });

  it('does not expand very short queries', () => {
    expect(synonymSearchKeys('li')).toEqual(['li']);
  });

  it('ranks a Russian tag for an English query', () => {
    const tags = new Map<string, TagRecord[]>([['c1', [tag('t1', 'свет')]]]);
    const ranked = rankTagsForQuery('light', [category], tags);
    expect(ranked.map((r) => r.tag.id)).toEqual(['t1']);
  });

  it('matches tags page filter via synonyms', () => {
    expect(tagFieldsMatchQuery('свет', undefined, 'light')).toBe(true);
    expect(tagFieldsMatchQuery('портрет', undefined, 'xyz')).toBe(false);
  });

  it('merges semantic hits that dictionary missed', () => {
    const tags = new Map<string, TagRecord[]>([['c1', [tag('t1', 'неон'), tag('t2', 'свет')]]]);
    const base = rankTagsForQuery('light', [category], tags);
    expect(base.map((r) => r.tag.id)).toEqual(['t2']);
    const merged = mergeSemanticTagHits(base, [{ tagId: 't1', score: 0.9 }], [category], tags);
    expect(merged.map((r) => r.tag.id)).toEqual(['t2', 't1']);
  });
});
