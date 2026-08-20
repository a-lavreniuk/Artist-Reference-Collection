import { mkdir, writeFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
    getVersion: () => '0.0.0-test'
  }
}));

vi.mock('../../libraryRootConfig', () => {
  const nodePath = require('path') as typeof import('path');
  const nodeOs = require('os') as typeof import('os');
  return {
    readParentLibraryPathSync: () =>
      nodePath.join(nodeOs.tmpdir(), `arc-shared-trash-${process.pid}`)
  };
});

import { closeLibraryDb, openLibraryDb } from '../db';
import { writeCardJson } from '../cardFolder';
import type { CardJsonV1 } from '../types';
import {
  countSharedTrashCards,
  emptySharedTrash,
  listSharedTrashCards,
  purgeExpiredTrash,
  restoreSharedTrashCard,
  type LibraryTrashSource
} from '../sharedTrash';
import { getCardByIdIsolated } from '../libraryStorage';

const tmpRoot = path.join(os.tmpdir(), `arc-shared-trash-${process.pid}`);

/** better-sqlite3 is built for Electron; skip under mismatched system Node. */
function canOpenSqlite(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    return true;
  } catch {
    return false;
  }
}

const sqliteOk = canOpenSqlite();

function libOf(id: string, name: string): LibraryTrashSource {
  return { id, name, path: path.join(tmpRoot, id) };
}

async function seedCard(
  root: string,
  cardId: string,
  addedAt: string,
  options?: { withFiles?: boolean; deleted?: boolean; deletedAt?: string | null }
): Promise<void> {
  const deleted = options?.deleted ?? true;
  const deletedAt =
    options && 'deletedAt' in options ? options.deletedAt ?? null : deleted ? addedAt : null;
  await mkdir(path.join(root, 'cards', cardId), { recursive: true });
  const db = openLibraryDb(root);
  db.prepare(
    `INSERT INTO cards (
      id, type, added_at, original_rel, thumb_s_rel, thumb_m_rel, thumb_l_rel, is_deleted, deleted_at
    ) VALUES (?, 'image', ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    cardId,
    addedAt,
    `cards/${cardId}/original.jpg`,
    `cards/${cardId}/thumb_s.webp`,
    `cards/${cardId}/thumb_m.webp`,
    `cards/${cardId}/thumb_l.webp`,
    deleted ? 1 : 0,
    deletedAt
  );
  const json: CardJsonV1 = {
    version: 1,
    id: cardId,
    type: 'image',
    addedAt,
    originalFileName: `${cardId}.jpg`,
    format: 'jpg',
    tagIds: [],
    collectionIds: [],
    ...(deletedAt ? { deletedAt } : {})
  };
  await writeCardJson(root, json);
  if (options?.withFiles) {
    await writeFile(path.join(root, 'cards', cardId, 'original.jpg'), Buffer.from('img'));
  }
}

async function seedTrashedCard(
  root: string,
  cardId: string,
  addedAt: string,
  withFiles = false
): Promise<void> {
  await seedCard(root, cardId, addedAt, { withFiles, deleted: true });
}

describe.skipIf(!sqliteOk)('shared trash across libraries', () => {
  const libA = libOf('lib-a', 'Alpha');
  const libB = libOf('lib-b', 'Beta');

  beforeEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
    await mkdir(tmpRoot, { recursive: true });
  });

  afterEach(() => {
    closeLibraryDb();
  });

  it('lists and counts deleted cards from all libraries', async () => {
    await seedTrashedCard(libA.path, 'card-a', '2026-01-01T00:00:00.000Z');
    await seedTrashedCard(libB.path, 'card-b', '2026-02-01T00:00:00.000Z');
    closeLibraryDb();

    const listed = listSharedTrashCards([libA, libB], { offset: 0, limit: 50 });
    expect(listed.map((row) => row.id)).toEqual(['card-b', 'card-a']);
    expect(listed[0]?.libraryName).toBe('Beta');
    expect(listed[1]?.libraryName).toBe('Alpha');
    expect(countSharedTrashCards([libA, libB])).toBe(2);

    const page = listSharedTrashCards([libA, libB], { offset: 0, limit: 1 });
    expect(page).toHaveLength(1);
    expect(page[0]?.id).toBe('card-b');
  });

  it('lists trash when a library index has no library_settings table', async () => {
    await seedTrashedCard(libA.path, 'card-a', '2026-01-01T00:00:00.000Z');
    const db = openLibraryDb(libA.path);
    db.exec('DROP TABLE IF EXISTS library_settings');
    closeLibraryDb();

    const listed = listSharedTrashCards([libA], { offset: 0, limit: 50 });
    expect(listed.map((row) => row.id)).toEqual(['card-a']);
  });

  it('restores a card into the origin library', async () => {
    await seedTrashedCard(libA.path, 'card-a', '2026-01-01T00:00:00.000Z');
    await seedTrashedCard(libB.path, 'card-b', '2026-02-01T00:00:00.000Z');
    closeLibraryDb();

    const result = await restoreSharedTrashCard({
      cardId: 'card-a',
      libraryId: 'lib-a',
      libraries: [libA, libB]
    });
    expect(result).toEqual({ ok: true });
    expect(countSharedTrashCards([libA, libB])).toBe(1);
    expect(listSharedTrashCards([libA, libB], { offset: 0, limit: 10 }).map((r) => r.id)).toEqual([
      'card-b'
    ]);
    const restored = getCardByIdIsolated(libA.path, 'card-a');
    expect(restored?.id).toBe('card-a');
  });

  it('empties trash in every library of the container', async () => {
    await seedTrashedCard(libA.path, 'card-a', '2026-01-01T00:00:00.000Z');
    await seedTrashedCard(libB.path, 'card-b', '2026-02-01T00:00:00.000Z');
    closeLibraryDb();

    const n = await emptySharedTrash([libA, libB]);
    expect(n).toBe(2);
    expect(countSharedTrashCards([libA, libB])).toBe(0);
  });

  it('keeps restore gated until a destination library is chosen when origin is gone', async () => {
    await seedTrashedCard(libA.path, 'card-c', '2026-03-01T00:00:00.000Z', true);
    closeLibraryDb();

    const missing = await restoreSharedTrashCard({
      cardId: 'card-c',
      libraryId: 'lib-a',
      sourceLibraryRoot: libA.path,
      libraries: [libB]
    });
    expect(missing).toEqual({ ok: false, error: 'origin-missing' });
    expect(countSharedTrashCards([libA])).toBe(1);

    const relocated = await restoreSharedTrashCard({
      cardId: 'card-c',
      libraryId: 'lib-a',
      sourceLibraryRoot: libA.path,
      destinationLibraryId: 'lib-b',
      libraries: [libB]
    });
    expect(relocated).toEqual({ ok: true });
    expect(getCardByIdIsolated(libB.path, 'card-c')?.id).toBe('card-c');
    expect(existsSync(path.join(libB.path, 'cards', 'card-c', 'original.jpg'))).toBe(true);
    expect(countSharedTrashCards([libA, libB])).toBe(0);
  });

  it('does not relocate an active card from an unlisted library folder', async () => {
    await seedCard(libA.path, 'live-card', '2026-04-01T00:00:00.000Z', { withFiles: true, deleted: false });
    closeLibraryDb();

    const result = await restoreSharedTrashCard({
      cardId: 'live-card',
      libraryId: 'lib-a',
      sourceLibraryRoot: libA.path,
      destinationLibraryId: 'lib-b',
      libraries: [libB]
    });
    expect(result).toEqual({ ok: false, error: 'files-unavailable' });
    expect(existsSync(path.join(libA.path, 'cards', 'live-card', 'original.jpg'))).toBe(true);
    expect(getCardByIdIsolated(libB.path, 'live-card')?.id).toBeUndefined();
  });

  it('purges expired trash and skips missing deleted_at', async () => {
    await seedCard(libA.path, 'old-trash', '2026-06-01T00:00:00.000Z', { withFiles: true, deleted: true });
    await seedCard(libA.path, 'fresh-trash', '2026-08-13T00:00:00.000Z', { withFiles: true, deleted: true });
    await seedCard(libA.path, 'no-deleted-at', '2026-01-01T00:00:00.000Z', {
      withFiles: true,
      deleted: true,
      deletedAt: null
    });
    await seedCard(libA.path, 'alive', '2026-01-01T00:00:00.000Z', { withFiles: true, deleted: false });
    closeLibraryDb();

    const cutoff = '2026-07-15T12:00:00.000Z';
    const n = await purgeExpiredTrash([libA], cutoff);
    expect(n).toBe(1);
    expect(getCardByIdIsolated(libA.path, 'old-trash')?.id).toBeUndefined();
    expect(getCardByIdIsolated(libA.path, 'fresh-trash')?.id).toBe('fresh-trash');
    expect(getCardByIdIsolated(libA.path, 'no-deleted-at')?.id).toBe('no-deleted-at');
    expect(getCardByIdIsolated(libA.path, 'alive')?.id).toBe('alive');
    expect(countSharedTrashCards([libA])).toBe(2);
  });
});

describe('shared trash restore gates', () => {
  it('does not relocate without origin library id', async () => {
    const result = await restoreSharedTrashCard({
      cardId: 'card-x',
      destinationLibraryId: 'lib-b',
      sourceLibraryRoot: path.join(tmpRoot, 'lib-a'),
      libraries: [libOf('lib-b', 'Beta')]
    });
    expect(result).toEqual({ ok: false, error: 'origin-missing' });
  });

  it('rejects a source root outside the container', async () => {
    const outside = path.join(os.tmpdir(), `arc-shared-trash-outside-${process.pid}`);
    await mkdir(outside, { recursive: true });
    try {
      const result = await restoreSharedTrashCard({
        cardId: 'card-x',
        libraryId: 'gone',
        destinationLibraryId: 'lib-b',
        sourceLibraryRoot: outside,
        libraries: [libOf('lib-b', 'Beta')]
      });
      expect(result).toEqual({ ok: false, error: 'files-unavailable' });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
