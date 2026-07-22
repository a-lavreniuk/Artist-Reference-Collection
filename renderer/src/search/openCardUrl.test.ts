import { describe, expect, it } from 'vitest';

import {
  ARC_DETAIL_QUERY_CARD,
  setSearchAndDetailCardInParams,
  stripOpenCardFromParams
} from './openCardUrl';
import { ARC_SEARCH_QUERY_CARD } from './searchUrl';

describe('stripOpenCardFromParams', () => {
  it('removes detail only when card filter differs', () => {
    const params = new URLSearchParams({
      [ARC_SEARCH_QUERY_CARD]: 'filter-id',
      [ARC_DETAIL_QUERY_CARD]: 'detail-id'
    });
    const next = stripOpenCardFromParams(params);
    expect(next.get(ARC_DETAIL_QUERY_CARD)).toBeNull();
    expect(next.get(ARC_SEARCH_QUERY_CARD)).toBe('filter-id');
  });

  it('removes matching card= filter when closing UUID search detail', () => {
    const params = setSearchAndDetailCardInParams(new URLSearchParams(), 'same-id');
    const next = stripOpenCardFromParams(params);
    expect(next.get(ARC_DETAIL_QUERY_CARD)).toBeNull();
    expect(next.get(ARC_SEARCH_QUERY_CARD)).toBeNull();
  });
});
