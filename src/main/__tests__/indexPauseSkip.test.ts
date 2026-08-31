import { describe, expect, it } from 'vitest';

import { isIndexPauseError } from '../ai/indexPauseError';

describe('isIndexPauseError', () => {
  it('does not treat a pause as a permanent skip', () => {
    expect(isIndexPauseError('Индексация приостановлена')).toBe(true);
    expect(isIndexPauseError('llama-server завершился при загрузке')).toBe(false);
    expect(isIndexPauseError(null)).toBe(false);
  });
});
