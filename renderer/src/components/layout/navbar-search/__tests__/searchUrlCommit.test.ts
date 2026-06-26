import { describe, expect, it } from 'vitest';
import {
  buildModeChangeParams,
  setTagIdsInParams,
  toggleTagIdInParams
} from '../utils/searchUrlCommit';
import { ARC_SEARCH_QUERY_TAG, ARC_SEARCH_QUERY_COLOR } from '../../../../search/searchUrl';

describe('searchUrlCommit', () => {
  it('toggleTagIdInParams adds and removes tag ids', () => {
    const base = new URLSearchParams();
    const added = toggleTagIdInParams(base, 'tag-a', []);
    expect(added.getAll(ARC_SEARCH_QUERY_TAG)).toEqual(['tag-a']);

    const removed = toggleTagIdInParams(added, 'tag-a', ['tag-a']);
    expect(removed.getAll(ARC_SEARCH_QUERY_TAG)).toEqual([]);
  });

  it('setTagIdsInParams replaces tag list', () => {
    const prev = new URLSearchParams();
    prev.append(ARC_SEARCH_QUERY_TAG, 'old');
    const next = setTagIdsInParams(prev, ['a', 'b']);
    expect(next.getAll(ARC_SEARCH_QUERY_TAG)).toEqual(['a', 'b']);
  });

  it('buildModeChangeParams clears search keys and sets color defaults', () => {
    const prev = new URLSearchParams();
    prev.append(ARC_SEARCH_QUERY_TAG, 'x');
    const next = buildModeChangeParams(prev, 'color');
    expect(next.getAll(ARC_SEARCH_QUERY_TAG)).toEqual([]);
    expect(next.get(ARC_SEARCH_QUERY_COLOR)).toBeTruthy();
  });

  it('buildModeChangeParams clears keys for tags mode', () => {
    const prev = new URLSearchParams();
    prev.append(ARC_SEARCH_QUERY_TAG, 'x');
    const next = buildModeChangeParams(prev, 'tags');
    expect(next.getAll(ARC_SEARCH_QUERY_TAG)).toEqual([]);
    expect(next.get(ARC_SEARCH_QUERY_COLOR)).toBeNull();
  });
});
