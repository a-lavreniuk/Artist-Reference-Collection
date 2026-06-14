import type Database from 'better-sqlite3';

import {
  hybridCaptionModelId,
  hybridVisualModelId,
  HYBRID_INDEX_VERSION
} from '../ai/hybridConstants';

export type CardEmbeddingRow = {
  cardId: string;
  modelId: string;
  vector: Float32Array;
  createdAt: string;
};

function vectorToBlob(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

function blobToVector(blob: Buffer): Float32Array {
  const aligned = blob.byteOffset % 4 === 0 && blob.byteLength % 4 === 0;
  if (aligned) {
    return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
  }
  const copy = Buffer.from(blob);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}

export function ensureCardEmbeddingsSchema(db: Database.Database): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS card_embeddings (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  vector BLOB NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (card_id, model_id)
);
CREATE INDEX IF NOT EXISTS idx_card_embeddings_model ON card_embeddings(model_id);

CREATE TABLE IF NOT EXISTS card_hybrid_index_meta (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  base_model_id TEXT NOT NULL,
  index_version INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (card_id, base_model_id)
);
CREATE INDEX IF NOT EXISTS idx_card_hybrid_index_meta_model ON card_hybrid_index_meta(base_model_id);
`);
}

export function upsertCardEmbedding(
  db: Database.Database,
  cardId: string,
  modelId: string,
  vector: Float32Array
): void {
  db.prepare(
    `INSERT INTO card_embeddings (card_id, model_id, vector, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(card_id, model_id) DO UPDATE SET
       vector = excluded.vector,
       created_at = excluded.created_at`
  ).run(cardId, modelId, vectorToBlob(vector), new Date().toISOString());
}

export function deleteEmbeddingsForModel(db: Database.Database, modelId: string): void {
  db.prepare('DELETE FROM card_embeddings WHERE model_id = ?').run(modelId);
  db.prepare('DELETE FROM card_embeddings WHERE model_id = ?').run(hybridVisualModelId(modelId));
  db.prepare('DELETE FROM card_embeddings WHERE model_id = ?').run(hybridCaptionModelId(modelId));
  db.prepare('DELETE FROM card_hybrid_index_meta WHERE base_model_id = ?').run(modelId);
}

export function deleteCardEmbeddings(db: Database.Database, cardId: string): void {
  db.prepare('DELETE FROM card_embeddings WHERE card_id = ?').run(cardId);
}

export function listEmbeddingsForModel(db: Database.Database, modelId: string): CardEmbeddingRow[] {
  const rows = db
    .prepare('SELECT card_id, model_id, vector, created_at FROM card_embeddings WHERE model_id = ?')
    .all(modelId) as Array<{ card_id: string; model_id: string; vector: Buffer; created_at: string }>;

  return rows.map((row) => ({
    cardId: row.card_id,
    modelId: row.model_id,
    vector: blobToVector(row.vector),
    createdAt: row.created_at
  }));
}

export function countEmbeddingsForModel(db: Database.Database, modelId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM card_embeddings WHERE model_id = ?')
    .get(modelId) as { c: number };
  return row.c;
}

export function countIndexableImageCards(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM cards WHERE is_deleted = 0 AND type = 'image'")
    .get() as { c: number };
  return row.c;
}

export function listCardsMissingEmbedding(
  db: Database.Database,
  modelId: string,
  limit: number
): string[] {
  const rows = db
    .prepare(
      `SELECT c.id FROM cards c
       LEFT JOIN card_embeddings e ON e.card_id = c.id AND e.model_id = ?
       WHERE c.is_deleted = 0 AND c.type = 'image' AND e.card_id IS NULL
       ORDER BY c.added_at DESC
       LIMIT ?`
    )
    .all(modelId, limit) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export type HybridCardEmbedding = {
  cardId: string;
  visual: Float32Array;
  caption: Float32Array;
};

export function upsertHybridCardEmbeddings(
  db: Database.Database,
  cardId: string,
  baseModelId: string,
  visual: Float32Array,
  caption: Float32Array
): void {
  upsertCardEmbedding(db, cardId, hybridVisualModelId(baseModelId), visual);
  upsertCardEmbedding(db, cardId, hybridCaptionModelId(baseModelId), caption);
  db.prepare(
    `INSERT INTO card_hybrid_index_meta (card_id, base_model_id, index_version, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(card_id, base_model_id) DO UPDATE SET
       index_version = excluded.index_version,
       updated_at = excluded.updated_at`
  ).run(cardId, baseModelId, HYBRID_INDEX_VERSION, new Date().toISOString());
  db.prepare('DELETE FROM card_embeddings WHERE card_id = ? AND model_id = ?').run(cardId, baseModelId);
}

export function isHybridIndexReady(db: Database.Database, cardId: string, baseModelId: string): boolean {
  const row = db
    .prepare(
      `SELECT index_version FROM card_hybrid_index_meta
       WHERE card_id = ? AND base_model_id = ? AND index_version >= ?`
    )
    .get(cardId, baseModelId, HYBRID_INDEX_VERSION) as { index_version: number } | undefined;
  return Boolean(row);
}

export function countHybridEmbeddingsForModel(db: Database.Database, baseModelId: string): number {
  const visualId = hybridVisualModelId(baseModelId);
  const captionId = hybridCaptionModelId(baseModelId);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM card_embeddings v
       INNER JOIN card_embeddings c ON c.card_id = v.card_id
       INNER JOIN card_hybrid_index_meta m ON m.card_id = v.card_id AND m.base_model_id = ?
       WHERE v.model_id = ? AND c.model_id = ? AND m.index_version >= ?`
    )
    .get(baseModelId, visualId, captionId, HYBRID_INDEX_VERSION) as { c: number };
  return row.c;
}

export function listHybridEmbeddingsForModel(
  db: Database.Database,
  baseModelId: string
): HybridCardEmbedding[] {
  const visualId = hybridVisualModelId(baseModelId);
  const captionId = hybridCaptionModelId(baseModelId);
  const rows = db
    .prepare(
      `SELECT v.card_id, v.vector AS visual, c.vector AS caption
       FROM card_embeddings v
       INNER JOIN card_embeddings c ON c.card_id = v.card_id
       INNER JOIN card_hybrid_index_meta m ON m.card_id = v.card_id AND m.base_model_id = ?
       WHERE v.model_id = ? AND c.model_id = ? AND m.index_version >= ?`
    )
    .all(baseModelId, visualId, captionId, HYBRID_INDEX_VERSION) as Array<{
      card_id: string;
      visual: Buffer;
      caption: Buffer;
    }>;

  return rows.map((row) => ({
    cardId: row.card_id,
    visual: blobToVector(row.visual),
    caption: blobToVector(row.caption)
  }));
}

export function listLegacyHeavyEmbeddings(
  db: Database.Database,
  baseModelId: string
): CardEmbeddingRow[] {
  const rows = db
    .prepare(
      `SELECT e.card_id, e.model_id, e.vector, e.created_at
       FROM card_embeddings e
       LEFT JOIN card_hybrid_index_meta m ON m.card_id = e.card_id AND m.base_model_id = ?
       WHERE e.model_id = ? AND m.card_id IS NULL`
    )
    .all(baseModelId, baseModelId) as Array<{
      card_id: string;
      model_id: string;
      vector: Buffer;
      created_at: string;
    }>;

  return rows.map((row) => ({
    cardId: row.card_id,
    modelId: row.model_id,
    vector: blobToVector(row.vector),
    createdAt: row.created_at
  }));
}

export function listCardsMissingHybridEmbedding(
  db: Database.Database,
  baseModelId: string,
  limit: number
): string[] {
  const visualId = hybridVisualModelId(baseModelId);
  const captionId = hybridCaptionModelId(baseModelId);
  const rows = db
    .prepare(
      `SELECT c.id FROM cards c
       LEFT JOIN card_hybrid_index_meta m ON m.card_id = c.id AND m.base_model_id = ?
       LEFT JOIN card_embeddings ev ON ev.card_id = c.id AND ev.model_id = ?
       LEFT JOIN card_embeddings ec ON ec.card_id = c.id AND ec.model_id = ?
       WHERE c.is_deleted = 0 AND c.type = 'image'
         AND (m.card_id IS NULL OR ev.card_id IS NULL OR ec.card_id IS NULL
              OR m.index_version < ?)
       ORDER BY c.added_at DESC
       LIMIT ?`
    )
    .all(baseModelId, visualId, captionId, HYBRID_INDEX_VERSION, limit) as Array<{ id: string }>;
  return rows.map((r) => r.id);
}

export function getCardTagNames(db: Database.Database, cardId: string): string[] {
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       INNER JOIN card_tags ct ON ct.tag_id = t.id
       WHERE ct.card_id = ?
       ORDER BY t.name COLLATE NOCASE`
    )
    .all(cardId) as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
