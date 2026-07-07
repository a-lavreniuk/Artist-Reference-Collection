import type Database from 'better-sqlite3';

const registeredDbs = new WeakSet<Database.Database>();

/** Детерминированный числовой ключ для ORDER BY при сортировке «перемешать». */
export function shuffleSortKeyForId(id: string, seed: number): number {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (let i = 0; i < id.length; i += 1) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 15;
    h >>>= 0;
  }
  return h >>> 0;
}

export function ensureShuffleSqlFunctions(db: Database.Database): void {
  if (registeredDbs.has(db)) return;
  registeredDbs.add(db);
  db.function('arc_shuffle_key', { deterministic: true, varargs: true }, (id: unknown, seed: unknown) => {
    if (typeof id !== 'string') return 0;
    const s = typeof seed === 'number' && Number.isFinite(seed) ? seed : 0;
    return shuffleSortKeyForId(id, s);
  });
}
