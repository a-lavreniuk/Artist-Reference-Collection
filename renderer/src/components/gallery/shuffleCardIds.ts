function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Детерминированное перемешивание ID: один seed + один набор ID → один порядок. */
export function shuffleCardIds(ids: readonly string[], seed: number): string[] {
  const ordered = [...ids].sort((a, b) => a.localeCompare(b));
  const rng = mulberry32(seed);
  for (let i = ordered.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered;
}

export function orderRecordsByIds<T extends { id: string }>(
  records: readonly T[],
  orderedIds: readonly string[]
): T[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  return orderedIds.map((id) => byId.get(id)).filter((r): r is T => r != null);
}

export function newShuffleSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] ?? 0;
  }
  return Date.now() >>> 0;
}
