import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  parseCfHdrop,
  parseClipboardUriList,
  parseFileNameW,
  uniqueAbsPaths
} from '../clipboardOsFiles';

function buildHdrop(filePaths: string[], wide = true): Buffer {
  const parts: Buffer[] = [];
  if (wide) {
    for (const p of filePaths) {
      parts.push(Buffer.from(p, 'utf16le'));
      parts.push(Buffer.from('\0', 'utf16le'));
    }
    parts.push(Buffer.from('\0', 'utf16le'));
  } else {
    for (const p of filePaths) {
      parts.push(Buffer.from(p, 'utf8'));
      parts.push(Buffer.from([0]));
    }
    parts.push(Buffer.from([0]));
  }
  const list = Buffer.concat(parts);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(20, 0);
  header.writeInt32LE(wide ? 1 : 0, 16);
  return Buffer.concat([header, list]);
}

describe('clipboardOsFiles', () => {
  it('parses a Unicode CF_HDROP list', () => {
    const buf = buildHdrop(['C:\\refs\\a.jpg', 'C:\\refs\\b.png']);
    expect(parseCfHdrop(buf)).toEqual([
      path.normalize('C:\\refs\\a.jpg'),
      path.normalize('C:\\refs\\b.png')
    ]);
  });

  it('parses FileNameW', () => {
    const buf = Buffer.from('D:\\art\\shot.webp\0', 'utf16le');
    expect(parseFileNameW(buf)).toBe(path.normalize('D:\\art\\shot.webp'));
  });

  it('parses file URI lists', () => {
    expect(parseClipboardUriList('file:///C:/refs/a.jpg\nfile:///C:/refs/b.png')).toEqual([
      path.normalize('C:/refs/a.jpg'),
      path.normalize('C:/refs/b.png')
    ]);
  });

  it('dedupes paths', () => {
    const a = path.resolve('C:\\refs\\a.jpg');
    expect(uniqueAbsPaths([a, a.toLowerCase(), a])).toEqual([a]);
  });
});
