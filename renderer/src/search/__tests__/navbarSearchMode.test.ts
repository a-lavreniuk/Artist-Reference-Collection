import { describe, expect, it } from 'vitest';
import { SEARCH_MODE_META } from '../navbarSearchMode';

describe('SEARCH_MODE_META unavailable hints', () => {
  it('explains semantic search setup on the AI tab', () => {
    expect(SEARCH_MODE_META.ai.unavailableHint).toBe(
      'Семантический поиск доступен после настройки умного поиска'
    );
  });

  it('explains similar search setup on the similar tab', () => {
    expect(SEARCH_MODE_META.similar.unavailableHint).toBe(
      'Поиск по совпадениям доступен после настройки умного поиска'
    );
  });

  it('titles the AI panel as semantic search', () => {
    expect(SEARCH_MODE_META.ai.panelTitle).toBe('Семантический поиск');
  });
});
