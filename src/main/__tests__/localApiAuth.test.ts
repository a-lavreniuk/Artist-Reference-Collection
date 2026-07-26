import type { IncomingMessage } from 'http';
import { describe, expect, it } from 'vitest';

import { ARC_LOCAL_TOKEN_HEADER, requestHasValidLocalApiToken } from '../localApiAuth';

function fakeReq(headers: Record<string, string | string[] | undefined>): IncomingMessage {
  return { headers } as IncomingMessage;
}

describe('localApiAuth', () => {
  it('accepts x-arc-local-token', () => {
    const req = fakeReq({ [ARC_LOCAL_TOKEN_HEADER]: 'secret-value' });
    expect(requestHasValidLocalApiToken(req, 'secret-value')).toBe(true);
  });

  it('accepts Bearer authorization', () => {
    const req = fakeReq({ authorization: 'Bearer secret-value' });
    expect(requestHasValidLocalApiToken(req, 'secret-value')).toBe(true);
  });

  it('rejects mismatch and empty', () => {
    expect(requestHasValidLocalApiToken(fakeReq({}), 'secret')).toBe(false);
    expect(requestHasValidLocalApiToken(fakeReq({ [ARC_LOCAL_TOKEN_HEADER]: 'a' }), 'b')).toBe(false);
    expect(requestHasValidLocalApiToken(fakeReq({ [ARC_LOCAL_TOKEN_HEADER]: 'x' }), '')).toBe(false);
  });
});
