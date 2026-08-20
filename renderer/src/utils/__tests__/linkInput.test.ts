import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LINK_PROTOCOL,
  hostDraftToStoredValue,
  isValidLinkInputValue,
  normalizeLinkInputValue,
  parseLinkInput,
  toOpenableLinkUrl
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

  it('treats empty as valid and rejects junk host', () => {
    expect(isValidLinkInputValue('')).toBe(true);
    expect(isValidLinkInputValue('   ')).toBe(true);
    expect(isValidLinkInputValue('not a link')).toBe(false);
    expect(isValidLinkInputValue('example')).toBe(false);
  });

  it('accepts http(s) hosts with a domain, localhost and IPv4', () => {
    expect(isValidLinkInputValue('example.com')).toBe(true);
    expect(isValidLinkInputValue('localhost')).toBe(true);
    expect(isValidLinkInputValue('https://example.com/path?q=1')).toBe(true);
    expect(isValidLinkInputValue('http://localhost:3000')).toBe(true);
    expect(isValidLinkInputValue('127.0.0.1')).toBe(true);
    expect(isValidLinkInputValue('[::1]')).toBe(true);
  });

  it('returns an openable url only for valid links', () => {
    expect(toOpenableLinkUrl('')).toBeNull();
    expect(toOpenableLinkUrl('nope')).toBeNull();
    expect(toOpenableLinkUrl('example.com')).toBe('https://example.com');
    expect(toOpenableLinkUrl('http://a.com/')).toBe('http://a.com');
  });
});
