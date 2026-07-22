import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { preferUnpackedAsarPath, __testOnly } from '../ffmpeg';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arc-ffmpeg-asar-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('preferUnpackedAsarPath', () => {
  it('rewrites app.asar path to app.asar.unpacked when binary exists there', () => {
    const root = makeTempRoot();
    const asarBin = path.join(root, 'app.asar', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
    const unpackedBin = path.join(
      root,
      'app.asar.unpacked',
      'node_modules',
      'ffmpeg-static',
      'ffmpeg.exe'
    );
    fs.mkdirSync(path.dirname(asarBin), { recursive: true });
    fs.mkdirSync(path.dirname(unpackedBin), { recursive: true });
    fs.writeFileSync(unpackedBin, 'fake');

    expect(preferUnpackedAsarPath(asarBin)).toBe(unpackedBin);
  });

  it('returns null for asar path when unpacked binary is missing', () => {
    const root = makeTempRoot();
    const asarBin = path.join(root, 'app.asar', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
    fs.mkdirSync(path.dirname(asarBin), { recursive: true });
    fs.writeFileSync(asarBin, 'fake');

    expect(preferUnpackedAsarPath(asarBin)).toBeNull();
  });

  it('returns ordinary path when file exists outside asar', () => {
    const root = makeTempRoot();
    const bin = path.join(root, 'bin', 'ffmpeg.exe');
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    fs.writeFileSync(bin, 'fake');

    expect(preferUnpackedAsarPath(bin)).toBe(path.resolve(bin));
  });

  it('returns null for empty input', () => {
    expect(preferUnpackedAsarPath('')).toBeNull();
    expect(preferUnpackedAsarPath('   ')).toBeNull();
  });
});

describe('buildFfmpegSeekArgs', () => {
  it('returns empty for first frame', () => {
    expect(__testOnly.buildFfmpegSeekArgs()).toEqual([]);
    expect(__testOnly.buildFfmpegSeekArgs(0)).toEqual([]);
  });

  it('formats seek position in seconds', () => {
    expect(__testOnly.buildFfmpegSeekArgs(1500)).toEqual(['-ss', '1.500']);
    expect(__testOnly.buildFfmpegSeekArgs(125000)).toEqual(['-ss', '125.000']);
  });
});
