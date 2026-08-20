import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LINK_PROTOCOL,
  hostDraftToStoredValue,
  normalizeLinkInputValue,
  parseLinkInput
} from '../linkInput';

describe('linkInput', () => {
  it('parses empty as https with no host', () => {
    expect(parseLinkInput('')).toEqual({ protocol: DEFAULT_LINK_PROTOCOL, host: '' });
    expect(parseLinkInput('   ')).toEqual({ protocol: DEFAULT_LINK_PROTOCOL, host: '' });
  });

  it('parses host without protocol as https', () => {
    expect(parseLinkInput('example.com')).toEqual({
      protocol: 'https://',
      host: 'example.com'
    });
  });

  it('strips https protocol, spaces and trailing slash', () => {
    expect(parseLinkInput('  https://a.com/  ')).toEqual({
      protocol: 'https://',
      host: 'a.com'
    });
  });

  it('keeps http protocol', () => {
    expect(parseLinkInput('http://a.com')).toEqual({
      protocol: 'http://',
      host: 'a.com'
    });
  });

  it('normalizes stored value', () => {
    expect(normalizeLinkInputValue('')).toBe('');
    expect(normalizeLinkInputValue('example.com')).toBe('https://example.com');
    expect(normalizeLinkInputValue('https://a.com/path/')).toBe('https://a.com/path');
    expect(normalizeLinkInputValue('HTTP://A.COM')).toBe('http://A.COM');
  });

  it('maps host draft to stored value without flipping http to https', () => {
    expect(hostDraftToStoredValue('https://', '')).toBe('');
    expect(hostDraftToStoredValue('https://', 'example.com')).toBe('https://example.com');
    expect(hostDraftToStoredValue('http://', 'example.com')).toBe('http://example.com');
    expect(hostDraftToStoredValue('https://', 'http://site.com/')).toBe('http://site.com');
  });
});
