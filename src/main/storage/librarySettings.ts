import type Database from 'better-sqlite3';
import {
  defaultDetailCardTemplate,
  sanitizeDetailCardTemplate,
  type DetailCardTemplateV1
} from '../shared/detailCardTemplate';
import {
  defaultGalleryFilterLayout,
  GALLERY_FILTER_IDS,
  sanitizeUserFilterVisible,
  type GalleryFilterId,
  type GalleryFilterLayoutState
} from '../shared/galleryFilterCore';

export const LIBRARY_SETTING_TEMPLATE = 'detailCardTemplate';
export const LIBRARY_SETTING_FILTER_LAYOUT = 'systemFilterLayout';

export function ensureLibrarySettingsSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS library_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL
    );
  `);
}

function parseJson(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function hasLibrarySettingsTable(db: Database.Database): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'library_settings'`)
    .get() as { ok: number } | undefined;
  return Boolean(row);
}

export function getLibrarySettingJson(db: Database.Database, key: string): unknown {
  if (!hasLibrarySettingsTable(db)) return null;
  const row = db.prepare('SELECT value_json FROM library_settings WHERE key = ?').get(key) as
    | { value_json: string }
    | undefined;
  return parseJson(row?.value_json);
}

export function setLibrarySettingJson(db: Database.Database, key: string, value: unknown): void {
  ensureLibrarySettingsSchema(db);
  db.prepare(
    `INSERT INTO library_settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
  ).run(key, JSON.stringify(value));
}

export function hasLibrarySetting(db: Database.Database, key: string): boolean {
  if (!hasLibrarySettingsTable(db)) return false;
  const row = db.prepare('SELECT 1 AS ok FROM library_settings WHERE key = ?').get(key) as
    | { ok: number }
    | undefined;
  return Boolean(row);
}

export function sanitizeSystemFilterLayout(raw: unknown): GalleryFilterLayoutState {
  const fallback = defaultGalleryFilterLayout();
  if (!raw || typeof raw !== 'object') return fallback;
  const rec = raw as { order?: unknown; visible?: unknown; userVisible?: unknown };
  const orderIn: string[] = Array.isArray(rec.order)
    ? rec.order.filter((id): id is string => typeof id === 'string')
    : [];
  const visibleIn =
    rec.visible && typeof rec.visible === 'object' && !Array.isArray(rec.visible)
      ? (rec.visible as Record<string, unknown>)
      : {};
  const order: GalleryFilterId[] = [];
  const visible = { ...fallback.visible };
  for (const id of orderIn) {
    if (!(GALLERY_FILTER_IDS as readonly string[]).includes(id)) continue;
    const gid = id as GalleryFilterId;
    if (order.includes(gid)) continue;
    order.push(gid);
  }
  for (const id of GALLERY_FILTER_IDS) {
    if (!order.includes(id)) order.push(id);
    if (id in visibleIn) visible[id] = visibleIn[id] !== false;
  }
  const userVisible = sanitizeUserFilterVisible(rec.userVisible);
  return userVisible ? { order, visible, userVisible } : { order, visible };
}

export function readLibraryDetailTemplate(db: Database.Database): DetailCardTemplateV1 {
  const raw = getLibrarySettingJson(db, LIBRARY_SETTING_TEMPLATE);
  if (raw == null) return defaultDetailCardTemplate();
  return sanitizeDetailCardTemplate(raw);
}

export function writeLibraryDetailTemplate(db: Database.Database, template: DetailCardTemplateV1): void {
  setLibrarySettingJson(db, LIBRARY_SETTING_TEMPLATE, sanitizeDetailCardTemplate(template));
}

export function readSystemFilterLayout(db: Database.Database): GalleryFilterLayoutState {
  const raw = getLibrarySettingJson(db, LIBRARY_SETTING_FILTER_LAYOUT);
  return sanitizeSystemFilterLayout(raw);
}

export function writeSystemFilterLayout(db: Database.Database, layout: GalleryFilterLayoutState): void {
  setLibrarySettingJson(db, LIBRARY_SETTING_FILTER_LAYOUT, sanitizeSystemFilterLayout(layout));
}

export function seedLibrarySettingsIfNeeded(
  db: Database.Database,
  source: { template?: unknown; useDefaultTemplate: boolean }
): void {
  ensureLibrarySettingsSchema(db);
  if (!hasLibrarySetting(db, LIBRARY_SETTING_TEMPLATE)) {
    const template = source.useDefaultTemplate
      ? defaultDetailCardTemplate()
      : sanitizeDetailCardTemplate(source.template);
    writeLibraryDetailTemplate(db, template);
  }
  if (!hasLibrarySetting(db, LIBRARY_SETTING_FILTER_LAYOUT)) {
    writeSystemFilterLayout(db, defaultGalleryFilterLayout());
  }
}
