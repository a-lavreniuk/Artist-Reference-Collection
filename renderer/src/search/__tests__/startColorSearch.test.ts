import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ARC_DETAIL_QUERY_CARD } from '../openCardUrl';
import { ARC_SEARCH_QUERY_COLOR, ARC_SEARCH_QUERY_TAG } from '../searchUrl';
import {
  ARC_START_COLOR_SEARCH_EVENT,
  buildColorSearchParams,
  startColorSearch
} from '../startColorSearch';

describe('buildColorSearchParams', () => {
  it('clears tags and detail, sets color search params', () => {
    const prev = new URLSearchParams();
    prev.append(ARC_SEARCH_QUERY_TAG, 'tag-a');
    prev.set(ARC_DETAIL_QUERY_CARD, 'card-1');
    const next = buildColorSearchParams(prev, '#AABBCC');
    expect(next.getAll(ARC_SEARCH_QUERY_TAG)).toEqual([]);
    expect(next.get(ARC_DETAIL_QUERY_CARD)).toBeNull();
    expect(next.get(ARC_SEARCH_QUERY_COLOR)).toBe('AABBCC');
  });
});

describe('startColorSearch', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    });
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('navigates with color params and dispatches start event', () => {
    const navigate = vi.fn();
    const prev = new URLSearchParams();
    prev.append(ARC_SEARCH_QUERY_TAG, 'tag-a');
    prev.set(ARC_DETAIL_QUERY_CARD, 'card-1');
    startColorSearch(navigate, prev, '#112233', { pathname: '/gallery' });

    expect(navigate).toHaveBeenCalledTimes(1);
    const arg = navigate.mock.calls[0]?.[0] as { pathname?: string; search?: string };
    expect(arg.pathname).toBe('/gallery');
    expect(arg.search).toContain('color=112233');
    expect(arg.search).not.toContain('tag=');
    expect(arg.search).not.toContain('detail=');
    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: ARC_START_COLOR_SEARCH_EVENT })
    );
  });
});
