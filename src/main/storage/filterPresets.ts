import type Database from 'better-sqlite3';
import { openLibraryDb } from './db';
import type { GalleryFilterPresetPayload } from './galleryFilters';

export type SavedFilterRow = {
  id: string;
  name: string;
  payload: GalleryFilterPresetPayload;
  createdAt: string;
};

export function listFilterPresets(libraryRoot: string): SavedFilterRow[] {
  const db = openLibraryDb(libraryRoot);
  const rows = db
    .prepare('SELECT id, name, payload_json, created_at FROM saved_filters ORDER BY created_at ASC')
    .all() as Array<{ id: string; name: string; payload_json: string; created_at: string }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    payload: JSON.parse(r.payload_json) as GalleryFilterPresetPayload
  }));
}

export function upsertFilterPreset(
  libraryRoot: string,
  id: string,
  name: string,
  payload: GalleryFilterPresetPayload
): void {
  const db = openLibraryDb(libraryRoot);
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO saved_filters (id, name, payload_json, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, payload_json = excluded.payload_json`
  ).run(id, name.trim(), JSON.stringify(payload), createdAt);
}

export function deleteFilterPreset(libraryRoot: string, id: string): void {
  const db = openLibraryDb(libraryRoot);
  db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id);
}

export function renameFilterPreset(libraryRoot: string, id: string, name: string): void {
  const db = openLibraryDb(libraryRoot);
  db.prepare('UPDATE saved_filters SET name = ? WHERE id = ?').run(name.trim(), id);
}
